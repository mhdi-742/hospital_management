import type { FlatDoctor, DoctorStatus } from '../../lib/types';
import styles from './DoctorCard.module.css';

/* ── Status configuration map ──────────────────────────────────────── */
interface StatusMeta {
  label: string;
  dotClass: string;
  cardClass: string;
}

const STATUS: Record<DoctorStatus, StatusMeta> = {
  running:     { label: 'Consulting',   dotClass: styles.dotRunning,     cardClass: styles.cardRunning },
  upcoming:    { label: 'Upcoming',     dotClass: styles.dotUpcoming,    cardClass: styles.cardUpcoming },
  break:       { label: 'On Break',     dotClass: styles.dotBreak,       cardClass: styles.cardBreak },
  completed:   { label: 'Completed',    dotClass: styles.dotCompleted,   cardClass: styles.cardCompleted },
  unavailable: { label: 'Unavailable',  dotClass: styles.dotUnavailable, cardClass: styles.cardUnavailable },
};

interface Props {
  doctor: FlatDoctor;
}

export default function DoctorCard({ doctor }: Props) {
  const meta      = STATUS[doctor.status];
  const isActive  = doctor.status === 'running';
  const isDimmed  = doctor.status === 'completed' || doctor.status === 'unavailable';
  const hasToken  = doctor.currentToken !== null;
  const pct       = hasToken && doctor.totalTokens > 0
    ? Math.min((doctor.currentToken! / doctor.totalTokens) * 100, 100)
    : 0;

  return (
    <article
      className={`${styles.card} ${meta.cardClass}`}
      style={{ '--dept-color': doctor.departmentColor } as React.CSSProperties}
      aria-label={`${doctor.name}, ${meta.label}`}
    >
      {/* Left dept accent */}
      <div className={styles.accent} aria-hidden="true" />

      {/* ── Top row: status + dept ── */}
      <div className={styles.topRow}>
        <div className={styles.statusBadge}>
          <span className={`${styles.dot} ${meta.dotClass}`} aria-hidden="true" />
          <span className={styles.statusText}>{meta.label}</span>
        </div>
        <span
          className={styles.deptPill}
          style={{ color: doctor.departmentColor }}
          aria-label={`Department: ${doctor.departmentName}`}
        >
          {doctor.departmentName}
        </span>
      </div>

      {/* ── Doctor info ── */}
      <div className={styles.info}>
        <p className={`${styles.name} ${isDimmed ? styles.nameDimmed : ''}`}>
          {doctor.name}
        </p>
        <p className={styles.designation}>{doctor.designation}</p>
        <p className={styles.floor}>{doctor.departmentFloor}</p>
      </div>

      {/* ── Room & hours ── */}
      <div className={styles.metaBar}>
        <div className={styles.metaItem}>
          <RoomIcon />
          <span className={styles.metaKey}>Room</span>
          <span className={styles.metaVal}>{doctor.roomNo}</span>
        </div>
        <div className={styles.metaDivider} aria-hidden="true" />
        <div className={styles.metaItem}>
          <ClockIcon />
          <span className={styles.metaKey}>Hours</span>
          <span className={styles.metaVal}>{doctor.startTime} – {doctor.endTime}</span>
        </div>
      </div>

      {/* ── Token section ── */}
      {!isDimmed ? (
        <div className={styles.tokenSection}>
          <div className={styles.tokenTop}>
            <div className={styles.tokenCount}>
              <span className={styles.tokenLabel}>Token</span>
              <span className={isActive ? styles.tokenNumActive : styles.tokenNum}>
                {hasToken ? doctor.currentToken : '—'}
              </span>
              <span className={styles.tokenOf}>/ {doctor.totalTokens}</span>
            </div>
            {isActive && doctor.avgWaitMinutes > 0 && (
              <span className={styles.waitBadge} aria-label={`Approximate wait: ${doctor.avgWaitMinutes} minutes`}>
                ≈&nbsp;{doctor.avgWaitMinutes} min
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
          {doctor.status === 'completed' ? 'Session completed for today' : 'Not available today'}
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
