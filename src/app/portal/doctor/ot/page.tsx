import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import OtScheduleClient from './OtScheduleClient';

export const dynamic = 'force-dynamic';

export default async function DoctorOtPage() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'DOCTOR') {
    redirect('/login');
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
  });

  if (!doctor) {
    return (
      <div style={{ color: '#f87171', padding: '24px' }}>
        Doctor profile not found.
      </div>
    );
  }

  // Fetch all OT cases where this doctor is lead or assistant
  const otCases = await prisma.otCase.findMany({
    where: {
      OR: [
        { leadDoctorId: doctor.id },
        { assistants: { some: { doctorId: doctor.id } } },
      ],
    },
    include: {
      admission: {
        include: {
          patient: true,
        },
      },
      otRoom: true,
      leadDoctor: {
        include: {
          user: { select: { name: true } },
        },
      },
      assistants: {
        include: {
          doctor: {
            include: {
              user: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: {
      scheduledTime: 'asc',
    },
  });

  // Map role and cleanly serialize fields
  const mappedOtCases = otCases.map(ot => {
    return {
      id: ot.id,
      admissionId: ot.admissionId,
      otRoomId: ot.otRoomId,
      leadDoctorId: ot.leadDoctorId,
      procedureName: ot.procedureName,
      anaesthetist: ot.anaesthetist,
      scheduledTime: ot.scheduledTime,
      estimatedDuration: ot.estimatedDuration,
      status: ot.status as any,
      notes: ot.notes,
      isLead: ot.leadDoctorId === doctor.id,
      otRoom: ot.otRoom ? {
        id: ot.otRoom.id,
        roomNo: ot.otRoom.roomNo,
        type: ot.otRoom.type,
      } : null,
      leadDoctor: ot.leadDoctor ? {
        user: { name: ot.leadDoctor.user.name }
      } : null,
      assistants: ot.assistants.map(a => ({
        doctor: {
          user: { name: a.doctor.user.name }
        }
      })),
      admission: {
        id: ot.admission.id,
        patient: {
          id: ot.admission.patient.id,
          name: ot.admission.patient.name,
          age: ot.admission.patient.age,
          gender: ot.admission.patient.gender,
        }
      }
    };
  });

  return (
    <OtScheduleClient
      initialOtCases={mappedOtCases}
      doctorId={doctor.id}
    />
  );
}
