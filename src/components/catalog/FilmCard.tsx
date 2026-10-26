import CategoryPoster from './CategoryPoster';
import { formatDuration } from '@/lib/format-duration';
import { Eye, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
type CardData = {
  id: number | string; slug: string; title: string; thumbnail: string; thumbnailAlt?: string; thumbnailFallbacks?: string[];
  movie: string; genre: string; duration: number | null; views: string; rating: number | null; quality: string;
};

export default function FilmCard({ film, compact = false, compactOnMobile = false, priority = false, recommended = false }: { film: CardData; compact?: boolean; compactOnMobile?: boolean; priority?: boolean; recommended?: boolean }) {
  const duration = film.duration === null ? '—' : formatDuration(film.duration);
  return (
    <article id={`film-${film.id}`} className={`${compactOnMobile ? "max-sm:[&_h3]:truncate max-sm:[&_h3]:mb-0 max-sm:[&_h3+div]:hidden max-sm:[&_.badge:not([aria-label])]:hidden" : ""} ${recommended ? "ring-1 ring-accent/60 hover:shadow-[0_0_16px_#ed145b22]" : ""} relative scroll-mt-[25px] overflow-hidden border border-[#7b539225] bg-card group transition-colors duration-200 hover:border-accent target:outline-2 target:outline-offset-4 target:outline-accent [container-type:inline-size]`}>
      <Link href={`/${film.slug}`} aria-label={`View ${film.title}`} className="absolute inset-0 z-10 focus-visible:outline-offset-[-2px]" />
      <div className="relative aspect-video overflow-hidden bg-card">
        <CategoryPoster priority={priority} url={film.thumbnail} fallbackUrls={film.thumbnailFallbacks} alt={film.thumbnailAlt || `${film.movie} — ${film.title}`} sizes="(max-width: 700px) 50vw, (max-width: 1000px) 25vw, 280px" />
        {recommended && <span className="absolute top-1.5 left-1.5 max-w-[calc(100%-12px)] truncate rounded border border-pink-300/30 bg-gradient-to-r from-[#b50c51] to-[#7022a7] px-1.5 py-1 text-[clamp(8px,3.8cqi,11px)] font-bold leading-tight text-white shadow-md">heyXdude Pick <span aria-hidden="true">??</span></span>}
        {!compact && <span className="badge absolute bottom-2 left-2 bg-black/75 text-[clamp(8px,3.5cqi,11px)] max-sm:bottom-1 max-sm:left-1">{film.genre}</span>}
        <span className="badge absolute right-2 bottom-2 bg-black/85 font-medium text-[clamp(8px,3.5cqi,11px)] max-sm:right-1 max-sm:bottom-1" aria-label={`Duration ${duration}`}>{duration}</span>
      </div>
      <div className="p-[clamp(6px,4cqi,10px)] max-sm:p-2">
        <h3 className={`min-h-[1.5em] text-center font-heading text-[clamp(10px,5cqi,13px)] leading-[1.5] font-bold tracking-[-0.2px] max-sm:min-h-0 max-sm:text-[clamp(12px,6cqi,14px)] ${compact ? "truncate" : "mb-[clamp(4px,2cqi,6px)] [overflow-wrap:anywhere] max-sm:mb-1"}`}>{film.title}</h3>
        {!compact && <div className="flex items-center justify-center gap-[clamp(5px,3cqi,9px)] text-[clamp(9px,4cqi,11px)] text-muted max-sm:gap-[clamp(7px,4cqi,10px)] max-sm:text-[clamp(10px,4.5cqi,12px)] [&>span]:flex [&>span]:items-center [&>span]:gap-[clamp(3px,2cqi,6px)] max-sm:[&>span]:gap-1 [&_svg]:shrink-0 [&_svg]:size-[clamp(11px,5cqi,15px)] max-sm:[&_svg]:size-[clamp(13px,6cqi,16px)]">
          <span><Eye size={16} />{film.views}</span>
          <span className="text-[#dfd1ed]"><ThumbsUp size={15} />{film.rating === null ? '—' : `${film.rating}%`}</span>
          <span className="hd-badge max-md:px-1 max-md:py-0.5 max-md:text-[clamp(8px,3.5cqi,10px)] max-sm:px-[5px] max-sm:py-[3px] max-sm:text-[clamp(9px,4cqi,11px)]">{film.quality}</span>
        </div>}
      </div>
    </article>
  );
}
