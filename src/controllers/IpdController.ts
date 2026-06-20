import { IpdService } from '../lib/services/IpdService';
import type { IpdApiResponse } from '../lib/types';

/**
 * IpdController — thin controller layer.
 * Delegates to IpdService, shapes the response for the view / API layer.
 * Server-side only.
 */
export class IpdController {
  /**
   * Assemble the full IPD display payload consumed by:
   *   - the TV screen Server Component (initial render)
   *   - the GET /api/ipd Route Handler (client polling)
   */
  static getDisplayData(): IpdApiResponse {
    const data = IpdService.getData();

    return {
      hospitalName: data.hospitalName,
      announcements: data.announcements,
      wards: data.wards,
      lastUpdated: data.lastUpdated,
    };
  }
}
