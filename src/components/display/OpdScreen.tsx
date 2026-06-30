'use client';

import { useState, useEffect, useCallback } from 'react';
import type { OpdApiResponse, FlatDoctor } from '../../lib/types';
import DoctorCard from './DoctorCard';
import TokenCallout from './TokenCallout';
import MarqueeTicker from './MarqueeTicker';
import styles from './OpdScreen.module.css';

const CARDS_PER_PAGE = 6;
const PAGE_INTERVAL_MS = 9000;   // advance page every 9 s

interface Props {
  initialData: OpdApiResponse;
  /** 'dark' (default) = deep space theme; 'light' = red-blue-white hospital theme */
  theme?: 'dark' | 'light';
}

export default function OpdScreen({ initialData, theme = 'dark' }: Props) {
  const [data, setData] = useState<OpdApiResponse>(initialData);
  const [currentPage, setCurrentPage] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // ── Apply theme to <html data-theme> so vars cascade to every component ──
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    return () => document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  const totalPages = Math.ceil(data.doctors.length / CARDS_PER_PAGE);

  const visibleDoctors: FlatDoctor[] = data.doctors.slice(
    currentPage * CARDS_PER_PAGE,
    (currentPage + 1) * CARDS_PER_PAGE
  );

  /** IDs of doctors currently rendered on the visible grid page */
  const visibleDoctorIds = new Set(visibleDoctors.map((d) => d.id));

  const runningConsultations: FlatDoctor[] = data.doctors.filter(
    (d) => d.status === 'running' && d.currentToken !== null
  );

  // ── Clock (hydration-safe — only set after mount) ──────────────────────────
  useEffect(() => {
    setCurrentTime(new Date());
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-page carousel ─────────────────────────────────────────────────────
  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentPage((p) => (p + 1) % totalPages);
        setIsVisible(true);
      }, 450);
    }, PAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [totalPages]);

  // ── Data refresh via SSE ───────────────────────────────────────────────────
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/opd');
      if (res.ok) {
        const next: OpdApiResponse = await res.json();
        setData(next);
      }
    } catch {
      /* silently skip — stale data is acceptable */
    }
  }, []);

  useEffect(() => {
    const evtSource = new EventSource('/api/events');
    evtSource.onmessage = () => {
      refreshData();
    };
    return () => evtSource.close();
  }, [refreshData]);

  // ── Manual page jump ───────────────────────────────────────────────────────
  const jumpToPage = (idx: number) => {
    if (idx === currentPage) return;
    setIsVisible(false);
    setTimeout(() => {
      setCurrentPage(idx);
      setIsVisible(true);
    }, 450);
  };

  // ── Time formatters ────────────────────────────────────────────────────────
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  return (
    <div className={styles.screen}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoMark}>
            <img
              src="https://mikkymeghahospital.com/wp-content/uploads/2025/09/m.png"
              alt="Apex City General Hospital Logo"
              className={styles.logoImage}
            />
          </div>
          <div>
            <p className={styles.hospitalName}>{data.hospitalName}</p>
            <p className={styles.headerSub}>Outpatient Department — Live Display</p>
          </div>
        </div>

        <div className={styles.headerCenter}>
          <span className={styles.livePill} role="status" aria-live="polite">
            <span className={styles.liveDot} aria-hidden="true" />
            LIVE
          </span>
        </div>

        <div className={styles.headerRight}>
          {currentTime ? (
            <>
              <p className={styles.clock}>{fmtTime(currentTime)}</p>
              <p className={styles.calDate}>{fmtDate(currentTime)}</p>
            </>
          ) : (
            <>
              <p className={styles.clock}>--:--:-- --</p>
              <p className={styles.calDate}>&nbsp;</p>
            </>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className={styles.main}>

        {/* Doctor grid */}
        <section className={styles.gridSection}>
          <div className={styles.gridMeta}>
            <span className={styles.gridLabel}>All Doctors</span>
            {totalPages > 1 && (
              <span className={styles.pageChip}>
                {currentPage + 1} / {totalPages}
              </span>
            )}
          </div>

          <div
            className={styles.grid}
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(6px)',
              transition: 'opacity 0.45s ease, transform 0.45s ease',
            }}
          >
            {visibleDoctors.map((doc) => (
              <DoctorCard key={doc.id} doctor={doc} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.dots} role="tablist" aria-label="Page navigation">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  id={`dot-${i}`}
                  role="tab"
                  aria-selected={i === currentPage}
                  aria-label={`Page ${i + 1}`}
                  className={`${styles.dot} ${i === currentPage ? styles.dotActive : ''}`}
                  onClick={() => jumpToPage(i)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside className={styles.sidebar} aria-label="OPD dashboard">
          <TokenCallout
            consultations={runningConsultations}
            allDoctors={data.doctors}
            visibleDoctorIds={visibleDoctorIds}
          />
        </aside>
      </main>

      {/* ── Ticker ── */}
      <footer className={styles.footer} aria-label="Announcements">
        <MarqueeTicker announcements={data.announcements} />
      </footer>
    </div>
  );
}
