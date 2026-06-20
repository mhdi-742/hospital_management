'use client';

import { useState, useEffect, useCallback } from 'react';
import type { IpdApiResponse, Ward } from '../../lib/types';
import PatientMarquee from './PatientMarquee';
import MarqueeTicker from './MarqueeTicker';
import styles from './IpdScreen.module.css';

const REFRESH_INTERVAL_MS = 30_000;

interface Props {
  initialData: IpdApiResponse;
  /** 'dark' (default) = deep space theme; 'light' = red-blue-white hospital theme */
  theme?: 'dark' | 'light';
}

export default function IpdScreen({ initialData, theme = 'dark' }: Props) {
  const [data, setData] = useState<IpdApiResponse>(initialData);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // ── Apply theme to <html data-theme> ───────────────────────────────────
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    return () => document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  // ── Clock (hydration-safe) ──────────────────────────────────────────────
  useEffect(() => {
    setCurrentTime(new Date());
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Data refresh polling ────────────────────────────────────────────────
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/ipd');
      if (res.ok) {
        const next: IpdApiResponse = await res.json();
        setData(next);
      }
    } catch {
      /* silently skip — stale data is acceptable */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refreshData, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshData]);

  // ── Computed stats ─────────────────────────────────────────────────────
  const totalAdmitted = data.wards.reduce((s, w) => s + w.patients.length, 0);
  const totalCapacity = data.wards.reduce((s, w) => s + w.capacity, 0);
  const criticalCount = data.wards.reduce(
    (s, w) => s + w.patients.filter((p) => p.status === 'critical').length,
    0
  );
  const occupancyPct = totalCapacity > 0
    ? Math.round((totalAdmitted / totalCapacity) * 100)
    : 0;

  // ── Time formatters ────────────────────────────────────────────────────
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

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
            <p className={styles.screenTitle}>IPD Patient Status Dashboard</p>
          </div>
        </div>

        <div className={styles.headerCenter}>
          {/* Summary pills */}
          <div className={styles.summaryPills}>
            <span className={`${styles.pill} ${styles.pillAdmitted}`}>
              🏥 {totalAdmitted} Admitted
            </span>
            {criticalCount > 0 && (
              <span className={`${styles.pill} ${styles.pillCritical}`}>
                ⚠ {criticalCount} Critical
              </span>
            )}
            <span className={`${styles.pill} ${styles.pillOccupancy}`}>
              {occupancyPct}% Occupancy
            </span>
          </div>

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

      {/* ── Main Table Area ── */}
      <main className={styles.main}>
        <div className={styles.tableWrapper}>
          <table className={styles.table} aria-label="IPD Patient Status">
            <colgroup>
              <col className={styles.colWard} />
              <col className={styles.colCount} />
              <col className={styles.colPatients} />
            </colgroup>
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th} scope="col">Ward / Unit</th>
                <th className={styles.th} scope="col">Occupied / Capacity</th>
                <th className={styles.th} scope="col">Admitted Patients</th>
              </tr>
            </thead>
            <tbody className={styles.tbody}>
              {data.wards.map((ward: Ward) => {
                const critCount = ward.patients.filter((p) => p.status === 'critical').length;
                const fillPct = ward.capacity > 0
                  ? Math.min((ward.patients.length / ward.capacity) * 100, 100)
                  : 0;

                return (
                  <tr key={ward.id} className={styles.tr}>

                    {/* Ward name cell */}
                    <td className={styles.td}>
                      <div className={styles.wardCell}>
                        <div
                          className={styles.wardAccent}
                          style={{ background: ward.accentColor }}
                          aria-hidden="true"
                        />
                        <span
                          className={styles.wardBadge}
                          style={{
                            color: ward.accentColor,
                            borderColor: ward.accentColor,
                            background: `${ward.accentColor}14`,
                          }}
                        >
                          {ward.code}
                        </span>
                        <div className={styles.wardInfo}>
                          <p className={styles.wardName}>{ward.name}</p>
                        </div>
                      </div>
                    </td>

                    {/* Count cell */}
                    <td className={styles.td}>
                      <div className={styles.countCell}>
                        <div className={styles.countNumbers}>
                          <span
                            className={styles.countValue}
                            style={{ color: ward.accentColor }}
                          >
                            {ward.patients.length}
                          </span>
                          <span className={styles.countSep}>/</span>
                          <span className={styles.countCapacity}>{ward.capacity}</span>
                        </div>
                        <div className={styles.progressTrack}>
                          <div
                            className={styles.progressFill}
                            style={{
                              width: `${fillPct}%`,
                              background: ward.accentColor,
                            }}
                          />
                        </div>
                        {critCount > 0 && (
                          <span className={styles.critBadge}>
                            <span className={styles.critDotSmall} />
                            {critCount} Critical
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Scrolling patients cell */}
                    <td className={styles.td}>
                      <div className={styles.patientsCell}>
                        <PatientMarquee
                          patients={ward.patients}
                          accentColor={ward.accentColor}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {/* ── Footer Ticker ── */}
      <footer className={styles.footer} aria-label="Announcements">
        <MarqueeTicker announcements={data.announcements} />
      </footer>
    </div>
  );
}
