import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PatientCondition } from '@prisma/client';

/**
 * PATCH /api/portal/doctor/ipd
 * Updates patient clinical details (diagnosis, condition) in IPD ward.
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

    const { admissionId, condition, diagnosis, chiefComplaint } = await req.json();

    if (!admissionId) {
      return NextResponse.json({ error: 'Admission ID is required' }, { status: 400 });
    }

    // Verify admission
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      include: { patient: true },
    });

    if (!admission) {
      return NextResponse.json({ error: 'Admission not found' }, { status: 404 });
    }

    // Update patient record
    if (diagnosis !== undefined || chiefComplaint !== undefined) {
      await prisma.patient.update({
        where: { id: admission.patientId },
        data: {
          diagnosis: diagnosis ?? admission.patient.diagnosis,
          chiefComplaint: chiefComplaint ?? admission.patient.chiefComplaint,
        },
      });
    }

    // Update admission condition
    const updated = await prisma.admission.update({
      where: { id: admissionId },
      data: {
        patientCondition: condition ? (condition as PatientCondition) : undefined,
      },
      include: {
        patient: true,
        ward: true,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_IPD_PATIENT',
        target: `Admission:${admissionId}`,
        metadata: JSON.stringify({ oldCondition: admission.patientCondition, newCondition: updated.patientCondition }),
      },
    });

    return NextResponse.json({ success: true, admission: updated });
  } catch (error: any) {
    console.error('[IPD_PATCH_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
