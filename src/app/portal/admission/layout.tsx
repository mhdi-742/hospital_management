import type { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdmissionSidebar from '@/components/admission/AdmissionSidebar';
import styles from './layout.module.css';

export const metadata = {
  title: 'Patient Admission Portal | Mikki Megha Hospital',
};

export default async function AdmissionLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (!session || (role !== 'RECEPTIONIST' && role !== 'NURSE')) {
    redirect('/login');
  }

  return (
    <div className={styles.shell}>
      <AdmissionSidebar userName={session.user?.name ?? ''} role={role} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
