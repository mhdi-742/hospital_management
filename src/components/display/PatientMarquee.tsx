'use client';

import type { Patient } from '../../lib/types';
import { translations, type Lang } from '../../lib/displayTranslations';
import styles from './IpdScreen.module.css';

interface Props {
  patients: Patient[];
  accentColor: string;
  lang?: Lang;
  /** Map of English name → Bengali transliteration */
  transliterations?: Map<string, string>;
}

/**
 * PatientMarquee — renders patient names as pill-chips that scroll
 * left indefinitely using a pure-CSS animation. The belt is doubled
 * so the loop is perfectly seamless.
 */
export default function PatientMarquee({
  patients,
  accentColor,
  lang = 'en',
  transliterations,
}: Props) {
  const t = translations[lang];

  const STATUS_LABELS: Record<Patient['status'], string> = {
    stable: t.ipd.stable,
    monitoring: t.ipd.monitoring,
    critical: t.ipd.critical,
  };

  const STATUS_CLASS: Record<Patient['status'], string> = {
    stable: styles.chipStable,
    monitoring: styles.chipMonitoring,
    critical: styles.chipCritical,
  };

  if (patients.length === 0) {
    return <span className={styles.emptyWard}>{t.ipd.noPatients}</span>;
  }

  /** Get transliterated name or fall back to original */
  const resolveName = (name: string) => {
    if (lang === 'bn' && transliterations?.has(name)) {
      return transliterations.get(name)!;
    }
    return name;
  };

  // Double the list for seamless looping
  const doubled = [...patients, ...patients];

  return (
    <div className={styles.marqueeTrack} aria-label="Patient list">
      <div
        className={styles.marqueeBelt}
        style={{ animationDuration: `${Math.max(patients.length * 4, 20)}s` }}
      >
        {doubled.map((p, idx) => (
          <span
            key={`${p.id}-${idx}`}
            className={`${styles.patientChip} ${STATUS_CLASS[p.status]}`}
            style={{ borderColor: p.status === 'critical' ? '#ef4444' : accentColor }}
            aria-label={`${resolveName(p.name)}, Bed ${p.bedNo}, ${STATUS_LABELS[p.status]}`}
          >
            <span className={styles.chipBed}>{p.bedNo}</span>
            <span className={styles.chipName}>{resolveName(p.name)}</span>
            {p.status === 'critical' && (
              <span className={styles.critDot} aria-hidden="true" />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
