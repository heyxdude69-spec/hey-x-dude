'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Clapperboard, Search, X, ArrowRight } from 'lucide-react';
import { films } from '@/lib/catalog';

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
        event.preventDefault(); setOpen(true);
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
      if (event.key === 'Tab') {
        const elements = panel.current?.querySelectorAll<HTMLElement>('button, input, a[href]');
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', onKey); trigger.current?.focus(); };
  }, [open]);
  const search = query.trim().toLowerCase();
  const results = films.filter(film => `${film.title} ${film.category} ${film.genre}`.toLowerCase().includes(search)).slice(0, 7);
  return <>
    <header className="header"><nav className="nav container" aria-label="Main navigation">
      <Link href="/" className="brand"><Image src="/logo.png" alt="heyXdude home" width={120} height={80} className="brand-logo" priority /></Link>
      <div className="nav-links"><Link href="/" className="active">Home</Link><Link href="/#categories">Categories</Link></div>
      <button ref={trigger} className="search-toggle" aria-label="Open search" aria-expanded={open} onClick={() => setOpen(true)}><Search size={20} /></button>
    </nav></header>
    <div className={`search-layer ${open ? 'is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <div className="search-backdrop" onClick={() => setOpen(false)} />
      <aside ref={panel} className="search-panel" role="dialog" aria-modal="true" aria-labelledby="search-title">
        <div className="search-heading"><div><span className="eyebrow">FIND YOUR NEXT WATCH</span><h2 id="search-title">Explore the collection</h2></div><button className="icon-button" aria-label="Close search" onClick={() => setOpen(false)}><X /></button></div>
        <div className="search-field"><Search size={20} /><input ref={input} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search titles, genres, categories…" aria-label="Search collection" />{query && <button className="icon-button" onClick={() => { setQuery(''); input.current?.focus(); }} aria-label="Clear search"><X size={16} /></button>}</div>
        <p className="search-caption" aria-live="polite">{query.trim() ? `${results.length} suggestions` : 'Popular in the collection'}</p>
        <div className="suggestions">{results.map(film => <Link key={film.id} href={`/#film-${film.id}`} onClick={() => setOpen(false)}><span className={`suggestion-art tone-${film.tone}`}><Clapperboard size={22} /></span><span><strong>{film.title}</strong><small>{film.genre} <span>·</span> {film.category}</small></span><ArrowUpRight size={18} /></Link>)}{results.length === 0 && <div className="empty-search"><Search size={30} /><h3>No titles found</h3><p>Try a different title or a genre like adventure.</p></div>}</div>
        <div className="search-bottom">Something good is waiting to be discovered.<ArrowRight size={16} /></div>
      </aside>
    </div>
  </>;
}
