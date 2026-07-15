'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { OtApiResponse, OtEntry, OtStatus } from '../../lib/types';
import {
  translations,
  localizeTime,
  localizeDate,
  localizeNumber,
  type Lang,
} from '../../lib/displayTranslations';
import { useTransliterate } from '../../hooks/useTransliterate';
import MarqueeTicker from './MarqueeTicker';
import styles from './OtScreen.module.css';

const REFRESH_INTERVAL_MS = 30_000;
const SCROLL_PX_PER_SEC  = 22;   // comfortable reading speed on a TV
const PAUSE_AT_BOTTOM_MS = 2500; // pause before snapping back to top
const FALLBACK_SWITCH_MS = 20_000; // fallback interval when content fits without scrolling

interface Props {
  initialData: OtApiResponse;
  theme?: 'dark' | 'light';
}

/* ── Status configuration ───────────────────────────────────────── */
type StatusMetaEntry = {
  labelKey: keyof typeof translations.en.ot;
  badgeClass: string;
  rowClass: string;
  pulse: boolean;
};

const STATUS_META: Record<OtStatus, StatusMetaEntry> = {
  'in-progress': {
    labelKey: 'inProgress',
    badgeClass: styles.statusInProgress,
    rowClass: styles.trActive,
    pulse: true,
  },
  preparing: {
    labelKey: 'preparing',
    badgeClass: styles.statusPreparing,
    rowClass: styles.trPreparing,
    pulse: true,
  },
  scheduled: {
    labelKey: 'scheduled',
    badgeClass: styles.statusScheduled,
    rowClass: '',
    pulse: false,
  },
  delayed: {
    labelKey: 'delayed',
    badgeClass: styles.statusDelayed,
    rowClass: styles.trDelayed,
    pulse: true,
  },
  completed: {
    labelKey: 'completed',
    badgeClass: styles.statusCompleted,
    rowClass: styles.trCompleted,
    pulse: false,
  },
  cancelled: {
    labelKey: 'cancelled',
    badgeClass: styles.statusCancelled,
    rowClass: styles.trCancelled,
    pulse: false,
  },
};

