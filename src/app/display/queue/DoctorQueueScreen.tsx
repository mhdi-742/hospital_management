'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { OpdApiResponse } from '../../../lib/types';
import MarqueeTicker from '../../../components/display/MarqueeTicker';
import styles from './DoctorQueueScreen.module.css';

interface QueuePatient {
  tokenNo: number;
  patientName: string;
  bengaliName?: string;
}

interface QueueData {
  doctorName: string;
  roomNo: string | null;
  departmentName: string;
  departmentColor: string;
  currentToken: number | null;
  totalTokens: number;
  status: string;
  startTime: string;
  endTime: string;
  queue: QueuePatient[];
}

function AutoScrollText({ text, className }: { text: string; className: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let scrollInterval: NodeJS.Timeout;
    let pauseTimeout: NodeJS.Timeout;
    let isPaused = false;
    let direction = 1;

    const startScrolling = () => {
      // Only scroll if content is overflowing
      if (el.scrollWidth <= el.clientWidth) {
        el.scrollLeft = 0;
        return;
      }

      scrollInterval = setInterval(() => {
        if (isPaused) return;

        el.scrollLeft += direction;

        // Hit right edge
        if (direction === 1 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) {
          isPaused = true;
          clearInterval(scrollInterval);
          pauseTimeout = setTimeout(() => {
            direction = -1;
            isPaused = false;
            startScrolling();
          }, 2000);
        }
        // Hit left edge
        else if (direction === -1 && el.scrollLeft <= 0) {
          isPaused = true;
          clearInterval(scrollInterval);
          pauseTimeout = setTimeout(() => {
            direction = 1;
            isPaused = false;
            startScrolling();
          }, 2000);
        }
      }, 30);
    };

    pauseTimeout = setTimeout(startScrolling, 1000);

    return () => {
      clearInterval(scrollInterval);
      clearTimeout(pauseTimeout);
    };
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}
    >
      {text}
    </div>
  );
}

