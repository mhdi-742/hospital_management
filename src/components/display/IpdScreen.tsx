'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { IpdApiResponse, Ward } from '../../lib/types';
import {
  translations,
  localizeTime,
  localizeDate,
  localizeNumber,
  type Lang,
} from '../../lib/displayTranslations';
import { useTransliterate } from '../../hooks/useTransliterate';
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

  // ── Language state — toggles after longest marquee scroll completes ──────
  const [lang, setLang] = useState<Lang>('en');
  const [isLangTransitioning, setIsLangTransitioning] = useState(false);

  // ── Apply theme to <html data-theme> ───────────────────────────────────
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
    for (const ward of data.wards) {
      names.push(ward.name);
      for (const patient of ward.patients) {
        names.push(patient.name);
      }
    }
    return names;
  }, [data.wards]);

  const { transliterations } = useTransliterate(allNames, true);

  // ── Language switch timer — based on longest marquee duration ─────────────
  const longestMarquee = useMemo(() => {
    return data.wards.reduce((max, ward) => {
      const duration = Math.max(ward.patients.length * 4, 20);
      return Math.max(max, duration);
    }, 20);
  }, [data.wards]);

  const switchInterval = longestMarquee * 1000;
  const switchIntervalRef = useRef(switchInterval);

  useEffect(() => {
    switchIntervalRef.current = switchInterval;
  }, [switchInterval]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const tick = () => {
      timeoutId = setTimeout(() => {
        setIsLangTransitioning(true);
        setTimeout(() => {
          setLang((prev) => (prev === 'en' ? 'bn' : 'en'));
          setIsLangTransitioning(false);
          tick(); // Schedule next tick
        }, 500);
      }, switchIntervalRef.current);
    };

    tick();

    return () => clearTimeout(timeoutId);
  }, []);

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

  // ── Translation helpers ──────────────────────────────────────────────────
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
          <div className={styles.headerTitles}>
            <p className={styles.hospitalName}>{t.common.hospitalName}</p>
            <p className={styles.screenTitle}>{t.ipd.subtitle}</p>
          </div>
        </div>

        <div className={styles.headerCenter}>
          {/* Summary pills */}
          <div className={styles.summaryPills}>
            <span className={`${styles.pill} ${styles.pillAdmitted}`}>
              🏥 {localizeNumber(totalAdmitted, lang)} {t.ipd.admitted}
            </span>
            {criticalCount > 0 && (
              <span className={`${styles.pill} ${styles.pillCritical}`}>
                ⚠ {localizeNumber(criticalCount, lang)} {t.ipd.critical}
              </span>
            )}
            <span className={`${styles.pill} ${styles.pillOccupancy}`}>
              {localizeNumber(occupancyPct, lang)}% {t.ipd.occupancy}
            </span>
          </div>

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

      {/* ── Main Table Area ── */}
      <main className={styles.main}>
        <div className={styles.tableWrapper}>
          <table className={styles.table} aria-label={t.ipd.subtitle}>
            <colgroup>
              <col className={styles.colWard} />
              <col className={styles.colCount} />
              <col className={styles.colPatients} />
            </colgroup>
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th} scope="col">{t.ipd.wardUnit}</th>
                <th className={`${styles.th} ${styles.thCompact}`} scope="col">{t.ipd.occupiedCapacity}</th>
                <th className={styles.th} scope="col">{t.ipd.admittedPatients}</th>
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
                          <div className={styles.wardNameWrap}>
                            <p className={`${styles.wardName} ${tr(ward.name).length > 14 ? styles.wardNameScroll : ''}`}>{tr(ward.name)}</p>
                          </div>
                          {(ward.roomNo || ward.floorNo) && (
                            <p className={styles.wardMeta} style={{ fontSize: '0.75em', opacity: 0.7, margin: 0 }}>
                              {ward.roomNo ? `Room ${ward.roomNo}` : ''}{ward.roomNo && ward.floorNo ? ' • ' : ''}{ward.floorNo ? `Floor ${ward.floorNo}` : ''}
                            </p>
                          )}
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
                            {localizeNumber(ward.patients.length, lang)}
                          </span>
                          <span className={styles.countSep}>/</span>
                          <span className={styles.countCapacity}>{localizeNumber(ward.capacity, lang)}</span>
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
                            {localizeNumber(critCount, lang)} {t.ipd.critical}
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
                          lang={lang}
                          transliterations={transliterations}
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
