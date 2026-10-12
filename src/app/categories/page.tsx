import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getCategoryCards, type CategoryCard } from '@/lib/category-api';
import CategoryPoster from '@/components/catalog/CategoryPoster';

// Request rendering is controlled by the root layout; public fetches have bounded TTLs.

export const metadata = {
  title: 'Categories | KnightWarrior',
  description: 'Browse the latest videos, Indian collection, recommendations and HD videos.',
};

export default async function CategoriesPage() {
  let categories: CategoryCard[];
  let unavailable = false;
  try { categories = await getCategoryCards(); }
  catch (error) {
    console.error('Categories API failed:', error instanceof Error ? error.message : 'Unknown error');
    categories = [];
    unavailable = true;
  }
  return (
    <main className="page-container py-7 max-sm:py-4">
      <h1 className="font-heading text-[30px] font-extrabold leading-tight [overflow-wrap:anywhere] max-sm:text-[24px]">Categories<span className="text-accent">.</span></h1>
      <p className="mt-2 mb-6 text-[13px] text-muted max-sm:mb-4">Find your next watch. Explore videos by collection.</p>
      <div className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        {categories.map(category => {
          return (
            <Link key={category.slug} href={`/categories/${category.slug}`} className="group flex min-w-0 flex-col overflow-hidden border border-line bg-card transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <div className="relative aspect-video overflow-hidden">
                <CategoryPoster url={category.thumbnail.url} alt={category.thumbnail.alt || category.name} sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 350px" />
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              </div>
              <div className="flex flex-1 items-center justify-between gap-2 p-4 max-sm:p-2.5">
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 min-h-[2.75em] [overflow-wrap:anywhere] font-heading text-[19px] font-bold leading-snug group-hover:text-accent max-sm:text-[14px]">{category.name === 'HD' ? 'HD collection' : category.name}</h2>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">{category.videoCount} videos</p>
                </div>
                <ArrowUpRight size={19} className="shrink-0 group-hover:text-accent max-sm:size-4" />
              </div>
            </Link>
          );
        })}
      </div>
      {!categories.length && <div className="rounded-md border border-line px-4 py-8 text-center">
        <p role="status" className="text-[13px] leading-relaxed text-muted">{unavailable ? 'Categories are temporarily unavailable. Please try again shortly.' : 'No categories available yet.'}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {unavailable && <a href="/categories" className="inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 text-[13px] text-white hover:border-accent hover:text-accent">Try again</a>}
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 text-[13px] text-white hover:border-accent hover:text-accent">Home</Link>
        </div>
      </div>}
    </main>
  );
}
