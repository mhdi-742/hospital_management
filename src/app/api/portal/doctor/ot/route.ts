import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OtStatus } from '@prisma/client';

/**
 * PATCH /api/portal/doctor/ot
 * Updates OT case status and notes by doctor.
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

    const { otCaseId, status, notes } = await req.json();

    if (!otCaseId) {
      return NextResponse.json({ error: 'OT Case ID is required' }, { status: 400 });
    }

    // Verify OT Case exists
    const otCase = await prisma.otCase.findUnique({
      where: { id: otCaseId },
    });

    if (!otCase) {
      return NextResponse.json({ error: 'OT Case not found' }, { status: 404 });
    }

    // Update OT Case
    const updated = await prisma.otCase.update({
      where: { id: otCaseId },
      data: {
        status: status ? (status as OtStatus) : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_OT_CASE',
        target: `OtCase:${otCaseId}`,
        metadata: JSON.stringify({ oldStatus: otCase.status, newStatus: updated.status }),
      },
    });

    return NextResponse.json({ success: true, otCase: updated });
  } catch (error: any) {
    console.error('[OT_PATCH_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
