import type { Metadata } from 'next';
import OpdDoctorsScreen from '../../../components/display/OpdDoctorsScreen';
import opdDoctorsData from '../../../data/opd_doctors.json';

export const metadata: Metadata = {
  title: 'OPD Doctors Timetable | Mikky Megha Hospital',
  description:
    'Comprehensive Bengali timetable and directory of specialist OPD doctors at Mikky Megha Hospital.',
};

export default function OpdDoctorsPage() {
  return <OpdDoctorsScreen initialData={opdDoctorsData} />;
}
