'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface InvestigationTest {
  id?: string;
  code?: string;
  name: string;
  amount: number;
  reportTime?: string;
  category?: string;
}

interface ItemRow {
  testId?: string;
  testName: string;
  qty: number;
  rate: number;
  amount: number;
}

interface Registration {
  id: string;
  regNo: string;
  patientName: string;
  patientAge?: string;
  gender?: string;
  contact?: string;
  referredByDoctor?: string;
  totalAmount: number;
  discount: number;
  netPayable: number;
  advancePaid: number;
  dueAmount: number;
  status: string;
  createdAt: string;
  items: { id: string; testName: string; qty: number; rate: number; amount: number }[];
}

export default function InvestigationRegistrationPage() {
  const [tab, setTab] = useState<'register' | 'history' | 'catalog'>('register');
  const [catalog, setCatalog] = useState<InvestigationTest[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Form State
  const [form, setForm] = useState({
    patientName: '',
    patientAge: '',
    gender: '',
    contact: '',
    address: '',
    referredByDoctor: '',
  });

  const [items, setItems] = useState<ItemRow[]>([
    { testName: '', qty: 1, rate: 0, amount: 0 },
  ]);

  const [discount, setDiscount] = useState<number>(0);
  const [advancePaid, setAdvancePaid] = useState<number>(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // History State
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Catalog search
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('');

  // Fetch rate chart catalog
  useEffect(() => {
    fetch('/api/portal/investigations')
      .then((r) => r.json())
      .then((d) => {
        setCatalog(d.tests || []);
        setLoadingCatalog(false);
      })
      .catch(() => setLoadingCatalog(false));
  }, []);

  // Fetch history
  const fetchHistory = useCallback(() => {
    setLoadingHistory(true);
    const params = new URLSearchParams();
    if (historySearch) params.set('search', historySearch);
    fetch(`/api/portal/admission/investigations?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setRegistrations(d.registrations || []);
        setLoadingHistory(false);
      })
      .catch(() => setLoadingHistory(false));
  }, [historySearch]);

  useEffect(() => {
    if (tab === 'history') {
      fetchHistory();
    }
  }, [tab, fetchHistory]);

  const updateForm = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  // Row operations
  const addRow = () => {
    setItems((prev) => [...prev, { testName: '', qty: 1, rate: 0, amount: 0 }]);
  };

  const removeRow = (index: number) => {
    if (items.length <= 1) {
      setItems([{ testName: '', qty: 1, rate: 0, amount: 0 }]);
    } else {
      setItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleTestNameChange = (index: number, nameVal: string) => {
    setItems((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], testName: nameVal };

      // Check if matches an existing test in the catalog
      const matched = catalog.find(
        (c) => c.name.trim().toLowerCase() === nameVal.trim().toLowerCase()
      );

      if (matched) {
        row.testId = matched.id;
        row.rate = matched.amount;
        row.amount = (row.qty || 1) * matched.amount;
      }
      updated[index] = row;
      return updated;
    });
  };

  const handleRateChange = (index: number, rateVal: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], rate: rateVal, amount: (updated[index].qty || 1) * rateVal };
      updated[index] = row;
      return updated;
    });
  };

  const handleQtyChange = (index: number, qtyVal: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], qty: qtyVal, amount: qtyVal * (updated[index].rate || 0) };
      updated[index] = row;
      return updated;
    });
  };

  // Calculations
  const subTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const netPayable = Math.max(0, subTotal - (discount || 0));
  const dueAmount = Math.max(0, netPayable - (advancePaid || 0));

  // Build link to billing app with all pre-filled items
  const buildBillingLink = () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const billDate = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;

    const params = new URLSearchParams();
    params.set('patientName', form.patientName);
    params.set('patientAge', form.patientAge ? `${form.patientAge} Years` : '');
    params.set('underDoctor', form.referredByDoctor);
    params.set('caseType', 'Investigation');
    params.set('billDate', billDate);
    if (advancePaid > 0) params.set('advance', String(advancePaid));

    return `/billing/index.html?${params.toString()}`;
  };

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientName.trim()) {
      setError('Please enter patient name');
      return;
    }

    const validItems = items.filter((i) => i.testName.trim() !== '');
    if (validItems.length === 0) {
      setError('Please add at least one test in the list');
      return;
    }

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/portal/admission/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: validItems,
          discount,
          advancePaid,
        }),
      });

      setSubmitting(false);

      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to register investigation');
        return;
      }

      const data = await res.json();
      setSuccess(`✅ Investigation Registered! Order ID: ${data.regNo}`);

      // Reset form
      setForm({
        patientName: '',
        patientAge: '',
        gender: '',
        contact: '',
        address: '',
        referredByDoctor: '',
      });
      setItems([{ testName: '', qty: 1, rate: 0, amount: 0 }]);
      setDiscount(0);
      setAdvancePaid(0);
    } catch (err: any) {
      setSubmitting(false);
      setError('Network error: ' + err.message);
    }
  }

  // Filter catalog
  const filteredCatalog = catalog.filter((c) => {
    const matchSearch =
      !catalogSearch ||
      c.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      (c.code && c.code.toLowerCase().includes(catalogSearch.toLowerCase()));
    const matchCategory = !catalogCategory || c.category === catalogCategory;
    return matchSearch && matchCategory;
  });

  const categories = Array.from(new Set(catalog.map((c) => c.category).filter(Boolean)));

  return (
    <div className={styles.page}>
      {/* Rate Chart Datalist for autocomplete */}
      <datalist id="rateChartDatalist">
        {catalog.map((test) => (
          <option key={test.code || test.name} value={test.name}>
            ₹{test.amount} {test.category ? `• ${test.category}` : ''}
          </option>
        ))}
      </datalist>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Investigation Registration</h1>
          <p className={styles.subtitle}>
            Register diagnostic pathology &amp; radiology tests as per hospital rate chart
          </p>
        </div>
        <div className={styles.headerBtns}>
          <a
            href="/billing/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.billingPortalBtn}
          >
            🧾 Open Billing Portal
          </a>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${tab === 'register' ? styles.tabActive : ''}`}
          onClick={() => setTab('register')}
          type="button"
        >
          ➕ New Registration
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'history' ? styles.tabActive : ''}`}
          onClick={() => setTab('history')}
          type="button"
        >
          📋 Recent Registrations
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'catalog' ? styles.tabActive : ''}`}
          onClick={() => setTab('catalog')}
          type="button"
        >
          📖 Rate Chart Catalog ({catalog.length})
        </button>
      </div>

      {/* TAB 1: NEW REGISTRATION */}
      {tab === 'register' && (
        <form onSubmit={handleRegister}>
          {error && <div className={styles.errorBox}>⚠️ {error}</div>}
          {success && <div className={styles.successBox}>{success}</div>}

          {/* Patient Details */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>1. Patient Details</h2>
            <div className={styles.grid3}>
              <div className={styles.field}>
                <label className={styles.label}>Patient Name *</label>
                <input
                  className={styles.input}
                  placeholder="e.g. Ramesh Chandra"
                  value={form.patientName}
                  onChange={(e) => updateForm('patientName', e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Age</label>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="e.g. 45"
                  value={form.patientAge}
                  onChange={(e) => updateForm('patientAge', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Gender</label>
                <select
                  className={styles.input}
                  value={form.gender}
                  onChange={(e) => updateForm('gender', e.target.value)}
                >
                  <option value="">Select gender...</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className={styles.grid3}>
              <div className={styles.field}>
                <label className={styles.label}>Contact No.</label>
                <input
                  className={styles.input}
                  placeholder="e.g. 9876543210"
                  value={form.contact}
                  onChange={(e) => updateForm('contact', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Referred By Doctor</label>
                <input
                  className={styles.input}
                  placeholder="e.g. Dr. Priya Sharma / Self"
                  value={form.referredByDoctor}
                  onChange={(e) => updateForm('referredByDoctor', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Address</label>
                <input
                  className={styles.input}
                  placeholder="e.g. Raiganj, Uttar Dinajpur"
                  value={form.address}
                  onChange={(e) => updateForm('address', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Test Items Selection */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>2. Select Tests &amp; Investigations</h2>
            <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: '0 0 14px' }}>
              Choose from the official Rate Chart or type any custom test name and rate freely.
            </p>

            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>SL</th>
                  <th>Test / Investigation Name</th>
                  <th style={{ width: '100px' }}>Qty</th>
                  <th style={{ width: '130px' }}>Rate (₹)</th>
                  <th style={{ width: '130px' }}>Amount (₹)</th>
                  <th style={{ width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ color: '#94a3b8', textAlign: 'center' }}>{idx + 1}</td>
                    <td>
                      <input
                        list="rateChartDatalist"
                        className={styles.tableInput}
                        placeholder="Type or select test from rate chart..."
                        value={item.testName}
                        onChange={(e) => handleTestNameChange(idx, e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        className={styles.tableInput}
                        value={item.qty}
                        onChange={(e) => handleQtyChange(idx, parseInt(e.target.value, 10) || 1)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        className={styles.tableInput}
                        placeholder="0.00"
                        value={item.rate || ''}
                        onChange={(e) => handleRateChange(idx, parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td style={{ fontWeight: 600, color: '#f1f5f9' }}>
                      ₹{item.amount.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className={styles.delBtn}
                        onClick={() => removeRow(idx)}
                        title="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button type="button" className={styles.addRowBtn} onClick={addRow}>
              + Add Test Row
            </button>

            {/* Totals Summary */}
            <div className={styles.summaryBox}>
              <div className={styles.summaryContent}>
                <div className={styles.summaryRow}>
                  <span>Sub Total:</span>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>₹{subTotal.toFixed(2)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Discount (₹):</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={styles.summaryInput}
                    value={discount || ''}
                    placeholder="0"
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className={`${styles.summaryRow} ${styles.summaryRowBold}`}>
                  <span>Net Payable:</span>
                  <span style={{ color: '#60a5fa' }}>₹{netPayable.toFixed(2)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Advance Payment (₹):</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={styles.summaryInput}
                    value={advancePaid || ''}
                    placeholder="0"
                    onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className={styles.summaryRow}>
                  <span>Due Balance:</span>
                  <span style={{ fontWeight: 700, color: dueAmount > 0 ? '#f87171' : '#4ade80' }}>
                    ₹{dueAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.formActions}>
              <a
                href={buildBillingLink()}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.billBtn}
              >
                🧾 Create Bill in Billing App
              </a>
              <button type="submit" className={styles.submitBtn} disabled={submitting}>
                {submitting ? 'Registering...' : 'Save & Register Investigation'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: RECENT REGISTRATIONS */}
      {tab === 'history' && (
        <div className={styles.card}>
          <div className={styles.searchBar}>
            <input
              type="search"
              className={styles.input}
              style={{ minWidth: '300px' }}
              placeholder="Search by patient name, order ID, or phone..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
            <button className={styles.submitBtn} onClick={fetchHistory} type="button">
              Search
            </button>
          </div>

          {loadingHistory ? (
            <p style={{ color: '#94a3b8' }}>Loading registrations...</p>
          ) : registrations.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No investigation registrations found.</p>
          ) : (
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>Order No.</th>
                  <th>Patient</th>
                  <th>Contact</th>
                  <th>Referred Doctor</th>
                  <th>Tests</th>
                  <th>Net Total</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg) => (
                  <tr key={reg.id}>
                    <td style={{ fontWeight: 600, color: '#a78bfa' }}>{reg.regNo}</td>
                    <td style={{ fontWeight: 600, color: '#f1f5f9' }}>
                      {reg.patientName}
                      {reg.patientAge ? ` (${reg.patientAge}y)` : ''}
                    </td>
                    <td style={{ color: '#94a3b8' }}>{reg.contact || '—'}</td>
                    <td style={{ color: '#cbd5e1' }}>{reg.referredByDoctor || 'Self'}</td>
                    <td>
                      <span className={styles.badge}>
                        {reg.items.length} test{reg.items.length > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#60a5fa' }}>
                      ₹{reg.netPayable.toFixed(2)}
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background:
                            reg.status === 'completed'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                          color: reg.status === 'completed' ? '#4ade80' : '#fbbf24',
                        }}
                      >
                        {reg.status}
                      </span>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                      {new Date(reg.createdAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 3: RATE CHART CATALOG */}
      {tab === 'catalog' && (
        <div className={styles.card}>
          <div className={styles.searchBar}>
            <input
              type="search"
              className={styles.input}
              style={{ minWidth: '260px', flex: 1 }}
              placeholder="Search tests by name or code..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
            />
            <select
              className={styles.input}
              value={catalogCategory}
              onChange={(e) => setCatalogCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Code</th>
                <th>Investigation Test</th>
                <th>Category</th>
                <th>Turnaround Time</th>
                <th style={{ textAlign: 'right' }}>Rate (₹)</th>
              </tr>
            </thead>
            <tbody>
              {filteredCatalog.map((test) => (
                <tr key={test.code || test.name}>
                  <td style={{ color: '#94a3b8', fontWeight: 600 }}>{test.code || '—'}</td>
                  <td style={{ color: '#f8fafc', fontWeight: 600 }}>{test.name}</td>
                  <td>
                    <span className={styles.badge}>{test.category || 'Pathology'}</span>
                  </td>
                  <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                    {test.reportTime || 'Same Day'}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#4ade80',
                      fontSize: '0.95rem',
                    }}
                  >
                    ₹{test.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
