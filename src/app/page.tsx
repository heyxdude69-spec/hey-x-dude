import Catalog from '@/components/catalog/Catalog';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  return <Catalog {...await searchParams} />;
}
