import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== 'RECEPTIONIST' && role !== 'NURSE' && role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      admissions: {
        orderBy: { admittedAt: 'desc' },
        include: {
          ward: true,
          opdSession: { include: { doctor: { include: { user: true } } } },
          otCase: { include: { otRoom: true, leadDoctor: { include: { user: true } } } },
          doctors: {
            include: { doctor: { include: { user: true, department: true } } },
          },
        },
      },
    },
  });

  if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(patient);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== 'RECEPTIONIST' && role !== 'NURSE' && role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action, ...data } = body;

  if (action === 'discharge') {
    if (role !== 'RECEPTIONIST' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only receptionists can discharge' }, { status: 403 });
    }
    const admissionId = data.admissionId;
    const admission = await prisma.admission.update({
      where: { id: admissionId },
      data: { status: 'discharged', dischargedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        userId: (session!.user as any).id,
        action: 'PATIENT_DISCHARGED',
        target: admissionId,
      },
    });
    return NextResponse.json(admission);
  }

  if (action === 'update_condition') {
    const admissionId = data.admissionId;
    const admission = await prisma.admission.update({
      where: { id: admissionId },
      data: { patientCondition: data.patientCondition },
    });
    return NextResponse.json(admission);
  }

  // Update patient demographics
  const patient = await prisma.patient.update({
    where: { id },
    data: {
      name:                 data.name,
      age:                  data.age    ? parseInt(data.age)    : undefined,
      gender:               data.gender || undefined,
      contact:              data.contact,
      address:              data.address,
      bloodGroup:           data.bloodGroup,
      chiefComplaint:       data.chiefComplaint,
      diagnosis:            data.diagnosis,
      emergencyContactName:  data.emergencyContactName,
      emergencyContactPhone: data.emergencyContactPhone,
      insuranceProvider:    data.insuranceProvider,
      policyNumber:         data.policyNumber,
    },
  });

  return NextResponse.json(patient);
}
