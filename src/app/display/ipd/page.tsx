import type { Metadata } from 'next';
import { IpdController } from '../../../controllers/IpdController';
import IpdScreen from '../../../components/display/IpdScreen';

export const metadata: Metadata = {
  title: 'IPD Patient Status | Apex City General Hospital',
  description:
    'Live inpatient department status — ward-wise patient census, bed occupancy, and admitted patient registry.',
};

interface PageProps {
  searchParams: Promise<{ theme?: string }>;
}

/**
 * Server Component — fetches IPD data server-side,
 * then hands it to the client IpdScreen for live updates.
 */
export default async function IpdDisplayPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const initialData = IpdController.getDisplayData();
  const theme = resolvedParams.theme === 'light' ? 'light' : 'dark';

  return <IpdScreen initialData={initialData} theme={theme} />;
}
