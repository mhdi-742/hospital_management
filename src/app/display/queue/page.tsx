import type { Metadata } from 'next';
import { OpdController } from '../../../controllers/OpdController';
import DoctorQueueScreen from './DoctorQueueScreen';

export const metadata: Metadata = {
  title: 'Doctor Queue Display | Mikki Megha General Hospital',
  description:
    'View all doctors and their live OPD queues — click on any doctor to see who is next in line.',
};

export const dynamic = 'force-dynamic';

/**
 * Public display page showing all doctors.
 * Clicking a doctor reveals the live patient queue for that session.
 */
export default async function DoctorQueuePage() {
  const initialData = await OpdController.getDisplayData();

  return <DoctorQueueScreen initialData={initialData} />;
}
