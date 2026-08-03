import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOpdQueueFallback } from '@/lib/jsonFallback';

/**
 * GET /api/opd/queue?sessionId=xxx
 * Returns the patient queue for a specific OPD session.
 * Public endpoint — used by the display board.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  return NextResponse.json(getOpdQueueFallback(sessionId));
}


