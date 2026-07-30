import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/opd/queue?sessionId=xxx
 * Returns the patient queue for a specific OPD session.
 * Public endpoint — used by the display board.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const session = await prisma.opdSession.findUnique({
      where: { id: sessionId },
      include: {
        doctor: {
          include: {
            user: { select: { name: true } },
            department: { select: { name: true, color: true } },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const admissions = await prisma.admission.findMany({
      where: {
        opdSessionId: sessionId,
        status: 'active',
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            chiefComplaint: true,
          },
        },
      },
      orderBy: [
        { queueOrder: 'asc' },
        { admittedAt: 'asc' },
      ],
    });

    const queue = admissions.map((adm, idx) => ({
      tokenNo: adm.tokenNo ?? (idx + 1),
      patientName: adm.patient.name,
      age: adm.patient.age,
      gender: adm.patient.gender,
      chiefComplaint: adm.patient.chiefComplaint,
      admittedAt: adm.admittedAt.toISOString(),
    }));

    return NextResponse.json({
      doctorName: session.doctor.user.name,
      roomNo: session.doctor.roomNo,
      departmentName: session.doctor.department?.name ?? 'General Medicine',
      departmentColor: session.doctor.department?.color ?? '#3b82f6',
      currentToken: session.currentToken,
      totalTokens: session.totalTokens,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      queue,
    });
  } catch (error: any) {
    console.error('[OPD_QUEUE_GET_ERR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
