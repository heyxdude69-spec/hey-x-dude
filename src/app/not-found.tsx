import type { Metadata } from 'next';
import StatusPage from '@/components/layout/StatusPage';
export const metadata: Metadata = { title: 'Page not found | KnightWarrior', robots: { index: false, follow: true } };
export default function NotFound() {
  return <StatusPage code="404" title="Page not found" description="This page may have moved or is no longer available. Head home or browse the categories to continue." />;
}
