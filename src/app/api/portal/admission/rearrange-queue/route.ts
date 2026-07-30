import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/eventBus';

/**
 * POST /api/portal/admission/rearrange-queue
 * Re-orders admissions for an OPD session by persisting queueOrder index values.
 * Body: { sessionId: string, orderedAdmissionIds: string[] }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (!session || !['RECEPTIONIST', 'NURSE', 'DOCTOR', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId, orderedAdmissionIds } = await req.json();

    if (!sessionId || !Array.isArray(orderedAdmissionIds) || orderedAdmissionIds.length === 0) {
      return NextResponse.json({ error: 'sessionId and orderedAdmissionIds are required' }, { status: 400 });
    }

    const opdSession = await prisma.opdSession.findUnique({ where: { id: sessionId } });
    if (!opdSession) {
      return NextResponse.json({ error: 'OPD Session not found' }, { status: 404 });
    }

    // Perform transaction to update queueOrder sequentially for all given admissionIds
    await prisma.$transaction(
      orderedAdmissionIds.map((admissionId: string, index: number) =>
        prisma.admission.updateMany({
          where: {
            id: admissionId,
            opdSessionId: sessionId,
          },
          data: {
            queueOrder: index + 1,
          },
        })
      )
    );

    // Audit logging
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REARRANGE_OPD_QUEUE',
        target: `OpdSession:${sessionId}`,
        metadata: JSON.stringify({
          sessionId,
          orderedAdmissionIds,
          totalRearranged: orderedAdmissionIds.length,
        }),
      },
    });

    // Notify real-time clients (Display boards, doctor portals, reception dashboards)
    eventBus.emit('REFRESH_OPD');

    return NextResponse.json({ success: true, count: orderedAdmissionIds.length });
  } catch (error: any) {
    console.error('[REARRANGE_QUEUE_POST_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
