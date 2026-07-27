'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import BedSelector from '@/components/admission/BedSelector';

interface Doctor {
  id: string;
  designation: string;
  user: { name: string };
  department: { name: string } | null;
}
interface Bed {
  id: string;
  bedNo: string;
  wardId: string;
  admissions: {
    id: string;
    patient: {
      name: string;
    };
  }[];
}
interface Ward   { id: string; name: string; code: string; accentColor: string; beds: Bed[]; }
interface OtRoom { id: string; roomNo: string; type: string; }
interface OpdSession {
  id: string;
  opdNo?: string | null;
  startTime: string;
  endTime: string;
  status: string;
  totalTokens: number;
  doctor: {
    id: string;
    roomNo?: string | null;
    user: { name: string };
    department: { name: string } | null;
  };
}

const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];

export default function NewAdmissionPage() {
  const router = useRouter();

  // Form data
  const [form, setForm] = useState({
    name: '', age: '', gender: '', contact: '', address: '', bloodGroup: '',
    chiefComplaint: '', diagnosis: '',
    emergencyContactName: '', emergencyContactPhone: '',
    insuranceProvider: '', policyNumber: '',
    admissionType: 'OPD',
    wardId: '', bedId: '',
    opdSessionId: '',
    otRoomId: '', procedureName: '', anaesthetist: '', scheduledTime: '', estimatedDuration: '',
  });

  const [selectedDoctors, setSelectedDoctors] = useState<{ doctorId: string; role: 'primary' | 'consultant' }[]>([]);
  const [options, setOptions] = useState<{ doctors: Doctor[]; wards: Ward[]; otRooms: OtRoom[]; opdSessions: OpdSession[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState(0); // multi-step: 0=demographics, 1=medical, 2=admission

  useEffect(() => {
    setLoading(true);
    fetch('/api/portal/admission/options')
      .then(r => r.json())
      .then(d => { setOptions(d); setLoading(false); });
  }, []);

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const addDoctor = (doctorId: string, role: 'primary' | 'consultant') => {
    setSelectedDoctors(prev => {
      if (prev.some(d => d.doctorId === doctorId)) return prev;
      // Only one primary
      if (role === 'primary') {
        return [{ doctorId, role }, ...prev.filter(d => d.role !== 'primary')];
      }
      return [...prev, { doctorId, role }];
    });
  };

  const removeDoctor = (doctorId: string) =>
    setSelectedDoctors(prev => prev.filter(d => d.doctorId !== doctorId));

  const getDoctorName = (id: string) =>
    options?.doctors.find(d => d.id === id)?.user.name ?? id;

  const validateDemographics = () => {
    if (!form.name.trim()) {
      setError('Patient name is required');
      return false;
    }
    if (!form.age.trim()) {
      setError('Age is required');
      return false;
    }
    const parsedAge = parseInt(form.age, 10);
    if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 150) {
      setError('Please enter a valid age between 0 and 150');
      return false;
    }
    if (!form.gender) {
      setError('Gender is required');
      return false;
    }
    if (!form.contact.trim()) {
      setError('Contact number is required');
      return false;
    }
    setError('');
    return true;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateDemographics()) {
      setSection(0);
      return;
    }
    if (form.admissionType === 'IPD') {
      if (!form.wardId) {
        setError('Please select a ward');
        setSection(2);
        return;
      }
      if (!form.bedId) {
        setError('Please select a bed from the booking grid');
        setSection(2);
        return;
      }
    }
    setError('');
    setSubmitting(true);

    const res = await fetch('/api/portal/admission/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, doctorIds: selectedDoctors }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? 'Something went wrong');
      return;
    }

    const data = await res.json();

    // Show assigned OPD token number if available
    if (data.assignedToken) {
      alert(`Patient registered successfully!\nAssigned Token: #${data.assignedToken}`);
    }

    router.push(`/portal/admission/patients/${data.patient.id}`);
  }

  // When an OPD session is selected, auto-assign that doctor as primary
  function handleOpdSessionSelect(sessionId: string) {
    set('opdSessionId', sessionId);
    if (!sessionId || !options) return;

    const selectedSession = options.opdSessions.find(s => s.id === sessionId);
    if (selectedSession) {
      // Auto-add the session's doctor as primary
      setSelectedDoctors(prev => {
        const withoutOldPrimary = prev.filter(d => d.role !== 'primary');
        return [{ doctorId: selectedSession.doctor.id, role: 'primary' as const }, ...withoutOldPrimary];
      });
    }
  }

  const steps = ['Demographics', 'Medical Details', 'Admission & Assignment'];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Admit Patient</h1>
          <p className={styles.subtitle}>Fill in the patient details and assign them to a department</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className={styles.steps}>
        {steps.map((s, i) => (
          <button
            key={i}
            className={`${styles.step} ${section === i ? styles.stepActive : ''} ${section > i ? styles.stepDone : ''}`}
            onClick={() => {
              if (i > 0 && !validateDemographics()) {
                return;
              }
              setSection(i);
            }}
            type="button"
          >
            <span className={styles.stepNum}>{section > i ? '✓' : i + 1}</span>
            <span className={styles.stepLabel}>{s}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && (
          <div className={styles.errorBox} style={{ marginBottom: '1.5rem' }}>
            <span>⚠</span> {error}
          </div>
        )}

        {/* ── Step 0: Demographics ── */}
        {section === 0 && (
          <div className={styles.formCard}>
            <h2 className={styles.cardTitle}>Patient Demographics</h2>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input id="patient-name" className={styles.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ravi Kumar" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Age <span style={{ color: '#ef4444' }}>*</span></label>
                <input id="patient-age" type="number" className={styles.input} value={form.age} onChange={e => set('age', e.target.value)} placeholder="e.g. 45" min="0" max="150" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Gender <span style={{ color: '#ef4444' }}>*</span></label>
                <select id="patient-gender" className={styles.input} value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select gender…</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Blood Group</label>
                <select id="patient-blood-group" className={styles.input} value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)}>
                  <option value="">Unknown</option>
                  {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Contact Number <span style={{ color: '#ef4444' }}>*</span></label>
                <input id="patient-contact" className={styles.input} value={form.contact} onChange={e => set('contact', e.target.value)} placeholder="+91 9876543210" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Address</label>
                <input id="patient-address" className={styles.input} value={form.address} onChange={e => set('address', e.target.value)} placeholder="City, State" />
              </div>
            </div>
            <div className={styles.sectionDivider}>Emergency Contact</div>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Contact Name</label>
                <input id="emergency-name" className={styles.input} value={form.emergencyContactName} onChange={e => set('emergencyContactName', e.target.value)} placeholder="Next of kin name" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Contact Phone</label>
                <input id="emergency-phone" className={styles.input} value={form.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)} placeholder="+91 9876543210" />
              </div>
            </div>
            <div className={styles.sectionDivider}>Insurance (Optional)</div>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Insurance Provider</label>
                <input id="insurance-provider" className={styles.input} value={form.insuranceProvider} onChange={e => set('insuranceProvider', e.target.value)} placeholder="e.g. Star Health" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Policy Number</label>
                <input id="policy-number" className={styles.input} value={form.policyNumber} onChange={e => set('policyNumber', e.target.value)} placeholder="e.g. POL-1234567" />
              </div>
            </div>
            <div className={styles.navBtns}>
              <div />
              <button
                type="button"
                className={styles.nextBtn}
                onClick={() => {
                  if (validateDemographics()) {
                    setSection(1);
                  }
                }}
              >
                Next: Medical Details →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Medical ── */}
        {section === 1 && (
          <div className={styles.formCard}>
            <h2 className={styles.cardTitle}>Medical Details</h2>
            <div className={styles.field}>
              <label className={styles.label}>Chief Complaint</label>
              <textarea
                id="chief-complaint"
                className={`${styles.input} ${styles.textarea}`}
                value={form.chiefComplaint}
                onChange={e => set('chiefComplaint', e.target.value)}
                placeholder="Main reason for visit or admission…"
                rows={3}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Diagnosis (if known)</label>
              <textarea
                id="diagnosis"
                className={`${styles.input} ${styles.textarea}`}
                value={form.diagnosis}
                onChange={e => set('diagnosis', e.target.value)}
                placeholder="Provisional or confirmed diagnosis…"
                rows={3}
              />
            </div>
            <div className={styles.navBtns}>
              <button type="button" className={styles.backBtn} onClick={() => setSection(0)}>← Back</button>
              <button type="button" className={styles.nextBtn} onClick={() => setSection(2)}>Next: Admission →</button>
            </div>
          </div>
        )}

        {/* ── Step 2: Admission & Assignment ── */}
        {section === 2 && (
          <div className={styles.formCard}>
            <h2 className={styles.cardTitle}>Admission & Assignment</h2>

            {/* Admission type toggle */}
            <div className={styles.field}>
              <label className={styles.label}>Admission Type</label>
              <div className={styles.typeToggle}>
                {['OPD', 'IPD', 'OT'].map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`${styles.typeOpt} ${form.admissionType === t ? styles.typeOptActive : ''}`}
                    onClick={() => set('admissionType', t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* OPD specific — Session picker */}
            {form.admissionType === 'OPD' && (
              <div className={styles.field}>
                <label className={styles.label}>Doctor&apos;s OPD Session</label>
                {options?.opdSessions && options.opdSessions.length > 0 ? (
                  <select
                    id="opd-session"
                    className={styles.input}
                    value={form.opdSessionId}
                    onChange={e => handleOpdSessionSelect(e.target.value)}
                  >
                    <option value="">Select a doctor&apos;s session…</option>
                    {options.opdSessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.doctor.user.name}
                        {s.doctor.department ? ` (${s.doctor.department.name})` : ''}
                        {s.opdNo ? ` • ${s.opdNo}` : (s.doctor.roomNo ? ` • ${s.doctor.roomNo}` : '')}
                        {' — '}{s.startTime}–{s.endTime}
                        {' — '}{s.totalTokens} patients registered
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className={styles.loadingText}>No active OPD sessions today. A doctor must start a session first.</p>
                )}
              </div>
            )}

            {/* IPD specific */}
            {form.admissionType === 'IPD' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                <div className={styles.field}>
                  <label className={styles.label}>Ward</label>
                  <select id="ipd-ward" className={styles.input} value={form.wardId} onChange={e => {
                    setForm(f => ({ ...f, wardId: e.target.value, bedId: '' }));
                  }}>
                    <option value="">Select ward…</option>
                    {options?.wards.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                {form.wardId && (() => {
                  const selectedWard = options?.wards.find(w => w.id === form.wardId);
                  return (
                    <BedSelector
                      wardName={selectedWard?.name || ''}
                      beds={selectedWard?.beds || []}
                      selectedBedId={form.bedId}
                      onSelectBed={(bedId) => set('bedId', bedId)}
                    />
                  );
                })()}
              </div>
            )}

            {/* OT specific */}
            {form.admissionType === 'OT' && (
              <>
                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>OT Room</label>
                    <select id="ot-room" className={styles.input} value={form.otRoomId} onChange={e => set('otRoomId', e.target.value)}>
                      <option value="">Select room…</option>
                      {options?.otRooms.map(r => (
                        <option key={r.id} value={r.id}>{r.roomNo} — {r.type}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Scheduled Time</label>
                    <input id="scheduled-time" type="time" className={styles.input} value={form.scheduledTime} onChange={e => set('scheduledTime', e.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Procedure Name</label>
                    <input id="procedure-name" className={styles.input} value={form.procedureName} onChange={e => set('procedureName', e.target.value)} placeholder="e.g. Appendectomy" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Anaesthetist</label>
                    <input id="anaesthetist" className={styles.input} value={form.anaesthetist} onChange={e => set('anaesthetist', e.target.value)} placeholder="Anaesthetist name" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Est. Duration (minutes)</label>
                    <input id="estimated-duration" type="number" className={styles.input} value={form.estimatedDuration} onChange={e => set('estimatedDuration', e.target.value)} placeholder="e.g. 90" />
                  </div>
                </div>
              </>
            )}

            {/* Doctor assignment */}
            <div className={styles.sectionDivider}>Assign Doctor(s)</div>

            {loading ? (
              <p className={styles.loadingText}>Loading doctors…</p>
            ) : (
              <>
                <div className={styles.doctorPicker}>
                  <select
                    id="doctor-select"
                    className={styles.input}
                    onChange={e => {
                      if (e.target.value) addDoctor(e.target.value, 'primary');
                      e.target.value = '';
                    }}
                    defaultValue=""
                  >
                    <option value="">Add primary doctor…</option>
                    {options?.doctors
                      .filter(d => !selectedDoctors.some(s => s.doctorId === d.id))
                      .map(d => (
                        <option key={d.id} value={d.id}>
                          {d.user.name} — {d.designation}{d.department ? ` (${d.department.name})` : ''}
                        </option>
                      ))}
                  </select>
                  <select
                    id="consultant-select"
                    className={styles.input}
                    onChange={e => {
                      if (e.target.value) addDoctor(e.target.value, 'consultant');
                      e.target.value = '';
                    }}
                    defaultValue=""
                  >
                    <option value="">Add consultant…</option>
                    {options?.doctors
                      .filter(d => !selectedDoctors.some(s => s.doctorId === d.id))
                      .map(d => (
                        <option key={d.id} value={d.id}>
                          {d.user.name} — {d.designation}{d.department ? ` (${d.department.name})` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                {selectedDoctors.length > 0 && (
                  <div className={styles.selectedDoctors}>
                    {selectedDoctors.map(d => (
                      <div key={d.doctorId} className={styles.doctorChip}>
                        <span className={styles.chipRole} data-role={d.role}>
                          {d.role === 'primary' ? 'Primary' : 'Consultant'}
                        </span>
                        <span className={styles.chipName}>{getDoctorName(d.doctorId)}</span>
                        <button type="button" className={styles.chipRemove} onClick={() => removeDoctor(d.doctorId)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}



            <div className={styles.navBtns}>
              <button type="button" className={styles.backBtn} onClick={() => setSection(1)}>← Back</button>
              <button type="submit" className={styles.submitBtn} disabled={submitting}>
                {submitting ? <span className={styles.spinner} /> : null}
                {submitting ? 'Saving…' : 'Admit Patient'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
