'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './ot.module.css';

interface Patient {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
}

interface Admission {
  id: string;
  patient: Patient;
}

interface OtRoom {
  id: string;
  roomNo: string;
  type: string;
}

interface User {
  name: string;
}

interface DoctorProfile {
  user: User;
}

interface Assistant {
  doctor: DoctorProfile;
}

interface OtCase {
  id: string;
  admissionId: string;
  otRoomId: string | null;
  leadDoctorId: string | null;
  procedureName: string;
  anaesthetist: string | null;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  status: 'scheduled' | 'preparing' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  notes: string | null;
  admission: Admission;
  otRoom: OtRoom | null;
  leadDoctor: DoctorProfile | null;
  assistants: Assistant[];
  isLead: boolean;
}

interface Props {
  initialOtCases: OtCase[];
  doctorId: string;
}

export default function OtScheduleClient({ initialOtCases, doctorId }: Props) {
  const router = useRouter();
  const [otCases, setOtCases] = useState<OtCase[]>(initialOtCases);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [editingCase, setEditingCase] = useState<OtCase | null>(null);
  const [status, setStatus] = useState<OtCase['status']>('scheduled');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Auto-refresh polling ──
  const refreshOtCases = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/doctor/ot');
      if (res.ok) {
        const data = await res.json();
        setOtCases(data.otCases);
      }
    } catch { /* silently skip */ }
  }, []);

  useEffect(() => {
    const id = setInterval(refreshOtCases, 15_000);
    return () => clearInterval(id);
  }, [refreshOtCases]);

  // ── Filters ──
  const filteredCases = otCases.filter(ot => {
    const matchesSearch = ot.admission.patient.name.toLowerCase().includes(search.toLowerCase()) ||
                          ot.procedureName.toLowerCase().includes(search.toLowerCase()) ||
                          (ot.otRoom?.roomNo ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ot.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ── Handlers ──
  const openEditModal = (ot: OtCase) => {
    setEditingCase(ot);
    setStatus(ot.status);
    setNotes(ot.notes || '');
    setError('');
  };

  const closeEditModal = () => {
    setEditingCase(null);
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCase) return;

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/portal/doctor/ot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otCaseId: editingCase.id,
          status,
          notes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update OT case');
      }

      const data = await res.json();

      // Update local state
      setOtCases(prev =>
        prev.map(c =>
          c.id === editingCase.id
            ? { ...c, status: data.otCase.status, notes: data.otCase.notes }
            : c
        )
      );

      closeEditModal();
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
          <h1 className={styles.title}>OT Schedule</h1>
          <p className={styles.subtitle}>Track scheduled procedures, room assignments, and update case logs</p>
        </div>
      </header>

      {/* Filters bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search patient, procedure, room..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
          className={styles.selectInput}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="preparing">Preparing</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="delayed">Delayed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Cases list */}
      <div className={styles.grid}>
        {filteredCases.length === 0 ? (
          <div className={styles.empty}>
            <p>No OT procedures scheduled matching the filter criteria.</p>
          </div>
        ) : (
          filteredCases.map(ot => (
            <div key={ot.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.timeRoom}>
                  <span className={styles.time}>{ot.scheduledTime || 'N/A'}</span>
                  <span className={styles.roomBadge}>{ot.otRoom?.roomNo || 'TBD'}</span>
                </div>
                <span className={`${styles.statusBadge} ${styles[ot.status]}`}>
                  {ot.status.replace('_', ' ')}
                </span>
              </div>

              <div className={styles.cardBody}>
                <h3 className={styles.procedureTitle}>{ot.procedureName}</h3>

                <div className={styles.metaSection}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Patient:</span>
                    <span className={styles.metaVal}>
                      {ot.admission.patient.name} ({ot.admission.patient.age} yrs • {ot.admission.patient.gender})
                    </span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Lead Surgeon:</span>
                    <span className={styles.metaVal}>
                      Dr. {ot.leadDoctor?.user.name} {ot.isLead && <span className={styles.selfBadge}>(You)</span>}
                    </span>
                  </div>
                  {ot.assistants.length > 0 && (
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Assistants:</span>
                      <span className={styles.metaVal}>
                        {ot.assistants.map(a => `Dr. ${a.doctor.user.name}`).join(', ')}
                      </span>
                    </div>
                  )}
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Anaesthetist:</span>
                    <span className={styles.metaVal}>{ot.anaesthetist || 'N/A'}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Duration:</span>
                    <span className={styles.metaVal}>{ot.estimatedDuration ? `${ot.estimatedDuration} mins` : 'N/A'}</span>
                  </div>
                </div>

                {ot.notes && (
                  <div className={styles.notesBlock}>
                    <h4 className={styles.notesTitle}>Clinical Notes:</h4>
                    <p className={styles.notesText}>{ot.notes}</p>
                  </div>
                )}
              </div>

              <div className={styles.cardFooter}>
                <button
                  className={styles.actionBtn}
                  onClick={() => openEditModal(ot)}
                >
                  Update Log
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit OT Log Modal */}
      {editingCase && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <form onSubmit={handleSave}>
              <div className={styles.modalHeader}>
                <div>
                  <h3 className={styles.modalTitle}>Update OT Case Log: {editingCase.procedureName}</h3>
                  <p className={styles.modalSubtitle}>
                    Patient: {editingCase.admission.patient.name} • Room: {editingCase.otRoom?.roomNo}
                  </p>
                </div>
                <button type="button" className={styles.closeBtn} onClick={closeEditModal}>×</button>
              </div>

              <div className={styles.modalBody}>
                {error && <div className={styles.errorBox}>{error}</div>}

                <div className={styles.field}>
                  <label className={styles.label}>Procedure Status</label>
                  <select
                    className={styles.input}
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="preparing">Preparing</option>
                    <option value="in_progress">🟢 In Progress</option>
                    <option value="completed">⚪ Completed</option>
                    <option value="delayed">🟡 Delayed</option>
                    <option value="cancelled">🔴 Cancelled</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Surgical / Post-Op Notes</label>
                  <textarea
                    className={`${styles.input} ${styles.textarea}`}
                    rows={5}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Enter operation details, anaesthesia notes, recovery notes, etc..."
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={closeEditModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.completeBtn}
                  disabled={saving}
                >
                  {saving ? 'Updating...' : 'Update OT Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
