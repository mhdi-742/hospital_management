import { OpdService } from '../lib/services/OpdService';
import type { OpdApiResponse } from '../lib/types';

/**
 * OpdController — thin controller layer.
 * Delegates to OpdService, shapes the response for the view / API layer.
 * Server-side only.
 */
export class OpdController {
  /**
   * Assemble the full display payload consumed by:
   *   - the TV screen Server Component (initial render)
   *   - the GET /api/opd Route Handler (client polling)
   */
  static getDisplayData(): OpdApiResponse {
    const data = OpdService.getData();
    const doctors = OpdService.getAllFlatDoctors();

    return {
      hospitalName: data.hospitalName,
      announcements: data.announcements,
      doctors,
      lastUpdated: data.lastUpdated,
    };
  }
}
