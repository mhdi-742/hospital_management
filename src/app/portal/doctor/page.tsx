import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export default async function DoctorDashboard() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'DOCTOR') {
    redirect('/login');
  }

  // 1. Fetch Doctor details
  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    include: {
      department: true,
      user: true,
    },
  });

  if (!doctor) {
    return (
      <div className={styles.container}>
        <div className={styles.alert}>Doctor profile not found. Please contact support.</div>
      </div>
    );
  }

  // 2. Fetch today's OPD session
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const opdSession = await prisma.opdSession.findFirst({
    where: {
      doctorId: doctor.id,
      date: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
  });

  // 3. Count active IPD patients assigned to this doctor
  const ipdCount = await prisma.admission.count({
    where: {
      type: 'IPD',
      status: 'active',
      doctors: {
        some: {
          doctorId: doctor.id,
        },
      },
    },
  });

  // 4. Count active OT cases assigned to this doctor
  const otCount = await prisma.otCase.count({
    where: {
      OR: [
        { leadDoctorId: doctor.id },
        { assistants: { some: { doctorId: doctor.id } } },
      ],
      status: {
        in: ['scheduled', 'preparing', 'in_progress', 'delayed'],
      },
    },
  });

  // 5. Fetch recent announcements for ALL or OPD boards
  const announcements = await prisma.announcement.findMany({
    where: {
      isActive: true,
      board: {
        in: ['ALL', 'OPD'],
      },
    },
    take: 3,
    orderBy: { createdAt: 'desc' },
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
          <h1 className={styles.title}>Welcome back, Dr. {doctor.user.name}</h1>
          <p className={styles.subtitle}>{formattedDate} • Hospital Management Portal</p>
        </div>
      </header>

      {/* Overview Cards */}
      <div className={styles.statsGrid}>
        {/* OPD Card */}
        <div className={`${styles.statCard} ${styles.opdCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>🩺</span>
            <span className={styles.cardLabel}>OPD SESSION</span>
          </div>
          <div className={styles.cardBody}>
            {opdSession ? (
              <>
                <div className={styles.sessionStatus}>
                  <span className={`${styles.badge} ${styles[opdSession.status]}`}>
                    {opdSession.status}
                  </span>
                </div>
                <div className={styles.tokenStats}>
                  <div className={styles.statGroup}>
                    <span className={styles.statLabelText}>Current Token</span>
                    <span className={styles.statValue}>
                      {opdSession.currentToken ?? 'None'}
                    </span>
                  </div>
                  <div className={styles.statGroup}>
                    <span className={styles.statLabelText}>Total Tokens</span>
                    <span className={styles.statValue}>{opdSession.totalTokens}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.noSession}>
                <p>No OPD session scheduled for today.</p>
                <Link href="/portal/doctor/opd" className={styles.actionBtn}>
                  Schedule Session
                </Link>
              </div>
            )}
          </div>
          {opdSession && (
            <div className={styles.cardFooter}>
              <Link href="/portal/doctor/opd" className={styles.footerLink}>
                Manage OPD Queue →
              </Link>
            </div>
          )}
        </div>

        {/* IPD Card */}
        <div className={`${styles.statCard} ${styles.ipdCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>🛌</span>
            <span className={styles.cardLabel}>ACTIVE IPD PATIENTS</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.bigCount}>{ipdCount}</div>
            <p className={styles.cardDescription}>
              Patients admitted in wards under your care or consultation.
            </p>
          </div>
          <div className={styles.cardFooter}>
            <Link href="/portal/doctor/ipd" className={styles.footerLink}>
              View Patient List →
            </Link>
          </div>
        </div>

        {/* OT Card */}
        <div className={`${styles.statCard} ${styles.otCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>🔪</span>
            <span className={styles.cardLabel}>OT PROCEDURES</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.bigCount}>{otCount}</div>
            <p className={styles.cardDescription}>
              Surgeries scheduled for today or upcoming cases.
            </p>
          </div>
          <div className={styles.cardFooter}>
            <Link href="/portal/doctor/ot" className={styles.footerLink}>
              View OT Schedule →
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* Info Card */}
        <div className={styles.infoSection}>
          <h2 className={styles.sectionTitle}>Your Profile & Schedule</h2>
          <div className={styles.profileDetails}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Department:</span>
              <span className={styles.infoVal}>
                <span
                  className={styles.deptColor}
                  style={{ backgroundColor: doctor.department?.color ?? '#3b82f6' }}
                />
                {doctor.department?.name ?? 'General Medicine'}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Room Number:</span>
              <span className={styles.infoVal}>{doctor.roomNo ?? 'N/A'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Speciality:</span>
              <span className={styles.infoVal}>{doctor.speciality ?? 'General practitioner'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Designation:</span>
              <span className={styles.infoVal}>{doctor.designation}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email:</span>
              <span className={styles.infoVal}>{doctor.user.email}</span>
            </div>
          </div>
        </div>

        {/* Announcements Section */}
        <div className={styles.announcementsSection}>
          <h2 className={styles.sectionTitle}>Hospital Announcements</h2>
          <div className={styles.announcementList}>
            {announcements.length > 0 ? (
              announcements.map((ann) => (
                <div key={ann.id} className={styles.announcementCard}>
                  <div className={styles.announcementMeta}>
                    <span className={styles.announcementBoard}>{ann.board} BOARD</span>
                    <span className={styles.announcementDate}>
                      {new Date(ann.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className={styles.announcementText}>{ann.text}</p>
                </div>
              ))
            ) : (
              <div className={styles.noAnnouncements}>No active announcements.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
