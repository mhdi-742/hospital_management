import type { Metadata } from 'next';
import { OtController } from '../../../controllers/OtController';
import OtScreen from '../../../components/display/OtScreen';

export const metadata: Metadata = {
  title: 'OT Live Schedule | Apex City General Hospital',
  description:
    'Live Operation Theatre schedule — room-wise procedure list, surgeon, anaesthetist, patient details and real-time status.',
};

interface PageProps {
  searchParams: Promise<{ theme?: string }>;
}

/**
 * Server Component — fetches OT data server-side,
 * then hands it to the client OtScreen for live updates.
 */
export default async function OtDisplayPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const initialData = await OtController.getDisplayData();
  const theme = resolvedParams.theme === 'light' ? 'light' : 'dark';

  return <OtScreen initialData={initialData} theme={theme} />;
}
