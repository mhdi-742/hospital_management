'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './edit.module.css';

const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];

interface Patient {
  id: string; name: string; age: number | null; gender: string | null;
  contact: string | null; address: string | null; bloodGroup: string | null;
  chiefComplaint: string | null; diagnosis: string | null;
  emergencyContactName: string | null; emergencyContactPhone: string | null;
  insuranceProvider: string | null; policyNumber: string | null;
}

export default function EditPatientPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [form, setForm] = useState<Partial<Patient>>({});
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState('');
  const [success, setSuccess]   = useState(false);

  useEffect(() => {
    fetch(`/api/portal/admission/patients/${id}`)
      .then(r => r.json())
      .then((p: Patient) => {
        setForm({
          name: p.name, age: p.age, gender: p.gender ?? '',
          contact: p.contact ?? '', address: p.address ?? '',
          bloodGroup: p.bloodGroup ?? '', chiefComplaint: p.chiefComplaint ?? '',
          diagnosis: p.diagnosis ?? '', emergencyContactName: p.emergencyContactName ?? '',
          emergencyContactPhone: p.emergencyContactPhone ?? '',
          insuranceProvider: p.insuranceProvider ?? '', policyNumber: p.policyNumber ?? '',
        });
        setLoading(false);
      });
  }, [id]);

  const set = (key: keyof Patient, val: string | number) =>
    setForm(f => ({ ...f, [key]: val }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const res = await fetch(`/api/portal/admission/patients/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { setError('Failed to save changes.'); return; }
    setSuccess(true);
    setTimeout(() => router.push(`/portal/admission/patients/${id}`), 1200);
  }

  if (loading) return (
    <div className={styles.centered}><span className={styles.spinner} /> Loading…</div>
  );

  return (
    <div className={styles.page}>
      <Link href={`/portal/admission/patients/${id}`} className={styles.back}>← Back to Patient</Link>
      <h1 className={styles.title}>Edit Patient Details</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Demographics */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Demographics</h2>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Full Name</label>
              <input id="edit-name" className={styles.input} value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Age</label>
              <input id="edit-age" type="number" className={styles.input} value={form.age ?? ''} onChange={e => set('age', e.target.value)} min="0" max="150" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Gender</label>
              <select id="edit-gender" className={styles.input} value={form.gender ?? ''} onChange={e => set('gender', e.target.value)}>
                <option value="">Not specified</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Blood Group</label>
              <select id="edit-blood-group" className={styles.input} value={form.bloodGroup ?? ''} onChange={e => set('bloodGroup', e.target.value)}>
                <option value="">Unknown</option>
                {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Contact</label>
              <input id="edit-contact" className={styles.input} value={form.contact ?? ''} onChange={e => set('contact', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Address</label>
              <input id="edit-address" className={styles.input} value={form.address ?? ''} onChange={e => set('address', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Medical */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Medical Details</h2>
          <div className={styles.field}>
            <label className={styles.label}>Chief Complaint</label>
            <textarea id="edit-complaint" className={`${styles.input} ${styles.textarea}`} value={form.chiefComplaint ?? ''} onChange={e => set('chiefComplaint', e.target.value)} rows={3} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Diagnosis</label>
            <textarea id="edit-diagnosis" className={`${styles.input} ${styles.textarea}`} value={form.diagnosis ?? ''} onChange={e => set('diagnosis', e.target.value)} rows={3} />
          </div>
        </div>

        {/* Emergency & Insurance */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Emergency Contact & Insurance</h2>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Emergency Contact Name</label>
              <input id="edit-emg-name" className={styles.input} value={form.emergencyContactName ?? ''} onChange={e => set('emergencyContactName', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Emergency Contact Phone</label>
              <input id="edit-emg-phone" className={styles.input} value={form.emergencyContactPhone ?? ''} onChange={e => set('emergencyContactPhone', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Insurance Provider</label>
              <input id="edit-insurance" className={styles.input} value={form.insuranceProvider ?? ''} onChange={e => set('insuranceProvider', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Policy Number</label>
              <input id="edit-policy" className={styles.input} value={form.policyNumber ?? ''} onChange={e => set('policyNumber', e.target.value)} />
            </div>
          </div>
        </div>

        {error   && <div className={styles.errorBox}>⚠ {error}</div>}
        {success && <div className={styles.successBox}>✓ Saved! Redirecting…</div>}

        <div className={styles.actions}>
          <Link href={`/portal/admission/patients/${id}`} className={styles.cancelBtn}>Cancel</Link>
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? <span className={styles.spinner} /> : null}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
