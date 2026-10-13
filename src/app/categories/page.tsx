import Link from 'next/link';
import CategoryGrid from '@/components/catalog/CategoryGrid';
import { getCategoryBatch, type CategoryCard } from '@/lib/category-api';

// Request rendering is controlled by the root layout; public fetches have bounded TTLs.

export const metadata = {
  title: 'Categories | KnightWarrior',
  description: 'Browse the latest videos, Indian collection, recommendations and HD videos.',
};

export default async function CategoriesPage() {
  let categories: CategoryCard[];
  let unavailable = false;
  let nextCursor: string | null = null;
  try { const batch = await getCategoryBatch(); categories = batch.categories; nextCursor = batch.nextCursor; }
  catch (error) {
    console.error('Categories API failed:', error instanceof Error ? error.message : 'Unknown error');
    categories = [];
    unavailable = true;
  }
  return (
    <main className="page-container py-7 max-sm:py-4">
      <h1 className="font-heading text-[30px] font-extrabold leading-tight [overflow-wrap:anywhere] max-sm:text-[24px]">Categories<span className="text-accent">.</span></h1>
      <p className="mt-2 mb-6 text-[13px] text-muted max-sm:mb-4">Find your next watch. Explore videos by collection.</p>
      <CategoryGrid initial={categories} initialCursor={nextCursor} />
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
