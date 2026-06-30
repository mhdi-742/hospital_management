'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TransferRequestsTable({ requests, styles, typeColors, typeBg }: any) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function handleReject(id: string) {
    if (!confirm('Are you sure you want to reject this transfer request?')) return;
    setProcessingId(id);

    try {
      await fetch(`/api/portal/admission/transfer-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      router.refresh();
    } catch (err) {
      alert('Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  }

  if (requests.length === 0) return null;

  return (
    <div className={styles.section} style={{ border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.02)' }}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle} style={{ color: '#f87171' }}>
          <span style={{ marginRight: '8px' }}>🔔</span>
          Action Required: Pending Transfer Requests
        </h2>
      </div>

      <div className={styles.table}>
        <div className={styles.tableHead}>
          <span>Patient</span>
          <span>Requested By</span>
          <span>Target Dept</span>
          <span>Notes</span>
          <span>Actions</span>
        </div>
        
        {requests.map((req: any) => (
          <div key={req.id} className={styles.tableRow} style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
            <span className={styles.patientName}>
              {req.admission.patient.name}
              <small>Current: {req.admission.type}</small>
            </span>
            <span>Dr. {req.doctor.user.name}</span>
            <span>
              <span
                className={styles.typeBadge}
                style={{ color: typeColors[req.targetType], background: typeBg[req.targetType] }}
              >
                {req.targetType}
              </span>
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {req.notes || '—'}
            </span>
            <span style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => handleReject(req.id)}
                disabled={processingId === req.id}
                style={{
                  padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer'
                }}
              >
                Reject
              </button>
              <Link 
                href={`/portal/admission/patients/${req.admission.patientId}?transferRequest=${req.id}&target=${req.targetType}`}
                style={{
                  padding: '6px 12px', background: '#3b82f6', border: 'none', textDecoration: 'none',
                  color: 'white', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600
                }}
              >
                Process →
              </Link>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
