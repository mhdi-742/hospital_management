import { OtService } from '../lib/services/OtService';
import type { OtApiResponse } from '../lib/types';

/**
 * OtController — thin controller for the OT schedule.
 * Delegates to OtService, shapes the payload for view / API layer.
 * Server-side only.
 */
export class OtController {
  static getDisplayData(): OtApiResponse {
    const data = OtService.getData();
    // Sort by scheduled time so display is chronological
    const entries = OtService.getSortedByTime();

    return {
      hospitalName: data.hospitalName,
      announcements: data.announcements,
      entries,
      lastUpdated: data.lastUpdated,
    };
  }
}
