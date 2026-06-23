import type { Metadata } from 'next';
import { OpdController } from '../../../controllers/OpdController';
import OpdScreen from '../../../components/display/OpdScreen';

export const metadata: Metadata = {
  title: 'OPD Live Display | Apex City General Hospital',
  description:
    'Live OPD queue status, doctor availability, room numbers, and token information',
};

interface PageProps {
  searchParams: Promise<{ theme?: string }>;
}

/**
 * Server Component — fetches the initial data server-side,
 * then hands it to the client OpdScreen for live updates.
 */
export default async function OpdDisplayPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const initialData = await OpdController.getDisplayData();
  const theme = resolvedParams.theme === 'light' ? 'light' : 'dark';

  return <OpdScreen initialData={initialData} theme={theme} />;
}
