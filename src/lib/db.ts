import fs from 'fs';
import path from 'path';
import type { OpdData, IpdData, OtData } from './types';

/**
 * Database — thin wrapper around the JSON flat-files.
 * All methods are synchronous and server-side only (uses Node `fs`).
 */
export class Database {
  private static readonly OPD_PATH = path.join(
    process.cwd(),
    'src',
    'data',
    'opd.json'
  );

  private static readonly IPD_PATH = path.join(
    process.cwd(),
    'src',
    'data',
    'ipd.json'
  );

  private static readonly OT_PATH = path.join(
    process.cwd(),
    'src',
    'data',
    'ot.json'
  );

  /* ── OPD ─────────────────────────────────────────────────── */

  /** Read the entire OPD dataset from disk. */
  static read(): OpdData {
    const raw = fs.readFileSync(this.OPD_PATH, 'utf-8');
    return JSON.parse(raw) as OpdData;
  }

  /** Overwrite the OPD dataset on disk (used by admin controller). */
  static write(data: OpdData): void {
    fs.writeFileSync(
      this.OPD_PATH,
      JSON.stringify(data, null, 2),
      'utf-8'
    );
  }

  /* ── IPD ─────────────────────────────────────────────────── */

  /** Read the entire IPD dataset from disk. */
  static readIpd(): IpdData {
    const raw = fs.readFileSync(this.IPD_PATH, 'utf-8');
    return JSON.parse(raw) as IpdData;
  }

  /** Overwrite the IPD dataset on disk (used by admin controller). */
  static writeIpd(data: IpdData): void {
    fs.writeFileSync(
      this.IPD_PATH,
      JSON.stringify(data, null, 2),
      'utf-8'
    );
  }

  /* ── OT ─────────────────────────────────────────────────── */

  /** Read the entire OT schedule from disk. */
  static readOt(): OtData {
    const raw = fs.readFileSync(this.OT_PATH, 'utf-8');
    return JSON.parse(raw) as OtData;
  }

  /** Overwrite the OT schedule on disk (used by admin controller). */
  static writeOt(data: OtData): void {
    fs.writeFileSync(
      this.OT_PATH,
      JSON.stringify(data, null, 2),
      'utf-8'
    );
  }
}
