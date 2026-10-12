import { permanentRedirect } from 'next/navigation';
export default async function LegacyVideoPage({ params }: { params: Promise<{ slug: string }> }) {
  permanentRedirect(`/${encodeURIComponent((await params).slug)}`);
}
