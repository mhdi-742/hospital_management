'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './admit.module.css';
import BedSelector from '@/components/admission/BedSelector';

interface Doctor { id: string; designation: string; user: { name: string }; department: { name: string } | null; }
interface Bed {
  id: string;
  bedNo: string;
  wardId: string;
  admissions: { id: string; patient: { name: string } }[];
}
interface Ward   { id: string; name: string; code: string; accentColor: string; beds: Bed[]; }
interface OtRoom { id: string; roomNo: string; type: string; }

export default function NewAdmissionForPatientPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [patientName, setPatientName] = useState('');
  const [options, setOptions]         = useState<{ doctors: Doctor[]; wards: Ward[]; otRooms: OtRoom[] } | null>(null);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');

  const [admissionType, setAdmissionType] = useState<'OPD' | 'IPD' | 'OT'>('OPD');
  const [wardId,    setWardId]    = useState('');
  const [bedId,     setBedId]     = useState('');
  const [otRoomId,  setOtRoomId]  = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [anaesthetist,  setAnaesthetist]  = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');

  const [selectedDoctors, setSelectedDoctors] = useState<{ doctorId: string; role: 'primary' | 'consultant' }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/portal/admission/patients/${id}`).then(r => r.json()),
      fetch('/api/portal/admission/options').then(r => r.json()),
    ]).then(([patient, opts]) => {
      setPatientName(patient.name ?? 'Patient');
      setOptions(opts);
      setLoading(false);
    });
  }, [id]);

  const addDoctor = (doctorId: string, role: 'primary' | 'consultant') => {
    setSelectedDoctors(prev => {
      if (prev.some(d => d.doctorId === doctorId)) return prev;
      if (role === 'primary') return [{ doctorId, role }, ...prev.filter(d => d.role !== 'primary')];
      return [...prev, { doctorId, role }];
    });
  };
  const removeDoctor = (doctorId: string) =>
    setSelectedDoctors(prev => prev.filter(d => d.doctorId !== doctorId));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (admissionType === 'IPD') {
      if (!wardId) { setError('Please select a ward'); return; }
      if (!bedId)  { setError('Please select a bed from the booking grid'); return; }
    }
    setSubmitting(true);

    const body: Record<string, unknown> = {
      admissionType,
      doctorIds: selectedDoctors,
      patientId: id,
    };

    if (admissionType === 'IPD') { body.wardId = wardId || undefined; body.bedId = bedId || undefined; }
    if (admissionType === 'OT')  {
      body.otRoomId = otRoomId || undefined;
      body.procedureName = procedureName;
      body.anaesthetist = anaesthetist;
      body.scheduledTime = scheduledTime;
      body.estimatedDuration = estimatedDuration;
    }

    const res = await fetch(`/api/portal/admission/new-episode/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setSubmitting(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return; }
    router.push(`/portal/admission/patients/${id}`);
  }

  if (loading) return <div className={styles.centered}><span className={styles.spinner} /> Loading…</div>;

  return (
    <div className={styles.page}>
      <Link href={`/portal/admission/patients/${id}`} className={styles.back}>← Back to Patient</Link>

      <div className={styles.header}>
        <h1 className={styles.title}>New Admission</h1>
        <p className={styles.subtitle}>Creating a new admission episode for <strong>{patientName}</strong></p>
      </div>

      <form onSubmit={handleSubmit} className={styles.formCard}>
        {/* Type */}
        <div className={styles.field}>
          <label className={styles.label}>Admission Type</label>
          <div className={styles.typeToggle}>
            {(['OPD', 'IPD', 'OT'] as const).map(t => (
              <button key={t} type="button"
                className={`${styles.typeOpt} ${admissionType === t ? styles.typeOptActive : ''}`}
                onClick={() => setAdmissionType(t)}
              >{t}</button>
            ))}
          </div>
        </div>

        {admissionType === 'IPD' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            <div className={styles.field}>
              <label className={styles.label}>Ward</label>
              <select id="new-adm-ward" className={styles.input} value={wardId} onChange={e => { setWardId(e.target.value); setBedId(''); }}>
                <option value="">Select ward…</option>
                {options?.wards.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
              </select>
            </div>

            {wardId && (() => {
              const selectedWard = options?.wards.find(w => w.id === wardId);
              return (
                <BedSelector
                  wardName={selectedWard?.name || ''}
                  beds={selectedWard?.beds || []}
                  selectedBedId={bedId}
                  onSelectBed={(id) => setBedId(id)}
                />
              );
            })()}
          </div>
        )}

        {admissionType === 'OT' && (
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>OT Room</label>
              <select id="new-adm-ot-room" className={styles.input} value={otRoomId} onChange={e => setOtRoomId(e.target.value)}>
                <option value="">Select room…</option>
                {options?.otRooms.map(r => <option key={r.id} value={r.id}>{r.roomNo} — {r.type}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Procedure Name</label>
              <input id="new-adm-procedure" className={styles.input} value={procedureName} onChange={e => setProcedureName(e.target.value)} placeholder="e.g. Cholecystectomy" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Anaesthetist</label>
              <input id="new-adm-anaes" className={styles.input} value={anaesthetist} onChange={e => setAnaesthetist(e.target.value)} placeholder="Anaesthetist name" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Scheduled Time</label>
              <input id="new-adm-time" type="time" className={styles.input} value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Est. Duration (min)</label>
              <input id="new-adm-duration" type="number" className={styles.input} value={estimatedDuration} onChange={e => setEstimatedDuration(e.target.value)} placeholder="e.g. 120" />
            </div>
          </div>
        )}

        {/* Doctors */}
        <div className={styles.divider}>Assign Doctors</div>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label}>Primary Doctor</label>
            <select id="new-adm-primary-doc" className={styles.input}
              onChange={e => { if (e.target.value) addDoctor(e.target.value, 'primary'); e.target.value = ''; }} defaultValue="">
              <option value="">Add primary doctor…</option>
              {options?.doctors.filter(d => !selectedDoctors.some(s => s.doctorId === d.id)).map(d => (
                <option key={d.id} value={d.id}>{d.user.name} — {d.designation}{d.department ? ` (${d.department.name})` : ''}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Consultant</label>
            <select id="new-adm-consultant" className={styles.input}
              onChange={e => { if (e.target.value) addDoctor(e.target.value, 'consultant'); e.target.value = ''; }} defaultValue="">
              <option value="">Add consultant…</option>
              {options?.doctors.filter(d => !selectedDoctors.some(s => s.doctorId === d.id)).map(d => (
                <option key={d.id} value={d.id}>{d.user.name} — {d.designation}{d.department ? ` (${d.department.name})` : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedDoctors.length > 0 && (
          <div className={styles.chipList}>
            {selectedDoctors.map(d => {
              const doc = options?.doctors.find(o => o.id === d.doctorId);
              return (
                <div key={d.doctorId} className={styles.chip}>
                  <span className={styles.chipRole} data-role={d.role}>{d.role}</span>
                  <span>{doc?.user.name ?? d.doctorId}</span>
                  <button type="button" className={styles.chipRemove} onClick={() => removeDoctor(d.doctorId)}>×</button>
                </div>
              );
            })}
          </div>
        )}

        {error && <div className={styles.errorBox}>⚠ {error}</div>}

        <div className={styles.actions}>
          <Link href={`/portal/admission/patients/${id}`} className={styles.cancelBtn}>Cancel</Link>
          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? <span className={styles.spinner} /> : null}
            {submitting ? 'Creating…' : `Admit as ${admissionType}`}
          </button>
        </div>
      </form>
    </div>
  );
}
