'use client';

import { useRef, useEffect } from 'react';
import type { FlatDoctor } from '../../lib/types';
import styles from './TokenCallout.module.css';

interface Props {
  consultations: FlatDoctor[];
  allDoctors: FlatDoctor[];
  visibleDoctorIds: Set<string>;
}

const SCROLL_SPEED_PX_PER_SEC = 28;

export default function TokenCallout({ consultations, allDoctors, visibleDoctorIds }: Props) {

  // ── Compute dashboard stats ───────────────────────────────────────────────
  /** Total tokens served across all doctors who have started consulting */
  const patientsTreated = allDoctors
    .filter((d) => d.currentToken !== null)
    .reduce((sum, d) => sum + (d.currentToken ?? 0), 0);

  /** Remaining tokens (total issued minus already served) for active sessions */
  const totalWaiting = allDoctors
    .filter((d) => d.status === 'running' || d.status === 'upcoming')
    .reduce((sum, d) => {
      const served = d.currentToken ?? 0;
      return sum + Math.max(0, d.totalTokens - served);
    }, 0);

  const avgWait = consultations.length > 0
    ? Math.round(
        consultations.reduce((s, d) => s + d.avgWaitMinutes, 0) / consultations.length
      )
    : 0;

  const doctorsAvailable = allDoctors.filter(
    (d) => d.status === 'running' || d.status === 'upcoming'
  ).length;

  const activeDepts = new Set(consultations.map((c) => c.departmentId)).size;

  const totalTokensIssued = allDoctors.reduce((s, d) => s + d.totalTokens, 0);

  // ── Also Running (off-screen running doctors only) ────────────────────────
  const alsoRunning = consultations.filter((d) => !visibleDoctorIds.has(d.id));

  const listRef = useRef<HTMLDivElement>(null);
  const rafRef  = useRef<number>(0);

  useEffect(() => {
    const el = listRef.current;
    if (!el || alsoRunning.length === 0) return;

    const timeout = setTimeout(() => {
      if (el.scrollHeight <= el.clientHeight) return;
      let lastTs = 0;
      const tick = (ts: number) => {
        if (lastTs) {
          el.scrollTop += (SCROLL_SPEED_PX_PER_SEC * (ts - lastTs)) / 1000;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
            el.scrollTop = 0;
          }
        }
        lastTs = ts;
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, 200);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [alsoRunning.length]);

  // ── Stat card definitions ─────────────────────────────────────────────────
  const stats: {
    id: string;
    label: string;
    value: string | number;
    sub: string;
    accent: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'treated',
      label: 'Treated Today',
      value: patientsTreated,
      sub: `of ${totalTokensIssued} tokens`,
      accent: '#10b981',
      icon: <CheckIcon />,
    },
    {
      id: 'active',
      label: 'Active Now',
      value: consultations.length,
      sub: 'consultations',
      accent: '#38bdf8',
      icon: <PulseIcon />,
    },
    {
      id: 'waiting',
      label: 'In Queue',
      value: totalWaiting,
      sub: 'patients waiting',
      accent: '#f59e0b',
      icon: <WaitIcon />,
    },
    {
      id: 'avgwait',
      label: 'Avg Wait',
      value: avgWait > 0 ? `${avgWait}m` : '—',
      sub: 'per patient',
      accent: '#f97316',
      icon: <ClockIcon />,
    },
    {
      id: 'depts',
      label: 'Depts Active',
      value: activeDepts,
      sub: `of ${new Set(allDoctors.map((d) => d.departmentId)).size} total`,
      accent: '#8b5cf6',
      icon: <DeptIcon />,
    },
    {
      id: 'docs',
      label: 'Doctors Avail.',
      value: doctorsAvailable,
      sub: `of ${allDoctors.length} today`,
      accent: '#14b8a6',
      icon: <DocIcon />,
    },
  ];

  return (
    <div className={styles.panel}>

      {/* ── Dashboard heading ── */}
      <div className={styles.dashHeading}>
        <span className={styles.dashDot} aria-hidden="true" />
        OPD Overview
      </div>

      {/* ── 2 × 3 stat card grid ── */}
      <div className={styles.statGrid}>
        {stats.map((s) => (
          <div
            key={s.id}
            className={styles.statCard}
            style={{ '--card-accent': s.accent } as React.CSSProperties}
            aria-label={`${s.label}: ${s.value}`}
          >
            <div className={styles.cardAccent} aria-hidden="true" />
            <div className={styles.cardIcon} style={{ color: s.accent }}>
              {s.icon}
            </div>
            <p className={styles.cardValue} style={{ color: s.accent }}>
              {s.value}
            </p>
            <p className={styles.cardLabel}>{s.label}</p>
            <p className={styles.cardSub}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Divider ── */}
      <div className={styles.divider} aria-hidden="true" />

      {/* ── Also Running (off-screen) ── */}
      {alsoRunning.length > 0 ? (
        <div className={styles.othersWrapper}>
          <p className={styles.othersHeading}>
            Also Running
            <span className={styles.othersCount}>{alsoRunning.length}</span>
          </p>
          <div
            ref={listRef}
            className={styles.othersList}
            aria-label="Other active consultations not visible on screen"
          >
            {alsoRunning.map((doc) => (
              <div
                key={doc.id}
                className={styles.otherItem}
                aria-label={`${doc.name}, token ${doc.currentToken}, Room ${doc.roomNo}`}
              >
                <span
                  className={styles.otherDot}
                  style={{ background: doc.departmentColor }}
                  aria-hidden="true"
                />
                <div className={styles.otherInfo}>
                  <p className={styles.otherName}>{doc.name}</p>
                  <p className={styles.otherMeta}>{doc.departmentName} · Rm {doc.roomNo}</p>
                </div>
                <span className={styles.otherToken}>#{doc.currentToken}</span>
              </div>
            ))}
          </div>
        </div>
      ) : consultations.length > 0 ? (
        <p className={styles.allOnScreen}>All active doctors are visible on screen</p>
      ) : null}
    </div>
  );
}

/* ── Micro icons ─────────────────────────────────────────────────────────── */
function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function PulseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function WaitIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function DeptIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
