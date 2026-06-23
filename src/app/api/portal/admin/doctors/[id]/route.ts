import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/portal/admin/doctors/[id]
 * Updates doctor and user details, resets password, or deactivates.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: doctorId } = await params;

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { user: true },
    });

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, designation, speciality, roomNo, departmentId, isActive, password } = body;

    const result = await prisma.$transaction(async tx => {
      // 1. Update user
      const userUpdate: any = {};
      if (name !== undefined) userUpdate.name = name;
      if (isActive !== undefined) userUpdate.isActive = !!isActive;
      if (password) {
        userUpdate.password = await bcrypt.hash(password, 12);
      }

      await tx.user.update({
        where: { id: doctor.userId },
        data: userUpdate,
      });

      // 2. Update doctor
      const doctorUpdate: any = {};
      if (designation !== undefined) doctorUpdate.designation = designation;
      if (speciality !== undefined) doctorUpdate.speciality = speciality;
      if (roomNo !== undefined) doctorUpdate.roomNo = roomNo;
      if (departmentId !== undefined) doctorUpdate.departmentId = departmentId || null;

      const updatedDoctor = await tx.doctor.update({
        where: { id: doctorId },
        data: doctorUpdate,
        include: {
          user: { select: { name: true, email: true, isActive: true } },
          department: true,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'UPDATE_DOCTOR',
          target: `Doctor:${doctorId}`,
          metadata: JSON.stringify({ fieldsChanged: Object.keys(body) }),
        },
      });

      return updatedDoctor;
    });

    return NextResponse.json({ success: true, doctor: result });
  } catch (error: any) {
    console.error('[ADMIN_UPDATE_DOCTOR_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/portal/admin/doctors/[id]
 * Deletes doctor and associated user account.
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: doctorId } = await params;

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    await prisma.$transaction(async tx => {
      // 1. Delete doctor record (dependent relations should be handled or blocked)
      // Since delete might fail if doctor is assigned to patients, we should be careful.
      // But we will delete it.
      await tx.doctor.delete({ where: { id: doctorId } });
      // 2. Delete user account
      await tx.user.delete({ where: { id: doctor.userId } });

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'DELETE_DOCTOR',
          target: `User:${doctor.userId}`,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ADMIN_DELETE_DOCTOR_ERR]', error);
    return NextResponse.json({ error: 'Cannot delete doctor: they may be assigned to patients or scheduled in OT. Try deactivating them instead.' }, { status: 500 });
  }
}
