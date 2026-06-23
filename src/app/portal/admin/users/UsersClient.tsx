'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './users.module.css';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'RECEPTIONIST' | 'NURSE';
  isActive: boolean;
  createdAt: string;
}

interface Props {
  initialUsers: User[];
  currentUserId: string;
}

export default function UsersClient({ initialUsers, currentUserId }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resettingPasswordUser, setResettingPasswordUser] = useState<User | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'RECEPTIONIST' | 'NURSE'>('RECEPTIONIST');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Filters ──
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  // ── Handlers ──
  const openCreate = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('RECEPTIONIST');
    setError('');
    setIsCreateOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setIsActive(u.isActive);
    setError('');
  };

  const openResetPw = (u: User) => {
    setResettingPasswordUser(u);
    setPassword('');
    setError('');
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/portal/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create user');
      }

      const data = await res.json();
      setUsers(prev => [data.user, ...prev]);
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
    if (!editingUser) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/portal/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, isActive }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update user');
      }

      const data = await res.json();
      setUsers(prev =>
        prev.map(u => (u.id === editingUser.id ? data.user : u))
      );
      setEditingUser(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resettingPasswordUser) return;
    if (!password) { setError('Password is required'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/portal/admin/users/${resettingPasswordUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to reset password');
      }

      setResettingPasswordUser(null);
      alert('Password reset successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(userId: string) {
    if (userId === currentUserId) {
      alert('Cannot delete your own account');
      return;
    }
    if (!confirm('Are you sure you want to permanently delete this user account?')) return;
    setError('');

    try {
      const res = await fetch(`/api/portal/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete user');
      }

      setUsers(prev => prev.filter(u => u.id !== userId));
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Staff Accounts</h1>
          <p className={styles.subtitle}>Manage credentials, authorization levels, and hospital portal access</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>
          ➕ Add Staff Account
        </button>
      </header>

      {/* Search Bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by name, email, role..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Directory Table */}
      <div className={styles.card}>
        {filteredUsers.length === 0 ? (
          <div className={styles.empty}>No staff accounts found.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>System Role</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className={styles.tableRow}>
                    <td>
                      <div className={styles.docName}>
                        {u.name} {u.id === currentUserId && <span className={styles.selfBadge}>(You)</span>}
                      </div>
                      <div className={styles.docEmail}>{u.email}</div>
                    </td>
                    <td>
                      <span className={`${styles.roleTag} ${styles[u.role]}`}>{u.role}</span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${u.isActive ? styles.active : styles.inactive}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className={styles.dateCol}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className={styles.actionsCell}>
                      <button className={styles.editBtn} onClick={() => openEdit(u)}>Edit</button>
                      <button className={styles.pwBtn} onClick={() => openResetPw(u)}>Key</button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(u.id)}
                        disabled={u.id === currentUserId}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {isCreateOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <form onSubmit={handleCreate}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Add New Staff Account</h3>
                <button type="button" className={styles.closeBtn} onClick={() => setIsCreateOpen(false)}>×</button>
              </div>

              <div className={styles.modalBody}>
                {error && <div className={styles.errorBox}>{error}</div>}

                <div className={styles.field}>
                  <label className={styles.label}>Full Name</label>
                  <input type="text" className={styles.input} required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Priya Sharma" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Email Address</label>
                  <input type="email" className={styles.input} required value={email} onChange={e => setEmail(e.target.value)} placeholder="priya@hospital.local" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Password</label>
                  <input type="password" className={styles.input} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>System Role</label>
                  <select className={styles.input} value={role} onChange={e => setRole(e.target.value as any)}>
                    <option value="RECEPTIONIST">Receptionist (Front Desk)</option>
                    <option value="NURSE">Ward Nurse</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setIsCreateOpen(false)}>Cancel</button>
                <button type="submit" className={styles.completeBtn} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <form onSubmit={handleEdit}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Edit Staff Account</h3>
                <button type="button" className={styles.closeBtn} onClick={() => setEditingUser(null)}>×</button>
              </div>

              <div className={styles.modalBody}>
                {error && <div className={styles.errorBox}>{error}</div>}

                <div className={styles.field}>
                  <label className={styles.label}>Full Name</label>
                  <input type="text" className={styles.input} required value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Email Address</label>
                  <input type="email" className={styles.input} required value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>System Role</label>
                  <select
                    className={styles.input}
                    value={role}
                    onChange={e => setRole(e.target.value as any)}
                    disabled={editingUser.id === currentUserId}
                  >
                    <option value="RECEPTIONIST">Receptionist (Front Desk)</option>
                    <option value="NURSE">Ward Nurse</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>

                <div className={styles.fieldCheckbox}>
                  <input
                    type="checkbox"
                    id="user-active"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    disabled={editingUser.id === currentUserId}
                  />
                  <label htmlFor="user-active" className={styles.checkboxLabel}>
                    Active Account (unchecking deactivates login access)
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setEditingUser(null)}>Cancel</button>
                <button type="submit" className={styles.completeBtn} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingPasswordUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <form onSubmit={handleResetPassword}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Reset Password: {resettingPasswordUser.name}</h3>
                <button type="button" className={styles.closeBtn} onClick={() => setResettingPasswordUser(null)}>×</button>
              </div>

              <div className={styles.modalBody}>
                {error && <div className={styles.errorBox}>{error}</div>}

                <div className={styles.field}>
                  <label className={styles.label}>New Password</label>
                  <input type="password" className={styles.input} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setResettingPasswordUser(null)}>Cancel</button>
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
