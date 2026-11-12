import type { Metadata } from 'next';
import DudeAdminPanel from './panel';

export const metadata: Metadata = {
  title: 'Admin console | HeyxDude',
  robots: { index: false, follow: false },
};

export default function DudeAdminPage() {
  return <DudeAdminPanel />;
}
