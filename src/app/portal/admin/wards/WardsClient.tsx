'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './wards.module.css';

interface Ward {
  id: string;
  name: string;
  code: string;
  roomNo: string | null;
  floorNo: string | null;
  capacity: number;
  accentColor: string;
}

interface BedItem {
  id: string;
  bedNo: string;
  wardId: string;
  admissions: { id: string; patient: { name: string } }[];
}

interface Props {
  initialWards: Ward[];
}

export default function WardsClient({ initialWards }: Props) {
  const router = useRouter();
  const [wards, setWards] = useState<Ward[]>(initialWards);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'wards' | 'beds'>('wards');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWard, setEditingWard] = useState<Ward | null>(null);

  // Form states for ward
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [roomNo, setRoomNo] = useState('');
  const [floorNo, setFloorNo] = useState('');
  const [capacity, setCapacity] = useState('20');
  const [accentColor, setAccentColor] = useState('#3b82f6');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Bed Configuration State ──
  const [selectedWardId, setSelectedWardId] = useState<string>(initialWards[0]?.id ?? '');
  const [beds, setBeds] = useState<BedItem[]>([]);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [bedError, setBedError] = useState('');
  const [newBedNo, setNewBedNo] = useState('');
  const [editingBedNos, setEditingBedNos] = useState<Record<string, string>>({});
  const [savingBedId, setSavingBedId] = useState<string | null>(null);

  // ── Fetch beds for selected ward ──
  const fetchBeds = useCallback(async (wardId: string) => {
    if (!wardId) return;
    setLoadingBeds(true);
    setBedError('');

    try {
      const res = await fetch(`/api/portal/admin/wards/${wardId}/beds`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to fetch beds');
      }
      const data = await res.json();
      setBeds(data.beds || []);

      // Initialize editing bed numbers map
      const initialMap: Record<string, string> = {};
      (data.beds || []).forEach((b: BedItem) => {
        initialMap[b.id] = b.bedNo;
      });
      setEditingBedNos(initialMap);
    } catch (err: any) {
      setBedError(err.message);
    } finally {
      setLoadingBeds(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'beds' && selectedWardId) {
      fetchBeds(selectedWardId);
    }
  }, [activeTab, selectedWardId, fetchBeds]);

  // ── Filters ──
  const filteredWards = wards.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.code.toLowerCase().includes(search.toLowerCase())
  );

  // ── Handlers ──
  const openCreate = () => {
    setName('');
    setCode('');
    setRoomNo('');
    setFloorNo('');
    setCapacity('20');
    setAccentColor('#3b82f6');
    setError('');
    setIsCreateOpen(true);
  };

  const openEdit = (w: Ward) => {
    setEditingWard(w);
    setName(w.name);
    setCode(w.code);
    setRoomNo(w.roomNo ?? '');
    setFloorNo(w.floorNo ?? '');
    setCapacity(String(w.capacity));
    setAccentColor(w.accentColor);
    setError('');
  };

  const openConfigureBeds = (wardId: string) => {
    setSelectedWardId(wardId);
    setActiveTab('beds');
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/portal/admin/wards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, roomNo, floorNo, capacity, accentColor }),
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
        body: JSON.stringify({ name, code, roomNo, floorNo, capacity, accentColor }),
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

  // ── Bed Handlers ──
  async function handleAddBed(e: React.FormEvent) {
    e.preventDefault();
    if (!newBedNo.trim() || !selectedWardId) return;

    setBedError('');
    try {
      const res = await fetch(`/api/portal/admin/wards/${selectedWardId}/beds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bedNo: newBedNo }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to add bed');
      }

      const data = await res.json();
      setBeds(prev => [...prev, data.bed]);
      setEditingBedNos(prev => ({ ...prev, [data.bed.id]: data.bed.bedNo }));
      setNewBedNo('');
    } catch (err: any) {
      setBedError(err.message);
    }
  }

  async function handleGenerateDefaultBeds() {
    if (!selectedWardId) return;
    setBedError('');
    setLoadingBeds(true);

    try {
      const res = await fetch(`/api/portal/admin/wards/${selectedWardId}/beds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to generate beds');
      }

      const data = await res.json();
      setBeds(data.beds || []);
      const initialMap: Record<string, string> = {};
      (data.beds || []).forEach((b: BedItem) => {
        initialMap[b.id] = b.bedNo;
      });
      setEditingBedNos(initialMap);
    } catch (err: any) {
      setBedError(err.message);
    } finally {
      setLoadingBeds(false);
    }
  }

  async function handleRenameBed(bedId: string) {
    const updatedBedNo = editingBedNos[bedId];
    if (!updatedBedNo || !updatedBedNo.trim()) return;

    setSavingBedId(bedId);
    setBedError('');

    try {
      const res = await fetch(`/api/portal/admin/beds/${bedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bedNo: updatedBedNo.trim() }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to rename bed');
      }

      const data = await res.json();
      setBeds(prev => prev.map(b => (b.id === bedId ? data.bed : b)));
    } catch (err: any) {
      setBedError(err.message);
    } finally {
      setSavingBedId(null);
    }
  }

  async function handleDeleteBed(bedId: string) {
    if (!confirm('Are you sure you want to delete this bed?')) return;
    setBedError('');

    try {
      const res = await fetch(`/api/portal/admin/beds/${bedId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete bed');
      }

      setBeds(prev => prev.filter(b => b.id !== bedId));
    } catch (err: any) {
      setBedError(err.message);
    }
  }

  const selectedWard = wards.find(w => w.id === selectedWardId);
  const occupiedCount = beds.filter(b => b.admissions && b.admissions.length > 0).length;
  const availableCount = beds.length - occupiedCount;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Hospital Wards & Beds</h1>
          <p className={styles.subtitle}>Configure inpatient departments, room numbers, bed capacities, and bed numbers</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>
          ➕ Add New Ward
        </button>
      </header>

      {/* Tab Switcher */}
      <div className={styles.tabNav}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'wards' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('wards')}
        >
          🏢 Ward Directory
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'beds' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('beds')}
        >
          🛏️ Configure Beds
        </button>
      </div>

      {activeTab === 'wards' ? (
        <>
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
                      <th>Room No</th>
                      <th>Floor No</th>
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
                        <td>{w.roomNo || '—'}</td>
                        <td>{w.floorNo || '—'}</td>
                        <td>{w.capacity} beds</td>
                        <td>
                          <div className={styles.colorCell}>
                            <div className={styles.colorDot} style={{ backgroundColor: w.accentColor }} />
                            <span className={styles.colorHex}>{w.accentColor}</span>
                          </div>
                        </td>
                        <td className={styles.actionsCell}>
                          <button
                            className={styles.editBtn}
                            style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.3)' }}
                            onClick={() => openConfigureBeds(w.id)}
                          >
                            🛏️ Beds
                          </button>
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
        </>
      ) : (
        /* ── Configure Beds View ── */
        <div>
          <div className={styles.bedConfigHeader}>
            <div className={styles.wardSelectWrapper}>
              <label className={styles.label}>Select Ward:</label>
              <select
                className={styles.selectInput}
                value={selectedWardId}
                onChange={e => setSelectedWardId(e.target.value)}
              >
                {wards.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code}) {w.roomNo ? `• Rm ${w.roomNo}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedWard && (
              <div className={styles.bedStats}>
                <div className={styles.statPill}>
                  Capacity: <span className={styles.statValue}>{selectedWard.capacity}</span>
                </div>
                <div className={styles.statPill}>
                  Configured: <span className={styles.statValue}>{beds.length}</span>
                </div>
                <div className={styles.statPill} style={{ color: '#4ade80' }}>
                  Available: <span className={styles.statValue} style={{ color: '#4ade80' }}>{availableCount}</span>
                </div>
                <div className={styles.statPill} style={{ color: '#f87171' }}>
                  Occupied: <span className={styles.statValue} style={{ color: '#f87171' }}>{occupiedCount}</span>
                </div>
              </div>
            )}

            <div className={styles.bedActions}>
              <button
                className={styles.genBtn}
                onClick={handleGenerateDefaultBeds}
                disabled={loadingBeds}
              >
                ⚡ Auto-Generate Default Beds
              </button>
            </div>
          </div>

          {/* Add Bed Form */}
          <form onSubmit={handleAddBed} className={styles.addBedForm}>
            <label className={styles.label}>Add Custom Bed Number:</label>
            <input
              type="text"
              className={styles.input}
              style={{ width: '220px' }}
              value={newBedNo}
              onChange={e => setNewBedNo(e.target.value)}
              placeholder={`e.g. ${selectedWard?.code ?? 'BED'}-101`}
            />
            <button type="submit" className={styles.primaryBtn} style={{ padding: '8px 16px' }}>
              ➕ Add Bed
            </button>
          </form>

          {bedError && <div className={styles.errorBox} style={{ marginBottom: '20px' }}>⚠ {bedError}</div>}

          {/* Bed Cards Grid */}
          {loadingBeds ? (
            <div className={styles.empty}>Loading beds...</div>
          ) : beds.length === 0 ? (
            <div className={styles.empty}>
              <p style={{ marginBottom: '12px' }}>No beds configured for this ward yet.</p>
              <button className={styles.primaryBtn} onClick={handleGenerateDefaultBeds}>
                ⚡ Generate Default Beds ({selectedWard?.capacity ?? 20} Beds)
              </button>
            </div>
          ) : (
            <div className={styles.bedGrid}>
              {beds.map(b => {
                const isOccupied = b.admissions && b.admissions.length > 0;
                const patientName = isOccupied ? b.admissions[0].patient.name : null;
                const currentEditVal = editingBedNos[b.id] ?? b.bedNo;
                const isChanged = currentEditVal !== b.bedNo;

                return (
                  <div
                    key={b.id}
                    className={`${styles.bedCard} ${
                      isOccupied ? styles.bedCardOccupied : styles.bedCardAvailable
                    }`}
                  >
                    <div className={styles.bedCardHeader}>
                      <span style={{ fontSize: '1.1rem' }}>🛏️</span>
                      <span
                        className={`${styles.bedBadge} ${
                          isOccupied ? styles.badgeOccupied : styles.badgeAvailable
                        }`}
                      >
                        {isOccupied ? 'Occupied' : 'Available'}
                      </span>
                    </div>

                    <div className={styles.bedInputWrapper}>
                      <input
                        type="text"
                        className={styles.bedInput}
                        value={currentEditVal}
                        onChange={e => setEditingBedNos({ ...editingBedNos, [b.id]: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameBed(b.id);
                        }}
                        placeholder="Bed No"
                      />
                      {isChanged && (
                        <button
                          className={styles.saveBedBtn}
                          onClick={() => handleRenameBed(b.id)}
                          disabled={savingBedId === b.id}
                        >
                          {savingBedId === b.id ? '...' : 'Save'}
                        </button>
                      )}
                    </div>

                    {isOccupied && patientName && (
                      <div className={styles.patientMetaInfo}>
                        👤 {patientName}
                      </div>
                    )}

                    <div className={styles.bedCardFooter}>
                      <span className={styles.bedNoTag}>Original: {b.bedNo}</span>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteBed(b.id)}
                        disabled={isOccupied}
                        title={isOccupied ? 'Cannot delete occupied bed' : 'Delete bed'}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
                  <label className={styles.label}>Room Number</label>
                  <input type="text" className={styles.input} value={roomNo} onChange={e => setRoomNo(e.target.value)} placeholder="e.g. 101, A-12" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Floor Number</label>
                  <input type="text" className={styles.input} value={floorNo} onChange={e => setFloorNo(e.target.value)} placeholder="e.g. 1, Ground, 2" />
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
                  <label className={styles.label}>Room Number</label>
                  <input type="text" className={styles.input} value={roomNo} onChange={e => setRoomNo(e.target.value)} placeholder="e.g. 101, A-12" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Floor Number</label>
                  <input type="text" className={styles.input} value={floorNo} onChange={e => setFloorNo(e.target.value)} placeholder="e.g. 1, Ground, 2" />
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
