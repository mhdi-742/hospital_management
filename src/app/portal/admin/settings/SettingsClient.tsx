'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './settings.module.css';

interface Props {
  initialSettings: Record<string, string>;
}

export default function SettingsClient({ initialSettings }: Props) {
  const router = useRouter();
  const [hospitalName, setHospitalName] = useState(initialSettings.hospitalName || 'Apex City General Hospital');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError('');

    try {
      const res = await fetch('/api/portal/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalName }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save settings');
      }

      setSuccess(true);
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
          <h1 className={styles.title}>Hospital Settings</h1>
          <p className={styles.subtitle}>Configure global system preferences and display customizations</p>
        </div>
      </header>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Global System Configuration</h2>

        {success && (
          <div className={styles.successBox}>
            <span>✓</span> Settings updated successfully.
          </div>
        )}

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Hospital / Facility Name</label>
            <input
              type="text"
              className={styles.input}
              required
              value={hospitalName}
              onChange={e => setHospitalName(e.target.value)}
              placeholder="e.g. Apex City General Hospital"
            />
            <p className={styles.helpText}>
              This name displays on all public display boards, printouts, and portal headers.
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>OPD Session Intermission (Default)</label>
            <input
              type="number"
              className={styles.input}
              value={10}
              disabled
              placeholder="10 minutes"
            />
            <p className={styles.helpText}>
              Average wait time suggestion for newly initialized sessions (Read-only).
            </p>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={saving}>
            {saving ? 'Saving preferences...' : 'Save Configuration'}
          </button>
        </form>
      </div>
    </div>
  );
}
