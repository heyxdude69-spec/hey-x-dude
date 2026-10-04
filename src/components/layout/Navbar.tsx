'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Clapperboard, Menu, Search, X } from 'lucide-react';
import { artTones, categories, films } from '@/lib/catalog';
import Brand from './Brand';

const iconButton = 'grid place-items-center rounded-[3px] bg-transparent p-[7px] text-[#b6a6c8] hover:bg-white/4';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    input.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const elements = panel.current?.querySelectorAll<HTMLElement>('button, input, a[href]');
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
      trigger.current?.focus();
    };
  }, [open]);

  const search = query.trim().toLowerCase();
  const results = films.filter(film => `${film.title} ${film.category} ${film.genre}`.toLowerCase().includes(search)).slice(0, 7);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-[90px] border-b border-line bg-[#120d20] max-sm:h-[72px]">
        <nav className="page-container relative flex h-full items-center gap-8 max-md:gap-6 max-sm:gap-2" aria-label="Main navigation">
          <div className="size-11 shrink-0 rounded-none border border-[#3d3d3d] max-sm:size-10">
          <details className="relative h-full">
            <summary aria-label="Toggle navigation menu" className="grid h-full w-full cursor-pointer list-none place-items-center rounded-none text-white [&::-webkit-details-marker]:hidden"><Menu size={28} strokeWidth={1} className="max-sm:size-6" /></summary>
            <nav aria-label="Menu navigation" className="absolute top-full left-0 mt-3 flex w-52 flex-col border border-line bg-[#1a1129] p-2 text-[13px] shadow-xl" onClick={event => { if ((event.target as HTMLElement).closest('a')) event.currentTarget.closest('details')?.removeAttribute('open'); }}>
              <Link href="/" className="p-3 hover:bg-white/5">Home</Link>
              {categories.map(category => <Link key={category} href={`/category/${category.toLowerCase()}`} className="p-3 hover:bg-white/5">{category === 'HD' ? 'HD collection' : category}</Link>)}
            </nav>
          </details>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2"><Brand priority /></div>
          <div className="ml-auto flex h-full items-center gap-8 text-[13px] text-[#a89bb9] max-md:gap-3 max-md:text-[11px] max-sm:h-auto max-sm:flex-col max-sm:gap-1 max-sm:text-[9px]">
            <Link href="/" className="relative flex h-full items-center text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#bda1e3]">Home</Link>
            <Link href="/#categories" className="flex h-full items-center hover:text-white">Categories</Link>
          </div>
          <button ref={trigger} className="grid place-items-center rounded-[3px] p-2.5 text-[#b3a7c3] max-sm:p-2" aria-label="Open search" aria-expanded={open} onClick={() => setOpen(true)}>
            <Search size={20} />
          </button>
        </nav>
      </header>

      <div className="group/search invisible fixed inset-0 z-100 transition-[visibility] duration-300 data-[open=true]:visible" data-open={open} aria-hidden={!open} inert={!open}>
        <div className="absolute inset-0 bg-[#090510b3] opacity-0 backdrop-blur-[5px] transition-opacity duration-300 group-data-[open=true]/search:opacity-100" onClick={() => setOpen(false)} />
        <aside ref={panel} className="absolute top-0 right-0 flex h-dvh w-full max-w-[460px] translate-x-full flex-col overflow-y-auto border-l border-white/9 bg-[#1a1129] px-5 py-6 transition-transform duration-300 ease-out group-data-[open=true]/search:translate-x-0 max-sm:px-3 max-sm:py-[18px]" role="dialog" aria-modal="true" aria-labelledby="search-title">
          <div className="mb-[18px] flex items-center justify-between gap-2.5">
            <div>
              <span className="text-[9px] font-bold tracking-[2px] text-[#b9a3d4]">FIND YOUR NEXT WATCH</span>
              <h2 id="search-title" className="mt-2.5 font-heading text-[21px] font-bold tracking-[-0.6px]">Explore the collection</h2>
            </div>
            <button className={iconButton} aria-label="Close search" onClick={() => setOpen(false)}><X /></button>
          </div>
          <div className="flex items-center gap-2.5 border border-[#765591] bg-[#281b3a] px-[13px] py-[11px] text-[#b39aca] focus-within:border-[#c09bdf]">
            <Search size={20} className="shrink-0" />
            <input ref={input} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search titles, genres, categories…" aria-label="Search collection" className="min-w-0 w-full border-0 bg-transparent text-[12px] leading-[25px] text-white placeholder:text-[#94809f]" />
            {query && <button className={iconButton} onClick={() => { setQuery(''); input.current?.focus(); }} aria-label="Clear search"><X size={16} /></button>}
          </div>
          <p className="mt-[25px] mb-3.5 text-[10px] text-[#8e7d9f]" aria-live="polite">{search ? `${results.length} suggestions` : 'Popular in the collection'}</p>
          <div>
            {results.map(film => (
              <Link key={film.id} href={`/category/${film.category.toLowerCase()}#film-${film.id}`} onClick={() => setOpen(false)} className="flex items-center gap-3 border-b border-line py-3">
                <span className={`grid h-[52px] w-16 shrink-0 place-items-center rounded-[3px] text-[#b49bcc] ${artTones[film.tone]}`}><Clapperboard size={22} /></span>
                <span>
                  <strong className="block text-[12px] font-medium">{film.title}</strong>
                  <small className="mt-[7px] block text-[10px] text-[#8e7e9f]">{film.genre}<span className="mx-[5px]">·</span>{film.category}</small>
                </span>
                <ArrowUpRight size={18} className="ml-auto shrink-0 text-[#9b83b0]" />
              </Link>
            ))}
            {results.length === 0 && (
              <div className="px-[15px] py-[45px] text-center text-[#a68fbb]">
                <Search size={30} className="mx-auto" />
                <h3 className="my-3 text-[15px] font-bold">No titles found</h3>
                <p className="text-[12px] leading-[1.7]">Try a different title or a genre like adventure.</p>
              </div>
            )}
          </div>
          <div className="mt-auto flex justify-between gap-2.5 pt-[30px] text-[10px] text-[#7e6c90]">Something good is waiting to be discovered.<ArrowRight size={16} className="shrink-0" /></div>
        </aside>
      </div>
    </>
  );
}
