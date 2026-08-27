'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface BillItem {
  id: string;
  name: string;
  qty?: string | null;
  priceUnit?: string | null;
  amount?: string | null;
}

interface BillDiscount {
  id: string;
  label?: string | null;
  amount?: string | null;
}

interface BillRecord {
  id: string;
  billNo: string;
  patientName: string;
  patientAge?: string | null;
  gender?: string | null;
  contact?: string | null;
  address?: string | null;
  underDoctor?: string | null;
  referredBy?: string | null;
  noOfDays?: string | null;
  mmhplId?: string | null;
  caseType?: string | null;
  bedNo?: string | null;
  billDate?: string | null;
  reportDate?: string | null;
  payMode?: string | null;
  transactionId?: string | null;
  remarks?: string | null;
  subTotal: number;
  totalDiscount: number;
  advance: number;
  netPayable: number;
  createdByName?: string | null;
  createdAt: string;
  items: BillItem[];
  discounts: BillDiscount[];
  payments?: { id?: string; mode: string; amount: number; ref?: string | null }[];
}

export default function BillsHistoryPage() {
  const [activeTab, setActiveTab] = useState<'hospital' | 'investigation' | 'advance'>('hospital');
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBill, setSelectedBill] = useState<BillRecord | null>(null);

  const [stats, setStats] = useState({
    totalBills: 0,
    totalNet: 0,
    totalAdvance: 0,
    totalDiscount: 0,
  });

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', activeTab);
      if (search) params.set('search', search);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/portal/bills?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBills(data.bills || []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to fetch bills:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, startDate, endDate]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleDelete = async (id: string, billNo: string) => {
    if (!confirm(`Are you sure you want to delete record ${billNo}?`)) return;

    try {
      const res = await fetch(`/api/portal/bills?id=${id}&type=${activeTab}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setBills((prev) => prev.filter((b) => b.id !== id));
        if (selectedBill?.id === id) setSelectedBill(null);
      } else {
        alert('Failed to delete record');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting record');
    }
  };

  const getReprintUrl = (bill: BillRecord) => {
    if (activeTab === 'advance') {
      const params = new URLSearchParams();
      if (bill.id) {
        params.set('receiptId', bill.id);
        params.set('billId', bill.id);
      }
      if (bill.billNo) {
        params.set('receiptNo', bill.billNo);
        params.set('billNo', bill.billNo);
      }
      if (bill.createdAt) params.set('savedAt', bill.createdAt);
      if (bill.patientName) params.set('patientName', bill.patientName);
      if (bill.patientAge) params.set('patientAge', bill.patientAge);
      if (bill.gender) params.set('gender', bill.gender);
      if (bill.underDoctor) params.set('underDoctor', bill.underDoctor);
      if (bill.contact) params.set('contact', bill.contact);
      if (bill.address) params.set('address', bill.address);
      if (bill.mmhplId) params.set('hospitalId', bill.mmhplId);
      if (bill.caseType) params.set('caseType', bill.caseType);
      if (bill.bedNo) params.set('bedNo', bill.bedNo);
      if (bill.billDate) params.set('receiptDate', bill.billDate);
      if (bill.netPayable > 0) params.set('amount', String(bill.netPayable));
      if (bill.payMode) params.set('payMode', bill.payMode);
      if (bill.transactionId) params.set('transactionId', bill.transactionId);
      if (bill.remarks) params.set('remarks', bill.remarks);

      return `/advance-billing/index.html?${params.toString()}`;
    }

    const isInv = activeTab === 'investigation';
    const baseUrl = isInv ? '/investigation-billing/index.html' : '/billing/index.html';

    const params = new URLSearchParams();
    if (bill.id) params.set('billId', bill.id);
    if (bill.billNo) params.set('billNo', bill.billNo);
    if (bill.createdAt) params.set('savedAt', bill.createdAt);
    if (bill.patientName) params.set('patientName', bill.patientName);
    if (bill.patientAge) params.set('patientAge', bill.patientAge);
    if (bill.gender) params.set('gender', bill.gender);
    if (bill.contact) params.set('contact', bill.contact);
    if (bill.address) params.set('address', bill.address);
    if (bill.underDoctor) params.set('underDoctor', bill.underDoctor);
    if (bill.referredBy) params.set('referredBy', bill.referredBy);
    if (bill.noOfDays) params.set('noOfDays', bill.noOfDays);
    if (bill.mmhplId) params.set('hospitalId', bill.mmhplId);
    if (bill.caseType) params.set('caseType', bill.caseType);
    if (bill.bedNo) params.set('bedNo', bill.bedNo);
    if (bill.billDate) params.set('billDate', bill.billDate);
    if (bill.reportDate) params.set('reportDate', bill.reportDate);
    if (bill.advance > 0) params.set('advance', String(bill.advance));
    if (bill.totalDiscount > 0) params.set('discount', String(bill.totalDiscount));

    if (bill.items && bill.items.length > 0) {
      const formattedItems = bill.items.map((i) => ({
        name: i.name,
        qty: i.qty ? parseFloat(i.qty) : 1,
        priceUnit: i.priceUnit ? parseFloat(i.priceUnit) : 0,
        amount: i.amount ? parseFloat(i.amount) : 0,
      }));
      params.set('items', JSON.stringify(formattedItems));
    }

    if (bill.payments && bill.payments.length > 0) {
      params.set('payments', JSON.stringify(bill.payments));
    }

    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Bills &amp; Payments</h1>
          <p className={styles.subtitle}>
            Manage, search, reprint and audit generated hospital invoices, investigation bills, and advance receipts
          </p>
        </div>
        <div className={styles.headerActions}>
          <a
            href="/billing/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnSecondary}
          >
            🧾 New Hospital Bill
          </a>
          <a
            href="/investigation-billing/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnSecondary}
          >
            🔬 New Investigation Bill
          </a>
          <a
            href="/advance-billing/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnPrimary}
          >
            💰 New Advance Receipt
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'hospital' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('hospital')}
        >
          🏥 Main Hospital Bills
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'investigation' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('investigation')}
        >
          🔬 Investigation Bills
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'advance' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('advance')}
        >
          💰 Advance Payments
        </button>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.totalBills}</div>
          <div className={styles.statLabel}>
            {activeTab === 'advance' ? 'Total Advance Receipts' : 'Total Invoices Generated'}
          </div>
        </div>
        <div className={styles.statCard} style={{ borderLeftColor: '#38bdf8' }}>
          <div className={styles.statValue} style={{ color: '#38bdf8' }}>
            ₹{stats.totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className={styles.statLabel}>
            {activeTab === 'advance' ? 'Total Advance Received' : 'Total Net Billed'}
          </div>
        </div>
        <div className={styles.statCard} style={{ borderLeftColor: '#4ade80' }}>
          <div className={styles.statValue} style={{ color: '#4ade80' }}>
            ₹{stats.totalAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className={styles.statLabel}>Total Collected</div>
        </div>
        <div className={styles.statCard} style={{ borderLeftColor: '#f87171' }}>
          <div className={styles.statValue} style={{ color: '#f87171' }}>
            ₹{stats.totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className={styles.statLabel}>Discounts Given</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          placeholder={
            activeTab === 'advance'
              ? 'Search by Receipt No, Patient Name, Doctor, MMHPL ID, Pay Mode...'
              : 'Search by Bill No, Patient Name, Doctor, MMHPL ID...'
          }
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>From:</span>
          <input
            type="date"
            className={styles.dateInput}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>To:</span>
          <input
            type="date"
            className={styles.dateInput}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        {(search || startDate || endDate) && (
          <button
            className={styles.btnSecondary}
            style={{ padding: '7px 12px', fontSize: '0.8rem' }}
            onClick={() => {
              setSearch('');
              setStartDate('');
              setEndDate('');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Bills / Advance Table */}
      <div className={styles.card}>
        <div className={styles.tableWrapper}>
          {loading ? (
            <div className={styles.emptyState}>Loading records...</div>
          ) : bills.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📄</div>
              <h3>
                No{' '}
                {activeTab === 'hospital'
                  ? 'Hospital bills'
                  : activeTab === 'investigation'
                  ? 'Investigation bills'
                  : 'Advance payment receipts'}{' '}
                found
              </h3>
              <p style={{ marginTop: 6, fontSize: '0.85rem' }}>
                Records saved from the{' '}
                {activeTab === 'hospital'
                  ? 'Hospital Billing Portal'
                  : activeTab === 'investigation'
                  ? 'Investigation Billing Portal'
                  : 'Advance Payment Portal'}{' '}
                will appear here.
              </p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{activeTab === 'advance' ? 'Receipt No' : 'Bill No'}</th>
                  <th>Patient Details</th>
                  <th>Doctor / Purpose</th>
                  <th>Date</th>
                  <th>Billed By</th>
                  {activeTab === 'advance' ? (
                    <th>Payment Mode</th>
                  ) : (
                    <th>Items</th>
                  )}
                  {activeTab !== 'advance' && <th>Sub Total</th>}
                  <th>{activeTab === 'advance' ? 'Advance Amount' : 'Net Payable'}</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className={styles.billNo}>{b.billNo}</span>
                      {b.mmhplId && (
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                          ID: {b.mmhplId}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className={styles.patientCol}>
                        <span className={styles.patientName}>{b.patientName || 'Anonymous'}</span>
                        <span className={styles.patientMeta}>
                          {b.patientAge ? `${b.patientAge}` : ''}
                          {b.gender ? ` • ${b.gender}` : ''}
                          {b.contact ? ` • 📞 ${b.contact}` : ''}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: '#f1f5f9' }}>
                        {b.underDoctor || b.referredBy || '—'}
                      </div>
                      {b.caseType && (
                        <span className={styles.badge} style={{ marginTop: 3 }}>
                          {b.caseType}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                        {b.billDate || new Date(b.createdAt).toLocaleDateString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {new Date(b.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.85rem' }}>👤</span>
                        <span>{b.createdByName || 'Staff'}</span>
                      </div>
                    </td>
                    {activeTab === 'advance' ? (
                      <td>
                        <span className={styles.badgeSuccess}>
                          💳 {b.payMode || 'Cash'}
                        </span>
                        {b.transactionId && (
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                            Ref: {b.transactionId}
                          </div>
                        )}
                      </td>
                    ) : (
                      <td>
                        <span className={styles.badge}>
                          {b.items?.length || 0} item{(b.items?.length || 0) === 1 ? '' : 's'}
                        </span>
                      </td>
                    )}
                    {activeTab !== 'advance' && (
                      <td>₹{(b.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    )}
                    <td>
                      <span className={styles.amount} style={{ color: activeTab === 'advance' ? '#4ade80' : '#38bdf8' }}>
                        ₹{(b.netPayable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      {activeTab !== 'advance' && b.advance > 0 && (
                        <div style={{ fontSize: '0.72rem', color: '#4ade80', marginTop: 2 }}>
                          Adv: ₹{b.advance}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => setSelectedBill(b)}
                          title="View Details"
                        >
                          👁️ View
                        </button>
                        <a
                          href={getReprintUrl(b)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${styles.actionBtn} ${styles.actionBtnPrint}`}
                          title="Open & Reprint Receipt"
                        >
                          🖨️ {activeTab === 'advance' ? 'Open Receipt' : 'Open Bill'}
                        </a>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                          onClick={() => handleDelete(b.id, b.billNo)}
                          title="Delete Record"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bill / Advance Receipt Details Modal */}
      {selectedBill && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedBill(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <h3>
                  {activeTab === 'advance'
                    ? 'Advance Payment Receipt Details'
                    : activeTab === 'investigation'
                    ? 'Investigation Bill Details'
                    : 'Hospital Bill Details'}
                </h3>
                <span className={styles.modalSubtitle}>{selectedBill.billNo}</span>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedBill(null)}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Patient & Bill Metadata Grid */}
              <div className={styles.modalGrid}>
                <div className={styles.modalField}>
                  <div className={styles.modalFieldLabel}>Patient Name</div>
                  <div className={styles.modalFieldValue}>{selectedBill.patientName || 'Anonymous'}</div>
                </div>
                <div className={styles.modalField}>
                  <div className={styles.modalFieldLabel}>Age / Gender / Contact</div>
                  <div className={styles.modalFieldValue}>
                    {[selectedBill.patientAge, selectedBill.gender, selectedBill.contact].filter(Boolean).join(' • ') || '—'}
                  </div>
                </div>
                <div className={styles.modalField}>
                  <div className={styles.modalFieldLabel}>Doctor / Consultant</div>
                  <div className={styles.modalFieldValue}>{selectedBill.underDoctor || selectedBill.referredBy || '—'}</div>
                </div>
                <div className={styles.modalField}>
                  <div className={styles.modalFieldLabel}>Hospital ID / Bed</div>
                  <div className={styles.modalFieldValue}>
                    {selectedBill.mmhplId || '—'} {selectedBill.bedNo ? `• Bed: ${selectedBill.bedNo}` : ''}
                  </div>
                </div>
                <div className={styles.modalField}>
                  <div className={styles.modalFieldLabel}>
                    {activeTab === 'advance' ? 'Purpose / Case' : 'Case Type'}
                  </div>
                  <div className={styles.modalFieldValue}>{selectedBill.caseType || '—'}</div>
                </div>
                <div className={styles.modalField}>
                  <div className={styles.modalFieldLabel}>Date</div>
                  <div className={styles.modalFieldValue}>
                    {selectedBill.billDate || new Date(selectedBill.createdAt).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <div className={styles.modalField}>
                  <div className={styles.modalFieldLabel}>Billed By (User)</div>
                  <div className={styles.modalFieldValue} style={{ fontWeight: 600, color: '#a78bfa' }}>
                    👤 {selectedBill.createdByName || 'Staff'}
                  </div>
                </div>
                {activeTab === 'advance' && (
                  <>
                    <div className={styles.modalField}>
                      <div className={styles.modalFieldLabel}>Payment Mode</div>
                      <div className={styles.modalFieldValue}>{selectedBill.payMode || 'Cash'}</div>
                    </div>
                    {selectedBill.transactionId && (
                      <div className={styles.modalField}>
                        <div className={styles.modalFieldLabel}>Transaction Ref</div>
                        <div className={styles.modalFieldValue}>{selectedBill.transactionId}</div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Items Breakdown Table (for Hospital & Investigation) */}
              {activeTab !== 'advance' && (
                <div>
                  <h4 style={{ fontSize: '0.9rem', color: '#f1f5f9', marginBottom: '8px' }}>
                    Particulars &amp; Charges ({selectedBill.items?.length || 0})
                  </h4>
                  <table className={styles.modalItemsTable}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Rate (₹)</th>
                        <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBill.items && selectedBill.items.length > 0 ? (
                        selectedBill.items.map((item, idx) => (
                          <tr key={item.id || idx}>
                            <td style={{ color: '#94a3b8', width: '30px' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 500 }}>{item.name}</td>
                            <td>{item.qty || 1}</td>
                            <td>{item.priceUnit || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#38bdf8' }}>
                              ₹{parseFloat(item.amount || '0').toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>
                            No item details recorded
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Remarks if Advance Receipt */}
              {activeTab === 'advance' && selectedBill.remarks && (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Remarks / Note: </span>
                  <span style={{ color: '#e2e8f0' }}>{selectedBill.remarks}</span>
                </div>
              )}

              {/* Totals Summary */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activeTab !== 'advance' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#94a3b8' }}>Sub Total:</span>
                      <span style={{ fontWeight: 600 }}>₹{selectedBill.subTotal.toFixed(2)}</span>
                    </div>
                    {selectedBill.totalDiscount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#f87171' }}>
                        <span>Discount:</span>
                        <span>- ₹{selectedBill.totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedBill.advance > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#4ade80' }}>
                        <span>Advance Payment:</span>
                        <span>- ₹{selectedBill.advance.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, color: '#60a5fa', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px', marginTop: '4px' }}>
                      <span>Net Payable:</span>
                      <span>₹{selectedBill.netPayable.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 800, color: '#4ade80' }}>
                    <span>Total Advance Received:</span>
                    <span>₹{selectedBill.netPayable.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setSelectedBill(null)}>
                Close
              </button>
              <a
                href={getReprintUrl(selectedBill)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnPrimary}
              >
                🖨️ {activeTab === 'advance' ? 'Open in Advance Receipt App' : 'Open in Billing App'}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
