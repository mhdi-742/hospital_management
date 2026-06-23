import { OpdController } from '../../../controllers/OpdController';

/** Always render fresh — never cache OPD data at the edge. */
export const dynamic = 'force-dynamic';

/** GET /api/opd — returns the full flat doctor list + announcements */
export async function GET() {
  try {
    const data = await OpdController.getDisplayData();
    return Response.json(data);
  } catch (error) {
    console.error('[/api/opd] Failed to load OPD data:', error);
    return Response.json(
      { error: 'Failed to load OPD data' },
      { status: 500 }
    );
  }
}
