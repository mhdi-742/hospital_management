'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './announcements.module.css';

interface Announcement {
  id: string;
  text: string;
  board: 'OPD' | 'IPD' | 'OT' | 'ALL';
  isActive: boolean;
  createdAt: string;
}

interface Props {
  initialAnnouncements: Announcement[];
}

export default function AnnouncementsClient({ initialAnnouncements }: Props) {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [search, setSearch] = useState('');
  const [boardFilter, setBoardFilter] = useState('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);

  // Form states
  const [text, setText] = useState('');
  const [board, setBoard] = useState<'OPD' | 'IPD' | 'OT' | 'ALL'>('ALL');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Filters ──
  const filteredAnnouncements = announcements.filter(ann => {
    const matchesSearch = ann.text.toLowerCase().includes(search.toLowerCase());
    const matchesBoard = boardFilter === 'all' || ann.board === boardFilter;
    return matchesSearch && matchesBoard;
  });

  // ── Handlers ──
  const openCreate = () => {
    setText('');
    setBoard('ALL');
    setIsActive(true);
    setError('');
    setIsCreateOpen(true);
  };

  const openEdit = (ann: Announcement) => {
    setEditingAnn(ann);
    setText(ann.text);
    setBoard(ann.board);
    setIsActive(ann.isActive);
    setError('');
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/portal/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, board, isActive }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create announcement');
      }

      const data = await res.json();
      setAnnouncements(prev => [data.announcement, ...prev]);
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
    if (!editingAnn) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/portal/admin/announcements/${editingAnn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, board, isActive }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update announcement');
      }

      const data = await res.json();
      setAnnouncements(prev =>
        prev.map(a => (a.id === editingAnn.id ? data.announcement : a))
      );
      setEditingAnn(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(annId: string) {
    if (!confirm('Are you sure you want to permanently delete this announcement?')) return;
    setError('');

    try {
      const res = await fetch(`/api/portal/admin/announcements/${annId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete announcement');
      }

      setAnnouncements(prev => prev.filter(a => a.id !== annId));
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Hospital Announcements</h1>
          <p className={styles.subtitle}>Broadcast alerts, instructions, and messages to display screens and dashboards</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>
          📢 Write Announcement
        </button>
      </header>

      {/* Search Bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by text..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
          className={styles.selectInput}
          value={boardFilter}
          onChange={e => setBoardFilter(e.target.value)}
        >
          <option value="all">All Boards</option>
          <option value="ALL">Global (ALL Screens)</option>
          <option value="OPD">OPD Display Board</option>
          <option value="IPD">IPD Display Board</option>
          <option value="OT">OT Display Board</option>
        </select>
      </div>

      {/* Directory Table */}
      <div className={styles.card}>
        {filteredAnnouncements.length === 0 ? (
          <div className={styles.empty}>No announcements broadcasting.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Announcement Text</th>
                  <th>Display Board</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAnnouncements.map(ann => (
                  <tr key={ann.id} className={styles.tableRow}>
                    <td className={styles.textCol}>{ann.text}</td>
                    <td>
                      <span className={`${styles.boardTag} ${styles[ann.board]}`}>{ann.board}</span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${ann.isActive ? styles.active : styles.inactive}`}>
                        {ann.isActive ? 'Active (Live)' : 'Inactive'}
                      </span>
                    </td>
                    <td className={styles.dateCol}>
                      {new Date(ann.createdAt).toLocaleDateString()}
                    </td>
                    <td className={styles.actionsCell}>
                      <button className={styles.editBtn} onClick={() => openEdit(ann)}>Edit</button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(ann.id)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Announcement Modal */}
      {isCreateOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <form onSubmit={handleCreate}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Broadcast Announcement</h3>
                <button type="button" className={styles.closeBtn} onClick={() => setIsCreateOpen(false)}>×</button>
              </div>

              <div className={styles.modalBody}>
                {error && <div className={styles.errorBox}>{error}</div>}

                <div className={styles.field}>
                  <label className={styles.label}>Announcement Message</label>
                  <textarea
                    className={`${styles.input} ${styles.textarea}`}
                    rows={4}
                    required
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Enter the message to display on the board tickers..."
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Target Display Board</label>
                  <select className={styles.input} value={board} onChange={e => setBoard(e.target.value as any)}>
                    <option value="ALL">All Boards (Global)</option>
                    <option value="OPD">OPD Display Board Only</option>
                    <option value="IPD">IPD Display Board Only</option>
                    <option value="OT">OT Display Board Only</option>
                  </select>
                </div>
                <div className={styles.fieldCheckbox}>
                  <input
                    type="checkbox"
                    id="ann-active"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                  />
                  <label htmlFor="ann-active" className={styles.checkboxLabel}>
                    Broadcast Immediately (Active)
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setIsCreateOpen(false)}>Cancel</button>
                <button type="submit" className={styles.completeBtn} disabled={loading}>
                  {loading ? 'Broadcasting...' : 'Broadcast Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Announcement Modal */}
      {editingAnn && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <form onSubmit={handleEdit}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Edit Announcement</h3>
                <button type="button" className={styles.closeBtn} onClick={() => setEditingAnn(null)}>×</button>
              </div>

              <div className={styles.modalBody}>
                {error && <div className={styles.errorBox}>{error}</div>}

                <div className={styles.field}>
                  <label className={styles.label}>Announcement Message</label>
                  <textarea
                    className={`${styles.input} ${styles.textarea}`}
                    rows={4}
                    required
                    value={text}
                    onChange={e => setText(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Target Display Board</label>
                  <select className={styles.input} value={board} onChange={e => setBoard(e.target.value as any)}>
                    <option value="ALL">All Boards (Global)</option>
                    <option value="OPD">OPD Display Board Only</option>
                    <option value="IPD">IPD Display Board Only</option>
                    <option value="OT">OT Display Board Only</option>
                  </select>
                </div>
                <div className={styles.fieldCheckbox}>
                  <input
                    type="checkbox"
                    id="ann-edit-active"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                  />
                  <label htmlFor="ann-edit-active" className={styles.checkboxLabel}>
                    Broadcast Live (Active)
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setEditingAnn(null)}>Cancel</button>
                <button type="submit" className={styles.completeBtn} disabled={loading}>
                  {loading ? 'Saving...' : 'Save broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
