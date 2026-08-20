'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import styles from './AdmissionSidebar.module.css';

const NAV = [
  {
    href: '/portal/admission',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    href: '/portal/admission/patients',
    label: 'Patients',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/portal/admission/patients/new',
    label: 'Admit Patient',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    ),
  },
  {
    href: '/portal/admission/investigations',
    label: 'Investigations',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M10 2v7.31M14 9.3V1.99M8.5 2h7M14 9.3a6.5 6.5 0 1 1-4 0"/>
        <path d="M5.52 16h12.96"/>
      </svg>
    ),
  },
  {
    href: '/portal/admission/opd-sessions',
    label: 'OPD Sessions',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
        <path d="M8 14h2M12 14h2M16 14h2M8 17h2M12 17h2"/>
      </svg>
    ),
  },
  {
    href: '/billing/index.html',
    label: 'Billing Portal',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
];

interface Props {
  userName: string;
  role: string;
}

export default function AdmissionSidebar({ userName, role }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/portal/admission'
      ? pathname === '/portal/admission'
      : pathname.startsWith(href);

  return (
    <aside className={styles.sidebar}>
      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.logoRing}>
          <svg viewBox="0 0 40 40" fill="none" width="22" height="22">
            <rect x="17" y="5" width="6" height="30" rx="3" fill="white"/>
            <rect x="5" y="17" width="30" height="6" rx="3" fill="white"/>
          </svg>
        </div>
        <div>
          <div className={styles.brandName}>MeghaHMS</div>
          <div className={styles.brandSub}>Admission</div>
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${isActive(item.href) ? styles.active : ''}`}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* User footer */}
      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className={styles.userName}>{userName}</div>
            <div className={styles.userRole}>
              {role === 'RECEPTIONIST' ? 'Receptionist' : 'Nurse'}
            </div>
          </div>
        </div>
        <button
          className={styles.signOut}
          onClick={() => signOut({ callbackUrl: '/login' })}
          title="Sign out"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
