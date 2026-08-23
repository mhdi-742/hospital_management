import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import InvestigationsClient from './InvestigationsClient';

export const dynamic = 'force-dynamic';

export default async function AdminInvestigationsPage() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    redirect('/login');
  }

  // Fetch all investigation tests (including inactive)
  const tests = await prisma.investigationTest.findMany({
    orderBy: { name: 'asc' },
  });

  // Get distinct categories
  const categoriesRaw = await prisma.investigationTest.findMany({
    select: { category: true },
    distinct: ['category'],
    where: { category: { not: null } },
  });
  const categories = categoriesRaw.map((c) => c.category).filter(Boolean) as string[];

  return (
    <InvestigationsClient
      initialTests={JSON.parse(JSON.stringify(tests))}
      initialCategories={categories}
    />
  );
}
