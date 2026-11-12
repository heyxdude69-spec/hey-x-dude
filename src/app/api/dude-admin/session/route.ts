import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, createAdminSession, isValidAdminSession, secureCookie, validAdminPassword } from '@/lib/dude-admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: 'strict' as const, secure: secureCookie(), path: '/', maxAge };
}

export async function GET(request: NextRequest) {
  const configured = !!process.env.ADMIN_PANEL_PASSWORD && (process.env.ADMIN_PANEL_SESSION_SECRET?.length || 0) >= 32 &&
    !!process.env.CATALOG_ADMIN_API_TOKEN && !!process.env.CATALOG_API_ORIGIN;
  return NextResponse.json({ configured, authenticated: isValidAdminSession(request.cookies.get(ADMIN_COOKIE)?.value) }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 2048) return NextResponse.json({ error: 'Request is too large' }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const password = body && typeof body === 'object' ? (body as { password?: unknown }).password : undefined;
  if (!validAdminPassword(password)) return NextResponse.json({ error: 'Incorrect admin password' }, { status: 401 });
  let session: ReturnType<typeof createAdminSession>;
  try { session = createAdminSession(); }
  catch { return NextResponse.json({ error: 'Admin panel is not configured on the server' }, { status: 503 }); }
  const response = NextResponse.json({ authenticated: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(ADMIN_COOKIE, session.value, cookieOptions(session.maxAge));
  return response;
}

export async function DELETE(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const response = NextResponse.json({ authenticated: false }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(ADMIN_COOKIE, '', cookieOptions(0));
  return response;
}
