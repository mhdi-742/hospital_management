'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './opd.module.css';

interface Patient {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  contact: string | null;
  address: string | null;
  bloodGroup: string | null;
  chiefComplaint: string | null;
  diagnosis: string | null;
}

interface Admission {
  id: string;
  patientId: string;
  opdSessionId?: string; // We added this to the API
  admittedAt: string;
  patient: Patient;
}

interface OpdSession {
  id: string;
  startTime: string;
  endTime: string;
  status: 'upcoming' | 'running' | 'break' | 'completed' | 'unavailable';
  currentToken: number | null;
  totalTokens: number;
  avgWaitMinutes: number;
}

interface Props {
  initialSessions: OpdSession[];
  initialQueue: Admission[];
}

export default function OpdSessionClient({ initialSessions, initialQueue }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState<OpdSession[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initialSessions.length > 0 ? initialSessions[0].id : null
  );
  const [queue, setQueue] = useState<Admission[]>(initialQueue);

  // New/Edit session form fields
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('13:00');

  // Examination Modal state
  const [examiningAdmission, setExaminingAdmission] = useState<Admission | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [saving, setSaving] = useState(false);

  // Loading/submitting states
  const [updatingSession, setUpdatingSession] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [error, setError] = useState('');

  // ── Derived State ──
  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const activeQueue = queue.filter(q => q.opdSessionId === activeSessionId);
  const waitingCount = activeSession
    ? Math.max(0, activeSession.totalTokens - (activeSession.currentToken ?? 0))
    : 0;

  // ── Handlers ──

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    setCreatingSession(true);
    setError('');

    try {
      const res = await fetch('/api/portal/doctor/opd-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: newStartTime,
          endTime: newEndTime,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to start session');
      }

      const data = await res.json();
      setSessions([...sessions, data.session]);
      setActiveSessionId(data.session.id);
      setShowAddModal(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingSession(false);
    }
  }

  async function updateSessionField(fields: any) {
    if (!activeSessionId) return;
    setUpdatingSession(true);
    setError('');

    try {
      const res = await fetch('/api/portal/doctor/opd-session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, sessionId: activeSessionId }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update session');
      }

      const data = await res.json();
      setSessions(prev => prev.map(s => (s.id === data.session.id ? data.session : s)));
      setShowEditModal(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingSession(false);
    }
  }

  const handleDeleteSession = async () => {
    if (!activeSession) return;
    if (!confirm('Are you sure you want to delete this session? Any waiting patients will be removed from this queue.')) return;

    setUpdatingSession(true);
    setError('');

    try {
      const res = await fetch(`/api/portal/doctor/opd-session?sessionId=${activeSession.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete session');
      }

      const updatedSessions = sessions.filter(s => s.id !== activeSession.id);
      setSessions(updatedSessions);
      setActiveSessionId(updatedSessions.length > 0 ? updatedSessions[0].id : null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingSession(false);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSessionField({ startTime: newStartTime, endTime: newEndTime });
  };

  const openEditModal = () => {
    if (!activeSession) return;
    setNewStartTime(activeSession.startTime);
    setNewEndTime(activeSession.endTime);
    setShowEditModal(true);
  };

  const openAddModal = () => {
    setNewStartTime('09:00');
    setNewEndTime('13:00');
    setShowAddModal(true);
  };

  const handleStatusChange = (status: string) => {
    updateSessionField({ status });
  };

  const handleCallNextPatient = () => {
    updateSessionField({ incrementToken: true });
  };

  const handleUndoCallPatient = () => {
    updateSessionField({ decrementToken: true });
  };

  const openExamineModal = (adm: Admission) => {
    setExaminingAdmission(adm);
    setChiefComplaint(adm.patient.chiefComplaint || '');
    setDiagnosis(adm.patient.diagnosis || '');
  };

  const closeExamineModal = () => {
    setExaminingAdmission(null);
  };

  async function handleSaveConsultation(action: 'save' | 'discharge') {
    if (!examiningAdmission) return;
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/portal/doctor/consultation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admissionId: examiningAdmission.id,
          chiefComplaint,
          diagnosis,
          action,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save consultation');
      }

      // If patient is discharged (completed), remove from client queue state
      if (action === 'discharge') {
        setQueue(prev => prev.filter(a => a.id !== examiningAdmission.id));
        closeExamineModal();
      } else {
        // Just update local queue state
        setQueue(prev =>
          prev.map(a =>
            a.id === examiningAdmission.id
              ? {
                ...a,
                patient: { ...a.patient, chiefComplaint, diagnosis },
              }
              : a
          )
        );
        // Show success alert or close
        closeExamineModal();
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerActions}>
          <div>
            <h1 className={styles.title}>OPD Session Control</h1>
            <p className={styles.subtitle}>Manage your schedule and examine patients</p>
          </div>
        </div>
      </header>

      {error && <div className={styles.errorBox}>{error}</div>}

      {/* Tabs */}
      <div className={styles.tabs}>
        {sessions.map(s => (
          <button
            key={s.id}
            className={`${styles.tab} ${activeSessionId === s.id ? styles.tabActive : ''}`}
            onClick={() => setActiveSessionId(s.id)}
          >
            {s.startTime} - {s.endTime}
          </button>
        ))}
        <button className={`${styles.tab} ${styles.addTab}`} onClick={openAddModal}>
          + Add Session
        </button>
      </div>

      {!activeSession ? (
        <div className={styles.startCard}>
          <h2 className={styles.cardTitle}>No Session Selected</h2>
          <p className={styles.cardDesc}>
            Click "+ Add Session" above to schedule a new OPD shift for today.
          </p>
        </div>
      ) : (
        /* ── Active Session Control ── */
        <div className={styles.mainGrid}>
          {/* Left panel: Session stats and control */}
          <div className={styles.controlPanel}>
            <div className={styles.sectionCard}>
              <div className={styles.panelHeader}>
                <h2 className={styles.cardTitle}>Session Settings</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className={styles.secondaryBtn} onClick={openEditModal} disabled={updatingSession}>
                    ✏️ Edit
                  </button>
                  <button className={styles.dangerBtn} onClick={handleDeleteSession} disabled={updatingSession}>
                    🗑️ Delete
                  </button>
                </div>
              </div>

              <div className={styles.controlGroup}>
                <label className={styles.label}>Session Status</label>
                <select
                  className={`${styles.input} ${styles.statusSelect}`}
                  value={activeSession.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={updatingSession}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="running">Running</option>
                  <option value="break">On Break</option>
                  <option value="completed">Completed</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>

              <div className={styles.actionRow}>
                <button
                  className={styles.nextBtn}
                  onClick={handleCallNextPatient}
                  disabled={updatingSession || (activeSession.currentToken ?? 0) >= activeSession.totalTokens}
                >
                  🔔 Call Next
                </button>
                <button
                  className={styles.undoBtn}
                  onClick={handleUndoCallPatient}
                  disabled={updatingSession || (activeSession.currentToken ?? 0) <= 0}
                  title="Undo Call (Go back one token)"
                >
                  ↩️ Undo
                </button>
              </div>
            </div>

            <div className={styles.sectionCard}>
              <h2 className={styles.cardTitle}>Queue Status</h2>
              <div className={styles.grid2}>
                <div className={styles.statBox}>
                  <div className={styles.statVal}>{activeSession.currentToken ?? '—'}</div>
                  <div className={styles.statLbl}>Now Serving</div>
                </div>
                <div className={styles.statBox}>
                  <div className={styles.statVal}>{activeSession.totalTokens}</div>
                  <div className={styles.statLbl}>Total Registered</div>
                </div>
              </div>
              <div className={styles.grid2} style={{ marginTop: '0.75rem' }}>
                <div className={styles.statBox}>
                  <div className={styles.statVal}>{waitingCount}</div>
                  <div className={styles.statLbl}>Waiting</div>
                </div>
                <div className={styles.statBox}>
                  <div className={styles.statVal}>{activeSession.startTime}</div>
                  <div className={styles.statLbl}>Start Time</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: Queue list */}
          <div className={styles.queuePanel}>
            <div className={styles.sectionCard}>
              <div className={styles.panelHeader}>
                <h2 className={styles.cardTitle}>Active Patient Queue</h2>
                <span className={styles.queueCount}>{activeQueue.length} waiting</span>
              </div>

              {activeQueue.length === 0 ? (
                <div className={styles.emptyQueue}>
                  <p>Queue is empty. Patients will appear here once the receptionist registers them.</p>
                </div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Patient Details</th>
                        <th>Registered At</th>
                        <th>Complaint</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeQueue.map((item, idx) => (
                        <tr key={item.id} className={styles.tableRow}>
                          <td>
                            <div className={styles.patientName}>{item.patient.name}</div>
                            <div className={styles.patientMeta}>
                              Token #{idx + 1} • {item.patient.age || 'N/A'} yrs • {item.patient.gender || 'Unknown'}
                            </div>
                          </td>
                          <td className={styles.timeCol}>
                            {new Date(item.admittedAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className={styles.complaintCol}>
                            {item.patient.chiefComplaint || 'No chief complaint recorded.'}
                          </td>
                          <td>
                            <button
                              className={styles.examineBtn}
                              onClick={() => openExamineModal(item)}
                            >
                              Examine
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>
                  {showAddModal ? 'Schedule New Session' : 'Edit Session Times'}
                </h3>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={showAddModal ? handleCreateSession : handleEditSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Start Time</label>
                    <input
                      type="time"
                      className={styles.input}
                      value={newStartTime}
                      onChange={e => setNewStartTime(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>End Time</label>
                    <input
                      type="time"
                      className={styles.input}
                      value={newEndTime}
                      onChange={e => setNewEndTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={creatingSession || updatingSession}>
                  {creatingSession || updatingSession ? 'Saving...' : 'Save Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Examine Modal */}
      {examiningAdmission && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Examine: {examiningAdmission.patient.name}</h3>
                <p className={styles.modalSubtitle}>
                  {examiningAdmission.patient.age} years old • {examiningAdmission.patient.gender} • Blood: {examiningAdmission.patient.bloodGroup || 'Unknown'}
                </p>
              </div>
              <button className={styles.closeBtn} onClick={closeExamineModal}>×</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Chief Complaint</label>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  rows={3}
                  value={chiefComplaint}
                  onChange={e => setChiefComplaint(e.target.value)}
                  placeholder="Patient's primary complaint..."
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Diagnosis & Clinical Findings</label>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  rows={4}
                  value={diagnosis}
                  onChange={e => setDiagnosis(e.target.value)}
                  placeholder="Enter medical assessment, prescription details, or clinical findings..."
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.secondaryBtn}
                onClick={closeExamineModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={() => handleSaveConsultation('save')}
                disabled={saving}
              >
                Save Draft
              </button>
              <button
                className={styles.completeBtn}
                onClick={() => handleSaveConsultation('discharge')}
                disabled={saving}
              >
                Complete & Discharge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
