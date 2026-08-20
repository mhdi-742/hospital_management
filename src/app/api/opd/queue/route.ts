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

  try {
    if (sessionId) {
      const session = await prisma.opdSession.findUnique({
        where: { id: sessionId },
        include: {
          doctor: {
            include: {
              user: true,
              department: true,
            },
          },
          admissions: {
            where: { status: 'active' },
            include: {
              patient: true,
            },
            orderBy: { queueOrder: 'asc' },
          },
        },
      });

      if (session) {
        const queue = session.admissions.map((adm, idx) => ({
          tokenNo: adm.tokenNo ?? idx + 1,
          patientName: adm.patient.name,
          age: adm.patient.age ?? 0,
          gender: (adm.patient.gender as any) ?? 'M',
          chiefComplaint: adm.patient.chiefComplaint ?? '',
          admittedAt: adm.admittedAt.toISOString(),
        }));

        return NextResponse.json({
          doctorName: session.doctor.user.name,
          roomNo: session.opdNo || session.doctor.roomNo || '201',
          departmentName: session.doctor.department?.name || 'General',
          departmentColor: session.doctor.department?.color || '#3b82f6',
          currentToken: session.currentToken,
          totalTokens: session.totalTokens,
          status: session.status,
          startTime: session.startTime,
          endTime: session.endTime,
          queue,
        });
      }
    }

    return NextResponse.json(getOpdQueueFallback(sessionId));
  } catch (err) {
    console.warn('[OPD_QUEUE_DB_ERR] Falling back to JSON:', err);
    return NextResponse.json(getOpdQueueFallback(sessionId));
  }
}


