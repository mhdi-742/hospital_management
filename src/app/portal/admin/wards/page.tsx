import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import WardsClient from './WardsClient';

export const dynamic = 'force-dynamic';

export default async function AdminWardsPage() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    redirect('/login');
  }

  // Fetch all wards
  const wards = await prisma.ward.findMany({
    orderBy: { name: 'asc' },
  });

  return (
    <WardsClient
      initialWards={wards}
    />
  );
}
