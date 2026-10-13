import { NextRequest, NextResponse } from 'next/server';
import { getCategoryBatch } from '@/lib/category-api';
export async function GET(request: NextRequest) {
  const values = request.nextUrl.searchParams;
  const cursor = values.get('cursor');
  if (!cursor || cursor.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cursor) || [...values.keys()].some(key => key !== 'cursor') || values.getAll('cursor').length !== 1) return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
  try { return NextResponse.json(await getCategoryBatch(cursor), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Categories unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
