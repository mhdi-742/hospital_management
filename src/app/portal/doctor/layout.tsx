import type { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DoctorSidebar from '@/components/doctor/DoctorSidebar';
import styles from './layout.module.css';

export const metadata = {
  title: 'Doctor Portal | Mikki Megha Hospital',
};

export default async function DoctorLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (!session || role !== 'DOCTOR') {
    redirect('/login');
  }

  // Fetch doctor record for the sidebar (e.g. designation)
  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user?.id },
    select: { designation: true },
  });

  return (
    <div className={styles.shell}>
      <DoctorSidebar
        userName={session.user?.name ?? ''}
        designation={doctor?.designation ?? 'Medical Officer'}
      />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
