import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    redirect('/login');
  }

  // Fetch counts
  const totalPatients = await prisma.patient.count();
  const totalDoctors = await prisma.doctor.count();
  const totalStaff = await prisma.user.count({
    where: { role: { in: ['ADMIN', 'RECEPTIONIST', 'NURSE'] } },
  });

  // Active admissions breakdown
  const activeAdmissions = await prisma.admission.findMany({
    where: { status: 'active' },
    select: { type: true },
  });

  const activeOpd = activeAdmissions.filter(a => a.type === 'OPD').length;
  const activeIpd = activeAdmissions.filter(a => a.type === 'IPD').length;
  const activeOt  = activeAdmissions.filter(a => a.type === 'OT').length;

  // Recent 5 audit logs
  const recentLogs = await prisma.auditLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true, role: true } },
    },
  });

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>System Control Center</h1>
          <p className={styles.subtitle}>{formattedDate} • Hospital Management Administration</p>
        </div>
      </header>

      {/* Global Stat Cards */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.blue}`}>
          <div className={styles.statVal}>{totalPatients}</div>
          <div className={styles.statLabel}>Total Patients</div>
        </div>
        <div className={`${styles.statCard} ${styles.green}`}>
          <div className={styles.statVal}>{totalDoctors}</div>
          <div className={styles.statLabel}>Active Doctors</div>
        </div>
        <div className={`${styles.statCard} ${styles.purple}`}>
          <div className={styles.statVal}>{totalStaff}</div>
          <div className={styles.statLabel}>Staff Accounts</div>
        </div>
        <div className={`${styles.statCard} ${styles.orange}`}>
          <div className={styles.statVal}>{activeAdmissions.length}</div>
          <div className={styles.statLabel}>Active Admissions</div>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* Left Side: Admissions breakdown & actions */}
        <div className={styles.leftCol}>
          <div className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Active Patient Flow</h2>
            <div className={styles.flowBreakdown}>
              <div className={styles.flowRow}>
                <span className={styles.flowLabel}>
                  <span className={`${styles.dot} ${styles.opdDot}`} />
                  Outpatient (OPD Sessions)
                </span>
                <span className={styles.flowVal}>{activeOpd} active</span>
              </div>
              <div className={styles.flowRow}>
                <span className={styles.flowLabel}>
                  <span className={`${styles.dot} ${styles.ipdDot}`} />
                  Inpatient (IPD Wards)
                </span>
                <span className={styles.flowVal}>{activeIpd} admitted</span>
              </div>
              <div className={styles.flowRow}>
                <span className={styles.flowLabel}>
                  <span className={`${styles.dot} ${styles.otDot}`} />
                  Operation Theatre (OT Cases)
                </span>
                <span className={styles.flowVal}>{activeOt} scheduled</span>
              </div>
            </div>
          </div>

          <div className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Quick Management Actions</h2>
            <div className={styles.actionsGrid}>
              <Link href="/portal/admin/doctors" className={styles.actionBtn}>
                👨‍⚕️ Manage Doctors
              </Link>
              <Link href="/portal/admin/investigations" className={styles.actionBtn}>
                🔬 Manage Investigations
              </Link>
              <Link href="/portal/admin/users" className={styles.actionBtn}>
                👥 Manage Staff
              </Link>
              <Link href="/portal/admin/announcements" className={styles.actionBtn}>
                📢 Write Announcement
              </Link>
              <Link href="/portal/admin/settings" className={styles.actionBtn}>
                ⚙️ Hospital Settings
              </Link>
            </div>
          </div>
        </div>

        {/* Right Side: Recent activity logs */}
        <div className={styles.rightCol}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeaderFlex}>
              <h2 className={styles.sectionTitle}>System Audit Trail</h2>
              <Link href="/portal/admin/audit" className={styles.viewAllLink}>
                View Full Logs →
              </Link>
            </div>

            <div className={styles.logsList}>
              {recentLogs.length > 0 ? (
                recentLogs.map((log) => (
                  <div key={log.id} className={styles.logCard}>
                    <div className={styles.logMeta}>
                      <span className={styles.logActor}>{log.user.name} ({log.user.role.toLowerCase()})</span>
                      <span className={styles.logTime}>
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className={styles.logAction}>
                      <span className={styles.actionTag}>{log.action}</span>
                      {log.target && <span className={styles.targetLabel}>Target: {log.target}</span>}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyLogs}>No recent system logs.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
