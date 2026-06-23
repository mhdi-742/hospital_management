'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './doctors.module.css';

interface Department {
  id: string;
  name: string;
  floor: string;
  color: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface Doctor {
  id: string;
  userId: string;
  designation: string;
  roomNo: string | null;
  speciality: string | null;
  user: User;
  department: Department | null;
}

interface Props {
  initialDoctors: Doctor[];
  departments: Department[];
}

export default function DoctorsClient({ initialDoctors, departments }: Props) {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>(initialDoctors);
  const [search, setSearch] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [resettingPasswordDoc, setResettingPasswordDoc] = useState<Doctor | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [designation, setDesignation] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [roomNo, setRoomNo] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Filters ──
  const filteredDoctors = doctors.filter(doc =>
    doc.user.name.toLowerCase().includes(search.toLowerCase()) ||
    doc.user.email.toLowerCase().includes(search.toLowerCase()) ||
    doc.designation.toLowerCase().includes(search.toLowerCase()) ||
    (doc.speciality ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Handlers ──
  const openCreate = () => {
    setName('');
    setEmail('');
    setPassword('');
    setDesignation('Consultant');
    setSpeciality('');
    setRoomNo('');
    setDepartmentId('');
    setError('');
    setIsCreateOpen(true);
  };

  const openEdit = (doc: Doctor) => {
    setEditingDoctor(doc);
    setName(doc.user.name);
    setDesignation(doc.designation);
    setSpeciality(doc.speciality || '');
    setRoomNo(doc.roomNo || '');
    setDepartmentId(doc.department?.id || '');
    setIsActive(doc.user.isActive);
    setError('');
  };

  const openResetPw = (doc: Doctor) => {
    setResettingPasswordDoc(doc);
    setPassword('');
    setError('');
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/portal/admin/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, designation, speciality, roomNo, departmentId }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create doctor');
      }

      const data = await res.json();
      // Refetch or update local state
      const newDoc: Doctor = {
        ...data.doctor,
        user: data.user,
        department: departments.find(d => d.id === departmentId) || null,
      };

      setDoctors(prev => [newDoc, ...prev]);
      setIsCreateOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDoctor) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/portal/admin/doctors/${editingDoctor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, designation, speciality, roomNo, departmentId, isActive }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update doctor');
      }

