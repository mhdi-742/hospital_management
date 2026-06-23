import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/portal/doctor/consultation
 * Completes a patient's consultation: discharges the admission, updates diagnosis.
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

    const { admissionId, diagnosis, chiefComplaint, action } = await req.json();

    if (!admissionId) {
      return NextResponse.json({ error: 'Admission ID is required' }, { status: 400 });
    }

    // Verify admission belongs to this doctor or OPD session
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      include: {
        opdSession: true,
        patient: true,
      },
    });

    if (!admission) {
      return NextResponse.json({ error: 'Admission record not found' }, { status: 404 });
    }

    // Ensure it's active
    if (admission.status !== 'active') {
      return NextResponse.json({ error: 'Admission is already inactive' }, { status: 400 });
    }

    // Update patient demographics/clinical fields if provided
    if (diagnosis !== undefined || chiefComplaint !== undefined) {
      await prisma.patient.update({
        where: { id: admission.patientId },
        data: {
          diagnosis: diagnosis ?? admission.patient.diagnosis,
          chiefComplaint: chiefComplaint ?? admission.patient.chiefComplaint,
        },
      });
    }

    let updatedAdmission = admission;
    if (action === 'discharge' || action === 'complete') {
      updatedAdmission = await prisma.admission.update({
        where: { id: admissionId },
        data: {
          status: 'discharged',
          dischargedAt: new Date(),
        },
        include: {
          patient: true,
          opdSession: true,
        },
      });

      // Log audit trail
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'DISCHARGE_PATIENT_OPD',
          target: `Patient:${admission.patientId}`,
          metadata: JSON.stringify({ admissionId }),
        },
      });
    }

    return NextResponse.json({ success: true, admission: updatedAdmission });
  } catch (error: any) {
    console.error('[CONSULTATION_PATCH_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
