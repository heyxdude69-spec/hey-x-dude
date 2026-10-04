import { notFound } from 'next/navigation';
import FilmCard from '@/components/catalog/FilmCard';
import { films, tagSlug } from '@/data/catalog';

export const dynamic = 'force-dynamic';

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tag = films.flatMap(film => film.tags).find(tag => tagSlug(tag) === slug);
  if (!tag) notFound();
  const results = films.filter(film => film.tags.includes(tag));

  return (
    <main className="page-container py-6 max-sm:py-4">
      <h1 className="mb-2 font-heading text-[26px] font-bold">{tag}<span className="text-accent">.</span></h1>
      <p className="mb-5 text-[12px] text-muted">{results.length} videos tagged {tag}</p>
      <div className="grid grid-cols-5 gap-3.5 max-md:grid-cols-4 max-md:gap-2.5 max-sm:grid-cols-2 max-sm:gap-1.5">
        {results.map(film => <FilmCard key={film.id} film={film} />)}
      </div>
    </main>
  );
}
