import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/portal/doctor/profile
 * Allows doctors to update their room number and speciality details.
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

    const { roomNo, speciality } = await req.json();

    const updated = await prisma.doctor.update({
      where: { id: doctor.id },
      data: {
        roomNo: roomNo !== undefined ? roomNo : undefined,
        speciality: speciality !== undefined ? speciality : undefined,
      },
      include: {
        user: { select: { name: true, email: true } },
        department: true,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_DOCTOR_PROFILE',
        target: `Doctor:${doctor.id}`,
        metadata: JSON.stringify({ roomNo, speciality }),
      },
    });

    return NextResponse.json({ success: true, doctor: updated });
  } catch (error: any) {
    console.error('[PROFILE_PATCH_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
