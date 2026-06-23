import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface Ctx { params: Promise<{ id: string }> }

/**
 * POST /api/portal/admission/new-episode/[id]
 * Creates a new admission episode for an existing patient.
 * Ensures any previous active admissions are kept as-is (patient can have one active at a time
 * or multiple — the UI decides). We simply create a new admission record.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: patientId } = await params;
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (!session || role !== 'RECEPTIONIST') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Ensure patient exists
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

  const body = await req.json();
  const {
    admissionType, wardId, bedNo, otRoomId,
    procedureName, anaesthetist, scheduledTime, estimatedDuration,
    doctorIds,
  } = body;

  const result = await prisma.$transaction(async tx => {
    // Auto-resolve OPD session if type is OPD and primary doctor is specified
    let resolvedOpdSessionId: string | undefined = undefined;
    if (admissionType === 'OPD' && doctorIds && Array.isArray(doctorIds)) {
      const primaryDoc = doctorIds.find((d: any) => d.role === 'primary');
      if (primaryDoc) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const activeSession = await tx.opdSession.findFirst({
          where: {
            doctorId: primaryDoc.doctorId,
            date: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        });
        if (activeSession) {
          resolvedOpdSessionId = activeSession.id;
        }
      }
    }

    const admission = await tx.admission.create({
      data: {
        patientId,
        type:   admissionType ?? 'OPD',
        status: 'active',
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

    // Create OT case if needed
    if (admissionType === 'OT' && procedureName) {
      const lead = doctorIds?.find((d: any) => d.role === 'primary');
      await tx.otCase.create({
        data: {
          admissionId:       admission.id,
          otRoomId:          otRoomId || undefined,
          leadDoctorId:      lead?.doctorId || undefined,
          procedureName,
          anaesthetist:      anaesthetist || undefined,
          scheduledTime:     scheduledTime || undefined,
          estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : undefined,
          status:            'scheduled',
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId:   (session!.user as any).id,
        action:   'NEW_ADMISSION_EPISODE',
        target:   patientId,
        metadata: JSON.stringify({ type: admissionType, admissionId: admission.id }),
      },
    });

    return admission;
  });

  return NextResponse.json(result, { status: 201 });
}
