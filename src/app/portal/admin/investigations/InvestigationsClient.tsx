'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './investigations.module.css';

interface InvestigationTest {
  id: string;
  code: string | null;
  name: string;
  amount: number;
  reportTime: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  initialTests: InvestigationTest[];
  initialCategories: string[];
}

export default function InvestigationsClient({ initialTests, initialCategories }: Props) {
  const router = useRouter();
  const [tests, setTests] = useState<InvestigationTest[]>(initialTests);
  const [categories, setCategories] = useState<string[]>(initialCategories);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<InvestigationTest | null>(null);

  // Form
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formReportTime, setFormReportTime] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Derived
  const filteredTests = tests.filter((t) => {
    const matchSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.code && t.code.toLowerCase().includes(search.toLowerCase()));
    const matchCategory = !filterCategory || t.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const activeCount = tests.filter((t) => t.isActive).length;
  const inactiveCount = tests.length - activeCount;

  // ── Open modals ──

  const openCreate = () => {
    setFormName('');
    setFormCode('');
    setFormAmount('');
    setFormCategory('');
    setFormReportTime('');
    setError('');
    setIsCreateOpen(true);
  };

  const openEdit = (t: InvestigationTest) => {
    setEditingTest(t);
    setFormName(t.name);
    setFormCode(t.code ?? '');
    setFormAmount(String(t.amount));
    setFormCategory(t.category ?? '');
    setFormReportTime(t.reportTime ?? '');
    setError('');
  };

  // ── CRUD handlers ──

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/portal/admin/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          code: formCode,
          amount: formAmount,
          category: formCategory,
          reportTime: formReportTime,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create test');
      }

      const data = await res.json();
      setTests((prev) => [...prev, data.test]);

      // Add category if new
      if (data.test.category && !categories.includes(data.test.category)) {
        setCategories((prev) => [...prev, data.test.category]);
      }

      setIsCreateOpen(false);
      setSuccess(`✅ "${data.test.name}" added successfully`);
      setTimeout(() => setSuccess(''), 4000);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTest) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/portal/admin/investigations/${editingTest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          code: formCode,
          amount: formAmount,
          category: formCategory,
          reportTime: formReportTime,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update test');
      }

      const data = await res.json();
      setTests((prev) => prev.map((t) => (t.id === editingTest.id ? data.test : t)));

      // Add category if new
      if (data.test.category && !categories.includes(data.test.category)) {
        setCategories((prev) => [...prev, data.test.category]);
      }

      setEditingTest(null);
      setSuccess(`✅ "${data.test.name}" updated successfully`);
      setTimeout(() => setSuccess(''), 4000);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(testId: string, testName: string) {
    if (!confirm(`Are you sure you want to delete "${testName}"?`)) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/portal/admin/investigations/${testId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete test');
      }

      const data = await res.json();

      if (data.softDeleted) {
        // Test was deactivated instead of deleted
        setTests((prev) =>
          prev.map((t) => (t.id === testId ? { ...t, isActive: false } : t))
        );
        setSuccess(`⚠️ ${data.message}`);
      } else {
        setTests((prev) => prev.filter((t) => t.id !== testId));
        setSuccess(`✅ "${testName}" deleted successfully`);
      }
      setTimeout(() => setSuccess(''), 5000);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleToggleActive(test: InvestigationTest) {
    try {
      const res = await fetch(`/api/portal/admin/investigations/${test.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !test.isActive }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to toggle status');
      }

      const data = await res.json();
      setTests((prev) => prev.map((t) => (t.id === test.id ? data.test : t)));
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // ── Form component (shared between create and edit) ──

  const renderForm = (onSubmit: (e: React.FormEvent) => void, submitLabel: string) => (
    <form onSubmit={onSubmit}>
      <div className={styles.modalBody}>
        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={styles.field}>
          <label className={styles.label}>Test / Investigation Name *</label>
          <input
            type="text"
            className={styles.input}
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Complete Blood Count (CBC)"
          />
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>Test Code</label>
            <input
              type="text"
              className={styles.input}
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              placeholder="e.g. CBC-001"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Rate / Amount (₹) *</label>
            <input
              type="number"
              className={styles.input}
              required
              step="any"
              min="0"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="e.g. 350"
            />
          </div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>Category</label>
            <input
              type="text"
              className={styles.input}
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              placeholder="e.g. Pathology, Radiology, Biochemistry"
              list="categorySuggestions"
            />
            <datalist id="categorySuggestions">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Report Turnaround Time</label>
            <input
              type="text"
              className={styles.input}
              value={formReportTime}
              onChange={(e) => setFormReportTime(e.target.value)}
              placeholder="e.g. Same Day, 24 Hours, 3 Days"
            />
          </div>
        </div>
      </div>

      <div className={styles.modalFooter}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => {
            setIsCreateOpen(false);
            setEditingTest(null);
          }}
        >
          Cancel
        </button>
        <button type="submit" className={styles.completeBtn} disabled={loading}>
          {loading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Investigation Rate Chart</h1>
          <p className={styles.subtitle}>
            Manage diagnostic tests, pathology &amp; radiology items and their pricing
          </p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>
          ➕ Add New Test
        </button>
      </header>

      {success && <div className={styles.successBox}>{success}</div>}

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statPill}>
          Total Tests: <span className={styles.statValue}>{tests.length}</span>
        </div>
        <div className={styles.statPill} style={{ color: '#4ade80' }}>
          Active: <span className={styles.statValue} style={{ color: '#4ade80' }}>{activeCount}</span>
        </div>
        {inactiveCount > 0 && (
          <div className={styles.statPill} style={{ color: '#f87171' }}>
            Inactive: <span className={styles.statValue} style={{ color: '#f87171' }}>{inactiveCount}</span>
          </div>
        )}
        <div className={styles.statPill}>
          Categories: <span className={styles.statValue}>{categories.length}</span>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by test name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.selectInput}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className={styles.card}>
        {filteredTests.length === 0 ? (
          <div className={styles.empty}>
            {tests.length === 0
              ? 'No investigation tests configured yet. Click "Add New Test" to get started.'
              : 'No tests match your search criteria.'}
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Test Name</th>
                  <th>Category</th>
                  <th>Turnaround</th>
                  <th style={{ textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTests.map((t) => (
                  <tr key={t.id} className={styles.tableRow} style={{ opacity: t.isActive ? 1 : 0.55 }}>
                    <td>
                      {t.code ? (
                        <span className={styles.codeTag}>{t.code}</span>
                      ) : (
                        <span style={{ color: '#475569' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.testName}>{t.name}</div>
                    </td>
                    <td>
                      <span className={styles.categoryBadge}>{t.category || 'General'}</span>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      {t.reportTime || 'Same Day'}
                    </td>
                    <td className={styles.rateCell}>₹{t.amount}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={t.isActive ? styles.statusActive : styles.statusInactive}
                        onClick={() => handleToggleActive(t)}
                        title={`Click to ${t.isActive ? 'deactivate' : 'activate'}`}
                      >
                        {t.isActive ? '● Active' : '● Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        <button className={styles.editBtn} onClick={() => openEdit(t)}>
                          Edit
                        </button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(t.id, t.name)}>
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add New Investigation Test</h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setIsCreateOpen(false)}
              >
                ×
              </button>
            </div>
            {renderForm(handleCreate, 'Create Test')}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTest && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit Investigation Test</h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setEditingTest(null)}
              >
                ×
              </button>
            </div>
            {renderForm(handleEdit, 'Save Changes')}
          </div>
        </div>
      )}
    </div>
  );
}
