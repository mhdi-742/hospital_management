import { OtController } from '../../../controllers/OtController';

/** Always render fresh — never cache OT data at the edge. */
export const dynamic = 'force-dynamic';

/** GET /api/ot — returns the full OT schedule */
export async function GET() {
  try {
    const data = OtController.getDisplayData();
    return Response.json(data);
  } catch (error) {
    console.error('[/api/ot] Failed to load OT data:', error);
    return Response.json(
      { error: 'Failed to load OT data' },
      { status: 500 }
    );
  }
}
