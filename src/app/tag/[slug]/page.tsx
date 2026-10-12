import { notFound } from 'next/navigation';
import FilmCard from '@/components/catalog/FilmCard';
import type { Metadata } from 'next';
import { cache } from 'react';
import Pagination from '@/components/catalog/Pagination';
import { getTagVideos, TagNotFound } from '@/lib/tag-api';
import { siteOrigin } from '@/lib/video-api';

export const dynamic = 'force-dynamic';

const loadTag = cache(getTagVideos);
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };
function pageNumber(raw?: string): number {
  const page = Number(raw ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000) throw new TagNotFound();
  return page;
}
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  try {
    const { slug } = await params, page = pageNumber((await searchParams).page);
    const data = await loadTag(slug, page);
    const title = `${data.name} Videos${page > 1 ? ` — Page ${page}` : ''} | KnightWarrior`;
    const description = `Browse published videos tagged ${data.name}. Discover related videos and available players.`;
    const url = new URL(`/tag/${encodeURIComponent(slug)}`, siteOrigin());
    if (page > 1) url.searchParams.set('page', String(page));
    return { title, description, alternates: { canonical: url.href }, robots: { index: page === 1, follow: true },
      openGraph: { title, description, url: url.href, type: 'website' }, twitter: { card: 'summary', title, description },
      ...(data.adult ? { other: { rating: 'adult' } } : {}) };
  } catch {
    return { title: 'Tag unavailable | KnightWarrior', robots: { index: false, follow: true } };
  }
}
export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  let data;
  try { data = await loadTag(slug, pageNumber((await searchParams).page)); }
  catch (error) {
    if (error instanceof TagNotFound) notFound();
    console.error('Tag API failed:', error instanceof Error ? error.message : 'Unknown error');
    return <main className="page-container py-6 max-sm:py-4"><p role="status" className="text-[13px] text-muted">Videos are temporarily unavailable. Please try again shortly.</p></main>;
  }

  return (
    <main className="page-container py-6 max-sm:py-4">
      <h1 id="tag-heading" className="mb-2 font-heading text-[26px] font-bold">{data.name}<span className="text-accent">.</span></h1>
      <p className="mb-5 text-[12px] text-muted">{data.pagination.totalVideos} videos tagged {data.name}</p>
      <div className="grid grid-cols-5 gap-3.5 max-md:grid-cols-4 max-md:gap-2.5 max-sm:grid-cols-2 max-sm:gap-1.5">
        {data.films.map(film => <FilmCard key={film.id} film={film} />)}
      </div>
      <Pagination currentPage={data.pagination.currentPage} pageCount={data.pagination.pageCount}
        basePath={`/tag/${encodeURIComponent(data.slug)}`} anchor="tag-heading" label={`${data.name} pagination`} />
    </main>
  );
}
