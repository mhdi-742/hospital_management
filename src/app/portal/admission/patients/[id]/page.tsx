'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import BedSelector from '@/components/admission/BedSelector';

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function toLocalDatetimeValue(date: Date) {
  // Returns YYYY-MM-DDTHH:MM for datetime-local input
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface Doctor { id?: string; user: { name: string }; department: { name: string } | null; }
interface Admission {
  id: string; type: string; status: string; admittedAt: string; dischargedAt: string | null;
  bedNo: string | null; patientCondition: string | null;
  bed: { id: string; bedNo: string } | null;
  ward: { name: string; code: string; accentColor: string } | null;
  opdSession: { doctor: { user: { name: string } }; startTime: string; endTime: string } | null;
  otCase: { procedureName: string; status: string; otRoom: { roomNo: string } | null } | null;
  doctors: { role: string; doctor: Doctor }[];
}
interface Patient {
  id: string; name: string; age: number | null; gender: string | null; contact: string | null;
  address: string | null; bloodGroup: string | null; chiefComplaint: string | null;
  diagnosis: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null;
  insuranceProvider: string | null; policyNumber: string | null;
  admissions: Admission[];
}
interface Bed {
  id: string;
  bedNo: string;
  wardId: string;
  admissions: { id: string; patient: { name: string } }[];
}
interface WardOption { id: string; name: string; code: string; accentColor: string; beds: Bed[]; }
interface OtRoomOption { id: string; roomNo: string; type: string; }
interface OpdSessionOption {
  id: string; startTime: string; endTime: string; status: string;
  doctor: { id: string; user: { name: string }; department: { name: string } | null; };
}
interface DoctorOption { id: string; user: { name: string }; department: { name: string } | null; }

const TYPE_COLOR: Record<string, string> = { OPD: '#3b82f6', IPD: '#8b5cf6', OT: '#f59e0b' };
const COND_COLOR: Record<string, string> = { stable: '#22c55e', monitoring: '#f59e0b', critical: '#ef4444' };

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const transferRequestId = searchParams?.get('transferRequest');
  const targetType = searchParams?.get('target');

  const [patient, setPatient]   = useState<Patient | null>(null);
  const [loading, setLoading]   = useState(true);
  const [role,    setRole]      = useState('');

  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeAdmId,     setDischargeAdmId]     = useState('');
  const [dischargeTime,      setDischargeTime]      = useState('');
  const [discharging,        setDischarging]        = useState(false);

  const [options, setOptions] = useState<{ wards: WardOption[]; otRooms: OtRoomOption[]; opdSessions: OpdSessionOption[]; doctors: DoctorOption[] } | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({
    newType: 'IPD', newWardId: '', newBedId: '', newOpdSessionId: '',
    newOtRoomId: '', newProcedureName: '', newAnaesthetist: '', newScheduledTime: '', newEstimatedDuration: '',
    transferRequestId: ''
  });
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (transferRequestId && targetType) {
      setShowTransfer(true);
      setTransferForm(prev => ({
        ...prev,
        newType: targetType,
        transferRequestId: transferRequestId
      }));
    }
  }, [transferRequestId, targetType]);

  useEffect(() => {
    fetch(`/api/portal/admission/patients/${id}`)
      .then(r => r.json()).then(d => { setPatient(d); setLoading(false); });
    fetch('/api/auth/session')
      .then(r => r.json()).then(s => setRole(s?.user?.role ?? ''));
    fetch('/api/portal/admission/options')
      .then(r => r.json()).then(d => setOptions(d));
  }, [id]);

  const openDischargeModal = (admissionId: string) => {
    setDischargeAdmId(admissionId);
    setDischargeTime(toLocalDatetimeValue(new Date()));
    setShowDischargeModal(true);
  };

  const dischargeConfirm = async () => {
    setDischarging(true);
    await fetch(`/api/portal/admission/patients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'discharge',
        admissionId: dischargeAdmId,
        dischargedAt: new Date(dischargeTime).toISOString(),
      }),
    });
    setDischarging(false);
    setShowDischargeModal(false);
    window.location.reload();
  };

  const updateCondition = async (admissionId: string, cond: string) => {
    await fetch(`/api/portal/admission/patients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_condition', admissionId, patientCondition: cond }),
    });
    window.location.reload();
  };

  const handleTransfer = async (admissionId: string) => {
    if (!transferForm.newType) return;
    if (transferForm.newType === 'IPD') {
      if (!transferForm.newWardId) { alert('Please select a ward'); return; }
      if (!transferForm.newBedId) { alert('Please select a bed from the booking grid'); return; }
    }
    setTransferring(true);
    await fetch(`/api/portal/admission/patients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'transfer', admissionId, ...transferForm }),
    });
    window.location.reload();
  };

  if (loading) return (
    <div className={styles.centered}>
      <span className={styles.spinner} /> Loading patient…
    </div>
  );

  if (!patient) return (
    <div className={styles.centered}>Patient not found.</div>
  );

  const activeAdmission = patient.admissions.find(a => a.status === 'active');

  return (
    <div className={styles.page}>
      {/* Back nav */}
      <Link href="/portal/admission/patients" className={styles.back}>← Back to Patients</Link>

      {/* Header card */}
      <div className={styles.headerCard}>
        <div className={styles.avatarLarge}>
          {patient.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
        </div>
        <div className={styles.headerInfo}>
          <h1 className={styles.patientName}>{patient.name}</h1>
          <div className={styles.metaRow}>
            {patient.age && <span className={styles.meta}>{patient.age} yrs</span>}
            {patient.gender && <span className={styles.meta}>{patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other'}</span>}
            {patient.bloodGroup && <span className={`${styles.meta} ${styles.bloodBadge}`}>{patient.bloodGroup}</span>}
            {patient.contact && <span className={styles.meta}>📞 {patient.contact}</span>}
          </div>
          {activeAdmission && (
            <span
              className={styles.admissionBadge}
              style={{ color: TYPE_COLOR[activeAdmission.type], background: TYPE_COLOR[activeAdmission.type] + '20' }}
            >
              Active · {activeAdmission.type}
              {activeAdmission.ward && ` · ${activeAdmission.ward.name}`}
              {(activeAdmission.bed?.bedNo || activeAdmission.bedNo) && ` · Bed ${activeAdmission.bed?.bedNo || activeAdmission.bedNo}`}
            </span>
          )}
        </div>
        {role === 'RECEPTIONIST' && (
          <Link href={`/portal/admission/patients/${id}/edit`} className={styles.editBtn}>Edit Details</Link>
        )}
      </div>

      <div className={styles.twoCol}>
        {/* Left: active admission */}
        <div className={styles.leftCol}>
          {activeAdmission ? (
            <div className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Active Admission</h2>
                <span className={styles.admType} style={{ color: TYPE_COLOR[activeAdmission.type], background: TYPE_COLOR[activeAdmission.type] + '22' }}>
                  {activeAdmission.type}
                </span>
              </div>

              {activeAdmission.type === 'IPD' && activeAdmission.ward && (
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Ward</span>
                    <span className={styles.infoVal}>
                      <span className={styles.wardBadge} style={{ color: activeAdmission.ward.accentColor, background: activeAdmission.ward.accentColor + '22' }}>
                        {activeAdmission.ward.code}
                      </span>
                      {activeAdmission.ward.name}
                    </span>
                  </div>
                  {(activeAdmission.bed?.bedNo || activeAdmission.bedNo) && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Bed</span>
                      <span className={styles.infoVal}>{activeAdmission.bed?.bedNo || activeAdmission.bedNo}</span>
                    </div>
                  )}
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Condition</span>
                    <div className={styles.conditionRow}>
                      {['stable', 'monitoring', 'critical'].map(c => (
                        <button
                          key={c}
                          className={`${styles.condBtn} ${activeAdmission.patientCondition === c ? styles.condBtnActive : ''}`}
                          style={activeAdmission.patientCondition === c ? { color: COND_COLOR[c], background: COND_COLOR[c] + '22', borderColor: COND_COLOR[c] + '44' } : {}}
                          onClick={() => updateCondition(activeAdmission.id, c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeAdmission.type === 'OT' && activeAdmission.otCase && (
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Procedure</span>
                    <span className={styles.infoVal}>{activeAdmission.otCase.procedureName}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>OT Room</span>
                    <span className={styles.infoVal}>{activeAdmission.otCase.otRoom?.roomNo ?? '—'}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Status</span>
                    <span className={styles.infoVal}>{activeAdmission.otCase.status}</span>
                  </div>
                </div>
              )}

              {/* Assigned doctors */}
              {activeAdmission.doctors.length > 0 && (
                <div className={styles.doctorList}>
                  <span className={styles.infoLabel}>Assigned Doctors</span>
                  {activeAdmission.doctors.map(d => (
                    <div key={d.doctor.user.name} className={styles.doctorRow}>
                      <span className={styles.docRoleBadge} data-role={d.role}>{d.role}</span>
                      <span className={styles.docName}>{d.doctor.user.name}</span>
                      {d.doctor.department && <span className={styles.docDept}>{d.doctor.department.name}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Admitted date + discharge */}
              <div className={styles.admFooter}>
                <div className={styles.admDates}>
                  <span className={styles.admDate}>
                    <span className={styles.admDateLabel}>Admitted</span>
                    {fmtDateTime(activeAdmission.admittedAt)}
                  </span>
                </div>
                {role === 'RECEPTIONIST' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className={styles.transferBtn} onClick={() => setShowTransfer(true)}>
                      Transfer
                    </button>
                    <button className={styles.dischargeBtn} onClick={() => openDischargeModal(activeAdmission.id)}>
                      Discharge
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.section}>
              <div className={styles.noActive}>
                No active admission.
                {role === 'RECEPTIONIST' && (
                  <Link href="/portal/admission/patients/new" className={styles.newAdmBtn}>+ New Admission</Link>
                )}
              </div>
            </div>
          )}

          {/* Medical info */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Medical</h2>
            <div className={styles.infoGrid}>
              {patient.chiefComplaint && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Chief Complaint</span>
                  <span className={styles.infoVal}>{patient.chiefComplaint}</span>
                </div>
              )}
              {patient.diagnosis && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Diagnosis</span>
                  <span className={styles.infoVal}>{patient.diagnosis}</span>
                </div>
              )}
            </div>
            {!patient.chiefComplaint && !patient.diagnosis && (
              <p className={styles.noData}>No medical details recorded.</p>
            )}
          </div>
        </div>

        {/* Right: personal + history */}
        <div className={styles.rightCol}>
          {/* Personal details */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Personal Details</h2>
            <div className={styles.infoGrid}>
              {patient.address && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Address</span>
                  <span className={styles.infoVal}>{patient.address}</span>
                </div>
              )}
              {patient.emergencyContactName && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Emergency Contact</span>
                  <span className={styles.infoVal}>{patient.emergencyContactName} · {patient.emergencyContactPhone}</span>
                </div>
              )}
              {patient.insuranceProvider && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Insurance</span>
                  <span className={styles.infoVal}>{patient.insuranceProvider} · {patient.policyNumber}</span>
                </div>
              )}
            </div>
            {!patient.address && !patient.emergencyContactName && !patient.insuranceProvider && (
              <p className={styles.noData}>No additional details.</p>
            )}
          </div>

          {/* Admission history */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Admission History</h2>
            {patient.admissions.length === 0 ? (
              <p className={styles.noData}>No admissions yet.</p>
            ) : (
              <div className={styles.historyList}>
                {patient.admissions.map(adm => (
                  <div key={adm.id} className={`${styles.historyItem} ${adm.status === 'active' ? styles.historyActive : ''}`}>
                    <span className={styles.histType} style={{ color: TYPE_COLOR[adm.type], background: TYPE_COLOR[adm.type] + '20' }}>
                      {adm.type}
                    </span>
                    <div className={styles.histMeta}>
                      <span>
                        <span className={styles.histLabel}>In: </span>
                        {fmtDateTime(adm.admittedAt)}
                      </span>
                      {adm.dischargedAt && (
                        <span>
                          <span className={styles.histLabel}>Out: </span>
                          {fmtDateTime(adm.dischargedAt)}
                        </span>
                      )}
                    </div>
                    <span className={`${styles.histStatus} ${adm.status === 'active' ? styles.histActive : ''}`}>{adm.status}</span>
                  </div>
                ))}

              </div>
            )}
          </div>
        </div>
      </div>

      {/* Discharge Modal */}
      {showDischargeModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>Discharge Patient</h2>
            <p>Set the exact discharge date and time for <strong>{patient?.name}</strong>.</p>

            <div className={styles.formGroup}>
              <label htmlFor="discharge-datetime">Discharge Date &amp; Time</label>
              <input
                id="discharge-datetime"
                type="datetime-local"
                value={dischargeTime}
                onChange={e => setDischargeTime(e.target.value)}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowDischargeModal(false)}
                disabled={discharging}
              >
                Cancel
              </button>
              <button
                className={styles.dischargeBtn}
                onClick={dischargeConfirm}
                disabled={discharging || !dischargeTime}
              >
                {discharging ? 'Discharging…' : 'Confirm Discharge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && activeAdmission && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>Transfer Patient</h2>
            <p>Move patient from <strong>{activeAdmission.type}</strong> to a new department.</p>

            <div className={styles.formGroup}>
              <label>New Department Type</label>
              <select 
                value={transferForm.newType} 
                onChange={e => setTransferForm({ ...transferForm, newType: e.target.value })}
              >
                <option value="OPD">OPD</option>
                <option value="IPD">IPD</option>
                <option value="OT">Operation Theatre (OT)</option>
              </select>
            </div>

            {transferForm.newType === 'IPD' && (
              <div className={styles.typeFields}>
                <div className={styles.formGroup}>
                  <label>Ward</label>
                  <select value={transferForm.newWardId} onChange={e => setTransferForm({ ...transferForm, newWardId: e.target.value, newBedId: '' })}>
                    <option value="">Select Ward...</option>
                    {options?.wards.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>

                {transferForm.newWardId && (() => {
                  const selectedWard = options?.wards.find(w => w.id === transferForm.newWardId);
                  return (
                    <BedSelector
                      wardName={selectedWard?.name || ''}
                      beds={selectedWard?.beds || []}
                      selectedBedId={transferForm.newBedId}
                      onSelectBed={(bedId) => setTransferForm({ ...transferForm, newBedId: bedId })}
                    />
                  );
                })()}
              </div>
            )}

            {transferForm.newType === 'OPD' && (
              <div className={styles.typeFields}>
                <div className={styles.formGroup}>
                  <label>Assign to Doctor (OPD Session)</label>
                  <select value={transferForm.newOpdSessionId} onChange={e => setTransferForm({ ...transferForm, newOpdSessionId: e.target.value })}>
                    <option value="">Select Session...</option>
                    {options?.opdSessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.doctor.user.name} ({s.doctor.department?.name}) - {s.startTime}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {transferForm.newType === 'OT' && (
              <div className={styles.typeFields}>
                <div className={styles.formGroup}>
                  <label>Procedure Name</label>
                  <input type="text" value={transferForm.newProcedureName} onChange={e => setTransferForm({ ...transferForm, newProcedureName: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>OT Room</label>
                  <select value={transferForm.newOtRoomId} onChange={e => setTransferForm({ ...transferForm, newOtRoomId: e.target.value })}>
                    <option value="">Select OT Room...</option>
                    {options?.otRooms.map(r => <option key={r.id} value={r.id}>{r.roomNo}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Anaesthetist (Optional)</label>
                  <input type="text" value={transferForm.newAnaesthetist} onChange={e => setTransferForm({ ...transferForm, newAnaesthetist: e.target.value })} />
                </div>
              </div>
            )}

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowTransfer(false)} disabled={transferring}>Cancel</button>
              <button 
                className={styles.submitBtn} 
                onClick={() => handleTransfer(activeAdmission.id)} 
                disabled={transferring || !transferForm.newType}
              >
                {transferring ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
