export async function sitemapProxy(path: string) {
  const base = process.env.CATALOG_API_ORIGIN;
  if (!base) return new Response('Sitemap unavailable', { status: 503 });
  try {
    const origin = new URL(base);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid API origin');
    const upstream = await fetch(new URL(path, origin), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) return new Response('Sitemap unavailable', { status: upstream.status });
    return new Response(upstream.body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  } catch { return new Response('Sitemap temporarily unavailable', { status: 503 }); }
}
