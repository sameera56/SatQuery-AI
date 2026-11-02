import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const SHARE_ROOT = path.join(process.cwd(), 'data', 'satquery-shares');

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Invalid image.', { status: 400 });
  try {
    const meta = JSON.parse(await readFile(path.join(SHARE_ROOT, `${id}.json`), 'utf8')) as { imageMimeType?: string };
    await stat(path.join(SHARE_ROOT, `${id}.image`));
    return new NextResponse(await readFile(path.join(SHARE_ROOT, `${id}.image`)), { headers: { 'Content-Type': meta.imageMimeType || 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
  } catch { return new NextResponse('Image unavailable.', { status: 404 }); }
}
