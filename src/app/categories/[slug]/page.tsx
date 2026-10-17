import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cache } from 'react';
import FilmCard from '@/components/catalog/FilmCard';
import Pagination from '@/components/catalog/Pagination';
import { CategoryNotFound, getCategoryVideos, normalizeCategoryPage } from '@/lib/category-videos-api';
import { siteOrigin } from '@/lib/video-api';

// Request rendering is controlled by the root layout; public fetches have bounded TTLs.
const loadCategory = cache(getCategoryVideos);
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = normalizeCategoryPage((await searchParams).page);
  try {
    const data = await loadCategory(slug, page);
    const suffix = data.pagination.currentPage > 1 ? ` — Page ${data.pagination.currentPage}` : '';
    const title = `${data.category.seo.title || data.category.name}${suffix} | HeyxDude`;
    const description = data.category.seo.metaDescription || data.category.description;
    const canonical = new URL(`/categories/${slug}${page > 1 ? `?page=${page}` : ''}`, siteOrigin()).href;
    return { title, alternates: { canonical },
      openGraph: { type: 'website', title, description, url: canonical },
      twitter: { card: 'summary', title, description },
      description: data.category.seo.metaDescription || data.category.description,
      robots: { index: data.category.seo.indexAllowed !== false && data.films.length > 0, follow: true } };
  } catch {
    return { title: 'Category unavailable | HeyxDude', robots: { index: false, follow: true } };
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = normalizeCategoryPage((await searchParams).page);
  let data;
  try { data = await loadCategory(slug, page); }
  catch (error) {
    if (error instanceof CategoryNotFound) notFound();
    console.error('Category videos API failed:', error instanceof Error ? error.message : 'Unknown error');
    return <main className="page-container py-7 max-sm:py-4"><p role="status" className="text-[13px] text-muted">Videos are temporarily unavailable. Please try again shortly.</p><Link href="/categories" className="mt-3 inline-flex min-h-11 items-center text-[13px] text-white hover:text-accent">All categories</Link></main>;
  }
  const { category, films, pagination } = data;
  const canonical = new URL(`/categories/${category.slug}${pagination.currentPage > 1 ? `?page=${pagination.currentPage}` : ''}`, siteOrigin()).href;
  const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: category.name, url: canonical,
    description: category.seo.metaDescription || category.description,
    mainEntity: { '@type': 'ItemList', itemListElement: films.map((film, index) => ({ '@type': 'ListItem', position: index + 1,
      name: film.title, url: new URL(`/${film.slug}`, canonical).href })) } };
  return <>
    {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />}
    <nav aria-label="Breadcrumb" className="page-container flex flex-wrap items-center gap-y-1 pt-5 text-[12px] text-muted max-sm:pt-3 [overflow-wrap:anywhere]"><Link href="/categories" className="inline-flex min-h-11 items-center text-white hover:text-accent">Categories</Link><span className="mx-2" aria-hidden="true">/</span><span aria-current="page">{category.name}</span></nav>
    <main className="page-container pt-1.5 max-sm:pt-0">
      <section className="border-b border-line py-5 last:border-b-0 max-sm:py-3" aria-labelledby="category-heading">
        <div className="mb-3 min-w-0 max-sm:mb-2">
          <div className="flex min-w-0 flex-wrap items-center gap-[11px]">
            <h1 id="category-heading" className="min-w-0 [overflow-wrap:anywhere] font-heading text-[22px] font-extrabold leading-snug tracking-[-0.7px] max-sm:text-[20px]">{category.name === 'HD' ? 'HD collection' : category.name}<span className="text-accent">.</span></h1>
            {category.name === 'Latest' && <span className="ml-[3px] rounded-[3px] border border-[#79619355] bg-[#30213e] px-1.5 py-1 text-[7px] tracking-[1px] text-[#bba1d1]">JUST ADDED</span>}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3.5 max-md:grid-cols-4 max-md:gap-2.5 max-sm:grid-cols-2 max-sm:gap-1.5">
          {films.map(film => <FilmCard key={film.id} film={film} compactOnMobile />)}
        </div>
        {!films.length && <div className="rounded-md border border-line px-4 py-8 text-center"><p role="status" className="text-[13px] text-muted">No published videos in this category yet.</p><Link href="/categories" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 text-[13px] text-white hover:border-accent hover:text-accent">All categories</Link></div>}
        <Pagination currentPage={pagination.currentPage} pageCount={pagination.pageCount}
          basePath={`/categories/${category.slug}`} anchor="category-heading" label={`${category.name} pagination`} />
      </section>
    </main>
  </>;
}
