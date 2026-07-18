import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import styles from './page.module.css';
import TransferRequestsTable from './TransferRequestsTable';

export const dynamic = 'force-dynamic';

async function getStats(role: string) {
  const [
    totalActive,
    totalOPD,
    totalIPD,
    totalOT,
    recentAdmissions,
    pendingTransferRequests
  ] = await Promise.all([
    prisma.admission.count({ where: { status: 'active' } }),
    prisma.admission.count({ where: { status: 'active', type: 'OPD' } }),
    prisma.admission.count({ where: { status: 'active', type: 'IPD' } }),
    prisma.admission.count({ where: { status: 'active', type: 'OT' } }),
    prisma.admission.findMany({
      where: { status: 'active' },
      orderBy: { admittedAt: 'desc' },
      take: 8,
      include: {
        patient: { select: { name: true, age: true, gender: true } },
        ward: { select: { name: true, code: true, accentColor: true } },
        bed: { select: { bedNo: true } },
      },
    }),
    prisma.transferRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: {
        admission: { include: { patient: { select: { name: true } } } },
        doctor: { include: { user: { select: { name: true } } } }
      }
    })
  ]);

  return { totalActive, totalOPD, totalIPD, totalOT, recentAdmissions, pendingTransferRequests };
}

export default async function AdmissionDashboard() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const stats = await getStats(role);

  const typeColors: Record<string, string> = {
    OPD: '#3b82f6',
    IPD: '#8b5cf6',
    OT:  '#f59e0b',
  };
  const typeBg: Record<string, string> = {
    OPD: 'rgba(59,130,246,0.12)',
    IPD: 'rgba(139,92,246,0.12)',
    OT:  'rgba(245,158,11,0.12)',
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>
            Welcome back, <span className={styles.name}>{session?.user?.name}</span>
          </p>
        </div>
        {role === 'RECEPTIONIST' && (
          <Link href="/portal/admission/patients/new" className={styles.admitBtn}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Admit Patient
          </Link>
        )}
      </div>

      <TransferRequestsTable 
        requests={stats.pendingTransferRequests} 
        styles={styles} 
        typeColors={typeColors} 
        typeBg={typeBg} 
      />

      {/* Stats row */}
      <div className={styles.statsGrid}>
        {[
          { label: 'Total Active', value: stats.totalActive, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
          { label: 'OPD Active',   value: stats.totalOPD,    color: typeColors.OPD, bg: typeBg.OPD },
          { label: 'IPD Admitted', value: stats.totalIPD,    color: typeColors.IPD, bg: typeBg.IPD },
          { label: 'OT Scheduled', value: stats.totalOT,     color: typeColors.OT,  bg: typeBg.OT  },
        ].map(s => (
          <div key={s.label} className={styles.statCard} style={{ '--accent': s.color, '--accentBg': s.bg } as any}>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent admissions */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Active Admissions</h2>
          <Link href="/portal/admission/patients" className={styles.viewAll}>View all →</Link>
        </div>

        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Patient</span>
            <span>Type</span>
            <span>Ward / Details</span>
            <span>Admitted</span>
            <span></span>
          </div>
          {stats.recentAdmissions.length === 0 && (
            <div className={styles.empty}>No active admissions yet.</div>
          )}
          {stats.recentAdmissions.map(adm => (
            <div key={adm.id} className={styles.tableRow}>
              <span className={styles.patientName}>
                {adm.patient.name}
                <small>{adm.patient.age ? `${adm.patient.age}y` : '—'} · {adm.patient.gender ?? '—'}</small>
              </span>
              <span>
                <span
                  className={styles.typeBadge}
                  style={{ color: typeColors[adm.type], background: typeBg[adm.type] }}
                >
                  {adm.type}
                </span>
              </span>
              <span className={styles.wardCell}>
                {adm.ward ? (
                  <>
                    <span
                      className={styles.wardBadge}
                      style={{ color: adm.ward.accentColor, background: adm.ward.accentColor + '22' }}
                    >
                      {adm.ward.code}
                    </span>
                    {(adm as any).bed?.bedNo && <span className={styles.bedNo}>Bed {(adm as any).bed.bedNo}</span>}
                  </>
                ) : '—'}
              </span>
              <span className={styles.dateCell}>
                {new Date(adm.admittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
              <span>
                <Link href={`/portal/admission/patients/${adm.patientId}`} className={styles.rowLink}>
                  View →
                </Link>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
