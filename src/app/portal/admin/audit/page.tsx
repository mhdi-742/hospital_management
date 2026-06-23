import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import AuditClient from './AuditClient';

export const dynamic = 'force-dynamic';

export default async function AdminAuditPage() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    redirect('/login');
  }

  // Fetch initial audit logs
  const logs = await prisma.auditLog.findMany({
    include: {
      user: {
        select: { name: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const total = await prisma.auditLog.count();

  // Parse logs for safely serializing metadata
  const parsedLogs = logs.map(log => ({
    ...log,
    createdAt: log.createdAt.toISOString(),
  }));

  return (
    <AuditClient
      initialLogs={parsedLogs}
      initialTotal={total}
    />
  );
}
