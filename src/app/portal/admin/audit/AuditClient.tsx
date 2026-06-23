'use client';

import { useState, useEffect } from 'react';
import styles from './audit.module.css';

interface User {
  name: string;
  email: string;
  role: string;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  target: string | null;
  metadata: string | null;
  createdAt: string;
  user: User;
}

interface Props {
  initialLogs: AuditLog[];
  initialTotal: number;
}

export default function AuditClient({ initialLogs, initialTotal }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Detail drawer state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch updated logs when filter/page changes
  useEffect(() => {
    // Skip initial fetch since we have initialLogs
    if (page === 1 && !search && !actionFilter) return;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          search,
          action: actionFilter,
        });
        const res = await fetch(`/api/portal/admin/audit?${queryParams}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs);
          setTotal(data.total);
        }
      } catch (err) {
        console.error('Failed to fetch audit logs', err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search slightly
    const timer = setTimeout(fetchLogs, 300);
    return () => clearTimeout(timer);
  }, [page, search, actionFilter]);

  // Handle page resets on filter change
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleActionChange = (val: string) => {
    setActionFilter(val);
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>System Audit Trail</h1>
          <p className={styles.subtitle}>Trace admin actions, patient admissions, and credential changes across the system</p>
        </div>
      </header>

      {/* Filters Bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by actor, target or meta..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
        />

        <select
          className={styles.selectInput}
          value={actionFilter}
          onChange={e => handleActionChange(e.target.value)}
        >
          <option value="">All Actions</option>
          <option value="CREATE_DOCTOR">Create Doctor</option>
          <option value="UPDATE_DOCTOR">Update Doctor</option>
          <option value="DELETE_DOCTOR">Delete Doctor</option>
          <option value="CREATE_STAFF_USER">Create Staff</option>
          <option value="UPDATE_STAFF_USER">Update Staff</option>
          <option value="DELETE_STAFF_USER">Delete Staff</option>
          <option value="CREATE_WARD">Create Ward</option>
          <option value="UPDATE_WARD">Update Ward</option>
          <option value="DELETE_WARD">Delete Ward</option>
          <option value="CREATE_ANNOUNCEMENT">Create Announcement</option>
          <option value="UPDATE_ANNOUNCEMENT">Update Announcement</option>
          <option value="DELETE_ANNOUNCEMENT">Delete Announcement</option>
          <option value="UPDATE_HOSPITAL_SETTINGS">Update Settings</option>
          <option value="PATIENT_ADMITTED">Patient Admitted</option>
          <option value="NEW_ADMISSION_EPISODE">New Patient Episode</option>
          <option value="DISCHARGE_PATIENT">Patient Discharged</option>
          <option value="UPDATE_IPD_PATIENT">Update Patient Clinicals</option>
        </select>
      </div>

      {/* Table */}
      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Loading system audit logs...</div>
        ) : logs.length === 0 ? (
          <div className={styles.empty}>No audit logs found.</div>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor (Role)</th>
                    <th>Action Executed</th>
                    <th>Target Record</th>
                    <th>Audit Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className={styles.tableRow}>
                      <td className={styles.timeCol}>
                        {new Date(log.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td>
                        <div className={styles.actorName}>{log.user.name}</div>
                        <div className={styles.actorEmail}>{log.user.email}</div>
                      </td>
                      <td>
                        <span className={styles.actionTag}>{log.action}</span>
                      </td>
                      <td className={styles.targetCol}>{log.target || 'N/A'}</td>
                      <td>
                        {log.metadata ? (
                          <button
                            className={styles.viewMetaBtn}
                            onClick={() => setSelectedLog(log)}
                          >
                            View Data ({JSON.parse(log.metadata).fieldsChanged ? 'edit' : 'raw'})
                          </button>
                        ) : (
                          <span className={styles.noMeta}>No payload</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={styles.pageBtn}
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  ← Previous
                </button>
                <span className={styles.pageIndicator}>
                  Page {page} of {totalPages}
                </span>
                <button
                  className={styles.pageBtn}
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Metadata Detail Modal */}
      {selectedLog && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Audit Payload: {selectedLog.action}</h3>
                <p className={styles.modalSubtitle}>Target: {selectedLog.target}</p>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedLog(null)}>×</button>
            </div>

            <div className={styles.modalBody}>
              <pre className={styles.jsonBlock}>
                {JSON.stringify(JSON.parse(selectedLog.metadata || '{}'), null, 2)}
              </pre>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.secondaryBtn} onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
