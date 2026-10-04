import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPageNumbers } from '@/lib/pagination';

const button = 'inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-[3px] border px-2 text-[12px] max-sm:min-h-8 max-sm:min-w-8 max-sm:px-1';

export default function Pagination({ currentPage, pageCount, basePath }: { currentPage: number; pageCount: number; basePath: string }) {
  const href = (page: number) => `${basePath}${basePath.includes('?') ? '&' : '?'}page=${page}#heading-HD`;
  return (
    <nav aria-label="HD pagination" className="my-8 flex flex-wrap items-center justify-center gap-2 text-[#b7a3cb] max-sm:my-6 max-sm:gap-1">
      {currentPage > 1
        ? <a href={href(currentPage - 1)} aria-label="Previous page" className={`${button} border-line hover:bg-white/5`}><ChevronLeft size={16} /><span className="max-sm:hidden">Previous</span></a>
        : <span aria-disabled="true" aria-label="Previous page" className={`${button} border-line opacity-40`}><ChevronLeft size={16} /><span className="max-sm:hidden">Previous</span></span>}
      {getPageNumbers(currentPage, pageCount).map(page => (
        <a key={page} href={href(page)} aria-label={`Page ${page}`} aria-current={page === currentPage ? 'page' : undefined}
          className={`${button} ${page === currentPage ? 'border-[#ed145b] bg-[#ed145b] text-white' : 'border-line hover:bg-white/5'}`}>
          {page}
        </a>
      ))}
      {currentPage < pageCount
        ? <a href={href(currentPage + 1)} aria-label="Next page" className={`${button} border-line hover:bg-white/5`}><span className="max-sm:hidden">Next</span><ChevronRight size={16} /></a>
        : <span aria-disabled="true" aria-label="Next page" className={`${button} border-line opacity-40`}><span className="max-sm:hidden">Next</span><ChevronRight size={16} /></span>}
      <span className="w-full pt-2 text-center text-[10px] text-[#8e7e9f]">Page {currentPage} of {pageCount}</span>
    </nav>
  );
}
