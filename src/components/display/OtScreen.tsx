'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { OtApiResponse, OtEntry, OtStatus } from '../../lib/types';
import MarqueeTicker from './MarqueeTicker';
import styles from './OtScreen.module.css';

const REFRESH_INTERVAL_MS = 30_000;
const SCROLL_PX_PER_SEC  = 22;   // comfortable reading speed on a TV
const PAUSE_AT_BOTTOM_MS = 2500; // pause before snapping back to top

interface Props {
  initialData: OtApiResponse;
  theme?: 'dark' | 'light';
}

/* ── Status configuration ───────────────────────────────────────── */
const STATUS_META: Record<
  OtStatus,
  { label: string; badgeClass: string; rowClass: string; pulse: boolean }
> = {
  'in-progress': {
    label: 'In Progress',
    badgeClass: styles.statusInProgress,
    rowClass: styles.trActive,
    pulse: true,
  },
  preparing: {
    label: 'Preparing',
    badgeClass: styles.statusPreparing,
    rowClass: styles.trPreparing,
    pulse: true,
  },
  scheduled: {
    label: 'Scheduled',
    badgeClass: styles.statusScheduled,
    rowClass: '',
    pulse: false,
  },
  delayed: {
    label: 'Delayed',
    badgeClass: styles.statusDelayed,
    rowClass: styles.trDelayed,
    pulse: true,
  },
  completed: {
    label: 'Completed',
    badgeClass: styles.statusCompleted,
    rowClass: styles.trCompleted,
    pulse: false,
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: styles.statusCancelled,
    rowClass: styles.trCancelled,
    pulse: false,
  },
};

export default function OtScreen({ initialData, theme = 'dark' }: Props) {
  const [data, setData] = useState<OtApiResponse>(initialData);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

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

  // ── Auto-scroll (rAF loop) ───────────────────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    let lastTs = 0;
    let paused = false;
    let exactScrollTop = 0;

    const tick = (ts: number) => {
      if (!paused) {
        // If content fits without scrolling, don't scroll
        if (el.scrollHeight <= el.clientHeight) {
          lastTs = ts;
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const delta = lastTs ? (ts - lastTs) / 1000 : 0;
        exactScrollTop += SCROLL_PX_PER_SEC * delta;
        
        // Sync if manual scroll happened
        if (Math.abs(el.scrollTop - exactScrollTop) > 5) {
          exactScrollTop = el.scrollTop;
        } else {
          el.scrollTop = exactScrollTop;
        }

        // Reached the bottom — pause then snap to top
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          paused = true;
          pauseRef.current = setTimeout(() => {
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
  }, [data.entries.length]); // restart when row count changes

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
    const id = setInterval(refreshData, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshData]);

  // ── Computed stats ───────────────────────────────────────────────────────
  const activeCount    = data.entries.filter((e) => e.status === 'in-progress' || e.status === 'preparing').length;
  const scheduledCount = data.entries.filter((e) => e.status === 'scheduled').length;
  const delayedCount   = data.entries.filter((e) => e.status === 'delayed').length;
  const completedCount = data.entries.filter((e) => e.status === 'completed').length;

  // ── Time formatters ───────────────────────────────────────────────────────
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const fmtDuration = (mins: number) =>
    mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`.trim() : `${mins}m`;

  const rowClass = (entry: OtEntry) =>
    [styles.tr, STATUS_META[entry.status].rowClass].filter(Boolean).join(' ');

  return (
    <div className={styles.screen}>

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
            <p className={styles.hospitalName}>{data.hospitalName}</p>
            <p className={styles.screenTitle}>Operation Theatre — Live Schedule</p>
          </div>
        </div>

        <div className={styles.headerCenter}>
          {activeCount > 0 && (
            <span className={`${styles.pill} ${styles.pillActive}`}>
              🔴 {activeCount} Active
            </span>
          )}
          <span className={`${styles.pill} ${styles.pillScheduled}`}>
            📋 {scheduledCount} Scheduled
          </span>
          {delayedCount > 0 && (
            <span className={`${styles.pill} ${styles.pillDelayed}`}>
              ⏳ {delayedCount} Delayed
            </span>
          )}
          <span className={`${styles.pill} ${styles.pillCompleted}`}>
            ✓ {completedCount} Done
          </span>
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

      {/* ── Table ── */}
      <main className={styles.main}>
        <div className={styles.tableOuter}>
          <div className={styles.tableWrapper} ref={wrapperRef}>
            <table className={styles.table} aria-label="OT Schedule">
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
                <th className={styles.th} scope="col">OT Room</th>
                <th className={styles.th} scope="col">Status</th>
                <th className={styles.th} scope="col">Type</th>
                <th className={styles.th} scope="col">Procedure</th>
                <th className={styles.th} scope="col">Patient</th>
                <th className={styles.th} scope="col">Surgeon</th>
                <th className={styles.th} scope="col">Anaesthetist</th>
                <th className={styles.th} scope="col">Time</th>
                <th className={styles.th} scope="col">Est. Dur.</th>
              </tr>
            </thead>

            <tbody>
              {data.entries.map((entry: OtEntry) => {
                const meta = STATUS_META[entry.status];

                return (
                  <tr
                    key={entry.id}
                    className={rowClass(entry)}
                    aria-label={`${entry.roomNo}: ${entry.procedureName} for ${entry.patientName}`}
                  >
                    {/* OT Room */}
                    <td className={styles.td}>
                      <span className={styles.roomBadge}>{entry.roomNo}</span>
                    </td>

                    {/* Status */}
                    <td className={styles.td}>
                      <span className={`${styles.statusBadge} ${meta.badgeClass}`}>
                        <span
                          className={`${styles.statusDot} ${meta.pulse ? styles.statusDotPulse : ''}`}
                          aria-hidden="true"
                        />
                        {meta.label}
                      </span>
                    </td>

                    {/* Type */}
                    <td className={styles.td}>
                      <span className={styles.typeChip}>{entry.type}</span>
                    </td>

                    {/* Procedure */}
                    <td className={styles.td}>
                      <p className={styles.procName}>{entry.procedureName}</p>
                      {entry.notes && (
                        <span className={styles.notesTag} title={entry.notes}>
                          📝 {entry.notes}
                        </span>
                      )}
                    </td>

                    {/* Patient */}
                    <td className={styles.td}>
                      <p className={styles.patientName}>{entry.patientName}</p>
                      <p className={styles.patientMeta}>
                        {entry.patientAge} yrs · {entry.patientGender === 'M' ? 'Male' : entry.patientGender === 'F' ? 'Female' : 'Other'}
                      </p>
                    </td>

                    {/* Surgeon */}
                    <td className={styles.td}>
                      <p className={styles.doctorName}>{entry.doctor}</p>
                      {entry.assistants.length > 0 && (
                        <p className={styles.assistantsList}>
                          + {entry.assistants.join(', ')}
                        </p>
                      )}
                    </td>

                    {/* Anaesthetist */}
                    <td className={styles.td}>
                      <p className={styles.anaesthetist}>{entry.anaesthetist}</p>
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
