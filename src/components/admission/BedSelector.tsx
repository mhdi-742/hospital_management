import React from 'react';
import styles from './BedSelector.module.css';

interface Bed {
  id: string;
  bedNo: string;
  wardId: string;
  admissions: {
    id: string;
    patient: {
      name: string;
    };
  }[];
}

interface BedSelectorProps {
  wardName: string;
  beds: Bed[];
  selectedBedId: string;
  onSelectBed: (bedId: string) => void;
}

export default function BedSelector({ wardName, beds, selectedBedId, onSelectBed }: BedSelectorProps) {
  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 className={styles.title}>Bed Booking Grid: {wardName}</h4>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={`${styles.indicator} ${styles.indicatorAvailable}`} />
          <span>Available</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.indicator} ${styles.indicatorOccupied}`} />
          <span>Occupied</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.indicator} ${styles.indicatorSelected}`} />
          <span>Selected</span>
        </div>
      </div>

      {beds.length === 0 ? (
        <div style={{ fontSize: '0.85rem', color: '#64748b', padding: '12px 0' }}>
          No beds configured for this ward.
        </div>
      ) : (
        <div className={styles.grid}>
          {beds.map((bed) => {
            const isOccupied = bed.admissions && bed.admissions.length > 0;
            const patientName = isOccupied ? bed.admissions[0].patient.name : null;
            const isSelected = bed.id === selectedBedId;

            return (
              <button
                key={bed.id}
                type="button"
                className={`${styles.bed} ${
                  isOccupied ? styles.bedOccupied : styles.bedAvailable
                } ${isSelected ? styles.bedSelected : ''}`}
                onClick={() => !isOccupied && onSelectBed(bed.id)}
                disabled={isOccupied}
                title={isOccupied ? `Occupied by: ${patientName}` : `Select bed ${bed.bedNo}`}
              >
                <span className={styles.bedIcon}>🛏️</span>
                <span className={styles.bedLabel}>{bed.bedNo}</span>
                {isOccupied && (
                  <div className={styles.tooltip}>
                    <div className={styles.tooltipTitle}>Occupied</div>
                    <div>{patientName}</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
