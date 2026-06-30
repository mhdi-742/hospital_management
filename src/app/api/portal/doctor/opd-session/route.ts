import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/eventBus';
import { OpdStatus } from '@prisma/client';

/**
 * PATCH /api/portal/doctor/opd-session
 * Doctor can only update session status and call the next patient (incrementToken).
 * Token counts (totalTokens) are managed by the receptionist when registering patients.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'DOCTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.user.id },
    });

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 });
    }

    const { status, incrementToken, decrementToken, startTime, endTime, sessionId } = await req.json();

    // Find the specific session or fall back to today's latest session
    let opdSession;
    if (sessionId) {
      opdSession = await prisma.opdSession.findFirst({
        where: { id: sessionId, doctorId: doctor.id },
      });
    } else {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      opdSession = await prisma.opdSession.findFirst({
        where: {
          doctorId: doctor.id,
          date: { gte: todayStart, lte: todayEnd },
        },
        orderBy: { startTime: 'desc' },
      });
    }

    if (!opdSession) {
      return NextResponse.json({ error: 'No OPD session found' }, { status: 404 });
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status as OpdStatus;
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;

    if (incrementToken) {
      const nextToken = (opdSession.currentToken ?? 0) + 1;
      updateData.currentToken = nextToken;
    } else if (decrementToken) {
      const prevToken = Math.max(0, (opdSession.currentToken ?? 0) - 1);
      updateData.currentToken = prevToken === 0 ? null : prevToken;
    }

    const updated = await prisma.opdSession.update({
      where: { id: opdSession.id },
      data: updateData,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_OPD_SESSION',
        target: `OpdSession:${opdSession.id}`,
        metadata: JSON.stringify(updateData),
      },
    });

    eventBus.emit('REFRESH_OPD');

    return NextResponse.json({ success: true, session: updated });
  } catch (error: any) {
    console.error('[OPD_SESSION_PATCH_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/portal/doctor/opd-session
 * Creates a new OPD session for today. Multiple sessions per day are allowed
 * (e.g. morning 09:00-13:00 and evening 16:00-19:00).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'DOCTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.user.id },
    });

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 });
    }

    const { startTime, endTime } = await req.json();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const newSession = await prisma.opdSession.create({
      data: {
        doctorId: doctor.id,
        date: todayStart,
        startTime: startTime || '09:00',
        endTime: endTime || '13:00',
        status: 'upcoming',
        totalTokens: 0,
        avgWaitMinutes: 0,
        currentToken: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_OPD_SESSION',
        target: `OpdSession:${newSession.id}`,
      },
    });

    eventBus.emit('REFRESH_OPD');

    return NextResponse.json({ success: true, session: newSession });
  } catch (error: any) {
    console.error('[OPD_SESSION_POST_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/portal/doctor/opd-session?sessionId=xxx
 * Deletes a session if it has no patients.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'DOCTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.user.id },
    });

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 });
    }

    const { searchParams } = req.nextUrl;
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const opdSession = await prisma.opdSession.findUnique({
      where: { id: sessionId },
    });

    if (!opdSession || opdSession.doctorId !== doctor.id) {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
    }

    // If there are patients linked to this session, unlink them so we can delete the session
    // without triggering a foreign key constraint error.
    if (opdSession.totalTokens > 0) {
      await prisma.admission.updateMany({
        where: { opdSessionId: sessionId },
        data: { opdSessionId: null },
      });
    }

    await prisma.opdSession.delete({
      where: { id: sessionId },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_OPD_SESSION',
        target: `OpdSession:${sessionId}`,
      },
    });

    eventBus.emit('REFRESH_OPD');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[OPD_SESSION_DELETE_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
