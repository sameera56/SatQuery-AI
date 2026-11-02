import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server';

const secret = process.env.SATQUERY_SESSION_SECRET || 'local-development-only-change-this-secret';
const encoder = new TextEncoder();
function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '='));
}
async function validSession(token?: string) {
  if (!token) return null;
  const [payload, supplied] = token.split('.');
  if (!payload || !supplied) return null;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signature = Uint8Array.from(fromBase64Url(supplied), (character) => character.charCodeAt(0));
  if (!(await crypto.subtle.verify('HMAC', key, signature, encoder.encode(payload)))) return null;
  try { const user = JSON.parse(fromBase64Url(payload)) as { sector?: string; exp?: number }; return user.exp && user.exp > Date.now() ? user : null; } catch { return null; }
}
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const url = request.nextUrl.pathname;
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'Unknown SATQUERY Client';
  const payload = { hostname: request.nextUrl.hostname, language: 'en-US', referrer: request.headers.get('referer') || '', screen: '1920x1080', title: 'SATQUERY AI', url, website: process.env.UMAMI_WEBSITE_ID || 'cd8f216c-fc3f-45f5-ba1a-e10309a61d18' };
  event.waitUntil(fetch('http://umami-umami-1:3000/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'x-forwarded-for': ip }, body: JSON.stringify({ payload, type: 'event' }), signal: AbortSignal.timeout(2000) }).catch(() => {}));
  const user = await validSession(request.cookies.get('satquery_session')?.value);
  const path = request.nextUrl.pathname;
  // The root is the shared live global map. Unauthenticated visitors must
  // still sign in; Simple users arrive here directly after authentication.
  if (path === '/') return user ? NextResponse.next() : NextResponse.redirect(new URL('/login', request.url));
  const expertOnly = path.startsWith('/government') || path.startsWith('/satquery/evaluation') || path.startsWith('/satquery/project-guide');
  // The Simple workspace is the safe, guided view. Both signed-in audiences
  // may enter it; Expert-only routes remain limited to approved researchers.
  if ((expertOnly && (!user || user.sector !== 'government')) || (path.startsWith('/analysis') && (!user || (user.sector !== 'government' && user.sector !== 'hack-query')))) return NextResponse.redirect(new URL('/login', request.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
