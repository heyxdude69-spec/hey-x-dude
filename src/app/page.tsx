import CatalogPage from '@/components/catalog/CatalogPage';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  return <CatalogPage {...await searchParams} />;
}
