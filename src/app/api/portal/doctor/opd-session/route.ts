import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OpdStatus } from '@prisma/client';

/**
 * PATCH /api/portal/doctor/opd-session
 * Updates the doctor's today session status, currentToken, totalTokens, or avgWaitMinutes.
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

    const { status, currentToken, totalTokens, avgWaitMinutes, incrementToken } = await req.json();

    // Find today's session
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const opdSession = await prisma.opdSession.findFirst({
      where: {
        doctorId: doctor.id,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    if (!opdSession) {
      return NextResponse.json({ error: 'No OPD session found for today' }, { status: 404 });
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status as OpdStatus;
    if (totalTokens !== undefined) updateData.totalTokens = parseInt(totalTokens, 10);
    if (avgWaitMinutes !== undefined) updateData.avgWaitMinutes = parseInt(avgWaitMinutes, 10);

    if (incrementToken) {
      const nextToken = (opdSession.currentToken ?? 0) + 1;
      // Cap at totalTokens if desired, or let it exceed if extra patients are registered
      updateData.currentToken = nextToken;
    } else if (currentToken !== undefined) {
      updateData.currentToken = currentToken === null ? null : parseInt(currentToken, 10);
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
        metadata: JSON.stringify({ old: opdSession, new: updated }),
      },
    });

    return NextResponse.json({ success: true, session: updated });
  } catch (error: any) {
    console.error('[OPD_SESSION_PATCH_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/portal/doctor/opd-session
 * Allows creating an OPD session for today if none exists.
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

    const { startTime, endTime, totalTokens, avgWaitMinutes } = await req.json();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Check if session already exists for today
    const existing = await prisma.opdSession.findFirst({
      where: {
        doctorId: doctor.id,
        date: todayStart,
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'OPD session already exists for today' }, { status: 400 });
    }

    const newSession = await prisma.opdSession.create({
      data: {
        doctorId: doctor.id,
        date: todayStart,
        startTime: startTime || '09:00',
        endTime: endTime || '13:00',
        status: 'upcoming',
        totalTokens: totalTokens ? parseInt(totalTokens, 10) : 20,
        avgWaitMinutes: avgWaitMinutes ? parseInt(avgWaitMinutes, 10) : 10,
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

    return NextResponse.json({ success: true, session: newSession });
  } catch (error: any) {
    console.error('[OPD_SESSION_POST_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