export default function OtScreen({ initialData, theme = 'dark' }: Props) {
  const [data, setData] = useState<OtApiResponse>(initialData);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // ── Language state — toggles when scroll reaches bottom + snaps to top ──
  const [lang, setLang] = useState<Lang>('en');
  const [isLangTransitioning, setIsLangTransitioning] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  // ── Auto-scroll refs ─────────────────────────────────────────────────────
  const wrapperRef   = useRef<HTMLDivElement>(null);
  const rafRef       = useRef<number>(0);
  const pauseRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Theme ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    return () => document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  // ── Collect all names for transliteration ────────────────────────────────
  const allNames = useMemo(() => {
    const names: string[] = [];
    for (const entry of data.entries) {
      names.push(entry.patientName);
      names.push(entry.doctor);
      names.push(entry.anaesthetist);
      names.push(entry.procedureName);
      for (const asst of entry.assistants) {
        names.push(asst);
      }
    }
    return names;
  }, [data.entries]);

  const { transliterations } = useTransliterate(allNames, true);

  // ── Language switch helper ─────────────────────────────────────────────
  const switchLanguage = useCallback(() => {
    setIsLangTransitioning(true);
    setTimeout(() => {
      setLang((prev) => (prev === 'en' ? 'bn' : 'en'));
      setIsLangTransitioning(false);
    }, 500);
  }, []);

  // ── Check if table is scrollable (overflows client height) ─────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // Small delay ensures DOM and styles are fully loaded and rendered
    const checkTimer = setTimeout(() => {
      const scrollable = el.scrollHeight - el.clientHeight > 10;
      setIsScrollable(scrollable);
    }, 200);

    return () => clearTimeout(checkTimer);
  }, [data.entries]);

  // ── Fallback language switch timer when table doesn't scroll ───────────
  useEffect(() => {
    if (isScrollable) return;

    const intervalId = setInterval(() => {
      switchLanguage();
    }, FALLBACK_SWITCH_MS);

    return () => clearInterval(intervalId);
  }, [isScrollable, switchLanguage]);

  // ── Auto-scroll (rAF loop) — triggers language switch at bottom ─────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || !isScrollable) return;

    let lastTs = 0;
    let paused = false;
    let exactScrollTop = 0;

    const tick = (ts: number) => {
      if (!paused) {
        const delta = lastTs ? (ts - lastTs) / 1000 : 0;
        exactScrollTop += SCROLL_PX_PER_SEC * delta;
        
        // Sync if manual scroll happened
        if (Math.abs(el.scrollTop - exactScrollTop) > 5) {
          exactScrollTop = el.scrollTop;
        } else {
          el.scrollTop = exactScrollTop;
        }

        // Reached the bottom — pause, switch language, then snap to top
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          paused = true;
          pauseRef.current = setTimeout(() => {
            // Switch language when we snap back to top
            switchLanguage();

            // Force instant scroll snap by temporarily disabling overflow
            el.style.overflowY = 'hidden';
            el.scrollTop = 0;
            exactScrollTop = 0;
            // Force browser layout recalculation
            void el.offsetHeight;
            el.style.overflowY = '';

            paused = false;
            lastTs = 0;           // reset so no big jump on resume
            rafRef.current = requestAnimationFrame(tick);
          }, PAUSE_AT_BOTTOM_MS);
          return;                 // don't request next frame while paused
        }
      }
      lastTs = ts;
      rafRef.current = requestAnimationFrame(tick);
    };

    // Small delay so layout is settled before we start
    const startTimer = setTimeout(() => {
      exactScrollTop = el.scrollTop;
      rafRef.current = requestAnimationFrame(tick);
    }, 600);

    return () => {
      clearTimeout(startTimer);
      if (pauseRef.current) clearTimeout(pauseRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isScrollable, switchLanguage]); // restart when row count changes

  // ── Clock ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setCurrentTime(new Date());
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Data polling ─────────────────────────────────────────────────────────
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/ot');
      if (res.ok) setData(await res.json());
    } catch { /* silently skip */ }
  }, []);

  useEffect(() => {
    const evtSource = new EventSource('/api/events');
    evtSource.onmessage = () => {
      refreshData();
    };

    const intervalId = setInterval(refreshData, REFRESH_INTERVAL_MS);

    return () => {
      evtSource.close();
      clearInterval(intervalId);
    };
  }, [refreshData]);

  // ── Computed stats ───────────────────────────────────────────────────────
  const activeCount    = data.entries.filter((e) => e.status === 'in-progress' || e.status === 'preparing').length;
  const scheduledCount = data.entries.filter((e) => e.status === 'scheduled').length;
  const delayedCount   = data.entries.filter((e) => e.status === 'delayed').length;
  const completedCount = data.entries.filter((e) => e.status === 'completed').length;

  // ── Translation helpers ──────────────────────────────────────────────────
  const t = translations[lang];

  /** Get transliterated value or fall back to original */
  const tr = (text: string) => {
    if (lang === 'bn' && transliterations.has(text)) {
      return transliterations.get(text)!;
    }
    return text;
  };

  const fmtDuration = (mins: number) => {
    const localMins = localizeNumber(mins % 60, lang);
    const localHours = localizeNumber(Math.floor(mins / 60), lang);
    if (mins >= 60) {
      return `${localHours}h ${mins % 60 > 0 ? `${localMins}m` : ''}`.trim();
    }
    return `${localMins}m`;
  };

  const rowClass = (entry: OtEntry) =>
    [styles.tr, STATUS_META[entry.status].rowClass].filter(Boolean).join(' ');

  const genderLabel = (g: string) => {
    if (g === 'M') return t.common.male;
    if (g === 'F') return t.common.female;
    return t.common.other;
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
          <div className={styles.headerTitles}>
            <p className={styles.hospitalName}>{t.common.hospitalName}</p>
            <p className={styles.screenTitle}>{t.ot.subtitle}</p>
          </div>
        </div>

        <div className={styles.headerCenter}>
          {activeCount > 0 && (
            <span className={`${styles.pill} ${styles.pillActive}`}>
              🔴 {localizeNumber(activeCount, lang)} {t.ot.active}
            </span>
          )}
          <span className={`${styles.pill} ${styles.pillScheduled}`}>
            📋 {localizeNumber(scheduledCount, lang)} {t.ot.scheduled}
          </span>
          {delayedCount > 0 && (
            <span className={`${styles.pill} ${styles.pillDelayed}`}>
              ⏳ {localizeNumber(delayedCount, lang)} {t.ot.delayed}
            </span>
          )}
          <span className={`${styles.pill} ${styles.pillCompleted}`}>
            ✓ {localizeNumber(completedCount, lang)} {t.ot.done}
          </span>
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

      {/* ── Table ── */}
      <main className={styles.main}>
        <div className={styles.tableOuter}>
          <div className={styles.tableWrapper} ref={wrapperRef}>
            <table className={styles.table} aria-label={t.ot.subtitle}>
            <colgroup>
              <col className={styles.colRoom} />
              <col className={styles.colStatus} />
              <col className={styles.colType} />
              <col className={styles.colProc} />
              <col className={styles.colPatient} />
              <col className={styles.colDoctor} />
              <col className={styles.colAnaeth} />
              <col className={styles.colTime} />
              <col className={styles.colDur} />
            </colgroup>

            <thead className={styles.thead}>
              <tr>
                <th className={styles.th} scope="col">{t.ot.otRoom}</th>
                <th className={styles.th} scope="col">{t.ot.status}</th>
                <th className={styles.th} scope="col">{t.ot.type}</th>
                <th className={styles.th} scope="col">{t.ot.procedure}</th>
                <th className={styles.th} scope="col">{t.ot.patient}</th>
                <th className={styles.th} scope="col">{t.ot.surgeon}</th>
                <th className={styles.th} scope="col">{t.ot.anaesthetist}</th>
                <th className={styles.th} scope="col">{t.ot.time}</th>
                <th className={styles.th} scope="col">{t.ot.estDur}</th>
              </tr>
            </thead>

            <tbody>
              {data.entries.map((entry: OtEntry) => {
                const meta = STATUS_META[entry.status];
                const statusLabel = t.ot[meta.labelKey] as string;

                return (
                  <tr
                    key={entry.id}
                    className={rowClass(entry)}
                    aria-label={`${entry.roomNo}: ${tr(entry.procedureName)} for ${tr(entry.patientName)}`}
                  >
                    {/* OT Room */}
                    <td className={styles.td}>
                      <span className={styles.roomBadge}>{localizeNumber(entry.roomNo, lang)}</span>
                    </td>

                    {/* Status */}
                    <td className={styles.td}>
                      <span className={`${styles.statusBadge} ${meta.badgeClass}`}>
                        <span
                          className={`${styles.statusDot} ${meta.pulse ? styles.statusDotPulse : ''}`}
                          aria-hidden="true"
                        />
                        {statusLabel}
                      </span>
                    </td>

                    {/* Type */}
                    <td className={styles.td}>
                      <span className={styles.typeChip}>{entry.type}</span>
                    </td>

                    {/* Procedure */}
                    <td className={styles.td}>
                      <p className={styles.procName}>{tr(entry.procedureName)}</p>
                      {entry.notes && (
                        <span className={styles.notesTag} title={entry.notes}>
                          📝 {entry.notes}
                        </span>
                      )}
                    </td>

                    {/* Patient */}
                    <td className={styles.td}>
                      <p className={styles.patientName}>{tr(entry.patientName)}</p>
                      <p className={styles.patientMeta}>
                        {localizeNumber(entry.patientAge, lang)} {t.common.yrs} · {genderLabel(entry.patientGender)}
                      </p>
                    </td>

                    {/* Surgeon */}
                    <td className={styles.td}>
                      <p className={styles.doctorName}>{tr(entry.doctor)}</p>
                      {entry.assistants.length > 0 && (
                        <p className={styles.assistantsList}>
                          + {entry.assistants.map(a => tr(a)).join(', ')}
                        </p>
                      )}
                    </td>

                    {/* Anaesthetist */}
                    <td className={styles.td}>
                      <p className={styles.anaesthetist}>{tr(entry.anaesthetist)}</p>
                    </td>

                    {/* Scheduled Time */}
                    <td className={styles.td}>
                      <span className={styles.timeVal}>{entry.scheduledTime}</span>
                    </td>

                    {/* Duration */}
                    <td className={styles.td}>
                      <span className={styles.durVal}>{fmtDuration(entry.estimatedDuration)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>

      {/* ── Footer Ticker ── */}
      <footer className={styles.footer} aria-label="OT Notices">
        <MarqueeTicker announcements={data.announcements} />
      </footer>
    </div>
  );
}
