import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPageNumbers } from '@/lib/pagination';

const button = 'inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-[3px] border px-2 text-[12px] max-sm:min-h-11 max-sm:min-w-11 max-sm:px-3';

export default function Pagination({ currentPage, pageCount, basePath, anchor = 'heading-HD', label = 'HD pagination' }: { currentPage: number; pageCount: number; basePath: string; anchor?: string; label?: string }) {
  if (pageCount <= 1) return null;
  const href = (page: number) => `${basePath}${basePath.includes('?') ? '&' : '?'}page=${page}#${anchor}`;
  return (
    <nav aria-label={label} className="my-8 flex flex-wrap items-center justify-center gap-2 text-[#b7a3cb] max-sm:my-6 max-sm:gap-3">
      {currentPage > 1
        ? <a href={href(currentPage - 1)} aria-label="Previous page" className={`${button} border-line text-white transition-colors hover:border-accent hover:text-accent`}><ChevronLeft size={16} /><span>Previous</span></a>
        : <span aria-disabled="true" aria-label="Previous page" className={`${button} border-line opacity-40`}><ChevronLeft size={16} /><span>Previous</span></span>}
      {getPageNumbers(currentPage, pageCount).map(page => (
        <a key={page} href={href(page)} aria-label={`Page ${page}`} aria-current={page === currentPage ? 'page' : undefined}
          className={`${button} max-sm:hidden ${page === currentPage ? 'border-accent bg-accent text-white' : 'border-line text-white transition-colors hover:border-accent hover:text-accent'}`}>
          {page}
        </a>
      ))}
      <span className="text-[12px] sm:hidden" aria-live="polite">{currentPage} / {pageCount}</span>
      {currentPage < pageCount
        ? <a href={href(currentPage + 1)} aria-label="Next page" className={`${button} border-line text-white transition-colors hover:border-accent hover:text-accent`}><span>Next</span><ChevronRight size={16} /></a>
        : <span aria-disabled="true" aria-label="Next page" className={`${button} border-line opacity-40`}><span>Next</span><ChevronRight size={16} /></span>}
      <span className="w-full pt-2 text-center max-sm:hidden text-[10px] text-[#8e7e9f]">Page {currentPage} of {pageCount}</span>
    </nav>
  );
}
