import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * GET /api/portal/admin/doctors
 * Returns a list of all doctors with their user accounts and departments.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const doctors = await prisma.doctor.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, isActive: true },
        },
        department: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ doctors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/portal/admin/doctors
 * Creates a new doctor user and profile.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, email, password, designation, speciality, roomNo, departmentId } = await req.json();

    if (!name || !email || !password || !designation) {
      return NextResponse.json({ error: 'Name, email, password, and designation are required' }, { status: 400 });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: 'DOCTOR',
          isActive: true,
        },
      });

      const doctor = await tx.doctor.create({
        data: {
          userId: user.id,
          designation,
          speciality,
          roomNo,
          departmentId: departmentId || undefined,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CREATE_DOCTOR',
          target: `Doctor:${doctor.id}`,
          metadata: JSON.stringify({ name, email, designation }),
        },
      });

      return { user, doctor };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[ADMIN_CREATE_DOCTOR_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
