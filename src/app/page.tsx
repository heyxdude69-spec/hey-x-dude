import Catalog from '@/components/catalog/Catalog';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getHome, HomeCollectionNotFound } from '@/lib/home-api';
import { siteOrigin } from '@/lib/video-api';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
const loadHome = cache(getHome);
type Props = { searchParams: Promise<{ section?: string; page?: string }> };
const pageNumber = (value?: string) => { const page = Number(value || 1); return Number.isSafeInteger(page) && page >= 1 && page <= 500 ? page : 1; };
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams, page = pageNumber(params.page);
  try {
    const data = await loadHome(params.section, page), selected = data.sections[0];
    const origin = siteOrigin(), canonical = new URL('/', origin);
    if (params.section) canonical.searchParams.set('section', params.section);
    if (page > 1) canonical.searchParams.set('page', String(page));
    const title = params.section ? `${selected.title} | ${data.seo.title}` : data.seo.title;
    return { title, description: data.seo.metaDescription, alternates: { canonical: canonical.href },
      robots: { index: data.seo.indexAllowed && !params.section && page === 1 && data.sections.some(row => row.films.length), follow: true },
      openGraph: { title, description: data.seo.metaDescription, url: canonical.href, type: 'website' },
      twitter: { card: 'summary', title, description: data.seo.metaDescription },
      ...(data.contentRating === 'adult' ? { other: { rating: 'adult' } } : {}) };
  } catch { return { title: 'Home unavailable', robots: { index: false, follow: true } }; }
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  try { return <Catalog data={await loadHome(params.section, pageNumber(params.page))} />; }
  catch (error) {
    if (error instanceof HomeCollectionNotFound) notFound();
    console.error('Home API failed:', error instanceof Error ? error.message : 'Unknown error');
    return <main className="page-container pt-1.5 max-sm:pt-0"><p role="status" className="py-5 text-[13px] text-muted">Home videos are temporarily unavailable. Please try again shortly.</p></main>;
  }
}
