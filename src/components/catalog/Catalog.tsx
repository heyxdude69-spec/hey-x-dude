import { ArrowRight } from 'lucide-react';
import FilmCard from '@/components/catalog/FilmCard';
import type { HomeData } from '@/lib/home-api';
import Pagination from './Pagination';

export default function Catalog({ data }: { data: HomeData }) {
  const selected = !!data.selectedSection;
  const sections = data.sections.filter(row => row.films.length);

  return (
    <main className="page-container pt-1.5 max-sm:pt-0">
      {sections.map(section => (
        <section key={section.key} className="border-b border-line py-5 last:border-b-0 max-sm:py-3" aria-labelledby={`heading-${section.key}`}>
          <div className="mb-3 flex items-center justify-between max-sm:mb-2">
            <div className="flex items-center gap-[11px]">
              <h2 id={`heading-${section.key}`} className="font-heading text-[22px] font-extrabold tracking-[-0.7px] max-sm:text-[20px]">{section.title}<span className="text-accent">.</span></h2>
              {section.badgeText && <span className="ml-[3px] rounded-[3px] border border-[#79619355] bg-[#30213e] px-1.5 py-1 text-[7px] tracking-[1px] text-[#bba1d1]">{section.badgeText}</span>}
            </div>
            <a href={section.seeMoreUrl} className="flex items-center gap-[9px] text-[11px] text-white transition-colors hover:text-accent">{section.seeMoreLabel}<ArrowRight size={16} /></a>
          </div>
          <div className={`grid grid-cols-5 gap-3.5 max-md:grid-cols-4 max-md:gap-2.5 max-sm:grid-cols-2 max-sm:gap-1.5 ${!selected ? 'max-md:[&>article:last-child]:hidden' : ''}`}>
            {section.films.map(film => <FilmCard key={film.id} film={film} />)}
          </div>
          {section.paginate && <Pagination currentPage={section.pagination.currentPage} pageCount={section.pagination.pageCount}
            basePath={selected ? `/?section=${section.key}` : '/'} anchor={`heading-${section.key}`} label={`${section.title} pagination`} />}
        </section>
      ))}
      {!sections.length && <p role="status" className="py-5 text-[13px] text-muted">{data.emptyMessage}</p>}
    </main>
  );
}
