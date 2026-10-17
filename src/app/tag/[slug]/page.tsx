import { notFound } from 'next/navigation';
import Link from 'next/link';
import FilmCard from '@/components/catalog/FilmCard';
import type { Metadata } from 'next';
import { cache } from 'react';
import Pagination from '@/components/catalog/Pagination';
import { getTagVideos, TagNotFound } from '@/lib/tag-api';
import { siteOrigin } from '@/lib/video-api';

// Request rendering is controlled by the root layout; public fetches have bounded TTLs.

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
    const title = `${data.name} Videos${page > 1 ? ` — Page ${page}` : ''} | HeyxDude`;
    const description = `Browse published videos tagged ${data.name}. Discover related videos and available players.`;
    const url = new URL(`/tag/${encodeURIComponent(slug)}`, siteOrigin());
    if (page > 1) url.searchParams.set('page', String(page));
    return { title, description, alternates: { canonical: url.href }, robots: { index: page === 1, follow: true },
      openGraph: { title, description, url: url.href, type: 'website' }, twitter: { card: 'summary', title, description },
      ...(data.adult ? { other: { rating: 'adult' } } : {}) };
  } catch {
    return { title: 'Tag unavailable | HeyxDude', robots: { index: false, follow: true } };
  }
}
export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  let data;
  try { data = await loadTag(slug, pageNumber((await searchParams).page)); }
  catch (error) {
    if (error instanceof TagNotFound) notFound();
    console.error('Tag API failed:', error instanceof Error ? error.message : 'Unknown error');
    return <main className="page-container py-6 max-sm:py-4"><div className="rounded-md border border-line px-4 py-8 text-center">
      <p role="status" className="text-[13px] leading-relaxed text-muted">Videos are temporarily unavailable. Please try again shortly.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <a href={`/tag/${encodeURIComponent(slug)}`} className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-[13px] text-white hover:border-accent hover:text-accent">Try again</a>
        <Link href="/categories" className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-[13px] text-white hover:border-accent hover:text-accent">Categories</Link>
      </div>
    </div></main>;
  }

  const canonical = new URL(`/tag/${encodeURIComponent(data.slug)}`, siteOrigin());
  if (data.pagination.currentPage > 1) canonical.searchParams.set('page', String(data.pagination.currentPage));
  const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${data.name} Videos`, url: canonical.href,
    mainEntity: { '@type': 'ItemList', itemListElement: data.films.map((film, index) => ({ '@type': 'ListItem', position: index + 1,
      name: film.title, url: new URL(`/${film.slug}`, canonical).href })) } };
  return (
    <main className="page-container py-6 max-sm:py-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted [overflow-wrap:anywhere]">
        <Link href="/" className="inline-flex min-h-11 items-center text-white hover:text-accent">Home</Link>
        <span aria-hidden="true">/</span><Link href="/categories" className="inline-flex min-h-11 items-center text-white hover:text-accent">Categories</Link>
        <span aria-hidden="true">/</span><span aria-current="page">{data.name}</span>
      </nav>
      <h1 id="tag-heading" className="mb-2 min-w-0 font-heading text-[26px] font-bold leading-snug [overflow-wrap:anywhere] max-sm:text-[22px]">{data.name}<span className="text-accent">.</span></h1>
      <p className="mb-5 text-[12px] text-muted">{data.pagination.totalVideos} videos</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 lg:gap-3.5">
        {data.films.map(film => <FilmCard key={film.id} film={film} compactOnMobile />)}
      </div>
      {!data.films.length && <div className="rounded-md border border-line px-4 py-8 text-center">
        <p role="status" className="text-[13px] text-muted">No published videos for this tag yet.</p>
        <Link href="/categories" className="mt-3 inline-flex min-h-11 items-center rounded-md border border-line px-4 text-[13px] text-white hover:border-accent hover:text-accent">Browse categories</Link>
      </div>}
      <Pagination currentPage={data.pagination.currentPage} pageCount={data.pagination.pageCount}
        basePath={`/tag/${encodeURIComponent(data.slug)}`} anchor="tag-heading" label={`${data.name} pagination`} />
    </main>
  );
}
