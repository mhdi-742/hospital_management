'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import styles from './DoctorSidebar.module.css';

const NAV = [
  {
    href: '/portal/doctor',
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
    href: '/portal/doctor/opd',
    label: 'OPD Sessions',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
    ),
  },
  {
    href: '/portal/doctor/ipd',
    label: 'My Patients (IPD)',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    href: '/portal/doctor/ot',
    label: 'OT Schedule',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.07 7.07l-9.74 9.74a2.82 2.82 0 1 1-4-4l9.74-9.74a6 6 0 0 1 7.07-7.07l-3.77 3.77z"/>
      </svg>
    ),
  },
  {
    href: '/portal/doctor/profile',
    label: 'Profile',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

interface Props {
  userName: string;
  designation: string;
}

export default function DoctorSidebar({ userName, designation }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/portal/doctor'
      ? pathname === '/portal/doctor'
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
          <div className={styles.brandSub}>Doctor Portal</div>
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
          <div className={styles.meta}>
            <div className={styles.userName}>{userName}</div>
            <div className={styles.userRole}>{designation || 'Doctor'}</div>
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
