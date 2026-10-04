import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { categories, films } from '@/data/catalog';

export const metadata = {
  title: 'Categories | KnightWarrior',
  description: 'Browse the latest videos, Indian collection, recommendations and HD videos.',
};

export default function CategoriesPage() {
  return (
    <main className="page-container py-7 max-sm:py-4">
      <h1 className="font-heading text-[30px] font-extrabold max-sm:text-[24px]">Categories<span className="text-accent">.</span></h1>
      <p className="mt-2 mb-6 text-[13px] text-muted max-sm:mb-4">Find your next watch. Explore videos by collection.</p>
      <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2 max-sm:gap-2">
        {categories.map(category => {
          const videos = films.filter(film => film.category === category);
          return (
            <Link key={category} href={`/categories/${category.toLowerCase()}`} className="group overflow-hidden border border-line bg-card transition-colors hover:border-accent">
              <div className="relative aspect-video overflow-hidden">
                <Image src={videos[0].thumbnail} alt="" fill sizes="(max-width: 1000px) 50vw, 350px" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              </div>
              <div className="flex items-center justify-between gap-2 p-4 max-sm:p-2.5">
                <div>
                  <h2 className="font-heading text-[19px] font-bold group-hover:text-accent max-sm:text-[15px]">{category === 'HD' ? 'HD collection' : category}</h2>
                  <p className="mt-1 text-[12px] text-muted max-sm:text-[10px]">{videos.length} videos</p>
                </div>
                <ArrowUpRight size={19} className="shrink-0 group-hover:text-accent" />
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
