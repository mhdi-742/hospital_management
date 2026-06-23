import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AnnouncementBoard } from '@prisma/client';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/portal/admin/announcements/[id]
 * Updates announcement text, board, or status.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: annId } = await params;

  try {
    const { text, board, isActive } = await req.json();

    const updated = await prisma.announcement.update({
      where: { id: annId },
      data: {
        text: text !== undefined ? text : undefined,
        board: board !== undefined ? (board as AnnouncementBoard) : undefined,
        isActive: isActive !== undefined ? !!isActive : undefined,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_ANNOUNCEMENT',
        target: `Announcement:${annId}`,
        metadata: JSON.stringify({ isActive, board }),
      },
    });

    return NextResponse.json({ success: true, announcement: updated });
  } catch (error: any) {
    console.error('[ADMIN_UPDATE_ANNOUNCEMENT_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/portal/admin/announcements/[id]
 * Deletes an announcement.
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: annId } = await params;

  try {
    await prisma.announcement.delete({
      where: { id: annId },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_ANNOUNCEMENT',
        target: `Announcement:${annId}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ADMIN_DELETE_ANNOUNCEMENT_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
