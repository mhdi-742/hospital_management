'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './ipd.module.css';

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

interface Ward {
  id: string;
  name: string;
  code: string;
  roomNo: string | null;
  floorNo: string | null;
  accentColor: string;
}

interface Admission {
  id: string;
  patientId: string;
  admittedAt: string;
  bedNo: string | null;
  patientCondition: 'stable' | 'monitoring' | 'critical' | null;
  patient: Patient;
  ward: Ward | null;
  assignedRole: 'primary' | 'consultant';
}

interface Props {
  initialAdmissions: Admission[];
  doctorId: string;
}

export default function IpdPatientsClient({ initialAdmissions, doctorId }: Props) {
  const router = useRouter();
  const [admissions, setAdmissions] = useState<Admission[]>(initialAdmissions);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');

  // Modal State
  const [editingAdmission, setEditingAdmission] = useState<Admission | null>(null);
  const [condition, setCondition] = useState<'stable' | 'monitoring' | 'critical'>('stable');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Filters ──
  const filteredAdmissions = admissions.filter(adm => {
    const matchesSearch = adm.patient.name.toLowerCase().includes(search.toLowerCase()) ||
                          (adm.ward?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || adm.assignedRole === roleFilter;
    const matchesCondition = conditionFilter === 'all' || adm.patientCondition === conditionFilter;
    return matchesSearch && matchesRole && matchesCondition;
  });

  // ── Handlers ──
  const openEditModal = (adm: Admission) => {
    setEditingAdmission(adm);
    setCondition(adm.patientCondition || 'stable');
    setChiefComplaint(adm.patient.chiefComplaint || '');
    setDiagnosis(adm.patient.diagnosis || '');
    setError('');
  };

  const closeEditModal = () => {
    setEditingAdmission(null);
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAdmission) return;

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/portal/doctor/ipd', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admissionId: editingAdmission.id,
          condition,
          chiefComplaint,
          diagnosis,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update patient record');
      }

      const data = await res.json();

      // Update local state
      setAdmissions(prev =>
        prev.map(a =>
          a.id === editingAdmission.id
            ? {
                ...a,
                patientCondition: data.admission.patientCondition,
                patient: {
                  ...a.patient,
                  chiefComplaint: data.admission.patient.chiefComplaint,
                  diagnosis: data.admission.patient.diagnosis,
                },
              }
            : a
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
          <h1 className={styles.title}>My IPD Patients</h1>
          <p className={styles.subtitle}>Track and update status of admitted patients assigned to you</p>
        </div>
      </header>

      {/* Filters bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by name, ward..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className={styles.selects}>
          <select
            className={styles.selectInput}
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="primary">Primary Doctor</option>
            <option value="consultant">Consultant</option>
          </select>

          <select
            className={styles.selectInput}
            value={conditionFilter}
            onChange={e => setConditionFilter(e.target.value)}
          >
            <option value="all">All Conditions</option>
            <option value="stable">Stable</option>
            <option value="monitoring">Monitoring</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Patients Table */}
      <div className={styles.card}>
        {filteredAdmissions.length === 0 ? (
          <div className={styles.empty}>
            <p>No active IPD patients matching the filter criteria.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient Details</th>
                  <th>Location</th>
                  <th>Assignment</th>
                  <th>Condition</th>
                  <th>Admitted Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmissions.map(adm => (
                  <tr key={adm.id} className={styles.tableRow}>
                    <td>
                      <div className={styles.patientName}>{adm.patient.name}</div>
                      <div className={styles.patientMeta}>
                        {adm.patient.age || 'N/A'} yrs • {adm.patient.gender || 'Unknown'} • Blood: {adm.patient.bloodGroup || 'N/A'}
                      </div>
                    </td>
                    <td>
                      <div className={styles.wardCell}>
                        <span
                          className={styles.wardBadge}
                          style={{
                            backgroundColor: `${adm.ward?.accentColor ?? '#3b82f6'}15`,
                            color: adm.ward?.accentColor ?? '#3b82f6',
                            border: `1px solid ${adm.ward?.accentColor ?? '#3b82f6'}30`,
                          }}
                        >
                          {adm.ward?.name} ({adm.ward?.code})
                        </span>
                        <span className={styles.bedNo}>Bed {adm.bedNo || 'N/A'}{adm.ward?.roomNo ? ` • Room ${adm.ward.roomNo}` : ''}{adm.ward?.floorNo ? ` • Floor ${adm.ward.floorNo}` : ''}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.roleBadge} ${styles[adm.assignedRole]}`}>
                        {adm.assignedRole === 'primary' ? 'Primary Lead' : 'Consultant'}
                      </span>
                    </td>
                    <td>
                      {adm.patientCondition ? (
                        <span className={`${styles.conditionBadge} ${styles[adm.patientCondition]}`}>
                          {adm.patientCondition}
                        </span>
                      ) : (
                        <span className={styles.noCondition}>Not specified</span>
                      )}
                    </td>
                    <td className={styles.dateCol}>
                      {new Date(adm.admittedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td>
                      <button
                        className={styles.actionBtn}
                        onClick={() => openEditModal(adm)}
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Clinical Info Modal */}
      {editingAdmission && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <form onSubmit={handleSave}>
              <div className={styles.modalHeader}>
                <div>
                  <h3 className={styles.modalTitle}>Update Clinical Details: {editingAdmission.patient.name}</h3>
                  <p className={styles.modalSubtitle}>
                    Ward: {editingAdmission.ward?.name} • Bed: {editingAdmission.bedNo}
                  </p>
                </div>
                <button type="button" className={styles.closeBtn} onClick={closeEditModal}>×</button>
              </div>

              <div className={styles.modalBody}>
                {error && <div className={styles.errorBox}>{error}</div>}

                <div className={styles.field}>
                  <label className={styles.label}>Patient Condition</label>
                  <select
                    className={styles.input}
                    value={condition}
                    onChange={e => setCondition(e.target.value as any)}
                  >
                    <option value="stable">🟢 Stable</option>
                    <option value="monitoring">🟡 Monitoring Required</option>
                    <option value="critical">🔴 Critical / ICU</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Chief Complaint</label>
                  <textarea
                    className={`${styles.input} ${styles.textarea}`}
                    rows={3}
                    value={chiefComplaint}
                    onChange={e => setChiefComplaint(e.target.value)}
                    placeholder="Primary reasons for admission..."
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Current Diagnosis & Notes</label>
                  <textarea
                    className={`${styles.input} ${styles.textarea}`}
                    rows={4}
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                    placeholder="Enter patient diagnosis, prognosis, treatment plan or daily updates..."
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
                  {saving ? 'Saving...' : 'Save Patient Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