      const data = await res.json();
      setDoctors(prev =>
        prev.map(d => (d.id === editingDoctor.id ? data.doctor : d))
      );
      setEditingDoctor(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resettingPasswordDoc) return;
    if (!password) { setError('Password is required'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/portal/admin/doctors/${resettingPasswordDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to reset password');
      }

      setResettingPasswordDoc(null);
      alert('Password reset successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('Are you sure you want to permanently delete this doctor profile? This will delete the user account too.')) return;
    setError('');

    try {
      const res = await fetch(`/api/portal/admin/doctors/${docId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete doctor');
      }

      setDoctors(prev => prev.filter(d => d.id !== docId));
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Doctors Directory</h1>
          <p className={styles.subtitle}>Register new doctors, update departmental status, or deactivate user accounts</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>
          ➕ Add New Doctor
        </button>
      </header>

      {/* Search Bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by name, email, speciality..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Directory Table */}
      <div className={styles.card}>
        {filteredDoctors.length === 0 ? (
          <div className={styles.empty}>No doctors found.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Doctor Name</th>
                  <th>Designation</th>
                  <th>Speciality</th>
                  <th>OPD Room</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDoctors.map(doc => (
                  <tr key={doc.id} className={styles.tableRow}>
                    <td>
                      <div className={styles.docName}>{doc.user.name}</div>
                      <div className={styles.docEmail}>{doc.user.email}</div>
                    </td>
                    <td>
                      <span className={styles.designationTag}>{doc.designation}</span>
                    </td>
                    <td>{doc.speciality || 'General Medicine'}</td>
                    <td>{doc.roomNo || 'N/A'}</td>
                    <td>
                      {doc.department ? (
                        <span
                          className={styles.deptBadge}
                          style={{
                            backgroundColor: `${doc.department.color}15`,
                            color: doc.department.color,
                            border: `1px solid ${doc.department.color}30`,
                          }}
                        >
                          {doc.department.name}
                        </span>
                      ) : (
                        <span className={styles.noDept}>None</span>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${doc.user.isActive ? styles.active : styles.inactive}`}>
                        {doc.user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className={styles.actionsCell}>
                      <button className={styles.editBtn} onClick={() => openEdit(doc)}>Edit</button>
                      <button className={styles.pwBtn} onClick={() => openResetPw(doc)}>Key</button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(doc.id)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Doctor Modal */}
      {isCreateOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <form onSubmit={handleCreate}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Add New Doctor Profile</h3>
                <button type="button" className={styles.closeBtn} onClick={() => setIsCreateOpen(false)}>×</button>
              </div>

              <div className={styles.modalBody}>
                {error && <div className={styles.errorBox}>{error}</div>}

                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Full Name</label>
                    <input type="text" className={styles.input} required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dr. Anand Verma" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Email Address</label>
                    <input type="email" className={styles.input} required value={email} onChange={e => setEmail(e.target.value)} placeholder="anand@hospital.local" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Designation</label>
                    <input type="text" className={styles.input} required value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Senior Consultant" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Password</label>
                    <input type="password" className={styles.input} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Speciality</label>
                    <input type="text" className={styles.input} value={speciality} onChange={e => setSpeciality(e.target.value)} placeholder="e.g. Cardiologist" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>OPD Room No</label>
                    <input type="text" className={styles.input} value={roomNo} onChange={e => setRoomNo(e.target.value)} placeholder="e.g. Room 204" />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>OPD Department</label>
                  <select className={styles.input} value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                    <option value="">Select department...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} (Floor {d.floor})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setIsCreateOpen(false)}>Cancel</button>
                <button type="submit" className={styles.completeBtn} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Doctor Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Doctor Modal */}
      {editingDoctor && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <form onSubmit={handleEdit}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Edit Doctor Profile</h3>
                <button type="button" className={styles.closeBtn} onClick={() => setEditingDoctor(null)}>×</button>
              </div>

              <div className={styles.modalBody}>
                {error && <div className={styles.errorBox}>{error}</div>}

                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Full Name</label>
                    <input type="text" className={styles.input} required value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Designation</label>
                    <input type="text" className={styles.input} required value={designation} onChange={e => setDesignation(e.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Speciality</label>
                    <input type="text" className={styles.input} value={speciality} onChange={e => setSpeciality(e.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>OPD Room No</label>
                    <input type="text" className={styles.input} value={roomNo} onChange={e => setRoomNo(e.target.value)} />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>OPD Department</label>
                  <select className={styles.input} value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                    <option value="">Select department...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} (Floor {d.floor})</option>
                    ))}
                  </select>
                </div>

                <div className={styles.fieldCheckbox}>
                  <input
                    type="checkbox"
                    id="doctor-active"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                  />
                  <label htmlFor="doctor-active" className={styles.checkboxLabel}>
                    Active Practice (unchecking deactivates login access)
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setEditingDoctor(null)}>Cancel</button>
                <button type="submit" className={styles.completeBtn} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingPasswordDoc && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <form onSubmit={handleResetPassword}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Reset Password: {resettingPasswordDoc.user.name}</h3>
                <button type="button" className={styles.closeBtn} onClick={() => setResettingPasswordDoc(null)}>×</button>
              </div>

              <div className={styles.modalBody}>
                {error && <div className={styles.errorBox}>{error}</div>}

                <div className={styles.field}>
                  <label className={styles.label}>New Password</label>
                  <input type="password" className={styles.input} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setResettingPasswordDoc(null)}>Cancel</button>
                <button type="submit" className={styles.completeBtn} disabled={loading}>
                  {loading ? 'Resetting...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
