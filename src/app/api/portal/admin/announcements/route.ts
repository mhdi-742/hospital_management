import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AnnouncementBoard } from '@prisma/client';

/**
 * GET /api/portal/admin/announcements
 * Returns all announcements.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ announcements });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/portal/admin/announcements
 * Creates a new announcement.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { text, board, isActive } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Announcement text is required' }, { status: 400 });
    }

    const ann = await prisma.announcement.create({
      data: {
        text,
        board: board ? (board as AnnouncementBoard) : 'ALL',
        isActive: isActive !== undefined ? !!isActive : true,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_ANNOUNCEMENT',
        target: `Announcement:${ann.id}`,
        metadata: JSON.stringify({ board, textSnippet: text.substring(0, 30) }),
      },
    });

    return NextResponse.json({ success: true, announcement: ann }, { status: 201 });
  } catch (error: any) {
    console.error('[ADMIN_CREATE_ANNOUNCEMENT_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
