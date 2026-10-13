import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Catalog from '@/components/catalog/Catalog';
import { getHome, HomeCollectionNotFound } from '@/lib/home-api';
import { siteOrigin } from '@/lib/video-api';
const load = cache(getHome);
type Props = { params: Promise<{ key: string }>; searchParams: Promise<{ page?: string }> };
function pageNumber(raw?: string) { const page = Number(raw ?? 1); if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) notFound(); return page; }
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  try {
    const { key } = await params, page = pageNumber((await searchParams).page), data = await load(key, page);
    const url = new URL(`/collections/${key}`, siteOrigin()); if (page > 1) url.searchParams.set('page', String(page));
    return { title: `${data.sections[0].title} | ${data.seo.title}`, description: data.seo.metaDescription, alternates: { canonical: url.href }, robots: { index: data.seo.indexAllowed && page === 1 && data.sections[0].films.length > 0, follow: true } };
  } catch { return { title: 'Collection unavailable', robots: { index: false, follow: true } }; }
}
export default async function CollectionPage({ params, searchParams }: Props) {
  const { key } = await params, page = pageNumber((await searchParams).page);
  try { return <Catalog data={await load(key, page)} collectionPath={`/collections/${encodeURIComponent(key)}`} />; }
  catch (error) { if (error instanceof HomeCollectionNotFound) notFound(); throw error; }
}
