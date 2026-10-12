import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import EmbedPlayer from '@/components/catalog/EmbedPlayer';
import VideoTaxonomy from '@/components/catalog/VideoTaxonomy';
import VideoInteractions, { VideoInteractionProvider } from '@/components/catalog/VideoInteractions';
import VideoRecommendations from '@/components/catalog/VideoRecommendations';
import { formatDuration } from '@/lib/format-duration';
import { getVideoPage, VideoNotFound, safeStructuredJson } from '@/lib/video-api';
// Request rendering is controlled by the root layout; public fetches have bounded TTLs.
const loadVideo = cache(getVideoPage);
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const video = await loadVideo((await params).slug), seo = video.seo;
    return { title: seo.title, description: seo.description, alternates: { canonical: seo.canonical },
      robots: { index: seo.index, follow: true, 'max-image-preview': 'large', 'max-video-preview': -1, 'max-snippet': -1 },
      openGraph: { type: 'video.other', title: seo.title, description: seo.description, url: seo.canonical,
        images: seo.image ? [{ url: seo.image, alt: video.card.thumbnailAlt }] : [] },
      twitter: { card: 'summary_large_image', title: seo.title, description: seo.description, images: seo.image ? [seo.image] : [] },
      ...(seo.adult ? { other: { rating: 'adult' } } : {}) };
  } catch { return { title: 'Video unavailable | KnightWarrior', robots: { index: false, follow: true } }; }
}
export default async function VideoPage({ params }: Props) {
  let video;
  try { video = await loadVideo((await params).slug); }
  catch (error) {
    if (error instanceof VideoNotFound) notFound();
    console.error('Video API failed:', error instanceof Error ? error.message : 'Unknown error');
    return <main className="page-container py-7"><p role="status" className="text-[13px] text-muted">Video details are temporarily unavailable. Please try again shortly.</p></main>;
  }
  const primary = video.categories[0];
  return <VideoInteractionProvider key={video.slug} slug={video.slug} initialViews={video.card.views} initialRating={video.card.rating}><main>
    {video.structuredData.map((schema, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeStructuredJson(schema) }} />)}
    <section aria-labelledby="video-title" className="mx-auto w-full max-w-[1800px] px-6 py-4 max-md:px-4 max-sm:px-2 max-sm:py-3">
      <div className="w-full max-w-[1100px] max-sm:max-w-none">
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <h1 id="video-title" className="font-heading text-[27px] font-extrabold leading-tight min-w-0 [overflow-wrap:anywhere] max-sm:w-full max-sm:text-[20px]">{video.h1}</h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2"><VideoInteractions slug={video.slug} header /></div>
        </div>
        <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted"><span>{primary?.name || 'Videos'}</span><span>{video.language}</span><span>{video.card.duration === null ? '—' : formatDuration(video.card.duration)}</span>
          {video.uploadDate && <time dateTime={video.uploadDate}>{new Date(video.uploadDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</time>}
          <span className="hd-badge">{video.card.quality}</span></p>
        <EmbedPlayer key={video.slug} title={video.title} servers={video.servers} />
        <VideoInteractions slug={video.slug} description={video.description} bodyText={video.bodyText} />
        <VideoTaxonomy categories={video.categories} tags={video.tags} />
      </div>
    </section>
    <VideoRecommendations key={video.slug} films={video.recommendations} exploreUrl={video.exploreUrl} />
  </main></VideoInteractionProvider>;
}
