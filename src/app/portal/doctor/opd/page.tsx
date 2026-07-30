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

  // Fetch today's and upcoming sessions from today onwards
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const opdSessions = await prisma.opdSession.findMany({
    where: {
      doctorId: doctor.id,
      date: {
        gte: todayStart,
      },
    },
    orderBy: [
      { date: 'asc' },
      { startTime: 'asc' },
    ],
  });

  const serializedSessions = opdSessions.map(session => ({
    id: session.id,
    date: session.date.toISOString().split('T')[0],
    startTime: session.startTime,
    endTime: session.endTime,
    opdNo: session.opdNo,
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
      orderBy: [
        { queueOrder: 'asc' },
        { admittedAt: 'asc' },
      ],
    });

    queue = rawQueue.map(item => ({
      id: item.id,
      patientId: item.patientId,
      opdSessionId: item.opdSessionId, // Added so UI can filter by session
      tokenNo: item.tokenNo,
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
