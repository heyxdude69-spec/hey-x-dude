import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Brand from './Brand';
import type { NavigationCategory } from '@/lib/navigation-api';

export default function Footer({ categories }: { categories: NavigationCategory[] }) {
  return (
    <footer className="border-t border-line bg-[#130d20]">
      <div className="page-container grid grid-cols-[1.5fr_1fr] items-start gap-x-10 gap-y-6 py-7 max-sm:grid-cols-1 max-sm:gap-y-5 max-sm:py-4">
        <div className="min-w-0">
          <Brand large />
          <p className="mt-2 max-w-[260px] text-[12px] leading-relaxed text-[#9a89ad] max-sm:text-[11px]">
            A world of stories. A place to discover them.
          </p>
        </div>
        <nav aria-label="Footer navigation" className="pt-5 max-sm:pt-0">
          <h2 className="mb-4 font-heading text-[13px] font-bold text-[#e0d4ec]">Explore</h2>
          <div className="flex flex-col gap-3 text-[12px] text-white">
            <Link href="/" className="flex items-center gap-2 transition-colors hover:text-accent">Home<ArrowUpRight size={14} /></Link>
            <Link href="/categories" className="flex items-center gap-2 transition-colors hover:text-accent">All categories<ArrowUpRight size={14} /></Link>
          </div>
        </nav>
        <nav aria-label="Footer categories" className="col-span-full min-w-0 border-t border-line pt-5 max-sm:pt-4">
          <h2 className="mb-4 font-heading text-[13px] font-bold text-[#e0d4ec]">Categories</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12px] text-white sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {categories.map(category => (
              <Link prefetch={false} key={category.slug} href={`/categories/${category.slug}`} className="flex min-w-0 items-start gap-2 leading-relaxed transition-colors hover:text-accent">
                <span className="min-w-0 [overflow-wrap:anywhere]">{category.name}</span><ArrowUpRight size={14} className="mt-0.5 shrink-0" />
              </Link>
            ))}
          </div>
        </nav>
      </div>
      <div className="page-container flex flex-wrap justify-between gap-2 border-t border-line py-3 text-[10px] text-[#80718f] max-sm:text-[9px]">
        <span>© {new Date().getFullYear()} KnightWarrior. All rights reserved.</span>
        <span>Made for the love of cinema.</span>
      </div>
    </footer>
  );
}
