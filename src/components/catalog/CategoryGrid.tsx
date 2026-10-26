'use client';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { parseCategoryBatch, type CategoryCard } from '@/lib/category-api';
import CategoryPoster from './CategoryPoster';
export default function CategoryGrid({ initial, initialCursor }: { initial: CategoryCard[]; initialCursor: string | null }) {
  const [categories, setCategories] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const seen = useRef(new Set<string>());
  useEffect(() => () => request.current?.abort(), []);
  async function loadMore() {
    if (!cursor || request.current) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/categories?cursor=${encodeURIComponent(cursor)}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Unavailable');
      const batch = parseCategoryBatch(await response.json(), cursor);
      if (batch.nextCursor && seen.current.has(batch.nextCursor)) throw new Error('Repeated cursor');
      if (controller.signal.aborted) return;
      seen.current.add(cursor);
      setCategories(current => { const existing = new Set(current.map(row => row.slug)); return [...current, ...batch.categories.filter(row => !existing.has(row.slug))]; });
      setCursor(batch.nextCursor);
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) setBusy(false); request.current = null; }
  }
  return <>
    <div className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 lg:gap-4" aria-busy={busy}>
      {categories.map((category, index) => <Link prefetch={false} key={category.slug} href={`/categories/${category.slug}`} className="group flex min-w-0 flex-col overflow-hidden border border-line bg-card transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <div className="relative aspect-video overflow-hidden"><CategoryPoster priority={index < 2} url={category.thumbnail.url} fallbackUrls={category.thumbnail.fallbackUrls} alt={category.thumbnail.alt || category.name} sizes="(max-width: 700px) 50vw, (max-width: 1000px) 33vw, 320px" /><div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" /></div>
        <div className="flex flex-1 items-center justify-between gap-2 p-4 max-sm:p-2.5"><div className="min-w-0 flex-1"><h2 className="line-clamp-2 min-h-[2.75em] [overflow-wrap:anywhere] font-heading text-[19px] font-bold leading-snug group-hover:text-accent max-sm:text-[14px]">{category.name === 'HD' ? 'HD collection' : category.name}</h2><p className="mt-1 text-[12px] leading-relaxed text-muted">{category.videoCount} videos</p></div><ArrowUpRight size={19} className="shrink-0 group-hover:text-accent max-sm:size-4" /></div>
      </Link>)}
    </div>
    <p role="status" className="mt-4 text-center text-xs text-muted">{busy ? 'Loading more categories...' : error ? 'Could not load more categories. Please retry.' : ''}</p>
    {cursor && <div className="my-5 flex justify-center"><button disabled={busy} onClick={loadMore} className="min-h-11 rounded-md border border-line px-5 text-sm hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-60">{busy ? 'Loading...' : error ? 'Retry' : 'Load more categories'}</button></div>}
  </>;
}
