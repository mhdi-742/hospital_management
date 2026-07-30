'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './opd-sessions.module.css';

/* ── Types ────────────────────────────────────────────────────────────── */
interface OpdSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  opdNo?: string | null;
  floor?: string | null;
  status: 'upcoming' | 'running' | 'break' | 'completed' | 'unavailable';
  currentToken: number | null;
  totalTokens: number;
  avgWaitMinutes: number;
}

interface DoctorWithSessions {
  id: string;
  name: string;
  designation: string;
  departmentName: string;
  departmentColor: string;
  sessions: OpdSession[];
}

interface QueueAdmission {
  id: string;
  patientId: string;
  opdSessionId: string | null;
  tokenNo?: number | null;
  admittedAt: string;
  patient: {
    id: string;
    name: string;
    age: number | null;
    gender: string | null;
    chiefComplaint: string | null;
  };
}

interface Props {
  initialDoctors: DoctorWithSessions[];
  initialQueue: QueueAdmission[];
}

/* ── Date formatter ──────────────────────────────────────────────────── */
function formatSessionDate(dateStr: string): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const d = new Date(dateStr + 'T00:00:00');
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Status dot classes ───────────────────────────────────────────────── */
const STATUS_DOT: Record<string, string> = {
  running:     styles.dotRunning,
  upcoming:    styles.dotUpcoming,
  break:       styles.dotBreak,
  completed:   styles.dotCompleted,
  unavailable: styles.dotUnavailable,
};

