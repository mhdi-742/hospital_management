import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import IpdPatientsClient from './IpdPatientsClient';

export const dynamic = 'force-dynamic';

export default async function DoctorIpdPage() {
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

  // Fetch active IPD admissions where this doctor is assigned
  const admissions = await prisma.admission.findMany({
    where: {
      type: 'IPD',
      status: 'active',
      doctors: {
        some: {
          doctorId: doctor.id,
        },
      },
    },
    include: {
      patient: true,
      ward: true,
      bed: true,
      doctors: {
        include: {
          doctor: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
    orderBy: {
      admittedAt: 'desc',
    },
  });

  // Map the doctors to find our role (Primary vs Consultant) and serialize cleanly
  const mappedAdmissions = admissions.map(adm => {
    const ourAssignment = adm.doctors.find(d => d.doctorId === doctor.id);
    return {
      id: adm.id,
      patientId: adm.patientId,
      admittedAt: adm.admittedAt.toISOString(),
      bedNo: adm.bed?.bedNo ?? null,
      patientCondition: adm.patientCondition as any,
      assignedRole: (ourAssignment?.role ?? 'consultant') as any,
      ward: adm.ward ? {
        id: adm.ward.id,
        name: adm.ward.name,
        code: adm.ward.code,
        accentColor: adm.ward.accentColor,
      } : null,
      patient: {
        id: adm.patient.id,
        name: adm.patient.name,
        age: adm.patient.age,
        gender: adm.patient.gender,
        contact: adm.patient.contact,
        address: adm.patient.address,
        bloodGroup: adm.patient.bloodGroup,
        chiefComplaint: adm.patient.chiefComplaint,
        diagnosis: adm.patient.diagnosis,
      }
    };
  });

  return (
    <IpdPatientsClient
      initialAdmissions={mappedAdmissions}
      doctorId={doctor.id}
    />
  );
}
