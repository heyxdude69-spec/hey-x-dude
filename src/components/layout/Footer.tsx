import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Brand from './Brand';
import { categories } from '@/lib/catalog';

export default function Footer() {
  return (
    <footer className="border-t border-line bg-[#130d20]">
      <div className="page-container grid grid-cols-[1.5fr_1fr_1fr] items-start gap-10 py-7 max-sm:grid-cols-2 max-sm:gap-x-6 max-sm:gap-y-5 max-sm:py-4">
        <div className="max-sm:col-span-2">
          <Brand large />
          <p className="mt-2 max-w-[260px] text-[12px] leading-relaxed text-[#9a89ad] max-sm:text-[11px]">
            A world of stories. A place to discover them.
          </p>
        </div>
        <nav aria-label="Footer navigation" className="pt-5 max-sm:pt-0">
          <h2 className="mb-4 font-heading text-[13px] font-bold text-[#e0d4ec]">Explore</h2>
          <div className="flex flex-col gap-3 text-[12px] text-[#a393b5]">
            <Link href="/" className="flex items-center gap-2 hover:text-white">Home<ArrowUpRight size={14} /></Link>
            <Link href="/#categories" className="flex items-center gap-2 hover:text-white">All categories<ArrowUpRight size={14} /></Link>
          </div>
        </nav>
        <nav aria-label="Footer categories" className="pt-5 max-sm:pt-0">
          <h2 className="mb-4 font-heading text-[13px] font-bold text-[#e0d4ec]">Categories</h2>
          <div className="flex flex-col gap-3 text-[12px] text-[#a393b5]">
            {categories.map(category => (
              <Link key={category} href={`/category/${category.toLowerCase()}`} className="flex items-center gap-2 hover:text-white">
                {category === 'HD' ? 'HD collection' : category}<ArrowUpRight size={14} />
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
