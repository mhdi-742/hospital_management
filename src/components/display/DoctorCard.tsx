import type { FlatDoctor, DoctorStatus } from '../../lib/types';
import { translations, localizeNumber, type Lang } from '../../lib/displayTranslations';
import styles from './DoctorCard.module.css';

/* ── Status configuration map ──────────────────────────────────────── */
interface StatusMeta {
  labelKey: keyof typeof translations.en.doctorCard;
  dotClass: string;
  cardClass: string;
}

const STATUS: Record<DoctorStatus, StatusMeta> = {
  running:     { labelKey: 'consulting',   dotClass: styles.dotRunning,     cardClass: styles.cardRunning },
  upcoming:    { labelKey: 'upcoming',     dotClass: styles.dotUpcoming,    cardClass: styles.cardUpcoming },
  break:       { labelKey: 'onBreak',      dotClass: styles.dotBreak,       cardClass: styles.cardBreak },
  completed:   { labelKey: 'completed',    dotClass: styles.dotCompleted,   cardClass: styles.cardCompleted },
  unavailable: { labelKey: 'unavailable',  dotClass: styles.dotUnavailable, cardClass: styles.cardUnavailable },
};

interface Props {
  doctor: FlatDoctor;
  lang?: Lang;
  /** Pre-transliterated Bengali name (if available) */
  transliteratedName?: string;
  /** Pre-transliterated Bengali department name (if available) */
  transliteratedDept?: string;
  /** Pre-transliterated Bengali designation (if available) */
  transliteratedDesignation?: string;
  /** Pre-transliterated Bengali floor (if available) */
  transliteratedFloor?: string;
}

export default function DoctorCard({
  doctor,
  lang = 'en',
  transliteratedName,
  transliteratedDept,
  transliteratedDesignation,
  transliteratedFloor,
}: Props) {
  const t = translations[lang];
  const meta      = STATUS[doctor.status];
  const statusLabel = t.doctorCard[meta.labelKey];
  const isActive  = doctor.status === 'running';
  const isDimmed  = doctor.status === 'completed' || doctor.status === 'unavailable';
  const hasToken  = doctor.currentToken !== null;
  const pct       = hasToken && doctor.totalTokens > 0
    ? Math.min((doctor.currentToken! / doctor.totalTokens) * 100, 100)
    : 0;

  // Resolve display values based on language
  const displayName = lang === 'bn' && transliteratedName ? transliteratedName : doctor.name;
  const displayDept = lang === 'bn' && transliteratedDept ? transliteratedDept : doctor.departmentName;
  const displayDesignation = lang === 'bn' && transliteratedDesignation ? transliteratedDesignation : doctor.designation;
  const displayFloor = lang === 'bn' && transliteratedFloor ? transliteratedFloor : doctor.departmentFloor;

  return (
    <article
      className={`${styles.card} ${meta.cardClass}`}
      style={{ '--dept-color': doctor.departmentColor } as React.CSSProperties}
      aria-label={`${displayName}, ${statusLabel}`}
    >
      {/* Left dept accent */}
      <div className={styles.accent} aria-hidden="true" />

      {/* ── Top row: status + dept ── */}
      <div className={styles.topRow}>
        <div className={styles.statusBadge}>
          <span className={`${styles.dot} ${meta.dotClass}`} aria-hidden="true" />
          <span className={styles.statusText}>{statusLabel}</span>
        </div>
        <span
          className={styles.deptPill}
          style={{ color: doctor.departmentColor }}
          aria-label={`${t.doctorCard.department}: ${displayDept}`}
        >
          {displayDept}
        </span>
      </div>

      {/* ── Doctor info ── */}
      <div className={styles.info}>
        <p className={`${styles.name} ${isDimmed ? styles.nameDimmed : ''}`}>
          {displayName}
        </p>
        <p className={styles.designation}>{displayDesignation}</p>
        <p className={styles.floor}>{displayFloor}</p>
      </div>

      {/* ── Room & hours ── */}
      <div className={styles.metaBar}>
        <div className={styles.metaItem}>
          <RoomIcon />
          <span className={styles.metaKey}>{t.common.room}</span>
          <span className={styles.metaVal}>{localizeNumber(doctor.roomNo, lang)}</span>
        </div>
        <div className={styles.metaDivider} aria-hidden="true" />
        <div className={styles.metaItem}>
          <ClockIcon />
          <span className={styles.metaKey}>{t.common.hours}</span>
          <span className={styles.metaVal}>{doctor.startTime} – {doctor.endTime}</span>
        </div>
      </div>

      {/* ── Token section ── */}
      {!isDimmed ? (
        <div className={styles.tokenSection}>
          <div className={styles.tokenTop}>
            <div className={styles.tokenCount}>
              <span className={styles.tokenLabel}>{t.common.token}</span>
              <span className={isActive ? styles.tokenNumActive : styles.tokenNum}>
                {hasToken ? localizeNumber(doctor.currentToken!, lang) : '--'}
              </span>
              <span className={styles.tokenOf}>/ {localizeNumber(doctor.totalTokens, lang)}</span>
            </div>
            {isActive && doctor.avgWaitMinutes > 0 && (
              <span className={styles.waitBadge} aria-label={`${t.tokenCallout.avgWait}: ${doctor.avgWaitMinutes} ${t.common.min}`}>
                ≈&nbsp;{localizeNumber(doctor.avgWaitMinutes, lang)} {t.common.min}
              </span>
            )}
          </div>
          {hasToken && (
            <div className={styles.track} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={styles.fill}
                style={{
                  width: `${pct}%`,
                  background: isActive ? doctor.departmentColor : 'var(--text-muted)',
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <p className={styles.unavailNote}>
          {doctor.status === 'completed' ? t.doctorCard.sessionCompleted : t.doctorCard.notAvailable}
        </p>
      )}
    </article>
  );
}

/* ── Micro-icons ─────────────────────────────────────────────────────── */
function RoomIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
