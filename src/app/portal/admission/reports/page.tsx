import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ReportsClient from '@/app/portal/admin/reports/ReportsClient';

export const dynamic = 'force-dynamic';

export default async function AdmissionReportsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== 'ADMIN' && role !== 'RECEPTIONIST' && role !== 'NURSE')) {
    redirect('/login');
  }

  return <ReportsClient />;
}
