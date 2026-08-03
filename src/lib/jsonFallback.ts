import opdData from '../data/opd.json';
import ipdData from '../data/ipd.json';
import otData from '../data/ot.json';
import type { OpdApiResponse, IpdApiResponse, OtApiResponse, FlatDoctor } from './types';

/* ─────────────────────────────────────────────────────────────────────────────
 * JSON Fallback Provider
 * When the database is unavailable (e.g. Vercel demo without a cloud DB),
 * these functions serve data from the static JSON files in src/data/.
 * ────────────────────────────────────────────────────────────────────────── */

let _dbAvailable: boolean | null = null;

/**
 * Check if the database is reachable. Result is cached for the lifetime
 * of the serverless function instance to avoid repeated connection attempts.
 */
export async function isDbAvailable(): Promise<boolean> {
  if (_dbAvailable !== null) return _dbAvailable;

  try {
    // Dynamic import so Prisma adapter errors don't crash the module on load
    const { prisma } = await import('./prisma');
    await prisma.$queryRawUnsafe('SELECT 1');
    _dbAvailable = true;
  } catch {
    console.warn('[jsonFallback] Database unavailable — serving from JSON files.');
    _dbAvailable = false;
  }
  return _dbAvailable;
}

/**
 * Reset the cached DB availability flag.
 * Useful if you want to retry the connection on the next request.
 */
export function resetDbCheck(): void {
  _dbAvailable = null;
}

/* ─── OPD Fallback ────────────────────────────────────────────────────────── */

export function getOpdFallback(): OpdApiResponse {
  const data = opdData as any;

  // Flatten departments[].doctors[] into a flat FlatDoctor[] array
  const doctors: FlatDoctor[] = [];
  for (const dept of data.departments) {
    for (const doc of dept.doctors) {
      doctors.push({
        id: doc.id,
        name: doc.name,
        designation: doc.designation,
        roomNo: doc.roomNo,
        status: doc.status,
        startTime: doc.startTime,
        endTime: doc.endTime,
        currentToken: doc.currentToken ?? null,
        nextToken: doc.currentToken ? (doc.currentToken < doc.totalTokens ? doc.currentToken + 1 : null) : (doc.totalTokens > 0 ? 1 : null),
        totalTokens: doc.totalTokens,
        avgWaitMinutes: doc.avgWaitMinutes,
        departmentId: dept.id,
        departmentName: dept.name,
        departmentFloor: dept.floor,
        departmentColor: dept.color,
      });
    }
  }

  return {
    hospitalName: data.hospitalName,
    announcements: data.announcements,
    doctors,
    lastUpdated: new Date().toLocaleTimeString('en-US', { hour12: false }),
  };
}

/* ─── IPD Fallback ────────────────────────────────────────────────────────── */

export function getIpdFallback(): IpdApiResponse {
  const data = ipdData as any;

  return {
    hospitalName: data.hospitalName,
    announcements: data.announcements,
    wards: data.wards,
    lastUpdated: new Date().toLocaleTimeString('en-US', { hour12: false }),
  };
}

/* ─── OT Fallback ─────────────────────────────────────────────────────────── */

export function getOtFallback(): OtApiResponse {
  const data = otData as any;

  return {
    hospitalName: data.hospitalName,
    announcements: data.announcements,
    entries: data.entries,
    lastUpdated: new Date().toLocaleTimeString('en-US', { hour12: false }),
  };
}
