import { sitemapProxy } from '@/lib/sitemap-proxy';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^videos-[0-9]+-[a-f0-9-]+-[0-9]+\.xml$/.test(file)) return new Response('Not found', { status: 404 });
  return sitemapProxy(`/sitemaps/${file}`);
}
