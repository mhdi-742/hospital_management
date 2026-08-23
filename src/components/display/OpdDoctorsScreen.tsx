'use client';

import React, { useState, useEffect, useRef } from 'react';
import defaultDoctorsData from '../../data/opd_doctors.json';
import styles from './OpdDoctorsScreen.module.css';

export interface DoctorEntry {
  name: string;
  nameBn?: string;
  subAffiliation?: string;
  degree: string;
  timeScheduleBn: string;
  colorTheme?: string;
}

export interface DepartmentGroup {
  id: string;
  name: string;
  nameBn: string;
  headerBg: string;
  borderColor: string;
  doctors: DoctorEntry[];
}

export interface OpdDoctorsData {
  hospitalName: string;
  hospitalSubName: string;
  tagline: string;
  phoneNumbers: string[];
  titleBn: string;
  footerNoteBn: string;
  departments: DepartmentGroup[];
}

interface Props {
  initialData?: OpdDoctorsData;
  isAdOverlay?: boolean;
  remainingSeconds?: number;
  onCloseAd?: () => void;
  autoScroll?: boolean;
}

export default function OpdDoctorsScreen({
  initialData = defaultDoctorsData as OpdDoctorsData,
  isAdOverlay = false,
  remainingSeconds,
  onCloseAd,
  autoScroll = true,
}: Props) {
  const [data, setData] = useState<OpdDoctorsData>(initialData);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Optionally fetch dynamic data if updated in DB
    fetch('/api/opd-doctors')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && json.departments) {
          setData(json);
        }
      })
      .catch(() => {
        // Fallback to initialData / default JSON
      });
  }, []);

  // ── Auto-scroll logic: smooth continuous top-to-bottom and loop ────────────
  useEffect(() => {
    if (!autoScroll) return;

    let animationFrameId: number;
    let isPaused = false;
    let pauseTimeout: NodeJS.Timeout;
    let direction: 'down' | 'up' = 'down';
    let lastTimestamp = 0;

    const scrollSpeedDown = 45; // pixels per second for readable pacing
    const scrollSpeedUp = 120;  // faster return to top

    const getScrollTop = () => {
      if (isAdOverlay && containerRef.current) {
        return containerRef.current.scrollTop;
      }
      return window.scrollY || document.documentElement.scrollTop || 0;
    };

    const getScrollHeight = () => {
      if (isAdOverlay && containerRef.current) {
        return containerRef.current.scrollHeight - containerRef.current.clientHeight;
      }
      return document.documentElement.scrollHeight - window.innerHeight;
    };

    const setScroll = (top: number) => {
      if (isAdOverlay && containerRef.current) {
        containerRef.current.scrollTop = top;
      } else {
        window.scrollTo({ top, behavior: 'auto' });
      }
    };

    const step = (timestamp: number) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const deltaTime = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      if (!isPaused) {
        const maxScroll = getScrollHeight();
        const currentScroll = getScrollTop();

        if (maxScroll > 10) {
          if (direction === 'down') {
            const nextScroll = currentScroll + scrollSpeedDown * deltaTime;
            if (nextScroll >= maxScroll - 2) {
              setScroll(maxScroll);
              isPaused = true;
              pauseTimeout = setTimeout(() => {
                direction = 'up';
                isPaused = false;
              }, 2500); // 2.5s pause at bottom
            } else {
              setScroll(nextScroll);
            }
          } else {
            const nextScroll = currentScroll - scrollSpeedUp * deltaTime;
            if (nextScroll <= 2) {
              setScroll(0);
              direction = 'down';
              isPaused = true;
              pauseTimeout = setTimeout(() => {
                isPaused = false;
              }, 1800); // 1.8s pause at top
            } else {
              setScroll(nextScroll);
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(step);
    };

    // Start auto-scroll after initial 1.2s pause
    pauseTimeout = setTimeout(() => {
      animationFrameId = requestAnimationFrame(step);
    }, 1200);

    // Pause auto-scroll temporarily if user scrolls manually
    const handleUserInteraction = () => {
      isPaused = true;
      clearTimeout(pauseTimeout);
      pauseTimeout = setTimeout(() => {
        isPaused = false;
      }, 4000);
    };

    const targetElem = isAdOverlay ? containerRef.current : window;
    targetElem?.addEventListener('wheel', handleUserInteraction, { passive: true });
    targetElem?.addEventListener('touchmove', handleUserInteraction, { passive: true });

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(pauseTimeout);
      targetElem?.removeEventListener('wheel', handleUserInteraction);
      targetElem?.removeEventListener('touchmove', handleUserInteraction);
    };
  }, [autoScroll, isAdOverlay]);

  // Split departments into 3 columns matching the exact physical layout
  const col1DeptIds = ['general_medicine', 'paediatrics', 'orthopedics'];
  const col2DeptIds = ['surgery', 'dermatology', 'ent', 'gastroenterology'];
  const col3DeptIds = ['gynaecology', 'neurology', 'cardiology'];

  const col1 = data.departments.filter((d) => col1DeptIds.includes(d.id));
  const col2 = data.departments.filter((d) => col2DeptIds.includes(d.id));
  const col3 = data.departments.filter((d) => col3DeptIds.includes(d.id));

  const renderDoctorItem = (doc: DoctorEntry) => {
    let nameColorClass = styles.nameBlue;
    if (doc.colorTheme === 'red') nameColorClass = styles.nameRed;
    else if (doc.colorTheme === 'teal') nameColorClass = styles.nameTeal;
    else if (doc.colorTheme === 'purple') nameColorClass = styles.namePurple;

    return (
      <div key={doc.name} className={styles.doctorItem}>
        <h4 className={`${styles.docName} ${nameColorClass}`}>{doc.name}</h4>
        {doc.subAffiliation && (
          <div className={styles.docSubAffiliation}>{doc.subAffiliation}</div>
        )}
        <div className={styles.docDegree}>{doc.degree}</div>
        {doc.timeScheduleBn ? (
          <div className={styles.scheduleBadge}>{doc.timeScheduleBn}</div>
        ) : null}
      </div>
    );
  };

  const renderDeptCard = (dept: DepartmentGroup) => (
    <div
      key={dept.id}
      className={styles.deptCard}
      style={{ borderColor: dept.borderColor || dept.headerBg }}
    >
      <div
        className={styles.deptHeader}
        style={{ backgroundColor: dept.headerBg }}
      >
        <h3 className={styles.deptEnName}>{dept.name}</h3>
        <h4 className={styles.deptBnName}>({dept.nameBn})</h4>
      </div>
      <div className={styles.doctorList}>
        {dept.doctors.map((doc) => renderDoctorItem(doc))}
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isAdOverlay ? styles.fullscreenAd : ''}`}
    >
      {isAdOverlay && (
        <div className={styles.adProgressHeader}>
          <div className={styles.adBadge}>
            <span className={styles.adDot} />
            OPD DOCTORS ANNOUNCEMENT
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {remainingSeconds !== undefined && (
              <span className={styles.adReturnPill}>
                Returning to IPD Census in {remainingSeconds}s...
              </span>
            )}
            {onCloseAd && (
              <button
                onClick={onCloseAd}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                }}
              >
                Close ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Top Header ── */}
      <header className={styles.topHeader}>
        <div className={styles.logoArea}>
          <img
            src="https://mikkymeghahospital.com/wp-content/uploads/2025/09/m.png"
            alt="Mikky Megha Logo"
            className={styles.logoIcon}
          />
          <span className={styles.logoSubtitle}>
            Mikky Megha
            <br />
            Multi Speciality Hospital
          </span>
        </div>

        <div className={styles.headerCenter}>
          <div className={styles.hospitalMainTitle}>
            <span className={styles.titleRed}>MIKKY MEGHA</span>
            <span className={styles.titleBlue}>HOSPITAL PVT. LTD.</span>
          </div>

          <div className={styles.missionTagline}>
            <span className={styles.missionLine} />
            <span className={styles.missionText}>Your Health Our Mission</span>
            <span className={styles.missionLine} />
          </div>

          <div className={styles.topHotline}>
            Mob.- <span>{data.phoneNumbers.join(' / ')}</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.buildingCard}>
            <span className={styles.buildingBadge}>MIKKY MEGHA</span>
            <div className={styles.buildingSub}>MULTI SPECIALITY HOSPITAL</div>
            <div
              style={{
                fontSize: '1.8rem',
                lineHeight: 1,
                marginTop: '4px',
              }}
            >
              🏥
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Bengali Ribbon Title ── */}
      <div className={styles.ribbonBanner}>
        <h2 className={styles.ribbonText}>{data.titleBn}</h2>
      </div>

      {/* ── 3 Column Department Directory ── */}
      <main className={styles.departmentsGrid}>
        {/* Column 1 */}
        <div className={styles.gridColumn}>
          {col1.map((dept) => renderDeptCard(dept))}
        </div>

        {/* Column 2 */}
        <div className={styles.gridColumn}>
          {col2.map((dept) => renderDeptCard(dept))}
        </div>

        {/* Column 3 */}
        <div className={styles.gridColumn}>
          {col3.map((dept) => renderDeptCard(dept))}

          {/* Contact Box at bottom of Column 3 */}
          <div className={styles.contactCard}>
            <h3 className={styles.contactTitle}>{data.footerNoteBn}</h3>
            <div className={styles.contactNumbers}>
              <div>
                Mob.- {data.phoneNumbers.slice(0, 2).join(' / ')}
              </div>
              <div>
                {data.phoneNumbers.slice(2, 4).join(' / ')}
              </div>
              <div>
                {data.phoneNumbers.slice(4).join(' / ')}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
