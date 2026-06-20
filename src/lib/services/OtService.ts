import { Database } from '../db';
import type { OtData, OtEntry, OtStatus } from '../types';

/**
 * OtService — business logic layer for OT schedule data.
 * Server-side only.
 */
export class OtService {
  static getData(): OtData {
    return Database.readOt();
  }

  static getAllEntries(): OtEntry[] {
    return this.getData().entries;
  }

  static getByStatus(status: OtStatus): OtEntry[] {
    return this.getAllEntries().filter((e) => e.status === status);
  }

  static getByRoom(roomNo: string): OtEntry[] {
    return this.getAllEntries().filter((e) => e.roomNo === roomNo);
  }

  /** Entries sorted by scheduledTime ascending. */
  static getSortedByTime(): OtEntry[] {
    return [...this.getAllEntries()].sort((a, b) =>
      a.scheduledTime.localeCompare(b.scheduledTime)
    );
  }

  static getActiveCount(): number {
    return this.getByStatus('in-progress').length + this.getByStatus('preparing').length;
  }
}
