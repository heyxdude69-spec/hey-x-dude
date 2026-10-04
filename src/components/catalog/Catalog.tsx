import { ArrowRight } from 'lucide-react';
import FilmCard from '@/components/catalog/FilmCard';
import { categories, films } from '@/data/catalog';
import Pagination from './Pagination';

export default function Catalog({ category, page }: { category?: string; page?: string }) {
  const selected = categories.find(name => name === category);
  const hdFilms = films.filter(film => film.category === 'HD');
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(hdFilms.length / pageSize));
  const currentPage = Math.min(pageCount, Math.max(1, Math.floor(Number(page) || 1)));

  return (
    <main className="page-container pt-1.5 max-sm:pt-0">
      {categories.filter(name => !selected || name === selected).map(name => (
        <section key={name} className="border-b border-line py-5 last:border-b-0 max-sm:py-3" aria-labelledby={`heading-${name}`}>
          <div className="mb-3 flex items-center justify-between max-sm:mb-2">
            <div className="flex items-center gap-[11px]">
              <h2 id={`heading-${name}`} className="font-heading text-[22px] font-extrabold tracking-[-0.7px] max-sm:text-[20px]">{name === 'HD' ? 'HD collection' : name}<span className="text-accent">.</span></h2>
              {name === 'Latest' && <span className="ml-[3px] rounded-[3px] border border-[#79619355] bg-[#30213e] px-1.5 py-1 text-[7px] tracking-[1px] text-[#bba1d1]">JUST ADDED</span>}
            </div>
            <a href={`/categories/${name.toLowerCase()}`} className="flex items-center gap-[9px] text-[11px] text-white transition-colors hover:text-accent">See more<ArrowRight size={16} /></a>
          </div>
          <div className={`grid grid-cols-5 gap-3.5 max-md:grid-cols-4 max-md:gap-2.5 max-sm:grid-cols-2 max-sm:gap-1.5 ${!selected ? 'max-md:[&>article:last-child]:hidden' : ''}`}>
            {(name === 'HD' ? hdFilms.slice((currentPage - 1) * pageSize, currentPage * pageSize) : films.filter(film => film.category === name)).map(film => <FilmCard key={film.id} film={film} />)}
          </div>
          {name === 'HD' && <Pagination currentPage={currentPage} pageCount={pageCount} basePath={selected ? '/categories/hd' : '/'} />}
        </section>
      ))}
    </main>
  );
}
