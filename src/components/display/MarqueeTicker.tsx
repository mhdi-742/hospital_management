import styles from './MarqueeTicker.module.css';

interface Props {
  announcements: string[];
}

/**
 * MarqueeTicker — infinitely scrolling announcement strip.
 * Content is duplicated so the loop is perfectly seamless.
 */
export default function MarqueeTicker({ announcements }: Props) {
  // Duplicate the list for a seamless CSS loop
  const items = [...announcements, ...announcements];

  return (
    <div className={styles.ticker} aria-label="Hospital announcements">
      <div className={styles.label} aria-hidden="true">
        <span className={styles.labelDot} />
        <span>NOTICE</span>
      </div>
      <div className={styles.track} aria-live="polite">
        <div className={styles.belt}>
          {items.map((text, i) => (
            <span key={i} className={styles.item}>
              <span className={styles.sep} aria-hidden="true">◆</span>
              {text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
