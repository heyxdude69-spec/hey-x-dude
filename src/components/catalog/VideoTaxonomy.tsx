import Link from 'next/link';

type Props = { categories: { slug: string; name: string }[]; tags: string[] };
const chip = 'badge max-w-full whitespace-normal [overflow-wrap:anywhere] px-3 py-1.5 transition-colors hover:border-accent hover:text-accent max-sm:min-h-11';
export default function VideoTaxonomy({ categories, tags }: Props) {
  return <dl className="mt-5 space-y-4 border-t border-line pt-4 text-[12px]">
    {!!categories.length && <div><dt className="mb-2 text-white/60">Categories:</dt><dd className="flex flex-wrap gap-2">
      {categories.map(category => <Link key={category.slug} href={`/categories/${category.slug}`} className={`${chip} text-white`}>{category.name}</Link>)}
    </dd></div>}
    {!!tags.length && <div><dt className="mb-2 text-white/60">Tags:</dt><dd>
      <div className="flex flex-wrap gap-2">{tags.slice(0, 6).map(tag => <Link key={tag} href={`/tag/${tag}`} className={chip}>{tag}</Link>)}</div>
      {tags.length > 6 && <details className="group mt-2">
        <summary className="w-fit cursor-pointer rounded-md px-2 py-3 text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          <span className="group-open:hidden">Show all tags ({tags.length})</span><span className="hidden group-open:inline">Show fewer tags</span>
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">{tags.slice(6).map(tag => <Link key={tag} href={`/tag/${tag}`} className={chip}>{tag}</Link>)}</div>
      </details>}
    </dd></div>}
  </dl>;
}
