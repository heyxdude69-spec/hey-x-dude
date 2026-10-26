'use client';

import Link from 'next/link';
import CategoryPoster from '@/components/catalog/CategoryPoster';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Menu, Search, X } from 'lucide-react';
import type { SearchSuggestion } from '@/lib/search-api';
import type { NavigationCategory } from '@/lib/navigation-api';
import Brand from './Brand';

const iconButton = 'grid min-h-11 min-w-11 shrink-0 place-items-center rounded-[3px] bg-transparent p-[7px] text-white transition-colors hover:text-accent';

export default function Navbar({ categories }: { categories: NavigationCategory[] }) {
  const pathname = usePathname();
  const categoryActive = pathname === '/categories' || pathname.startsWith('/categories/');
  const [open, setOpen] = useState<'menu' | 'search' | null>(null);
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loadedQuery, setLoadedQuery] = useState('');
  const [searchAttempt, setSearchAttempt] = useState(0);
  const search = query.trim().toLowerCase().replace(/\s+/g, ' ');
  useEffect(() => {
    if (open !== 'search') return;
    setSuggestions([]); setSearchState('loading');
    if (search && search.length < 2) { setSearchState('idle'); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(search)}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Search unavailable');
        const data = await response.json();
        if (!Array.isArray(data.videos) || data.videos.length > 7) throw new Error('Invalid suggestions');
        if (controller.signal.aborted) return;
        setSuggestions(data.videos); setLoadedQuery(search); setSearchState('ready');
      } catch { if (!controller.signal.aborted) setSearchState('error'); }
    }, search ? 300 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, search, searchAttempt]);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    let previousY = window.scrollY;
    function onScroll() {
      const currentY = Math.max(0, window.scrollY);
      if (currentY !== previousY) setHidden(currentY > 80 && currentY > previousY);
      previousY = currentY;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault();
        setOpen('search');
      }
    }
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);

  useEffect(() => {
    if (!open || !window.visualViewport) return;
    const visual = window.visualViewport;
    const update = () => setViewport({ height: visual.height, top: visual.offsetTop });
    update();
    visual.addEventListener('resize', update);
    visual.addEventListener('scroll', update);
    return () => {
      visual.removeEventListener('resize', update);
      visual.removeEventListener('scroll', update);
      setViewport(null);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const activePanel = open === 'search' ? panel.current : menuPanel.current;
    const activeTrigger = open === 'search' ? trigger.current : menuTrigger.current;
    if (open === 'search') input.current?.focus();
    else activePanel?.querySelector<HTMLButtonElement>('button')?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(null);
      if (event.key !== 'Tab') return;
      const elements = activePanel?.querySelectorAll<HTMLElement>('button, input, a[href]');
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
      activeTrigger?.focus();
    };
  }, [open]);

  const results = loadedQuery === search ? suggestions : [];

  return (
    <>
      <header data-hidden={hidden && !open} onFocusCapture={() => setHidden(false)} className="fixed inset-x-0 top-0 z-50 h-[80px] border-b border-line bg-[#120d20] shadow-[0_4px_18px_#00000055] transition-transform duration-200 data-[hidden=true]:-translate-y-full max-sm:h-[64px]">
        <nav className="page-container relative flex h-full items-center gap-8 max-md:gap-6 max-sm:gap-2" aria-label="Main navigation">
          <button ref={menuTrigger} aria-label="Open navigation menu" aria-expanded={open === 'menu'} aria-controls="menu-sidebar" onClick={() => setOpen('menu')} className="grid size-11 shrink-0 place-items-center rounded-none border-[0.2px] border-white/50 text-accent transition-colors hover:border-accent active:border-accent aria-expanded:border-accent max-sm:size-11">
            <Menu size={28} strokeWidth={1} className="max-sm:size-6" />
          </button>
          <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2"><Brand priority /></div>
          <div className="ml-auto flex h-full items-center gap-8 text-[13px] text-white max-md:gap-3 max-md:text-[11px] max-[700px]:hidden">
            <Link href="/" aria-current={pathname === '/' ? 'page' : undefined} className="relative flex h-full items-center text-white transition-colors hover:text-accent after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 aria-[current=page]:after:bg-accent aria-[current=page]:text-accent">Home</Link>
            <Link href="/categories" aria-current={categoryActive ? 'page' : undefined} className="relative flex h-full items-center transition-colors hover:text-accent after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 aria-[current=page]:after:bg-accent aria-[current=page]:text-accent">Categories</Link>
          </div>
          <button ref={trigger} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-[3px] p-2.5 text-white transition-colors hover:text-accent max-[700px]:ml-auto max-sm:p-2" aria-label="Open search" aria-controls="search-sidebar" aria-expanded={open === 'search'} onClick={() => setOpen('search')}>
            <Search size={20} />
          </button>
        </nav>
      </header>

      <div className="group/menu invisible fixed inset-0 z-100 transition-[visibility] duration-300 data-[open=true]:visible" data-open={open === 'menu'} aria-hidden={open !== 'menu'} inert={open !== 'menu'}>
        <div className="absolute inset-0 bg-[#090510b3] opacity-0 backdrop-blur-[5px] transition-opacity duration-300 group-data-[open=true]/menu:opacity-100" onClick={() => setOpen(null)} />
        <aside id="menu-sidebar" ref={menuPanel} style={viewport ? { height: viewport.height, top: viewport.top } : undefined} className="absolute top-0 left-0 flex h-dvh w-full max-w-[460px] -translate-x-full flex-col overflow-hidden overscroll-contain border-r border-white/9 bg-[#1a1129] px-5 py-6 transition-transform duration-300 ease-out group-data-[open=true]/menu:translate-x-0 max-sm:px-3 max-sm:py-[18px] [padding-top:max(1.5rem,env(safe-area-inset-top))] [padding-bottom:max(1.5rem,env(safe-area-inset-bottom))]" role="dialog" aria-modal="true" aria-labelledby="menu-title">
          <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
            <h2 id="menu-title" className="font-heading text-[21px] font-bold">Menu</h2>
            <button className={iconButton} aria-label="Close navigation menu" onClick={() => setOpen(null)}><X /></button>
          </div>
          <nav aria-label="Menu navigation" className="min-h-0 flex-1 overflow-y-auto overscroll-contain text-[14px] [overflow-wrap:anywhere]" onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(null); }}>
            <Link href="/" className="flex min-h-11 items-center border-b border-line py-4 text-white transition-colors hover:text-accent">Home</Link>
            <Link href="/categories" className="flex min-h-11 items-center border-b border-line py-4 text-white transition-colors hover:text-accent">All categories</Link>
            {categories.map(category => <Link prefetch={false} key={category.slug} href={`/categories/${category.slug}`} className="flex min-h-11 items-center border-b border-line py-4 text-white transition-colors hover:text-accent">{category.name}</Link>)}
          </nav>
        </aside>
      </div>
      <div className="group/search invisible fixed inset-0 z-100 transition-[visibility] duration-300 data-[open=true]:visible" data-open={open === 'search'} aria-hidden={open !== 'search'} inert={open !== 'search'}>
        <div className="absolute inset-0 bg-[#090510b3] opacity-0 backdrop-blur-[5px] transition-opacity duration-300 group-data-[open=true]/search:opacity-100" onClick={() => setOpen(null)} />
        <aside id="search-sidebar" ref={panel} style={viewport ? { height: viewport.height, top: viewport.top } : undefined} className="absolute top-0 right-0 flex h-dvh w-full max-w-[460px] translate-x-full flex-col overflow-hidden overscroll-contain border-l border-white/9 bg-[#1a1129] px-5 py-6 transition-transform duration-300 ease-out group-data-[open=true]/search:translate-x-0 max-sm:px-3 max-sm:py-[18px] [padding-top:max(1.5rem,env(safe-area-inset-top))] [padding-bottom:max(1.5rem,env(safe-area-inset-bottom))]" role="dialog" aria-modal="true" aria-labelledby="search-title">
          <div className="mb-[18px] flex shrink-0 items-center justify-between gap-2.5">
            <div className="min-w-0">
              <span className="text-[9px] font-bold tracking-[2px] text-[#b9a3d4]">FIND YOUR NEXT WATCH</span>
              <h2 id="search-title" className="mt-2.5 font-heading text-[21px] font-bold tracking-[-0.6px] [overflow-wrap:anywhere] max-sm:text-[19px]">Explore the collection</h2>
            </div>
            <button className={iconButton} aria-label="Close search" onClick={() => setOpen(null)}><X /></button>
          </div>
          <div className="flex shrink-0 items-center gap-2.5 border border-[#765591] bg-[#281b3a] px-[13px] py-[11px] text-[#b39aca] focus-within:border-accent">
            <Search size={20} className="shrink-0" />
