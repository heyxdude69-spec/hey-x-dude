import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, isValidAdminSession } from '@/lib/dude-admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowed = [
  /^stats$/,
  /^categories$/,
  /^categories\/[a-f0-9]{24}$/,
  /^videos$/,
  /^videos\/[a-f0-9]{24}$/,
  /^videos\/[a-f0-9]{24}\/sources$/,
  /^sources\/[a-f0-9]{24}$/,
];

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, context, 'GET');
}
export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, context, 'POST');
}
export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, context, 'PATCH');
}
export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, context, 'DELETE');
}

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }, method: string) {
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminSession(cookie)) return NextResponse.json({ error: 'Admin session expired' }, { status: 401 });
  if (method !== 'GET' && request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  const { path } = await context.params;
  const resource = path.join('/');
  if (!allowed.some(pattern => pattern.test(resource))) return NextResponse.json({ error: 'Unknown admin resource' }, { status: 404 });
  const origin = process.env.CATALOG_API_ORIGIN;
  const token = process.env.CATALOG_ADMIN_API_TOKEN;
  if (!origin || !token) return NextResponse.json({ error: 'Admin API is not configured on the server' }, { status: 503 });
  let base: URL;
  try { base = new URL(origin); } catch { return NextResponse.json({ error: 'Invalid admin API origin' }, { status: 500 }); }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    return NextResponse.json({ error: 'Invalid admin API origin' }, { status: 500 });
  }
  const target = new URL(`/api/admin/${resource}`, base);
  target.search = request.nextUrl.search;
  const headers = new Headers({ Authorization: `Bearer ${token}`, Accept: 'application/json' });
  let body: string | undefined;
  if (method === 'POST' || method === 'PATCH') {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 160_000) return NextResponse.json({ error: 'Request is too large' }, { status: 413 });
    body = await request.text();
    if (Buffer.byteLength(body) > 160_000) return NextResponse.json({ error: 'Request is too large' }, { status: 413 });
    headers.set('Content-Type', 'application/json');
  }
  try {
    const upstream = await fetch(target, { method, headers, body, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    const responseBody = await upstream.text();
    return new NextResponse(responseBody, { status: upstream.status, headers: {
      'Cache-Control': 'no-store', 'Content-Type': upstream.headers.get('content-type') || 'application/json',
    } });
  } catch {
    return NextResponse.json({ error: 'Admin API unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
