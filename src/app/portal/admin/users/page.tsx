import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import UsersClient from './UsersClient';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    redirect('/login');
  }

  // Fetch all staff users (not doctors)
  const users = await prisma.user.findMany({
    where: {
      role: {
        in: ['ADMIN', 'RECEPTIONIST', 'NURSE'],
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const serialized = users.map(u => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <UsersClient
      initialUsers={serialized as any}
      currentUserId={(session.user as any).id}
    />
  );
}
