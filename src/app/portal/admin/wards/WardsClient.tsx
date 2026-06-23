'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './wards.module.css';

interface Ward {
  id: string;
  name: string;
  code: string;
  capacity: number;
  accentColor: string;
}

interface Props {
  initialWards: Ward[];
}

export default function WardsClient({ initialWards }: Props) {
  const router = useRouter();
  const [wards, setWards] = useState<Ward[]>(initialWards);
  const [search, setSearch] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWard, setEditingWard] = useState<Ward | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [capacity, setCapacity] = useState('20');
  const [accentColor, setAccentColor] = useState('#3b82f6');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Filters ──
  const filteredWards = wards.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.code.toLowerCase().includes(search.toLowerCase())
  );

  // ── Handlers ──
  const openCreate = () => {
    setName('');
    setCode('');
    setCapacity('20');
    setAccentColor('#3b82f6');
    setError('');
    setIsCreateOpen(true);
  };

  const openEdit = (w: Ward) => {
    setEditingWard(w);
    setName(w.name);
    setCode(w.code);
    setCapacity(String(w.capacity));
    setAccentColor(w.accentColor);
    setError('');
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/portal/admin/wards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, capacity, accentColor }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create ward');
      }

      const data = await res.json();
      setWards(prev => [...prev, data.ward]);
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
    if (!editingWard) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/portal/admin/wards/${editingWard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, capacity, accentColor }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update ward');
      }

      const data = await res.json();
      setWards(prev =>
        prev.map(w => (w.id === editingWard.id ? data.ward : w))
      );
      setEditingWard(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(wardId: string) {
    if (!confirm('Are you sure you want to permanently delete this ward?')) return;
    setError('');

    try {
      const res = await fetch(`/api/portal/admin/wards/${wardId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete ward');
      }

      setWards(prev => prev.filter(w => w.id !== wardId));
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Hospital Wards</h1>
          <p className={styles.subtitle}>Configure inpatient departments, manage bed capacities, and accents colors</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>
          ➕ Add New Ward
        </button>
      </header>

      {/* Search Bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by name, code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Directory Table */}
      <div className={styles.card}>
        {filteredWards.length === 0 ? (
          <div className={styles.empty}>No wards configured.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ward Name</th>
                  <th>Short Code</th>
                  <th>Total Capacity</th>
                  <th>Accent Color</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWards.map(w => (
                  <tr key={w.id} className={styles.tableRow}>
                    <td>
                      <div className={styles.docName}>{w.name}</div>
                    </td>
                    <td>
                      <span
                        className={styles.codeTag}
                        style={{
                          backgroundColor: `${w.accentColor}15`,
                          color: w.accentColor,
                          border: `1px solid ${w.accentColor}30`,
                        }}
                      >
                        {w.code}
                      </span>
                    </td>
                    <td>{w.capacity} beds</td>
                    <td>
                      <div className={styles.colorCell}>
                        <div className={styles.colorDot} style={{ backgroundColor: w.accentColor }} />
                        <span className={styles.colorHex}>{w.accentColor}</span>
                      </div>
                    </td>
                    <td className={styles.actionsCell}>
                      <button className={styles.editBtn} onClick={() => openEdit(w)}>Edit</button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(w.id)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Ward Modal */}
      {isCreateOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <form onSubmit={handleCreate}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Add New Inpatient Ward</h3>
                <button type="button" className={styles.closeBtn} onClick={() => setIsCreateOpen(false)}>×</button>
              </div>

              <div className={styles.modalBody}>
                {error && <div className={styles.errorBox}>{error}</div>}

                <div className={styles.field}>
                  <label className={styles.label}>Ward Name</label>
                  <input type="text" className={styles.input} required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. ICU, General Male Ward" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Short Code</label>
                  <input type="text" className={styles.input} required value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. MW, ICU, CCU" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Total Bed Capacity</label>
                  <input type="number" className={styles.input} required value={capacity} onChange={e => setCapacity(e.target.value)} min="1" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Accent Hex Color</label>
                  <div className={styles.colorPickerWrapper}>
                    <input type="color" className={styles.colorPicker} value={accentColor} onChange={e => setAccentColor(e.target.value)} />
                    <input type="text" className={styles.input} value={accentColor} onChange={e => setAccentColor(e.target.value)} placeholder="#3b82f6" />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setIsCreateOpen(false)}>Cancel</button>
                <button type="submit" className={styles.completeBtn} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Ward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ward Modal */}
      {editingWard && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <form onSubmit={handleEdit}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Edit Inpatient Ward</h3>
                <button type="button" className={styles.closeBtn} onClick={() => setEditingWard(null)}>×</button>
              </div>

              <div className={styles.modalBody}>
                {error && <div className={styles.errorBox}>{error}</div>}

                <div className={styles.field}>
                  <label className={styles.label}>Ward Name</label>
                  <input type="text" className={styles.input} required value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Short Code</label>
                  <input type="text" className={styles.input} required value={code} onChange={e => setCode(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Total Bed Capacity</label>
                  <input type="number" className={styles.input} required value={capacity} onChange={e => setCapacity(e.target.value)} min="1" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Accent Hex Color</label>
                  <div className={styles.colorPickerWrapper}>
                    <input type="color" className={styles.colorPicker} value={accentColor} onChange={e => setAccentColor(e.target.value)} />
                    <input type="text" className={styles.input} value={accentColor} onChange={e => setAccentColor(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setEditingWard(null)}>Cancel</button>
                <button type="submit" className={styles.completeBtn} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Ward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
