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
  initialSession: OpdSession | null;
  initialQueue: Admission[];
}

export default function OpdSessionClient({ initialSession, initialQueue }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<OpdSession | null>(initialSession);
  const [queue, setQueue] = useState<Admission[]>(initialQueue);

  // New session form fields
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('13:00');
  const [newTotalTokens, setNewTotalTokens] = useState('20');
  const [newAvgWait, setNewAvgWait] = useState('10');

  // Examination Modal state
  const [examiningAdmission, setExaminingAdmission] = useState<Admission | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [saving, setSaving] = useState(false);

  // Loading/submitting states
  const [updatingSession, setUpdatingSession] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [error, setError] = useState('');

  // ── Handlers ──

  async function handleStartSession(e: React.FormEvent) {
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
          totalTokens: newTotalTokens,
          avgWaitMinutes: newAvgWait,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to start session');
      }

      const data = await res.json();
      setSession(data.session);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingSession(false);
    }
  }

  async function updateSessionField(fields: any) {
    setUpdatingSession(true);
    setError('');

    try {
      const res = await fetch('/api/portal/doctor/opd-session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update session');
      }

      const data = await res.json();
      setSession(data.session);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingSession(false);
    }
  }

  const handleStatusChange = (status: string) => {
    updateSessionField({ status });
  };

  const handleIncrementToken = () => {
    updateSessionField({ incrementToken: true });
  };

  const handleSetToken = (val: string) => {
    const num = val === '' ? null : parseInt(val, 10);
    if (val === '' || (!isNaN(num!) && num! >= 0)) {
      updateSessionField({ currentToken: num });
    }
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
        <div>
          <h1 className={styles.title}>OPD Session Control</h1>
          <p className={styles.subtitle}>Manage today's patient queue and OPD session status</p>
        </div>
      </header>

      {error && <div className={styles.errorBox}>{error}</div>}

      {!session ? (
        /* ── Start Session Screen ── */
        <div className={styles.startCard}>
          <h2 className={styles.cardTitle}>No Active Session for Today</h2>
          <p className={styles.cardDesc}>
            Setup your OPD timings and patient limits to initialize today's consultation queue.
          </p>
          <form onSubmit={handleStartSession} className={styles.startForm}>
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
              <div className={styles.field}>
                <label className={styles.label}>Total Token Capacity</label>
                <input
                  type="number"
                  className={styles.input}
                  value={newTotalTokens}
                  onChange={e => setNewTotalTokens(e.target.value)}
                  min="1"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Avg Wait Time (mins)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={newAvgWait}
                  onChange={e => setNewAvgWait(e.target.value)}
                  min="1"
                />
              </div>
            </div>
            <button type="submit" className={styles.primaryBtn} disabled={creatingSession}>
              {creatingSession ? 'Starting Session...' : '🚀 Start OPD Session'}
            </button>
          </form>
        </div>
      ) : (
        /* ── Active Session Control ── */
        <div className={styles.mainGrid}>
          {/* Left panel: Session stats and control */}
          <div className={styles.controlPanel}>
            <div className={styles.sectionCard}>
              <h2 className={styles.cardTitle}>Session Settings</h2>

              <div className={styles.controlGroup}>
                <label className={styles.label}>Session Status</label>
                <select
                  className={`${styles.input} ${styles.statusSelect}`}
                  value={session.status}
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

              <div className={styles.controlGroup}>
                <label className={styles.label}>Current Active Token</label>
                <div className={styles.tokenController}>
                  <button
                    className={styles.tokenBtn}
                    onClick={() => handleSetToken(Math.max(0, (session.currentToken ?? 0) - 1).toString())}
                    disabled={updatingSession || (session.currentToken ?? 0) <= 0}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className={`${styles.input} ${styles.tokenInput}`}
                    value={session.currentToken ?? ''}
                    onChange={e => handleSetToken(e.target.value)}
                    placeholder="None"
                    disabled={updatingSession}
                  />
                  <button
                    className={styles.tokenBtn}
                    onClick={() => handleSetToken(((session.currentToken ?? 0) + 1).toString())}
                    disabled={updatingSession}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                className={styles.nextBtn}
                onClick={handleIncrementToken}
                disabled={updatingSession}
              >
                🔔 Call Next Patient
              </button>
            </div>

            <div className={styles.sectionCard}>
              <h2 className={styles.cardTitle}>Queue Performance</h2>
              <div className={styles.grid2}>
                <div className={styles.statBox}>
                  <div className={styles.statVal}>{session.totalTokens}</div>
                  <div className={styles.statLbl}>Total Capacity</div>
                </div>
                <div className={styles.statBox}>
                  <div className={styles.statVal}>{session.avgWaitMinutes}m</div>
                  <div className={styles.statLbl}>Avg Wait Time</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: Queue list */}
          <div className={styles.queuePanel}>
            <div className={styles.sectionCard}>
              <div className={styles.panelHeader}>
                <h2 className={styles.cardTitle}>Active Patient Queue</h2>
                <span className={styles.queueCount}>{queue.length} waiting</span>
              </div>

              {queue.length === 0 ? (
                <div className={styles.emptyQueue}>
                  <p>Queue is empty. No patients currently checked in for OPD.</p>
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
                      {queue.map((item, idx) => (
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
