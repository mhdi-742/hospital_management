import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/eventBus';
import { OpdStatus } from '@prisma/client';

/**
 * GET /api/portal/admission/opd-sessions
 * Returns all doctors with their today's sessions (and doctors without sessions).
 * Also returns the patient queue for all today's sessions.
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || !['RECEPTIONIST', 'NURSE'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // All doctors with their sessions from today onwards (including future sessions)
    const doctors = await prisma.doctor.findMany({
      include: {
        user: { select: { name: true } },
        department: true,
        opdSessions: {
          where: {
            date: { gte: todayStart },
          },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // All admissions linked to today's sessions
    const todaySessionIds = doctors.flatMap(d => d.opdSessions.map(s => s.id));
    const admissions = todaySessionIds.length > 0
      ? await prisma.admission.findMany({
          where: { opdSessionId: { in: todaySessionIds }, status: 'active' },
          include: { patient: true },
          orderBy: { admittedAt: 'asc' },
        })
      : [];

    return NextResponse.json({
      doctors: doctors.map(d => ({
        id: d.id,
        name: d.user.name,
        designation: d.designation,
        departmentName: d.department?.name ?? 'General Medicine',
        departmentColor: d.department?.color ?? '#3b82f6',
        sessions: d.opdSessions.map(s => ({
          id: s.id,
          date: s.date.toISOString().split('T')[0],
          startTime: s.startTime,
          endTime: s.endTime,
          opdNo: s.opdNo,
          floor: s.floor,
          status: s.status,
          currentToken: s.currentToken,
          totalTokens: s.totalTokens,
          avgWaitMinutes: s.avgWaitMinutes,
        })),
      })),
      queue: admissions.map(a => ({
        id: a.id,
        patientId: a.patientId,
        opdSessionId: a.opdSessionId,
        admittedAt: a.admittedAt.toISOString(),
        patient: {
          id: a.patient.id,
          name: a.patient.name,
          age: a.patient.age,
          gender: a.patient.gender,
          chiefComplaint: a.patient.chiefComplaint,
        },
      })),
    });
  } catch (error: any) {
    console.error('[RECEPTION_OPD_GET_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/portal/admission/opd-sessions
 * Creates a new OPD session for any doctor.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !['RECEPTIONIST', 'NURSE'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { doctorId, startTime, endTime, opdNo, floor, date } = await req.json();
    if (!doctorId) return NextResponse.json({ error: 'doctorId is required' }, { status: 400 });

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { department: true },
    });
    if (!doctor) return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });

    const sessionDate = date ? new Date(date) : new Date();
    sessionDate.setHours(0, 0, 0, 0);

    const newSession = await prisma.opdSession.create({
      data: {
        doctorId,
        date: sessionDate,
        startTime: startTime || '09:00',
        endTime: endTime || '13:00',
        opdNo: opdNo || doctor.roomNo || null,
        floor: floor || doctor.department?.floor || null,
        status: 'upcoming',
        totalTokens: 0,
        avgWaitMinutes: 0,
        currentToken: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_OPD_SESSION_RECEPTION',
        target: `OpdSession:${newSession.id}`,
        metadata: JSON.stringify({ doctorId }),
      },
    });

    eventBus.emit('REFRESH_OPD');
    return NextResponse.json({ success: true, session: { ...newSession, date: newSession.date.toISOString().split('T')[0] } });
  } catch (error: any) {
    console.error('[RECEPTION_OPD_POST_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/portal/admission/opd-sessions
 * Updates any OPD session — status, times, token increment/decrement, etc.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || !['RECEPTIONIST', 'NURSE'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId, status, incrementToken, decrementToken, startTime, endTime, opdNo, floor, date } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

    const opdSession = await prisma.opdSession.findUnique({ where: { id: sessionId } });
    if (!opdSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const updateData: any = {};
    if (status !== undefined) updateData.status = status as OpdStatus;
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (opdNo !== undefined) updateData.opdNo = opdNo || null;
    if (floor !== undefined) updateData.floor = floor || null;
    if (date !== undefined && date) updateData.date = new Date(date);

    if (incrementToken) {
      updateData.currentToken = (opdSession.currentToken ?? 0) + 1;
    } else if (decrementToken) {
      const prev = Math.max(0, (opdSession.currentToken ?? 0) - 1);
      updateData.currentToken = prev === 0 ? null : prev;
    }

    const updated = await prisma.opdSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_OPD_SESSION_RECEPTION',
        target: `OpdSession:${sessionId}`,
        metadata: JSON.stringify(updateData),
      },
    });

    eventBus.emit('REFRESH_OPD');
    return NextResponse.json({ success: true, session: { ...updated, date: updated.date.toISOString().split('T')[0] } });
  } catch (error: any) {
    console.error('[RECEPTION_OPD_PATCH_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/portal/admission/opd-sessions?sessionId=xxx
 * Deletes any OPD session.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || !['RECEPTIONIST', 'NURSE'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

    const opdSession = await prisma.opdSession.findUnique({ where: { id: sessionId } });
    if (!opdSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    if (opdSession.totalTokens > 0) {
      await prisma.admission.updateMany({
        where: { opdSessionId: sessionId },
        data: { opdSessionId: null },
      });
    }

    await prisma.opdSession.delete({ where: { id: sessionId } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_OPD_SESSION_RECEPTION',
        target: `OpdSession:${sessionId}`,
      },
    });

    eventBus.emit('REFRESH_OPD');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[RECEPTION_OPD_DELETE_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
