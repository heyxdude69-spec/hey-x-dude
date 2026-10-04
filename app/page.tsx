import { ArrowRight, Sparkles } from 'lucide-react';
import FilmCard from '@/components/FilmCard';
import { films } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const categories = ['Latest', 'Indian', 'HD'] as const;
  const selected = categories.find(name => name === category);

  return (
    <main id="categories" className="container main">
      {categories.filter(name => !selected || name === selected).map(name => (
        <section className="film-section" key={name} aria-labelledby={`heading-${name}`}>
          <div className="section-heading">
            <div>
              <h2 id={`heading-${name}`}>{name === 'HD' ? 'HD collection' : name}<span className="heading-dot">.</span></h2>
              {name === 'Latest' && <span className="new-badge">JUST ADDED</span>}
            </div>
            <a href={`/?category=${name}#categories`} className="see-more">See more<ArrowRight size={16} /></a>
          </div>
          <div className="film-grid">
            {films.filter(film => film.category === name).map(film => <FilmCard key={film.id} film={film} />)}
          </div>
        </section>
      ))}
      <div className="end-note"><span /><Sparkles size={16} /><p>You’ve reached the end. A new story is always on its way.</p><span /></div>
    </main>
  );
}
