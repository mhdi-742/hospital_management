import { redirect } from 'next/navigation';

/** Root — redirect straight to the OPD display screen. */
export default function Home() {
  redirect('/display/opd');
}