/* ── Main Component ───────────────────────────────────────────────────── */
export default function OpdSessionsClient({ initialDoctors, initialQueue }: Props) {
  const [doctors, setDoctors] = useState<DoctorWithSessions[]>(initialDoctors);
  const [queue, setQueue] = useState<QueueAdmission[]>(initialQueue);

  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(
    initialDoctors.length > 0 ? initialDoctors[0].id : null
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const first = initialDoctors[0];
    return first?.sessions[0]?.id ?? null;
  });

  /* Modal state */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  /* Form fields */
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('13:00');
  const [formOpdNo, setFormOpdNo] = useState('');
  const [formFloor, setFormFloor] = useState('');
  const [formDoctorId, setFormDoctorId] = useState('');

  /* Loading / error */
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  /* ── Data refresh ────────────────────────────────────────────────────── */
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/admission/opd-sessions');
      if (res.ok) {
        const data = await res.json();
        setDoctors(data.doctors);
        setQueue(data.queue);
      }
    } catch { /* silently skip */ }
  }, []);

  useEffect(() => {
    const evtSource = new EventSource('/api/events');
    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'REFRESH_OPD') refreshData();
      } catch { /* non-json ping */ }
    };
    return () => evtSource.close();
  }, [refreshData]);

  /* ── Derived state ───────────────────────────────────────────────────── */
  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId) ?? null;
  const activeSession = selectedDoctor?.sessions.find(s => s.id === activeSessionId) ?? null;
  const sessionQueue = queue.filter(q => q.opdSessionId === activeSessionId);

  const currentToken = activeSession?.currentToken ?? 0;
  const waitingQueue = sessionQueue.filter((_, i) => i + 1 >= currentToken);
  const completedQueue = sessionQueue.filter((_, i) => i + 1 < currentToken);

  /* Drag and Drop queue reordering state */
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const waitingCount = activeSession
    ? Math.max(0, activeSession.totalTokens - (activeSession.currentToken ?? 0))
    : 0;

  const handleReorderQueue = async (newWaitingList: QueueAdmission[]) => {
    if (!activeSessionId) return;

    // Optimistically update local state
    const otherAdmissions = queue.filter(q => q.opdSessionId !== activeSessionId);
    const updatedSessionQueue = [...completedQueue, ...newWaitingList];
    setQueue([...otherAdmissions, ...updatedSessionQueue]);

    try {
      await fetch('/api/portal/admission/rearrange-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          orderedAdmissionIds: newWaitingList.map(item => item.id),
        }),
      });
    } catch (err) {
      console.error('[OPD_REARRANGE_ERR]', err);
    }
  };

  const handleDropRow = (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newWaiting = [...waitingQueue];
    const [movedItem] = newWaiting.splice(draggedIdx, 1);
    newWaiting.splice(targetIdx, 0, movedItem);

    setDraggedIdx(null);
    setDragOverIdx(null);
    handleReorderQueue(newWaiting);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= waitingQueue.length) return;

    const newWaiting = [...waitingQueue];
    const [movedItem] = newWaiting.splice(index, 1);
    newWaiting.splice(targetIndex, 0, movedItem);

    handleReorderQueue(newWaiting);
  };

  /* ── Select a doctor ─────────────────────────────────────────────────── */
  const selectDoctor = (doctorId: string) => {
    setSelectedDoctorId(doctorId);
    setError('');
    const doc = doctors.find(d => d.id === doctorId);
    setActiveSessionId(doc?.sessions[0]?.id ?? null);
  };

  /* ── API calls ───────────────────────────────────────────────────────── */
  async function apiPatch(fields: Record<string, any>) {
    if (!activeSessionId) return;
    setUpdating(true);
    setError('');
    try {
      const res = await fetch('/api/portal/admission/opd-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, ...fields }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      const data = await res.json();
      // Update local sessions state
      setDoctors(prev => prev.map(d => ({
        ...d,
        sessions: d.sessions.map(s => s.id === data.session.id ? { ...s, ...data.session } : s),
      })));
      setShowEditModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  }

  const handleStatusChange = (status: string) => apiPatch({ status });
  const handleCallNext = () => apiPatch({ incrementToken: true });
  const handleUndo = () => apiPatch({ decrementToken: true });

  const handleDelete = async () => {
    if (!activeSession) return;
    if (!confirm('Delete this session? Patients in queue will be unlinked.')) return;
    setUpdating(true);
    setError('');
    try {
      const res = await fetch(`/api/portal/admission/opd-sessions?sessionId=${activeSession.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
      setDoctors(prev => prev.map(d => ({
        ...d,
        sessions: d.sessions.filter(s => s.id !== activeSession.id),
      })));
      const remaining = selectedDoctor?.sessions.filter(s => s.id !== activeSession.id) ?? [];
      setActiveSessionId(remaining[0]?.id ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  /* Create session */
  const openCreateModal = () => {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormStartTime('09:00');
    setFormEndTime('13:00');
    setFormOpdNo('');
    setFormFloor('');
    setFormDoctorId(selectedDoctorId ?? doctors[0]?.id ?? '');
    setShowCreateModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/portal/admission/opd-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: formDoctorId,
          date: formDate,
          startTime: formStartTime,
          endTime: formEndTime,
          opdNo: formOpdNo,
          floor: formFloor,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create session');
      const data = await res.json();
      const newSess = data.session as OpdSession;
      setDoctors(prev => prev.map(d =>
        d.id === formDoctorId ? { ...d, sessions: [...d.sessions, newSess] } : d
      ));
      if (formDoctorId === selectedDoctorId) setActiveSessionId(newSess.id);
      setShowCreateModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* Edit session */
  const openEditModal = () => {
    if (!activeSession) return;
    setFormDate(activeSession.date);
    setFormStartTime(activeSession.startTime);
    setFormEndTime(activeSession.endTime);
    setFormOpdNo(activeSession.opdNo ?? '');
    setFormFloor(activeSession.floor ?? '');
    setShowEditModal(true);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    apiPatch({
      date: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      opdNo: formOpdNo,
      floor: formFloor,
    });
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>OPD Session Management</h1>
          <p className={styles.subtitle}>Manage doctor sessions, queues, and token calling</p>
        </div>
        <button className={styles.createSessionBtn} onClick={openCreateModal}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Session
        </button>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.splitLayout}>
        {/* ── Left: Doctor list ── */}
        <div className={styles.doctorListPanel}>
          <div className={styles.doctorListHeader}>
            <p className={styles.panelTitle}>Doctors</p>
            <span className={styles.doctorCount}>{doctors.length}</span>
          </div>
          <div className={styles.doctorList}>
            {doctors.map(doc => {
              const hasSession = doc.sessions.length > 0;
              const isRunning = doc.sessions.some(s => s.status === 'running');
              return (
                <div
                  key={doc.id}
                  className={`${styles.doctorItem} ${selectedDoctorId === doc.id ? styles.doctorItemActive : ''}`}
                  onClick={() => selectDoctor(doc.id)}
                >
                  <div
                    className={styles.doctorAvatar}
                    style={{ background: doc.departmentColor }}
                  >
                    {doc.name.charAt(0)}
                  </div>
                  <div className={styles.doctorItemInfo}>
                    <div className={styles.doctorItemName}>{doc.name}</div>
                    <div className={styles.doctorItemDept}>{doc.departmentName}</div>
                  </div>
                  <span className={`${styles.sessionCountBadge} ${hasSession ? styles.sessionBadgeActive : styles.sessionBadgeNone}`}>
                    {hasSession
                      ? isRunning ? '● Live' : `${doc.sessions.length} session${doc.sessions.length > 1 ? 's' : ''}`
                      : 'No session'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: Session management ── */}
        <div className={styles.rightPanel}>
          {!selectedDoctor ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>🏥</div>
              <p className={styles.emptyStateTitle}>Select a Doctor</p>
              <p className={styles.emptyStateDesc}>Choose a doctor from the list to manage their OPD sessions.</p>
            </div>
          ) : (
            <>
              {/* Doctor header */}
              <div className={styles.doctorHeader}>
                <div className={styles.doctorHeaderLeft}>
                  <div
                    className={styles.doctorHeaderAvatar}
                    style={{ background: selectedDoctor.departmentColor }}
                  >
                    {selectedDoctor.name.charAt(0)}
                  </div>
                  <div>
                    <p className={styles.doctorHeaderName}>{selectedDoctor.name}</p>
                    <p className={styles.doctorHeaderMeta}>{selectedDoctor.designation}</p>
                  </div>
                  <span
                    className={styles.deptPill}
                    style={{ color: selectedDoctor.departmentColor }}
                  >
                    {selectedDoctor.departmentName}
                  </span>
                </div>
                <button className={styles.createSessionBtn} onClick={openCreateModal}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Add Session
                </button>
              </div>

              {/* Session tabs */}
              {selectedDoctor.sessions.length > 0 && (
                <div className={styles.sessionTabs}>
                  {selectedDoctor.sessions.map(s => (
                    <button
                      key={s.id}
                      className={`${styles.sessionTab} ${activeSessionId === s.id ? styles.sessionTabActive : ''}`}
                      onClick={() => { setActiveSessionId(s.id); setError(''); }}
                    >
                      <span className={`${styles.statusDot} ${STATUS_DOT[s.status] ?? ''}`} />
                      <span>
                        <strong>{formatSessionDate(s.date)}</strong>
                        {' · '}{s.opdNo ? `${s.opdNo} · ` : ''}{s.startTime}–{s.endTime}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* No session */}
              {selectedDoctor.sessions.length === 0 && (
                <div className={styles.noSessionCard}>
                  <p className={styles.noSessionText}>No upcoming sessions scheduled.</p>
                  <button className={styles.createSessionBtn} onClick={openCreateModal}>
                    + Create a Session
                  </button>
                </div>
              )}

              {/* Session control */}
              {activeSession && (
                <div className={styles.sessionControlGrid}>
                  {/* Control panel */}
                  <div className={styles.card}>
                    <div className={styles.cardTitle}>
                      <span>
                        Session Control
                        <span style={{ fontWeight: 400, fontSize: '0.82rem', marginLeft: '0.6rem', opacity: 0.7 }}>
                          {formatSessionDate(activeSession.date)} · {activeSession.startTime}–{activeSession.endTime}
                        </span>
                      </span>
                      <div className={styles.cardActions}>
                        <button className={styles.editBtn} onClick={openEditModal} disabled={updating}>✏️ Edit</button>
                        <button className={styles.dangerBtn} onClick={handleDelete} disabled={updating}>🗑️</button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className={styles.statsGrid}>
                      <div className={styles.statBox}>
                        <div className={styles.statVal}>{activeSession.currentToken ?? '—'}</div>
                        <div className={styles.statLbl}>Now Serving</div>
                      </div>
                      <div className={styles.statBox}>
                        <div className={styles.statVal}>{activeSession.totalTokens}</div>
                        <div className={styles.statLbl}>Total</div>
                      </div>
                      <div className={styles.statBox}>
                        <div className={styles.statVal}>{waitingCount}</div>
                        <div className={styles.statLbl}>Waiting</div>
                      </div>
                      <div className={styles.statBox}>
                        <div className={styles.statVal} style={{ fontSize: '0.9rem' }}>
                          {activeSession.floor || activeSession.opdNo || '—'}
                        </div>
                        <div className={styles.statLbl}>{activeSession.floor ? 'Floor' : 'Room'}</div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className={styles.controlGroup}>
                      <span className={styles.label}>Status</span>
                      <select
                        className={styles.select}
                        value={activeSession.status}
                        onChange={e => handleStatusChange(e.target.value)}
                        disabled={updating}
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="running">Running</option>
                        <option value="break">On Break</option>
                        <option value="completed">Completed</option>
                        <option value="unavailable">Unavailable</option>
                      </select>
                    </div>

                    {/* Call next / undo */}
                    <div className={styles.actionRow}>
                      <button
                        className={styles.nextBtn}
                        onClick={handleCallNext}
                        disabled={updating || (activeSession.currentToken ?? 0) >= activeSession.totalTokens}
                      >
                        🔔 Call Next
                      </button>
                      <button
                        className={styles.undoBtn}
                        onClick={handleUndo}
                        disabled={updating || (activeSession.currentToken ?? 0) <= 0}
                        title="Undo last call"
                      >
                        ↩️
                      </button>
                    </div>
                  </div>

                  {/* Queue panel */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Waiting */}
                    <div className={styles.card}>
                      <div className={styles.cardTitle}>
                        Waiting Queue
                        <span className={`${styles.queueBadge} ${styles.waitingBadge}`}>
                          {waitingQueue.length} waiting
                        </span>
                      </div>
                      {waitingQueue.length === 0 ? (
                        <div className={styles.emptyQueue}>No patients waiting</div>
                      ) : (
                        <div className={styles.tableWrapper}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th style={{ width: '70px', textAlign: 'center' }}>Reorder</th>
                                <th>Token</th>
                                <th>Patient</th>
                                <th>Complaint</th>
                                <th>Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {waitingQueue.map((item, idx) => {
                                const tokenNo = item.tokenNo ?? (idx + (completedQueue.length + 1));
                                const isServing = tokenNo === currentToken;
                                return (
                                  <tr
                                    key={item.id}
                                    draggable
                                    onDragStart={() => setDraggedIdx(idx)}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      setDragOverIdx(idx);
                                    }}
                                    onDragEnd={() => {
                                      setDraggedIdx(null);
                                      setDragOverIdx(null);
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      handleDropRow(idx);
                                    }}
                                    className={`${isServing ? styles.rowServing : ''} ${
                                      draggedIdx === idx ? styles.draggingRow : ''
                                    } ${dragOverIdx === idx ? styles.dragOverRow : ''}`}
                                  >
                                    <td style={{ textAlign: 'center' }}>
                                      <div className={styles.rearrangeGroup}>
                                        <span className={styles.dragHandle} title="Drag row to reorder queue">⋮⋮</span>
                                        <button
                                          type="button"
                                          className={styles.stepBtn}
                                          onClick={() => handleMoveStep(idx, 'up')}
                                          disabled={idx === 0}
                                          title="Move up"
                                        >
                                          ▲
                                        </button>
                                        <button
                                          type="button"
                                          className={styles.stepBtn}
                                          onClick={() => handleMoveStep(idx, 'down')}
                                          disabled={idx === waitingQueue.length - 1}
                                          title="Move down"
                                        >
                                          ▼
                                        </button>
                                      </div>
                                    </td>
                                    <td>
                                      <span className={styles.tokenBadge}>#{tokenNo}</span>
                                      {isServing && (
                                        <span className={styles.servingBadge} style={{ marginLeft: '6px' }}>Now</span>
                                      )}
                                    </td>
                                    <td>
                                      <div className={styles.patientName}>{item.patient.name}</div>
                                      <div className={styles.patientMeta}>
                                        {item.patient.age ? `${item.patient.age}y` : '—'} · {item.patient.gender ?? '—'}
                                      </div>
                                    </td>
                                    <td>
                                      <span className={styles.complaintText}>
                                        {item.patient.chiefComplaint || 'N/A'}
                                      </span>
                                    </td>
                                   <td style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                      {new Date(item.admittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                      {' '}{new Date(item.admittedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Completed */}
                    {completedQueue.length > 0 && (
                      <div className={styles.card}>
                        <div className={styles.cardTitle}>
                          Completed
                          <span className={`${styles.queueBadge} ${styles.completedBadge}`}>
                            {completedQueue.length} done
                          </span>
                        </div>
                        <div className={styles.tableWrapper}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th>Token</th>
                                <th>Patient</th>
                                <th>Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {completedQueue.map((item, idx) => (
                                <tr key={item.id} className={styles.rowCompleted}>
                                  <td><span className={styles.tokenBadge}>#{idx + 1}</span></td>
                                  <td>
                                    <div className={styles.patientName}>{item.patient.name}</div>
                                    <div className={styles.patientMeta}>
                                      {item.patient.age ? `${item.patient.age}y` : '—'} · {item.patient.gender ?? '—'}
                                    </div>
                                  </td>
                                  <td style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                    {new Date(item.admittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    {' '}{new Date(item.admittedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Create Session Modal ─────────────────────────────────────────── */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Create New Session</h3>
              <button className={styles.closeBtn} onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className={styles.modalBody}>
                <div className={styles.field}>
                  <label className={styles.label}>Doctor</label>
                  <select
                    className={styles.input}
                    value={formDoctorId}
                    onChange={e => setFormDoctorId(e.target.value)}
                    required
                  >
                    <option value="">Select a doctor…</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} — {d.departmentName}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Session Date</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Start Time</label>
                    <input type="time" className={styles.input} value={formStartTime} onChange={e => setFormStartTime(e.target.value)} required />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>End Time</label>
                    <input type="time" className={styles.input} value={formEndTime} onChange={e => setFormEndTime(e.target.value)} required />
                  </div>
                </div>
                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>OPD / Room No</label>
                    <input type="text" className={styles.input} value={formOpdNo} onChange={e => setFormOpdNo(e.target.value)} placeholder="e.g. OPD-01" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Floor</label>
                    <input type="text" className={styles.input} value={formFloor} onChange={e => setFormFloor(e.target.value)} placeholder="e.g. Floor 1" />
                  </div>
                </div>
                {error && <div className={styles.errorBox}>{error}</div>}
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => { setShowCreateModal(false); setError(''); }}>Cancel</button>
                <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Session Modal ───────────────────────────────────────────── */}
      {showEditModal && activeSession && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit Session</h3>
              <button className={styles.closeBtn} onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className={styles.modalBody}>
                <div className={styles.field}>
                  <label className={styles.label}>Session Date</label>
                  <input type="date" className={styles.input} value={formDate} onChange={e => setFormDate(e.target.value)} required />
                </div>
                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Start Time</label>
                    <input type="time" className={styles.input} value={formStartTime} onChange={e => setFormStartTime(e.target.value)} required />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>End Time</label>
                    <input type="time" className={styles.input} value={formEndTime} onChange={e => setFormEndTime(e.target.value)} required />
                  </div>
                </div>
                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>OPD / Room No</label>
                    <input type="text" className={styles.input} value={formOpdNo} onChange={e => setFormOpdNo(e.target.value)} placeholder="e.g. OPD-01" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Floor</label>
                    <input type="text" className={styles.input} value={formFloor} onChange={e => setFormFloor(e.target.value)} placeholder="e.g. Floor 1" />
                  </div>
                </div>
                {error && <div className={styles.errorBox}>{error}</div>}
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => { setShowEditModal(false); setError(''); }}>Cancel</button>
                <button type="submit" className={styles.primaryBtn} disabled={updating}>
                  {updating ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
