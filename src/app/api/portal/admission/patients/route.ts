import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/eventBus';

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== 'RECEPTIONIST' && role !== 'NURSE' && role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search') ?? '';
  const type   = searchParams.get('type')   ?? '';
  const status = searchParams.get('status') ?? 'active';
  const page   = parseInt(searchParams.get('page') ?? '1', 10);
  const limit  = 20;

  const patients = await prisma.patient.findMany({
    where: {
      name: search ? { contains: search } : undefined,
      admissions: {
        some: {
          type:   type   ? (type   as any) : undefined,
          status: status ? (status as any) : undefined,
        },
      },
    },
    include: {
      admissions: {
        where: { status: 'active' },
        orderBy: { admittedAt: 'desc' },
        take: 1,
        include: {
          ward: { select: { name: true, code: true, accentColor: true } },
          doctors: {
            include: { doctor: { include: { user: { select: { name: true } } } } },
            where: { role: 'primary' },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await prisma.patient.count({
    where: {
      name: search ? { contains: search } : undefined,
      admissions: {
        some: {
          type:   type   ? (type   as any) : undefined,
          status: status ? (status as any) : undefined,
        },
      },
    },
  });

  return NextResponse.json({ patients, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || role !== 'RECEPTIONIST') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  const {
    // Patient demographics
    name, age, gender, contact, address, bloodGroup,
    // Medical
    chiefComplaint, diagnosis,
    // Emergency
    emergencyContactName, emergencyContactPhone,
    // Insurance
    insuranceProvider, policyNumber,
    // Admission
    admissionType, wardId, bedNo, opdSessionId, otRoomId,
    doctorIds, // [{ doctorId, role }]
    // OT
    procedureName, anaesthetist, scheduledTime, estimatedDuration,
  } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Patient name is required' }, { status: 400 });
  }

  if (age === undefined || age === null || String(age).trim() === '') {
    return NextResponse.json({ error: 'Age is required' }, { status: 400 });
  }
  const parsedAge = parseInt(String(age), 10);
  if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 150) {
    return NextResponse.json({ error: 'Age must be a valid number between 0 and 150' }, { status: 400 });
  }

  if (!gender) {
    return NextResponse.json({ error: 'Gender is required' }, { status: 400 });
  }
  if (gender !== 'M' && gender !== 'F' && gender !== 'Other') {
    return NextResponse.json({ error: 'Invalid gender value' }, { status: 400 });
  }

  if (!contact || !contact.trim()) {
    return NextResponse.json({ error: 'Contact number is required' }, { status: 400 });
  }

  // Create patient + admission in a transaction
  const result = await prisma.$transaction(async tx => {
    const patient = await tx.patient.create({
      data: {
        name,
        age:    age    ? parseInt(age)    : undefined,
        gender: gender || undefined,
        contact, address, bloodGroup, chiefComplaint, diagnosis,
        emergencyContactName, emergencyContactPhone,
        insuranceProvider, policyNumber,
      },
    });

    // Auto-resolve OPD session if type is OPD and primary doctor is specified
    let resolvedOpdSessionId = opdSessionId || undefined;
    let assignedToken: number | null = null;

    if (admissionType === 'OPD' && doctorIds && Array.isArray(doctorIds)) {
      const primaryDoc = doctorIds.find((d: any) => d.role === 'primary');
      if (primaryDoc) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // If a specific session was selected, use it; otherwise find today's latest
        let activeSession;
        if (opdSessionId) {
          activeSession = await tx.opdSession.findFirst({
            where: { id: opdSessionId, doctorId: primaryDoc.doctorId },
          });
        } else {
          activeSession = await tx.opdSession.findFirst({
            where: {
              doctorId: primaryDoc.doctorId,
              date: { gte: todayStart, lte: todayEnd },
            },
            orderBy: { startTime: 'asc' },
          });
        }

        if (activeSession) {
          resolvedOpdSessionId = activeSession.id;

          // Increment totalTokens and assign the new token number to this patient
          const updatedSession = await tx.opdSession.update({
            where: { id: activeSession.id },
            data: { totalTokens: { increment: 1 } },
          });
          assignedToken = updatedSession.totalTokens;
        }
      }
    }

    const admission = await tx.admission.create({
      data: {
        patientId: patient.id,
        type:      admissionType ?? 'OPD',
        status:    'active',
        wardId:    wardId    || undefined,
        bedNo:     bedNo     || undefined,
        opdSessionId: resolvedOpdSessionId,
      },
    });

    // Assign doctors
    if (doctorIds && Array.isArray(doctorIds)) {
      for (const d of doctorIds) {
        await tx.patientDoctor.create({
          data: {
            admissionId: admission.id,
            doctorId:    d.doctorId,
            role:        d.role ?? 'primary',
          },
        });
      }
    }

    // Create OT case
    if (admissionType === 'OT') {
      const leadDoctor = doctorIds?.find((d: any) => d.role === 'primary');
      await tx.otCase.create({
        data: {
          admissionId:      admission.id,
          otRoomId:         otRoomId || undefined,
          leadDoctorId:     leadDoctor?.doctorId || undefined,
          procedureName:    procedureName || 'TBD',
          anaesthetist:     anaesthetist || undefined,
          scheduledTime:    scheduledTime || undefined,
          estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : undefined,
          status:           'scheduled',
        },
      });
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        userId:   (session!.user as any).id,
        action:   'PATIENT_ADMITTED',
        target:   patient.id,
        metadata: JSON.stringify({ type: admissionType, patientName: name }),
      },
    });

    return { patient, admission, assignedToken };
  });

  // Emit events for live displays
  if (admissionType === 'OPD') {
    eventBus.emit('REFRESH_OPD');
  } else if (admissionType === 'OT') {
    eventBus.emit('REFRESH_OT');
  } else if (admissionType === 'IPD') {
    eventBus.emit('REFRESH_IPD');
  }

  return NextResponse.json(result, { status: 201 });
}
