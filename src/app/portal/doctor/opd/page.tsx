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

  // Fetch today's sessions
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const opdSessions = await prisma.opdSession.findMany({
    where: {
      doctorId: doctor.id,
      date: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    orderBy: { startTime: 'asc' },
  });

  const serializedSessions = opdSessions.map(session => ({
    id: session.id,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status as any,
    currentToken: session.currentToken,
    totalTokens: session.totalTokens,
    avgWaitMinutes: session.avgWaitMinutes,
  }));

  // Fetch active patient queue for ALL of today's sessions
  let queue: any[] = [];
  if (opdSessions.length > 0) {
    const rawQueue = await prisma.admission.findMany({
      where: {
        opdSessionId: { in: opdSessions.map(s => s.id) },
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
      opdSessionId: item.opdSessionId, // Added so UI can filter by session
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
      initialSessions={serializedSessions}
      initialQueue={queue}
    />
  );
}
