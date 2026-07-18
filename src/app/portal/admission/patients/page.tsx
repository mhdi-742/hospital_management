'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface Doctor { user: { name: string }; }
interface Ward   { name: string; code: string; accentColor: string; }
interface Admission {
  id: string;
  type: string;
  status: string;
  admittedAt: string;
  bedNo: string | null;
  bed: { bedNo: string } | null;
  ward: Ward | null;
  doctors: { role: string; doctor: Doctor }[];
}
interface Patient {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  contact: string | null;
  admissions: Admission[];
}

const TYPE_COLOR: Record<string, string>   = { OPD: '#3b82f6', IPD: '#8b5cf6', OT: '#f59e0b' };
const TYPE_BG:    Record<string, string>   = { OPD: 'rgba(59,130,246,0.12)', IPD: 'rgba(139,92,246,0.12)', OT: 'rgba(245,158,11,0.12)' };

export default function PatientsPage() {
  const [patients,  setPatients]  = useState<Patient[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState('');
  const [typeFilter,setTypeFilter]= useState('');
  const [loading,   setLoading]   = useState(true);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      ...(search     ? { search }            : {}),
      ...(typeFilter ? { type: typeFilter }   : {}),
    });
    const res  = await fetch(`/api/portal/admission/patients?${params}`);
    const data = await res.json();
    setPatients(data.patients ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, search, typeFilter]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  // reset page on filter change
  useEffect(() => { setPage(1); }, [search, typeFilter]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Patients</h1>
          <p className={styles.subtitle}>{total} total records</p>
        </div>
        <Link href="/portal/admission/patients/new" className={styles.admitBtn}>
          + Admit New Patient
        </Link>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.searchInput}
          id="patient-search"
        />
        <div className={styles.typeFilters}>
          {['', 'OPD', 'IPD', 'OT'].map(t => (
            <button
              key={t}
              className={`${styles.typeBtn} ${typeFilter === t ? styles.typeBtnActive : ''}`}
              style={typeFilter === t && t ? { color: TYPE_COLOR[t], background: TYPE_BG[t], borderColor: TYPE_COLOR[t] + '55' } : {}}
              onClick={() => setTypeFilter(t)}
            >
              {t || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <div className={styles.tableHead}>
          <span>Patient</span>
          <span>Contact</span>
          <span>Current Admission</span>
          <span>Doctor</span>
          <span>Since</span>
          <span></span>
        </div>

        {loading && (
          <div className={styles.loadingRow}>
            <span className={styles.spinner} />
            Loading…
          </div>
        )}

        {!loading && patients.length === 0 && (
          <div className={styles.empty}>No patients found.</div>
        )}

        {!loading && patients.map(p => {
          const adm = p.admissions[0];
          const primaryDoc = adm?.doctors.find(d => d.role === 'primary');
          return (
            <div key={p.id} className={styles.tableRow}>
              <span className={styles.patientCell}>
                <span className={styles.patientName}>{p.name}</span>
                <small>{p.age ? `${p.age}y` : '—'} · {p.gender ?? '—'}</small>
              </span>
              <span className={styles.contactCell}>{p.contact ?? '—'}</span>
              <span className={styles.admCell}>
                {adm ? (
                  <span className={styles.typeBadge} style={{ color: TYPE_COLOR[adm.type], background: TYPE_BG[adm.type] }}>
                    {adm.type}
                    {adm.ward && ` · ${adm.ward.code}`}
                    {(adm.bed?.bedNo || adm.bedNo) && ` B-${adm.bed?.bedNo || adm.bedNo}`}
                  </span>
                ) : <span className={styles.noneText}>No active admission</span>}
              </span>
              <span className={styles.docCell}>
                {primaryDoc?.doctor.user.name ?? '—'}
              </span>
              <span className={styles.dateCell}>
                {adm ? new Date(adm.admittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
              </span>
              <span>
                <Link href={`/portal/admission/patients/${p.id}`} className={styles.viewBtn}>View</Link>
              </span>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
          <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
