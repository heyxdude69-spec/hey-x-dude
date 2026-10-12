import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { parseSuggestions } from '@/lib/search-api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') || '';
  if (q.length > 100 || [...request.nextUrl.searchParams.keys()].some(key => key !== 'q')) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const secret = process.env.INTERACTION_PROXY_SECRET, base = process.env.CATALOG_API_ORIGIN;
  const rating = process.env.CATALOG_CONTENT_RATING || 'general';
  if (!base || !secret || secret.length < 32 || !['general', 'adult'].includes(rating)) return NextResponse.json({ error: 'Search unavailable' }, { status: 503 });
  const cookie = request.cookies.get('catalog_visitor')?.value;
  const visitor = cookie && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(cookie) ? cookie : randomUUID();
  try {
    const origin = new URL(base);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid API origin');
    const url = new URL('/api/search', origin);
    url.searchParams.set('q', q); url.searchParams.set('rating', rating);
    const upstream = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000),
      headers: { 'X-Interaction-Secret': secret, 'X-Visitor-Id': visitor } });
    if (!upstream.ok) return NextResponse.json({ error: 'Search unavailable' }, { status: upstream.status === 429 ? 429 : 503, headers: { 'Cache-Control': 'no-store' } });
    const videos = parseSuggestions(await upstream.json());
    const response = NextResponse.json({ videos }, { headers: { 'Cache-Control': 'no-store' } });
    if (visitor !== cookie) response.cookies.set('catalog_visitor', visitor, { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: 31536000 });
    return response;
  } catch { return NextResponse.json({ error: 'Search temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
