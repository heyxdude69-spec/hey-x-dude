import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ slug: string; resource: string }> };
async function proxy(request: NextRequest, context: Context) {
  const { slug, resource } = await context.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180 || !['interactions', 'comments'].includes(resource)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (request.method === 'POST' && request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }
  const secret = process.env.INTERACTION_PROXY_SECRET, base = process.env.CATALOG_API_ORIGIN;
  if (!secret || secret.length < 32 || !base) return NextResponse.json({ error: 'Interaction service unavailable' }, { status: 503 });
  const currentCookie = request.cookies.get('catalog_visitor')?.value;
  const visitor = currentCookie && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(currentCookie) ? currentCookie : randomUUID();
  try {
    const origin = new URL(base);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid API origin');
    const url = new URL(`/api/videos/${slug}/${resource}`, origin);
    if (resource === 'comments' && request.nextUrl.searchParams.has('before')) url.searchParams.set('before', request.nextUrl.searchParams.get('before')!);
    let body: string | undefined;
    if (request.method === 'POST') {
      if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'JSON required' }, { status: 415 });
      body = await request.text();
      if (Buffer.byteLength(body) > 12000) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    }
    const upstream = await fetch(url, { method: request.method, cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-Interaction-Secret': secret, 'X-Visitor-Id': visitor }, body });
    const response = NextResponse.json(await upstream.json(), { status: upstream.status, headers: { 'Cache-Control': 'no-store' } });
    if (visitor !== currentCookie) response.cookies.set('catalog_visitor', visitor, { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: 31536000 });
    return response;
  } catch { return NextResponse.json({ error: 'Interaction service temporarily unavailable' }, { status: 503 }); }
}
export const GET = proxy;
export const POST = proxy;
