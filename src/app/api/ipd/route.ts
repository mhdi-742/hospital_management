import { IpdController } from '../../../controllers/IpdController';

/** Always render fresh — never cache IPD data at the edge. */
export const dynamic = 'force-dynamic';

/** GET /api/ipd — returns the full ward + patient list */
export async function GET() {
  try {
    const data = await IpdController.getDisplayData();
    return Response.json(data);
  } catch (error) {
    console.error('[/api/ipd] Failed to load IPD data:', error);
    return Response.json(
      { error: 'Failed to load IPD data' },
      { status: 500 }
    );
  }
}
