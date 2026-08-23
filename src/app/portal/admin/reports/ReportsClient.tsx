'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './reports.module.css';

interface Props {
  initialStartDate?: string;
  initialEndDate?: string;
}

export default function ReportsClient({ initialStartDate, initialEndDate }: Props) {
  // Today's date string YYYY-MM-DD helper
  const getTodayStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const [preset, setPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'last30' | 'custom'>('today');
  const [startDate, setStartDate] = useState(initialStartDate || getTodayStr());
  const [endDate, setEndDate] = useState(initialEndDate || getTodayStr());
  const [search, setSearch] = useState('');
  const [payMode, setPayMode] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'hospital' | 'investigation' | 'advance'>('all');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Set date preset helpers
  const applyPreset = (type: 'today' | 'yesterday' | 'week' | 'month' | 'last30') => {
    setPreset(type);
    const now = new Date();

    if (type === 'today') {
      const todayStr = getTodayStr();
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (type === 'week') {
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
      const firstStr = firstDay.toISOString().split('T')[0];
      setStartDate(firstStr);
      setEndDate(getTodayStr());
    } else if (type === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstStr = firstDay.toISOString().split('T')[0];
      setStartDate(firstStr);
      setEndDate(getTodayStr());
    } else if (type === 'last30') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(getTodayStr());
    }
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (search) params.set('search', search);
      if (payMode) params.set('payMode', payMode);

      const res = await fetch(`/api/portal/reports/transactions?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to fetch report data:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, search, payMode]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!data || !data.unifiedLedger || data.unifiedLedger.length === 0) {
      alert('No transaction records to export for this date range.');
      return;
    }

    const headers = [
      'Type',
      'Bill / Receipt No',
      'Date',
      'Patient Name',
      'Age',
      'Doctor / Ref',
      'Case Type',
      'Items / Remarks',
      'Subtotal (INR)',
      'Discount (INR)',
      'Net Amount (INR)',
      'Paid Amount (INR)',
      'Due Balance (INR)',
      'Payment Mode',
      'Billed By',
    ];

    const rows = data.unifiedLedger.map((t: any) => [
      `"${t.typeLabel}"`,
      `"${t.refNo}"`,
      `"${t.date}"`,
      `"${t.patientName || ''}"`,
      `"${t.patientAge || ''}"`,
      `"${t.doctor || ''}"`,
      `"${t.caseType || ''}"`,
      `"${(t.itemsSummary || '').replace(/"/g, '""')}"`,
      t.subTotal || 0,
      t.discount || 0,
      t.netAmount || 0,
      t.paidAmount || 0,
      t.dueAmount || 0,
      `"${t.payMode || 'Cash'}"`,
      `"${t.billedBy || 'Staff'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  const overall = data?.overallSummary || {
    totalTransactions: 0,
    totalGrossAmount: 0,
    totalDiscounts: 0,
    totalNetBilled: 0,
    totalCollected: 0,
    totalDuePending: 0,
  };

  const hospitalSum = data?.hospitalSummary || { count: 0, subTotal: 0, discount: 0, netPayable: 0 };
  const investigationSum = data?.investigationSummary || { count: 0, subTotal: 0, discount: 0, netPayable: 0, totalPaid: 0, dueAmount: 0 };
  const advanceSum = data?.advanceSummary || { count: 0, totalAmount: 0 };
  const paymentModes = data?.paymentModeTotals || {};
  const ledger = data?.unifiedLedger || [];

  // Filter list based on tab
  const displayLedger = ledger.filter((item: any) => {
    if (activeTab === 'hospital') return item.type === 'HOSPITAL';
    if (activeTab === 'investigation') return item.type === 'INVESTIGATION';
    if (activeTab === 'advance') return item.type === 'ADVANCE';
    return true;
  });

  return (
    <div className={styles.container}>
      {/* ── Screen Header ── */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <span>📊</span> Financial &amp; Transaction Reports
          </h1>
          <p className={styles.subtitle}>
            Comprehensive revenue analytics, hospital bills, diagnostic investigations, and advance collections
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryBtn} onClick={handleExportCSV} title="Export current report to CSV/Excel">
            📥 Export CSV
          </button>
          <button className={styles.primaryBtn} onClick={handlePrint} title="Print official A4 financial summary sheet">
            🖨️ Print Statement
          </button>
        </div>
      </header>

      {/* ── Filter Card (Date Range & Search) ── */}
      <div className={styles.filterCard}>
        {/* Quick Date Presets */}
        <div className={styles.presetRow}>
          <span className={styles.presetLabel}>Date Range:</span>
          <button
            className={`${styles.presetBtn} ${preset === 'today' ? styles.presetActive : ''}`}
            onClick={() => applyPreset('today')}
          >
            Today
          </button>
          <button
            className={`${styles.presetBtn} ${preset === 'yesterday' ? styles.presetActive : ''}`}
            onClick={() => applyPreset('yesterday')}
          >
            Yesterday
          </button>
          <button
            className={`${styles.presetBtn} ${preset === 'week' ? styles.presetActive : ''}`}
            onClick={() => applyPreset('week')}
          >
            This Week
          </button>
          <button
            className={`${styles.presetBtn} ${preset === 'month' ? styles.presetActive : ''}`}
            onClick={() => applyPreset('month')}
          >
            This Month
          </button>
          <button
            className={`${styles.presetBtn} ${preset === 'last30' ? styles.presetActive : ''}`}
            onClick={() => applyPreset('last30')}
          >
            Last 30 Days
          </button>
        </div>

        {/* Custom Date Inputs & Search */}
        <div className={styles.customDateRow}>
          <div className={styles.dateInputGroup}>
            <span className={styles.dateLabel}>From:</span>
            <input
              type="date"
              className={styles.dateInput}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPreset('custom');
              }}
            />
          </div>

          <div className={styles.dateInputGroup}>
            <span className={styles.dateLabel}>To:</span>
            <input
              type="date"
              className={styles.dateInput}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPreset('custom');
              }}
            />
          </div>

          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by Patient, Bill No, Doctor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className={styles.selectInput}
            value={payMode}
            onChange={(e) => setPayMode(e.target.value)}
          >
            <option value="">All Payment Modes</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI / Online</option>
            <option value="Card">Card</option>
            <option value="Cheque">Cheque</option>
          </select>
        </div>
      </div>

      {/* ── Top Financial KPI Cards ── */}
      <div className={styles.kpiGrid}>
        {/* Total Collected */}
        <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Total Collections (Net)</span>
            <span className={styles.kpiIcon}>💰</span>
          </div>
          <div className={styles.kpiValue}>₹{overall.totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div className={styles.kpiSub}>
            Across <span className={styles.kpiSubHighlight}>{overall.totalTransactions}</span> total transactions
          </div>
        </div>

        {/* Main Hospital Bills */}
        <div className={`${styles.kpiCard} ${styles.kpiBlue}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Main Hospital Bills</span>
            <span className={styles.kpiIcon}>🏥</span>
          </div>
          <div className={styles.kpiValue}>₹{hospitalSum.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div className={styles.kpiSub}>
            <span>{hospitalSum.count} bills</span>
            {hospitalSum.discount > 0 && <span>• ₹{hospitalSum.discount} disc</span>}
          </div>
        </div>

        {/* Investigation Bills */}
        <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Investigation Lab Bills</span>
            <span className={styles.kpiIcon}>🔬</span>
          </div>
          <div className={styles.kpiValue}>₹{investigationSum.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div className={styles.kpiSub}>
            <span>{investigationSum.count} tests</span>
            {investigationSum.dueAmount > 0 && (
              <span style={{ color: '#f87171' }}>• ₹{investigationSum.dueAmount} due</span>
            )}
          </div>
        </div>

        {/* Advance Payments */}
        <div className={`${styles.kpiCard} ${styles.kpiOrange}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Advance Deposits</span>
            <span className={styles.kpiIcon}>💳</span>
          </div>
          <div className={styles.kpiValue}>₹{advanceSum.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div className={styles.kpiSub}>
            <span>{advanceSum.count} receipts</span>
          </div>
        </div>

        {/* Total Discounts */}
        <div className={`${styles.kpiCard} ${styles.kpiRed}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Total Discounts</span>
            <span className={styles.kpiIcon}>🏷️</span>
          </div>
          <div className={styles.kpiValue}>₹{overall.totalDiscounts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div className={styles.kpiSub}>
            Gross: ₹{overall.totalGrossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* ── Payment Modes Breakdown Bar ── */}
      <div className={styles.paymentModeBar}>
        <div className={styles.pmTitle}>
          <span>💳</span> Payment Mode Breakdown:
        </div>
        <div className={styles.pmPills}>
          <div className={styles.pmPill}>
            <span>💵 Cash:</span>
            <span className={styles.pmAmount}>₹{(paymentModes['Cash']?.amount || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className={styles.pmPill}>
            <span>📱 UPI / Online:</span>
            <span className={styles.pmAmount}>₹{(paymentModes['UPI / Online']?.amount || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className={styles.pmPill}>
            <span>💳 Card:</span>
            <span className={styles.pmAmount}>₹{(paymentModes['Debit / Credit Card']?.amount || 0).toLocaleString('en-IN')}</span>
          </div>
          {paymentModes['Cheque']?.amount > 0 && (
            <div className={styles.pmPill}>
              <span>🏦 Cheque:</span>
              <span className={styles.pmAmount}>₹{(paymentModes['Cheque']?.amount || 0).toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section Tabs ── */}
      <div className={styles.tabNav}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('all')}
        >
          📑 All Transactions
          <span className={styles.tabBadge}>{ledger.length}</span>
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'hospital' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('hospital')}
        >
          🏥 Main Hospital Bills
          <span className={styles.tabBadge}>{hospitalSum.count}</span>
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'investigation' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('investigation')}
        >
          🔬 Investigation Bills
          <span className={styles.tabBadge}>{investigationSum.count}</span>
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'advance' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('advance')}
        >
          💳 Advance Receipts
          <span className={styles.tabBadge}>{advanceSum.count}</span>
        </button>
      </div>

      {/* ── Transactions Table Card ── */}
      <div className={styles.card}>
        {loading ? (
          <div className={styles.emptyState}>Loading report data...</div>
        ) : displayLedger.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No transactions found for the selected date range and filter criteria.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Bill / Ref No</th>
                  <th>Patient Details</th>
                  <th>Doctor / Purpose</th>
                  <th>Payment Mode</th>
                  <th style={{ textAlign: 'right' }}>Net Billed</th>
                  <th style={{ textAlign: 'right' }}>Paid Amount</th>
                  <th style={{ textAlign: 'right' }}>Due</th>
                  <th>Date &amp; Billed By</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayLedger.map((t: any) => (
                  <tr key={`${t.type}-${t.id}`} className={styles.tableRow}>
                    <td>
                      <span
                        className={
                          t.type === 'HOSPITAL'
                            ? styles.badgeHospital
                            : t.type === 'INVESTIGATION'
                            ? styles.badgeInvestigation
                            : styles.badgeAdvance
                        }
                      >
                        {t.typeLabel}
                      </span>
                    </td>
                    <td>
                      <div className={styles.refNo}>{t.refNo}</div>
                      {t.transactionId && (
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          Ref: {t.transactionId}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className={styles.patientName}>{t.patientName || 'Anonymous'}</div>
                      <div className={styles.patientMeta}>
                        {t.patientAge ? `${t.patientAge}y` : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: '#f1f5f9' }}>{t.doctor}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.caseType}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 600 }}>
                        {t.payMode}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className={styles.amountBlue}>₹{t.netAmount.toLocaleString('en-IN')}</div>
                      {t.discount > 0 && (
                        <div style={{ fontSize: '0.72rem', color: '#f87171' }}>
                          -₹{t.discount} disc
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={styles.amountGreen}>
                        ₹{t.paidAmount.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {t.dueAmount > 0 ? (
                        <span className={styles.amountRed}>
                          ₹{t.dueAmount.toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span style={{ color: '#475569', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{t.date}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>👤 {t.billedBy}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {t.type === 'INVESTIGATION' ? (
                        <a
                          href={`/investigation-billing/index.html?billId=${t.id}&billNo=${t.refNo}&savedAt=${t.createdAt}&patientName=${encodeURIComponent(t.patientName || '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.actionLink}
                        >
                          👁️ View
                        </a>
                      ) : t.type === 'ADVANCE' ? (
                        <a
                          href={`/advance-billing/index.html?patientName=${encodeURIComponent(t.patientName || '')}&amount=${t.netAmount}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.actionLink}
                        >
                          👁️ View
                        </a>
                      ) : (
                        <a
                          href={`/billing/index.html?patientName=${encodeURIComponent(t.patientName || '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.actionLink}
                        >
                          👁️ View
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==========================================================================
          Official Printable Financial Statement (@media print only)
          ========================================================================== */}
      <div className={styles.printableStatement}>
        <div className={styles.printHeader}>
          <h2 className={styles.printHospitalName}>Mikky Megha Hospital Pvt. Ltd.</h2>
          <p className={styles.printHospitalAddress}>
            Chhotparua, Karnajora, Raiganj, Uttar Dinajpur, PIN- 733130, West Bengal | MOB: 8653870222
          </p>
          <div className={styles.printDocTitle}>DAILY / PERIOD FINANCIAL TRANSACTION STATEMENT</div>
        </div>

        <div className={styles.printMetaGrid}>
          <div>
            <strong>Report Date Range:</strong> {startDate} to {endDate}
          </div>
          <div>
            <strong>Generated On:</strong> {new Date().toLocaleString('en-IN')}
          </div>
          <div>
            <strong>Total Records:</strong> {overall.totalTransactions}
          </div>
        </div>

        <div className={styles.printSectionTitle}>1. REVENUE &amp; COLLECTION SUMMARY</div>
        <table className={styles.printKpiTable}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Count</th>
              <th>Gross Billed (₹)</th>
              <th>Discounts (₹)</th>
              <th>Net Collected (₹)</th>
              <th>Due Pending (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Main Hospital Bills</strong></td>
              <td>{hospitalSum.count}</td>
              <td>₹{hospitalSum.subTotal.toFixed(2)}</td>
              <td>₹{hospitalSum.discount.toFixed(2)}</td>
              <td>₹{hospitalSum.netPayable.toFixed(2)}</td>
              <td>₹0.00</td>
            </tr>
            <tr>
              <td><strong>Investigation Lab Bills</strong></td>
              <td>{investigationSum.count}</td>
              <td>₹{investigationSum.subTotal.toFixed(2)}</td>
              <td>₹{investigationSum.discount.toFixed(2)}</td>
              <td>₹{investigationSum.totalPaid.toFixed(2)}</td>
              <td>₹{investigationSum.dueAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Advance Deposits</strong></td>
              <td>{advanceSum.count}</td>
              <td>₹{advanceSum.totalAmount.toFixed(2)}</td>
              <td>₹0.00</td>
              <td>₹{advanceSum.totalAmount.toFixed(2)}</td>
              <td>₹0.00</td>
            </tr>
            <tr style={{ background: '#f1f5f9', fontWeight: 'bold' }}>
              <td>TOTAL REVENUE &amp; COLLECTIONS</td>
              <td>{overall.totalTransactions}</td>
              <td>₹{overall.totalGrossAmount.toFixed(2)}</td>
              <td>₹{overall.totalDiscounts.toFixed(2)}</td>
              <td>₹{overall.totalCollected.toFixed(2)}</td>
              <td>₹{overall.totalDuePending.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div className={styles.printSectionTitle}>2. DETAILED TRANSACTION LEDGER</div>
        <table className={styles.printLedgerTable}>
          <thead>
            <tr>
              <th>SL</th>
              <th>Type</th>
              <th>Ref / Bill No</th>
              <th>Patient Name</th>
              <th>Doctor / Purpose</th>
              <th>Mode</th>
              <th>Net Billed</th>
              <th>Paid</th>
              <th>Due</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((t: any, idx: number) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>{t.typeLabel}</td>
                <td>{t.refNo}</td>
                <td>{t.patientName}</td>
                <td>{t.doctor}</td>
                <td>{t.payMode}</td>
                <td>₹{t.netAmount.toFixed(2)}</td>
                <td>₹{t.paidAmount.toFixed(2)}</td>
                <td>₹{t.dueAmount.toFixed(2)}</td>
                <td>{t.date}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.printSignSection}>
          <div className={styles.printSignBlock}>
            <div className={styles.printSignLine}></div>
            <div className={styles.printSignLabel}>Prepared By (Billing Desk)</div>
          </div>
          <div className={styles.printSignBlock}>
            <div className={styles.printSignLine}></div>
            <div className={styles.printSignLabel}>Internal Auditor / Accountant</div>
          </div>
          <div className={styles.printSignBlock}>
            <div className={styles.printSignLine}></div>
            <div className={styles.printSignLabel}>Authorized Hospital Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}
