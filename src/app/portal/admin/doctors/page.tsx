import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DoctorsClient from './DoctorsClient';

export const dynamic = 'force-dynamic';

export default async function AdminDoctorsPage() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    redirect('/login');
  }

  // Fetch all doctors
  const doctors = await prisma.doctor.findMany({
    include: {
      user: {
        select: { id: true, name: true, email: true, isActive: true },
      },
      department: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch all departments for select dropdowns
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
  });

  return (
    <DoctorsClient
      initialDoctors={doctors}
      departments={departments}
    />
  );
}
