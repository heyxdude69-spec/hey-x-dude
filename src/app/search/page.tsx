import type { Metadata } from 'next';
import Link from 'next/link';
import FilmCard from '@/components/catalog/FilmCard';
import { parseSuggestions } from '@/lib/search-api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Search | HeyxDude', description: 'Search the video collection.', robots: { index: false, follow: true } };
type Props = { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> };
const button = 'inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 text-sm text-white hover:border-accent hover:text-accent';
export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.normalize('NFKC').trim().replace(/\s+/g, ' ') : '';
  const page = params.page === undefined ? 1 : typeof params.page === 'string' ? Number(params.page) : NaN;
  const valid = q.length >= 2 && q.length <= 100 && Number.isSafeInteger(page) && page >= 1 && page <= 100;
  let videos: ReturnType<typeof parseSuggestions> = [], hasMore = false, failed = false;
  if (valid) {
    try {
      const base = process.env.CATALOG_API_ORIGIN;
      if (!base) throw new Error('Unavailable');
      const origin = new URL(base);
      if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid origin');
      const rating = process.env.CATALOG_CONTENT_RATING || 'general';
      if (!['general', 'adult'].includes(rating)) throw new Error('Invalid rating');
      const url = new URL('/api/search', origin);
      url.searchParams.set('q', q); url.searchParams.set('page', String(page)); url.searchParams.set('rating', rating);
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000), headers: process.env.INTERACTION_PROXY_SECRET ? { 'X-Interaction-Secret': process.env.INTERACTION_PROXY_SECRET } : undefined });
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      if (data.page !== page || typeof data.hasMore !== 'boolean') throw new Error('Invalid pagination');
      videos = parseSuggestions(data, 48); hasMore = data.hasMore;
    } catch { failed = true; }
  }
  const href = (target: number) => `/search?q=${encodeURIComponent(q)}&page=${target}`;
  return <main className="page-container py-6 max-sm:py-4">
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-xs text-muted"><Link href="/" className="inline-flex min-h-11 items-center hover:text-accent">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Search</span></nav>
    <h1 id="search-heading" className="mb-4 font-heading text-[26px] font-bold max-sm:text-[22px]">Search<span className="text-accent">.</span></h1>
    <form action="/search" role="search" className="mb-5 flex flex-wrap gap-2">
      <label htmlFor="page-search" className="sr-only">Search titles, tags or categories</label>
      <input id="page-search" name="q" type="search" defaultValue={q.slice(0, 100)} required minLength={2} maxLength={100} enterKeyHint="search" placeholder="Search titles, tags, categories..." className="min-h-11 min-w-0 flex-1 basis-48 rounded-md border border-line bg-card px-3 text-base text-white focus:border-accent" />
      <button className={`${button} border-accent`}>Search</button>
    </form>
    {!valid ? <p role="status" className="rounded-md border border-line p-5 text-sm text-muted">Enter 2?100 characters to search. Page numbers must be between 1 and 100.</p>
      : failed ? <div role="status" className="rounded-md border border-line px-4 py-8 text-center"><p className="mb-4 text-sm text-muted">Search is temporarily unavailable.</p><a href={href(page)} className={button}>Try again</a></div>
      : <>
        <p role="status" className="mb-4 text-sm text-muted [overflow-wrap:anywhere]">Results for ?{q}? ? Page {page}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 lg:gap-3.5">{videos.map(video => <FilmCard key={video.id} compact film={{ ...video, thumbnailAlt: video.title, movie: video.title, genre: video.category, duration: video.durationSeconds ?? null, views: '', rating: null, quality: '' }} />)}</div>
        {!videos.length && <div className="rounded-md border border-line px-4 py-8 text-center"><p className="text-sm text-muted">No playable results on this page. Try another keyword or browse categories.</p><Link href="/categories" className={`${button} mt-4`}>Browse categories</Link></div>}
        {(page > 1 || hasMore) && <nav aria-label="Search pagination" className="my-6 flex flex-wrap items-center justify-center gap-3">{page > 1 && <Link href={href(page - 1)} className={button}>Previous</Link>}<span className="text-xs text-muted">Page {page}</span>{hasMore && <Link href={href(page + 1)} className={button}>Next</Link>}</nav>}
      </>}
  </main>;
}
