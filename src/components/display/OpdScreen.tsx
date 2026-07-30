'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { OpdApiResponse, FlatDoctor } from '../../lib/types';
import {
  translations,
  localizeTime,
  localizeDate,
  localizeNumber,
  type Lang,
} from '../../lib/displayTranslations';
import { useTransliterate } from '../../hooks/useTransliterate';
import DoctorCard from './DoctorCard';
import TokenCallout from './TokenCallout';
import MarqueeTicker from './MarqueeTicker';
import styles from './OpdScreen.module.css';

const CARDS_PER_PAGE = 4;
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

  // ── Language state — toggles after each full carousel cycle ──────────────
  const [lang, setLang] = useState<Lang>('en');
  const [isLangTransitioning, setIsLangTransitioning] = useState(false);
  const cycleCountRef = useRef(0);

  // ── Apply theme to <html data-theme> so vars cascade to every component ──
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    return () => document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  const totalPages = Math.max(1, Math.ceil(data.doctors.length / CARDS_PER_PAGE));

  const visibleDoctors: FlatDoctor[] = data.doctors.slice(
    currentPage * CARDS_PER_PAGE,
    (currentPage + 1) * CARDS_PER_PAGE
  );

  /** IDs of doctors currently rendered on the visible grid page */
  const visibleDoctorIds = new Set(visibleDoctors.map((d) => d.id));

  const runningConsultations: FlatDoctor[] = data.doctors.filter(
    (d) => d.status === 'running' && d.currentToken !== null
  );

  // ── Collect all names for transliteration ────────────────────────────────
  const allNames = useMemo(() => {
    const names: string[] = [];
    for (const doc of data.doctors) {
      names.push(doc.name);
      names.push(doc.departmentName);
      if (doc.designation) names.push(doc.designation);
      if (doc.departmentFloor) names.push(doc.departmentFloor);
    }
    return names;
  }, [data.doctors]);

  const { transliterations } = useTransliterate(allNames, true);

  // ── Clock (hydration-safe — only set after mount) ──────────────────────────
  useEffect(() => {
    setCurrentTime(new Date());
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-page carousel ──────────────────────────────────────────────────
  useEffect(() => {
    if (totalPages <= 1) {
      // Single page: switch language on a fixed interval (same as one "cycle")
      const id = setInterval(() => {
        setIsLangTransitioning(true);
        setTimeout(() => {
          setLang((prev) => (prev === 'en' ? 'bn' : 'en'));
          setIsLangTransitioning(false);
        }, 500);
      }, PAGE_INTERVAL_MS);
      return () => clearInterval(id);
    }

    const id = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentPage((p) => (p + 1) % totalPages);
        setIsVisible(true);
      }, 450);
    }, PAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [totalPages]);

  const prevPageRef = useRef(0);

  // ── Detect when carousel wraps back to Page 0 to switch language ───────
  useEffect(() => {
    if (totalPages <= 1) return;

    const prevPage = prevPageRef.current;
    prevPageRef.current = currentPage;

    if (currentPage === 0 && prevPage === totalPages - 1) {
      setIsLangTransitioning(true);
      const timer = setTimeout(() => {
        setLang((prev) => (prev === 'en' ? 'bn' : 'en'));
        setIsLangTransitioning(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [currentPage, totalPages]);

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

  // ── Translation helpers ─────────────────────────────────────────────────────
  const t = translations[lang];

  /** Get transliterated value or fall back to original */
  const tr = (text: string) => {
    if (lang === 'bn' && transliterations.has(text)) {
      return transliterations.get(text)!;
    }
    return text;
  };

  return (
    <div
      className={styles.screen}
      style={{
        opacity: isLangTransitioning ? 0 : 1,
        transition: 'opacity 0.5s ease',
      }}
    >
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoMark}>
            <img
              src="https://mikkymeghahospital.com/wp-content/uploads/2025/09/m.png"
              alt="Hospital Logo"
              className={styles.logoImage}
            />
          </div>
          <div>
            <p className={styles.hospitalName}>{t.common.hospitalName}</p>
            <p className={styles.headerSub}>{t.opd.subtitle}</p>
          </div>
        </div>

        <div className={styles.headerCenter}>
          <span className={styles.livePill} role="status" aria-live="polite">
            <span className={styles.liveDot} aria-hidden="true" />
            {t.common.live}
          </span>
        </div>

        <div className={styles.headerRight}>
          {currentTime ? (
            <>
              <p className={styles.clock}>{localizeTime(currentTime, lang)}</p>
              <p className={styles.calDate}>{localizeDate(currentTime, lang)}</p>
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
            <span className={styles.gridLabel}>{t.opd.allDoctors}</span>
            {totalPages > 1 && (
              <span className={styles.pageChip}>
                {localizeNumber(currentPage + 1, lang)} / {localizeNumber(totalPages, lang)}
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
              <DoctorCard
                key={doc.id}
                doctor={doc}
                lang={lang}
                transliteratedName={tr(doc.name) !== doc.name ? tr(doc.name) : undefined}
                transliteratedDept={tr(doc.departmentName) !== doc.departmentName ? tr(doc.departmentName) : undefined}
                transliteratedDesignation={doc.designation && tr(doc.designation) !== doc.designation ? tr(doc.designation) : undefined}
                transliteratedFloor={doc.departmentFloor && tr(doc.departmentFloor) !== doc.departmentFloor ? tr(doc.departmentFloor) : undefined}
              />
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
            lang={lang}
            transliterations={transliterations}
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
