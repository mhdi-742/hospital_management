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
          bed: true,
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
    const dischargedAt = data.dischargedAt ? new Date(data.dischargedAt) : new Date();
    const admission = await prisma.admission.update({
      where: { id: admissionId },
      data: { status: 'discharged', dischargedAt },
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

  if (action === 'transfer') {
    if (role !== 'RECEPTIONIST' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only receptionists can transfer' }, { status: 403 });
    }
    const {
      admissionId, newType, newWardId, newBedId, newOpdSessionId,
      newOtRoomId, newProcedureName, newAnaesthetist, newScheduledTime, newEstimatedDuration,
      transferRequestId
    } = data;

    const newAdmission = await prisma.$transaction(async (tx) => {
      // 1. Mark current as transferred
      const oldAdm = await tx.admission.update({
        where: { id: admissionId },
        data: { status: 'transferred', dischargedAt: new Date() },
        include: { doctors: true }
      });

      // 2. Create new admission
      const created = await tx.admission.create({
        data: {
          patientId: oldAdm.patientId,
          type: newType,
          status: 'active',
          wardId: newType === 'IPD' ? newWardId || null : null,
          bedId: newType === 'IPD' ? newBedId || null : null,
          patientCondition: newType === 'IPD' ? 'stable' : null,
          opdSessionId: newType === 'OPD' ? newOpdSessionId || null : null,
          doctors: {
            create: oldAdm.doctors.map(d => ({
              doctorId: d.doctorId,
              role: d.role
            }))
          }
        }
      });

      // 3. Handle OT case
      if (newType === 'OT') {
        const leadDoctorId = oldAdm.doctors.find(d => d.role === 'primary')?.doctorId || oldAdm.doctors[0]?.doctorId;
        if (leadDoctorId) {
          await tx.otCase.create({
            data: {
              admissionId: created.id,
              procedureName: newProcedureName || 'TBD',
              leadDoctorId,
              anaesthetist: newAnaesthetist || null,
              status: 'scheduled',
              otRoomId: newOtRoomId || null,
              scheduledTime: newScheduledTime || null,
              estimatedDuration: newEstimatedDuration ? parseInt(newEstimatedDuration) : null,
            }
          });
        }
      }

      // 4. Mark TransferRequest as approved
      if (transferRequestId) {
        await tx.transferRequest.update({
          where: { id: transferRequestId },
          data: { status: 'approved' },
        });
      }

      return created;
    });

    const { eventBus } = await import('@/lib/eventBus');
    eventBus.emit('REFRESH_OPD', {});
    eventBus.emit('REFRESH_OT', {});
    eventBus.emit('REFRESH_IPD', {});

    await prisma.auditLog.create({
      data: {
        userId: (session!.user as any).id,
        action: 'PATIENT_TRANSFERRED',
        target: newAdmission.id,
      },
    });

    return NextResponse.json(newAdmission);
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

  if (data.activeAdmissionId && (data.wardId !== undefined || data.bedId !== undefined)) {
    await prisma.admission.update({
      where: { id: data.activeAdmissionId },
      data: {
        wardId: data.wardId || null,
        bedId: data.bedId || null,
      },
    });

    try {
      const { eventBus } = await import('@/lib/eventBus');
      eventBus.emit('REFRESH_IPD', {});
    } catch (e) {}
  }

  return NextResponse.json(patient);
}