<input ref={input} value={query} maxLength={100} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && search.length >= 2 && !event.nativeEvent.isComposing) { setOpen(null); window.location.assign(`/search?q=${encodeURIComponent(search)}`); } }} placeholder="Search titles, tags, categories…" aria-label="Search collection" type="search" enterKeyHint="search" autoComplete="off" spellCheck={false} className="min-w-0 w-full border-0 bg-transparent text-[12px] max-sm:text-[16px] leading-[25px] text-white placeholder:text-[#94809f]" />
            {query && <button className={iconButton} onClick={() => { setQuery(''); input.current?.focus(); }} aria-label="Clear search"><X size={16} /></button>}
          </div>
          <p className="mt-4 mb-3.5 shrink-0 text-[12px] text-[#8e7d9f]" aria-live="polite">{searchState === 'error' ? 'Search is temporarily unavailable' : search && search.length < 2 ? 'Type at least 2 characters' : searchState === 'loading' || loadedQuery !== search ? 'Searching…' : search ? `${results.length} suggestions` : 'Latest in the collection'}</p>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={searchState === 'loading'}>
            {searchState === 'loading' && <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
              {[0, 1, 2].map(index => <div key={index} className="flex items-center gap-3 py-3"><div className="h-[45px] w-20 shrink-0 rounded bg-white/5" /><div className="min-w-0 flex-1 space-y-2"><div className="h-4 w-3/4 rounded bg-white/5" /><div className="h-3 w-1/2 rounded bg-white/5" /></div></div>)}
            </div>}
            {searchState === 'error' && <div className="py-5 text-center">
              <p className="text-[13px] text-muted">Search is temporarily unavailable.</p>
              <button onClick={() => { setSearchAttempt(current => current + 1); input.current?.focus(); }} className="mt-3 min-h-11 rounded-md border border-line px-4 text-[13px] text-white hover:border-accent hover:text-accent">Retry search</button>
            </div>}
            {results.map(film => (
              <Link key={film.id} href={`/${film.slug}`} onClick={() => setOpen(null)} className="flex min-h-11 items-center gap-3 border-b border-line py-3 text-white transition-colors hover:text-accent">
                <div className="relative h-[45px] w-20 shrink-0 overflow-hidden rounded-[3px]"><CategoryPoster url={film.thumbnail} fallbackUrls={film.thumbnailFallbacks} alt="" sizes="80px" /></div>
                <span className="min-w-0 flex-1">
                  <strong className="line-clamp-2 text-[13px] font-medium leading-snug [overflow-wrap:anywhere]">{film.title}</strong>
                  <small className="mt-1 block text-[12px] [overflow-wrap:anywhere] text-[#8e7e9f]">{film.category}{film.category && film.language && <span className="mx-[5px]">·</span>}{film.language}</small>
                </span>
                <ArrowUpRight size={18} className="ml-auto shrink-0" />
              </Link>
            ))}
            {results.length === 0 && searchState === 'ready' && loadedQuery === search && (
              <div className="px-[15px] py-[45px] text-center text-[#a68fbb]">
                <Search size={30} className="mx-auto" />
                <h3 className="my-3 text-[15px] font-bold">No titles found</h3>
                <p className="text-[12px] leading-[1.7]">Try a different title or a genre like adventure.</p>
              </div>
            )}
          </div>
          {search.length >= 2 && <Link href={`/search?q=${encodeURIComponent(search)}`} onClick={() => setOpen(null)} className="mt-3 flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-accent px-4 text-sm text-white hover:bg-accent/20">View all results<ArrowRight size={16} /></Link>}
          <div className="flex shrink-0 justify-between gap-2.5 pt-4 max-sm:hidden text-[10px] text-[#7e6c90]">Something good is waiting to be discovered.<ArrowRight size={16} className="shrink-0" /></div>
        </aside>
      </div>
    </>
  );
}
