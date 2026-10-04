import { notFound } from 'next/navigation';
import Link from 'next/link';
import Catalog from '@/components/catalog/Catalog';
import { categories } from '@/data/catalog';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const category = categories.find(name => name.toLowerCase() === slug);
  if (!category) notFound();
  const { page } = await searchParams;
  return <><nav aria-label="Breadcrumb" className="page-container pt-5 text-[12px] text-muted"><Link href="/categories" className="text-white hover:text-accent">Categories</Link><span className="mx-2" aria-hidden="true">/</span><span aria-current="page">{category}</span></nav><Catalog category={category} page={page} /></>;
}
