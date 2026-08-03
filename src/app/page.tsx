import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        {/* Header & Hero */}
        <header className={styles.header}>
          <div className={styles.brandBadge}>
            <span className={styles.statusDot}></span>
            Hospital Management System
          </div>
          <h1 className={styles.title}>Central Navigation Hub</h1>
          <p className={styles.subtitle}>
            Select a live TV display screen or access staff management portals to manage outpatient queues, ward admissions, and surgical schedules.
          </p>
        </header>

        {/* SECTION 1: Live Public Displays */}
        <section>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <span>Live Public Display Boards</span>
            </div>
            <span className={`${styles.sectionTag} ${styles.displayTag}`}>Real-Time Updates</span>
          </div>

          <div className={styles.grid}>
            {/* OPD Display Card */}
            <Link
              href="/display/opd"
              className={styles.card}
              style={{ '--card-accent': '#38bdf8', '--icon-bg': 'rgba(56, 189, 248, 0.12)', '--icon-color': '#38bdf8', '--icon-border': 'rgba(56, 189, 248, 0.25)' } as any}
            >
              <div>
                <div className={styles.cardTop}>
                  <div className={styles.iconWrapper}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <polyline points="17 11 19 13 23 9"></polyline>
                    </svg>
                  </div>
                  <span className={styles.badge}>Live Queue</span>
                </div>
                <div className={styles.cardContent}>
                  <h3>OPD Queue Screen</h3>
                  <p>Outpatient department live doctor tokens, room numbers, and estimated patient waiting times.</p>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <span>Open OPD Display</span>
                <span>→</span>
              </div>
            </Link>

            {/* IPD Ward Display Card */}
            <Link
              href="/display/ipd"
              className={styles.card}
              style={{ '--card-accent': '#10b981', '--icon-bg': 'rgba(16, 185, 129, 0.12)', '--icon-color': '#10b981', '--icon-border': 'rgba(16, 185, 129, 0.25)' } as any}
            >
              <div>
                <div className={styles.cardTop}>
                  <div className={styles.iconWrapper}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 4v16"></path>
                      <path d="M2 8h18a2 2 0 0 1 2 2v10"></path>
                      <path d="M2 17h20"></path>
                      <path d="M6 8v9"></path>
                    </svg>
                  </div>
                  <span className={styles.badge}>Ward Status</span>
                </div>
                <div className={styles.cardContent}>
                  <h3>IPD Ward Screen</h3>
                  <p>Inpatient department bed occupancy, ward capacities, and patient monitoring status.</p>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <span>Open IPD Display</span>
                <span>→</span>
              </div>
            </Link>

            {/* OT Schedule Display Card */}
            <Link
              href="/display/ot"
              className={styles.card}
              style={{ '--card-accent': '#f59e0b', '--icon-bg': 'rgba(245, 158, 11, 0.12)', '--icon-color': '#f59e0b', '--icon-border': 'rgba(245, 158, 11, 0.25)' } as any}
            >
              <div>
                <div className={styles.cardTop}>
                  <div className={styles.iconWrapper}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </div>
                  <span className={styles.badge}>Surgeries</span>
                </div>
                <div className={styles.cardContent}>
                  <h3>OT Surgical Screen</h3>
                  <p>Operation Theatre live procedure schedules, operating room allocations, and surgeon assignments.</p>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <span>Open OT Display</span>
                <span>→</span>
              </div>
            </Link>

            {/* Doctor Queue Screen */}
            <Link
              href="/display/queue"
              className={styles.card}
              style={{ '--card-accent': '#a855f7', '--icon-bg': 'rgba(168, 85, 247, 0.12)', '--icon-color': '#a855f7', '--icon-border': 'rgba(168, 85, 247, 0.25)' } as any}
            >
              <div>
                <div className={styles.cardTop}>
                  <div className={styles.iconWrapper}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  </div>
                  <span className={styles.badge}>Doctor TV</span>
                </div>
                <div className={styles.cardContent}>
                  <h3>Doctor Queue Screen</h3>
                  <p>Single-doctor dedicated consultation queue view with active token calls and patient details.</p>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <span>Open Doctor Queue</span>
                <span>→</span>
              </div>
            </Link>
          </div>
        </section>

        {/* SECTION 2: Staff & Management Portals */}
        <section>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span>Staff & Role Portals</span>
            </div>
            <span className={`${styles.sectionTag} ${styles.portalTag}`}>Protected Routes</span>
          </div>

          <div className={styles.grid}>
            {/* Admin Portal */}
            <Link
              href="/portal/admin"
              className={styles.card}
              style={{ '--card-accent': '#ec4899', '--icon-bg': 'rgba(236, 72, 153, 0.12)', '--icon-color': '#ec4899', '--icon-border': 'rgba(236, 72, 153, 0.25)' } as any}
            >
              <div>
                <div className={styles.cardTop}>
                  <div className={styles.iconWrapper}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                  </div>
                  <span className={styles.badge}>ADMIN</span>
                </div>
                <div className={styles.cardContent}>
                  <h3>Admin Portal</h3>
                  <p>Manage users, doctors, wards, hospital settings, public announcements, and system audit logs.</p>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <span>Access Admin Portal</span>
                <span>→</span>
              </div>
            </Link>

            {/* Doctor Portal */}
            <Link
              href="/portal/doctor"
              className={styles.card}
              style={{ '--card-accent': '#06b6d4', '--icon-bg': 'rgba(6, 182, 212, 0.12)', '--icon-color': '#06b6d4', '--icon-border': 'rgba(6, 182, 212, 0.25)' } as any}
            >
              <div>
                <div className={styles.cardTop}>
                  <div className={styles.iconWrapper}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4.8 2.3A.3.3 0 0 0 4.5 2.6V5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V2.6a.3.3 0 0 0-.3-.3H4.8z"></path>
                      <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path>
                      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"></path>
                    </svg>
                  </div>
                  <span className={styles.badge}>DOCTOR</span>
                </div>
                <div className={styles.cardContent}>
                  <h3>Doctor Portal</h3>
                  <p>Manage active OPD consultation tokens, conduct IPD ward rounds, and view assigned OT surgeries.</p>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <span>Access Doctor Portal</span>
                <span>→</span>
              </div>
            </Link>

            {/* Admission & Reception Portal */}
            <Link
              href="/portal/admission"
              className={styles.card}
              style={{ '--card-accent': '#6366f1', '--icon-bg': 'rgba(99, 102, 241, 0.12)', '--icon-color': '#6366f1', '--icon-border': 'rgba(99, 102, 241, 0.25)' } as any}
            >
              <div>
                <div className={styles.cardTop}>
                  <div className={styles.iconWrapper}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                      <path d="M12 11h4"></path>
                      <path d="M12 16h4"></path>
                      <path d="M8 11h.01"></path>
                      <path d="M8 16h.01"></path>
                    </svg>
                  </div>
                  <span className={styles.badge}>RECEPTION / NURSE</span>
                </div>
                <div className={styles.cardContent}>
                  <h3>Admission Portal</h3>
                  <p>Register new patients, allocate ward beds, manage OPD sessions, and process patient transfer requests.</p>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <span>Access Admission Portal</span>
                <span>→</span>
              </div>
            </Link>
          </div>
        </section>

        {/* SECTION 3: Demo Credentials Helper */}
        <section>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>Seeded Account Credentials</span>
            </div>
            <Link href="/login" className={`${styles.sectionTag} ${styles.credTag}`}>
              Sign In Page →
            </Link>
          </div>

          <div className={styles.credBox}>
            <div className={styles.credItem}>
              <div className={styles.credRole}>
                <span>Admin</span>
                <span style={{ color: '#ec4899' }}>Full Access</span>
              </div>
              <div className={styles.credDetail}>
                <span className={styles.credLabel}>Email:</span> admin@hospital.local
              </div>
              <div className={styles.credDetail}>
                <span className={styles.credLabel}>Pass:</span> Admin@123
              </div>
            </div>

            <div className={styles.credItem}>
              <div className={styles.credRole}>
                <span>Doctor</span>
                <span style={{ color: '#06b6d4' }}>Consultation</span>
              </div>
              <div className={styles.credDetail}>
                <span className={styles.credLabel}>Email:</span> doc-001@hospital.local
              </div>
              <div className={styles.credDetail}>
                <span className={styles.credLabel}>Pass:</span> Doctor@123
              </div>
            </div>

            <div className={styles.credItem}>
              <div className={styles.credRole}>
                <span>Receptionist</span>
                <span style={{ color: '#6366f1' }}>Admission</span>
              </div>
              <div className={styles.credDetail}>
                <span className={styles.credLabel}>Email:</span> reception@hospital.local
              </div>
              <div className={styles.credDetail}>
                <span className={styles.credLabel}>Pass:</span> Staff@123
              </div>
            </div>

            <div className={styles.credItem}>
              <div className={styles.credRole}>
                <span>Nurse</span>
                <span style={{ color: '#10b981' }}>Ward Care</span>
              </div>
              <div className={styles.credDetail}>
                <span className={styles.credLabel}>Email:</span> nurse@hospital.local
              </div>
              <div className={styles.credDetail}>
                <span className={styles.credLabel}>Pass:</span> Staff@123
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          Mikki Megha Hospital Management System • Built with Next.js 16 & Prisma ORM
        </footer>
      </main>
    </div>
  );
}
