import type { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import styles from './layout.module.css';

export const metadata = {
  title: 'Admin Portal | Mikki Megha Hospital',
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (!session || role !== 'ADMIN') {
    redirect('/login');
  }

  return (
    <div className={styles.shell}>
      <AdminSidebar userName={session.user?.name ?? 'System Admin'} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
