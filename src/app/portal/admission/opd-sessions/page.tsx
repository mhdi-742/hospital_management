import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import OpdSessionsClient from './OpdSessionsClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'OPD Sessions | Reception Portal',
};

export default async function ReceptionOpdSessionsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || !['RECEPTIONIST', 'NURSE'].includes(role)) {
    redirect('/login');
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // All doctors with today's sessions
  const doctors = await prisma.doctor.findMany({
    include: {
      user: { select: { name: true } },
      department: true,
      opdSessions: {
        where: { date: { gte: todayStart, lte: todayEnd } },
        orderBy: { startTime: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const todaySessionIds = doctors.flatMap(d => d.opdSessions.map(s => s.id));

  const admissions = todaySessionIds.length > 0
    ? await prisma.admission.findMany({
        where: { opdSessionId: { in: todaySessionIds }, status: 'active' },
        include: { patient: true },
        orderBy: { admittedAt: 'asc' },
      })
    : [];

  const serializedDoctors = doctors.map(d => ({
    id: d.id,
    name: d.user.name,
    designation: d.designation,
    departmentName: d.department?.name ?? 'General Medicine',
    departmentColor: d.department?.color ?? '#3b82f6',
    sessions: d.opdSessions.map(s => ({
      id: s.id,
      date: s.date.toISOString().split('T')[0],
      startTime: s.startTime,
      endTime: s.endTime,
      opdNo: s.opdNo,
      floor: s.floor,
      status: s.status as any,
      currentToken: s.currentToken,
      totalTokens: s.totalTokens,
      avgWaitMinutes: s.avgWaitMinutes,
    })),
  }));

  const serializedQueue = admissions.map(a => ({
    id: a.id,
    patientId: a.patientId,
    opdSessionId: a.opdSessionId,
    admittedAt: a.admittedAt.toISOString(),
    patient: {
      id: a.patient.id,
      name: a.patient.name,
      age: a.patient.age,
      gender: a.patient.gender,
      chiefComplaint: a.patient.chiefComplaint,
    },
  }));

  return (
    <OpdSessionsClient
      initialDoctors={serializedDoctors}
      initialQueue={serializedQueue}
    />
  );
}
