import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getCategoryCards, type CategoryCard } from '@/lib/category-api';
import CategoryPoster from '@/components/catalog/CategoryPoster';

export const dynamic = 'force-dynamic';

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
      <h1 className="font-heading text-[30px] font-extrabold max-sm:text-[24px]">Categories<span className="text-accent">.</span></h1>
      <p className="mt-2 mb-6 text-[13px] text-muted max-sm:mb-4">Find your next watch. Explore videos by collection.</p>
      <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2 max-sm:gap-2">
        {categories.map(category => {
          return (
            <Link key={category.slug} href={`/categories/${category.slug}`} className="group overflow-hidden border border-line bg-card transition-colors hover:border-accent">
              <div className="relative aspect-video overflow-hidden">
                <CategoryPoster url={category.thumbnail.url} alt={category.thumbnail.alt || category.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              </div>
              <div className="flex items-center justify-between gap-2 p-4 max-sm:p-2.5">
                <div>
                  <h2 className="font-heading text-[19px] font-bold group-hover:text-accent max-sm:text-[15px]">{category.name === 'HD' ? 'HD collection' : category.name}</h2>
                  <p className="mt-1 text-[12px] text-muted max-sm:text-[10px]">{category.videoCount} videos</p>
                </div>
                <ArrowUpRight size={19} className="shrink-0 group-hover:text-accent" />
              </div>
            </Link>
          );
        })}
      </div>
      {!categories.length && <p role="status" className="text-[13px] text-muted">{unavailable ? 'Categories are temporarily unavailable. Please try again shortly.' : 'No categories available yet.'}</p>}
    </main>
  );
}
