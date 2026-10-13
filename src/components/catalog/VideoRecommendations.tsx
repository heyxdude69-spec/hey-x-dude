'use client';
import { useState } from 'react';
import Link from 'next/link';
import FilmCard from './FilmCard';
import { recommendationBadges } from '@/lib/recommendation-badges';
import type { CatalogCard } from '@/lib/category-videos-api';
export default function VideoRecommendations({ films, exploreUrl, badgeSeed }: { films: CatalogCard[]; exploreUrl: string; badgeSeed: string }) {
  const [expanded, setExpanded] = useState(false);
  const badges = recommendationBadges(films.map(film => film.id), badgeSeed);
  return <section id="related" aria-labelledby="related-title" className="page-container py-10 max-sm:py-6">
    <h2 id="related-title" className="mb-7 text-center font-heading text-[28px] font-extrabold max-sm:mb-4 max-sm:text-[20px]">You liked this video? You may also like<span className="text-accent">...</span></h2>
    <div className="grid grid-cols-5 gap-3.5 max-md:grid-cols-4 max-md:gap-2.5 max-sm:grid-cols-2 max-sm:gap-1.5">
      {films.slice(0, expanded ? 16 : 8).map(film => <FilmCard key={film.id} film={film} recommended={badges.has(film.id)} compactOnMobile />)}
    </div>
    <div className="mt-8 flex justify-center max-sm:mt-5">
      {!expanded && films.length > 8
        ? <button onClick={() => setExpanded(true)} className="rounded-[3px] border border-line px-7 py-3 text-[13px] text-white transition-colors hover:border-accent hover:text-accent">Show more</button>
        : <Link href={exploreUrl} className="rounded-[3px] border border-line px-7 py-3 text-[13px] text-white transition-colors hover:border-accent hover:text-accent">Explore more</Link>}
    </div>
  </section>;
}
