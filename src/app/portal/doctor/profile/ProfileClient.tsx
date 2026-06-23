'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './profile.module.css';

interface Department {
  name: string;
  floor: string;
  color: string;
}

interface User {
  name: string;
  email: string;
}

interface Doctor {
  id: string;
  roomNo: string | null;
  speciality: string | null;
  designation: string;
  user: User;
  department: Department | null;
}

interface Props {
  doctor: Doctor;
}

export default function ProfileClient({ doctor }: Props) {
  const router = useRouter();
  const [roomNo, setRoomNo] = useState(doctor.roomNo || '');
  const [speciality, setSpeciality] = useState(doctor.speciality || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError('');

    try {
      const res = await fetch('/api/portal/doctor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomNo, speciality }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update profile');
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
          <h1 className={styles.title}>My Profile</h1>
          <p className={styles.subtitle}>View your hospital credentials and update contact details</p>
        </div>
      </header>

      <div className={styles.grid}>
        {/* Left Side: General Profile Card */}
        <div className={styles.profileCard}>
          <div className={styles.avatarSection}>
            <div className={styles.largeAvatar}>
              {doctor.user.name.charAt(0).toUpperCase()}
            </div>
            <h2 className={styles.doctorName}>Dr. {doctor.user.name}</h2>
            <p className={styles.designation}>{doctor.designation}</p>
            {doctor.department && (
              <span
                className={styles.deptBadge}
                style={{
                  backgroundColor: `${doctor.department.color}15`,
                  color: doctor.department.color,
                  border: `1px solid ${doctor.department.color}30`,
                }}
              >
                {doctor.department.name} Department
              </span>
            )}
          </div>

          <div className={styles.readOnlyDetails}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Email Address:</span>
              <span className={styles.detailVal}>{doctor.user.email}</span>
            </div>
            {doctor.department && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Floor Location:</span>
                <span className={styles.detailVal}>{doctor.department.floor}</span>
              </div>
            )}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Status:</span>
              <span className={styles.statusActive}>🟢 Active Practice</span>
            </div>
          </div>
        </div>

        {/* Right Side: Edit Form */}
        <div className={styles.formCard}>
          <h2 className={styles.sectionTitle}>Edit Professional Details</h2>

          {success && (
            <div className={styles.successBox}>
              <span>✓</span> Profile updated successfully.
            </div>
          )}

          {error && <div className={styles.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Room Number</label>
              <input
                type="text"
                className={styles.input}
                value={roomNo}
                onChange={e => setRoomNo(e.target.value)}
                placeholder="e.g. Room 304, OPD Block"
              />
              <p className={styles.helpText}>This room number will display on public OPD display screens.</p>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Medical Speciality</label>
              <input
                type="text"
                className={styles.input}
                value={speciality}
                onChange={e => setSpeciality(e.target.value)}
                placeholder="e.g. Cardiologist, Pediatric Surgeon"
              />
              <p className={styles.helpText}>Your areas of expertise or clinical focus.</p>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? 'Saving changes...' : 'Save Profile Details'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
