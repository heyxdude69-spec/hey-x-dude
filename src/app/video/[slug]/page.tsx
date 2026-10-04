import EmbedPlayer from '@/components/catalog/EmbedPlayer';
import { formatDuration } from '@/lib/format-duration';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Eye, ThumbsUp } from 'lucide-react';
import FilmCard from '@/components/catalog/FilmCard';
import VideoActions from '@/components/catalog/VideoActions';
import { films, tagSlug } from '@/data/catalog';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const film = films.find(film => film.slug === slug);
  return { title: film ? `${film.title} | KnightWarrior` : 'Video not found | KnightWarrior' };
}

export default async function VideoPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const film = films.find(film => film.slug === slug);
  if (!film) notFound();
  const related = films.filter(item => item.id !== film.id).sort((a, b) => Number(b.category === film.category) - Number(a.category === film.category));
  const { page } = await searchParams;
  const currentPage = Math.min(Math.ceil(related.length / 25), Math.max(1, Math.floor(Number(page) || 1)));
  const visible = related.slice(0, currentPage * 25);

  return (
    <main>
      <section aria-labelledby="video-title" className="mx-auto w-full max-w-[1800px] px-6 py-4 max-md:px-4 max-sm:px-2 max-sm:py-3">
        <div className="w-full max-w-[1100px] max-sm:max-w-none">
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <h1 id="video-title" className="font-heading text-[27px] font-extrabold leading-tight max-sm:text-[20px]">{film.title}</h1>
            <span className="flex items-center gap-1.5 text-[12px] text-white/60"><Eye size={16} />{film.views} views</span>
            <span className="flex items-center gap-1.5 text-[12px] text-white/60"><ThumbsUp size={16} />{film.rating}%</span>
          </div>
          <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted"><span>{film.movie}</span><span>{film.language}</span><span>{formatDuration(film.duration)}</span><time dateTime={film.uploadedAt}>{new Date(film.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</time><span className="hd-badge">HD</span></p>
          <div className="mb-4 flex flex-wrap gap-2 text-[12px]">
            <Link href={`/categories/${film.category.toLowerCase()}`} className="badge px-3 py-2 text-white transition-colors hover:border-accent hover:text-accent">{film.category}</Link>
            {film.tags.map(tag => <Link key={tag} href={`/tag/${tagSlug(tag)}`} className="badge px-3 py-2 transition-colors hover:border-accent hover:text-accent">{tag}</Link>)}
          </div>
          <EmbedPlayer key={film.slug} title={film.title} servers={film.servers} />
          <VideoActions description={film.description} rating={film.rating} downloadUrl={film.downloadEnabled ? film.downloadUrl : undefined} />
          <dl className="mt-5 space-y-3 border-t border-line pt-4 text-[12px]">
            <div className="flex flex-wrap items-center gap-2"><dt className="mr-2 text-white/60">Categories:</dt><dd><Link href={`/categories/${film.category.toLowerCase()}`} className="badge px-3 py-1.5 text-white transition-colors hover:border-accent hover:text-accent">{film.category}</Link></dd></div>
            <div className="flex flex-wrap items-center gap-2"><dt className="mr-2 text-white/60">Tags:</dt>{film.tags.map(tag => <dd key={tag}><Link href={`/tag/${tagSlug(tag)}`} className="badge px-3 py-1.5 transition-colors hover:border-accent hover:text-accent">{tag}</Link></dd>)}</div>
          </dl>
        </div>
      </section>
      <section id="related" aria-labelledby="related-title" className="page-container py-10 max-sm:py-6">
        <h2 id="related-title" className="mb-7 text-center font-heading text-[28px] font-extrabold max-sm:mb-4 max-sm:text-[20px]">You liked this video? You may also like<span className="text-accent">...</span></h2>
        <div className="grid grid-cols-5 gap-3.5 max-md:grid-cols-4 max-md:gap-2.5 max-sm:grid-cols-2 max-sm:gap-1.5">
          {visible.map(item => <FilmCard key={item.id} film={item} />)}
        </div>
        {visible.length < related.length && (
          <div className="mt-8 flex justify-center max-sm:mt-5">
            <Link href={`/video/${film.slug}?page=${currentPage + 1}#film-${visible.at(-1)?.id}`} className="rounded-[3px] border border-line px-7 py-3 text-[13px] text-white transition-colors hover:border-accent hover:text-accent">Show more</Link>
          </div>
        )}
      </section>
    </main>
  );
}
