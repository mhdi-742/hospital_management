import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import OpdSessionClient from './OpdSessionClient';

export const dynamic = 'force-dynamic';

export default async function OpdSessionPage() {
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

  // Fetch today's session
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const opdSession = await prisma.opdSession.findFirst({
    where: {
      doctorId: doctor.id,
      date: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
  });

  const serializedSession = opdSession ? {
    id: opdSession.id,
    startTime: opdSession.startTime,
    endTime: opdSession.endTime,
    status: opdSession.status as any,
    currentToken: opdSession.currentToken,
    totalTokens: opdSession.totalTokens,
    avgWaitMinutes: opdSession.avgWaitMinutes,
  } : null;

  // Fetch active patient queue for today's session
  let queue: any[] = [];
  if (opdSession) {
    const rawQueue = await prisma.admission.findMany({
      where: {
        opdSessionId: opdSession.id,
        status: 'active',
      },
      include: {
        patient: true,
      },
      orderBy: {
        admittedAt: 'asc',
      },
    });

    queue = rawQueue.map(item => ({
      id: item.id,
      patientId: item.patientId,
      admittedAt: item.admittedAt.toISOString(),
      patient: {
        id: item.patient.id,
        name: item.patient.name,
        age: item.patient.age,
        gender: item.patient.gender,
        contact: item.patient.contact,
        address: item.patient.address,
        bloodGroup: item.patient.bloodGroup,
        chiefComplaint: item.patient.chiefComplaint,
        diagnosis: item.patient.diagnosis,
      }
    }));
  }

  return (
    <OpdSessionClient
      initialSession={serializedSession}
      initialQueue={queue}
    />
  );
}
