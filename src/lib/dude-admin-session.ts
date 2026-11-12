import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'dude_admin_session';
const SESSION_SECONDS = 60 * 60 * 8;

function secret() {
  const value = process.env.ADMIN_PANEL_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('Set ADMIN_PANEL_SESSION_SECRET to a random value of at least 32 characters');
  return value;
}

export function validAdminPassword(value: unknown) {
  const expected = process.env.ADMIN_PANEL_PASSWORD || '';
  if (!expected || typeof value !== 'string') return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createAdminSession() {
  const payload = Buffer.from(JSON.stringify({ expiresAt: Date.now() + SESSION_SECONDS * 1000 })).toString('base64url');
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
  return { value: `${payload}.${signature}`, maxAge: SESSION_SECONDS };
}

export function isValidAdminSession(value?: string) {
  if (!value) return false;
  try {
    const [payload, signature, extra] = value.split('.');
    if (!payload || !signature || extra) return false;
    const expected = createHmac('sha256', secret()).update(payload).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return Number.isSafeInteger(data.expiresAt) && data.expiresAt > Date.now();
  } catch { return false; }
}

export function secureCookie() {
  return process.env.NODE_ENV === 'production' || process.env.SITE_URL?.startsWith('https://') === true;
}
