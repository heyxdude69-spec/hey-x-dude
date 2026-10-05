import { sitemapProxy } from '@/lib/sitemap-proxy';
export const dynamic = 'force-dynamic';
export async function GET() { return sitemapProxy('/sitemap.xml'); }