export default function DoctorQueueScreen({ initialData }: { initialData: OpdApiResponse }) {
  // Setup state: list of doctors available
  const [data, setData] = useState<OpdApiResponse>(initialData);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Cabin display state
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Ref for auto-scrolling the waiting list
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Clock ───────────────────────────────────────────────────────────
  useEffect(() => {
    setCurrentTime(new Date());
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-scroll Waiting List ────────────────────────────────────────
  useEffect(() => {
    if (!queueData) return;
    
    let scrollInterval: NodeJS.Timeout;
    let pauseTimeout: NodeJS.Timeout;
    let isPaused = false;

    const startScrolling = () => {
      scrollInterval = setInterval(() => {
        const el = scrollRef.current;
        if (!el || isPaused) return;

        // If not scrollable, don't do anything
        if (el.scrollHeight <= el.clientHeight) return;

        // Scroll down by 1px
        el.scrollTop += 1;

        // Check if we hit the bottom (allow 2px margin of error)
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          isPaused = true;
          clearInterval(scrollInterval);
          
          // Pause at bottom for 3 seconds, then snap to top and pause for 3 seconds before resuming
          pauseTimeout = setTimeout(() => {
            el.scrollTop = 0;
            setTimeout(() => {
              isPaused = false;
              startScrolling();
            }, 3000);
          }, 3000);
        }
      }, 50); // Speed of scroll (50ms per pixel)
    };

    // Initial pause before scrolling starts
    pauseTimeout = setTimeout(() => {
      startScrolling();
    }, 3000);

    return () => {
      clearInterval(scrollInterval);
      clearTimeout(pauseTimeout);
    };
  }, [queueData]);

  // ── Refresh doctor list via SSE (for setup mode) ────────────────────
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/opd');
      if (res.ok) setData(await res.json());
    } catch { /* skip */ }
  }, []);

  useEffect(() => {
    if (selectedSessionId) return; // Don't need to refresh all doctors if we are in cabin mode
    const evtSource = new EventSource('/api/events');
    evtSource.onmessage = () => refreshData();
    return () => evtSource.close();
  }, [refreshData, selectedSessionId]);

  // ── Fetch queue for selected doctor (Cabin Mode) ────────────────────
  const fetchQueue = useCallback(async (sessionId: string, isInitial = false) => {
    if (isInitial) setLoadingQueue(true);
    try {
      const res = await fetch(`/api/opd/queue?sessionId=${sessionId}`);
      if (res.ok) {
        const rawData: QueueData = await res.json();
        
        // Transliterate missing Bengali names
        const updatedQueue = await Promise.all(rawData.queue.map(async (patient) => {
          if (patient.bengaliName) return patient;
          
          try {
            const firstWord = patient.patientName.split(' ')[0];
            const transRes = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(firstWord)}&itc=bn-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&app=test`);
            const transData = await transRes.json();
            
            if (transData[0] === 'SUCCESS' && transData[1]?.[0]?.[1]?.[0]) {
              return { ...patient, bengaliName: transData[1][0][1][0] };
            }
          } catch {
             // Silently fail and just use English
          }
          return patient;
        }));

        setQueueData({ ...rawData, queue: updatedQueue });
      }
    } catch { /* skip */ }
    if (isInitial) setLoadingQueue(false);
  }, []);

  // Auto-refresh queue every 5s when a doctor is selected
  useEffect(() => {
    if (!selectedSessionId) return;
    fetchQueue(selectedSessionId, true);
    const id = setInterval(() => fetchQueue(selectedSessionId, false), 5000);
    return () => clearInterval(id);
  }, [selectedSessionId, fetchQueue]);

  // ── Handlers ────────────────────────────────────────────────────────
  const handleSelectDoctor = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handleExitCabinMode = () => {
    setSelectedSessionId(null);
    setQueueData(null);
  };

  // ── Time formatters ─────────────────────────────────────────────────
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── Computed states for Cabin Mode ──────────────────────────────────
  let nowServing: QueuePatient | null = null;
  let waitingList: QueuePatient[] = [];

  if (queueData) {
    const currentTk = queueData.currentToken ?? 0;
    
    // Find the exact patient currently serving (or latest done if no one is explicitly "running")
    nowServing = queueData.queue.find(p => p.tokenNo === currentTk) || null;
    
    // Waiting list includes anyone strictly after the current token
    waitingList = queueData.queue.filter(p => p.tokenNo > currentTk).sort((a, b) => a.tokenNo - b.tokenNo);
  }

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
          <div>
            <p className={styles.hospitalName}>{data.hospitalName}</p>
            <p className={styles.headerSub}>
              {selectedSessionId ? 'Cabin Display' : 'Display Setup'}
            </p>
          </div>
        </div>

        <div className={styles.headerCenter}>
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

      {/* ── Main Content ── */}
      <main className={styles.main}>
        {!selectedSessionId ? (
          /* ── Setup Mode ── */
          <div className={styles.setupPanel}>
            <h1 className={styles.setupTitle}>Select Doctor for this Display</h1>
            <p className={styles.setupSub}>Click on a doctor to launch their dedicated cabin display.</p>

            {data.doctors.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No active OPD sessions found for today.
              </p>
            ) : (
              <div className={styles.grid}>
                {data.doctors.map(doc => (
                  <button
                    key={doc.id}
                    className={styles.doctorCard}
                    onClick={() => handleSelectDoctor(doc.id)}
                  >
                    <p className={styles.setupDocName}>{doc.name}</p>
                    <p className={styles.setupDept} style={{ color: doc.departmentColor }}>
                      {doc.departmentName}
                    </p>
                    <p className={styles.setupRoom}>Room {doc.roomNo}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Cabin Mode ── */
          <div className={styles.cabinPanel}>
            {loadingQueue && !queueData && (
              <div className={styles.loadingOverlay}>
                <div className={styles.spinner} />
              </div>
            )}

            {/* Left: Now Serving */}
            <div className={styles.nowServingPanel}>
              {queueData && (
                <div className={styles.doctorInfoBar}>
                  <div>
                    <div className={styles.docNameBig}>{queueData.doctorName}</div>
                    <div className={styles.docDeptBig} style={{ color: queueData.departmentColor }}>
                      {queueData.departmentName}
                    </div>
                  </div>
                  <div className={styles.roomBadgeBig}>
                    Room {queueData.roomNo || 'TBD'}
                  </div>
                </div>
              )}

              <button className={styles.exitButton} onClick={handleExitCabinMode}>
                ← Exit Cabin Display
              </button>

              <div className={styles.servingLabel}>Now Serving</div>
              
              {nowServing ? (
                <>
                  <div className={styles.servingToken}>{nowServing.tokenNo}</div>
                  <AutoScrollText 
                    className={styles.servingName} 
                    text={`${nowServing.patientName} ${nowServing.bengaliName ? `(${nowServing.bengaliName})` : ''}`}
                  />
                </>
              ) : queueData?.currentToken ? (
                /* Patient is serving but not found in list (e.g. ad-hoc/manual token advance without registration) */
                <>
                  <div className={styles.servingToken}>{queueData.currentToken}</div>
                  <div className={styles.servingName} style={{ color: 'var(--text-muted)' }}>—</div>
                </>
              ) : (
                <>
                  <div className={styles.servingToken} style={{ color: 'var(--text-muted)' }}>—</div>
                  <div className={styles.servingName} style={{ color: 'var(--text-muted)', fontSize: '2rem' }}>
                    {queueData?.status === 'completed' ? 'Session Completed' : 'Waiting for patients...'}
                  </div>
                </>
              )}
            </div>

            {/* Right: Waiting List */}
            <div className={styles.waitingPanel}>
              <div className={styles.waitingHeader}>
                Waiting List
              </div>
              
              {waitingList.length === 0 ? (
                <div className={styles.emptyQueue}>
                  No one is waiting.
                </div>
              ) : (
                <div className={styles.waitingList} ref={scrollRef}>
                  {waitingList.map((patient, index) => {
                    const isNext = index === 0;
                    return (
                      <div key={patient.tokenNo} className={`${styles.waitingItem} ${isNext ? styles.next : ''}`}>
                        <div className={styles.waitingToken}>{patient.tokenNo}</div>
                        <AutoScrollText 
                          className={styles.waitingName} 
                          text={`${patient.patientName} ${patient.bengaliName ? `(${patient.bengaliName})` : ''}`}
                        />
                        <div className={styles.waitingStatus}>
                          {isNext ? 'Next' : 'Waiting'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className={styles.footer} aria-label="Announcements">
        <MarqueeTicker announcements={data.announcements} />
      </footer>
    </div>
  );
}
