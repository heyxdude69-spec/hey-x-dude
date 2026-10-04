import { notFound } from 'next/navigation';
import CatalogPage from '@/components/catalog/CatalogPage';
import { categories } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const category = categories.find(name => name.toLowerCase() === slug);
  if (!category) notFound();
  const { page } = await searchParams;
  return <CatalogPage category={category} page={page} />;
}
