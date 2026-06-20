import { Database } from '../db';
import type { IpdData, Ward } from '../types';

/**
 * IpdService — business logic layer for IPD data.
 * Reads data via Database, exposes clean query methods.
 * Server-side only.
 */
export class IpdService {
  /** Return the raw IPD dataset. */
  static getData(): IpdData {
    return Database.readIpd();
  }

  /** Return all wards. */
  static getAllWards(): Ward[] {
    return this.getData().wards;
  }

  /** Find a single ward by its slug id. */
  static getWardById(id: string): Ward | undefined {
    return this.getAllWards().find((w) => w.id === id);
  }

  /** Total patients admitted across all wards. */
  static getTotalAdmitted(): number {
    return this.getAllWards().reduce((sum, w) => sum + w.patients.length, 0);
  }

  /** Total bed capacity across all wards. */
  static getTotalCapacity(): number {
    return this.getAllWards().reduce((sum, w) => sum + w.capacity, 0);
  }

  /** Count of patients with critical status across all wards. */
  static getCriticalCount(): number {
    return this.getAllWards().reduce(
      (sum, w) => sum + w.patients.filter((p) => p.status === 'critical').length,
      0
    );
  }
}
