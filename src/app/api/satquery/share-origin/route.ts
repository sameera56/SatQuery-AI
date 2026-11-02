import { networkInterfaces } from 'node:os';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function localIpv4Address() {
  const interfaces = networkInterfaces();
  // Prefer the actual Wi-Fi adapter. VirtualBox/VMware host-only adapters are
  // often listed first and produce QR URLs that a phone cannot reach.
  const ordered = Object.entries(interfaces).sort(([left], [right]) => Number(!/wi-?fi|wlan|wireless/i.test(left)) - Number(!/wi-?fi|wlan|wireless/i.test(right)));
  for (const [, addresses] of ordered) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address)) return address.address;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const configuredOrigin = (process.env.SATQUERY_PUBLIC_URL || process.env.NEXT_PUBLIC_SATQUERY_PUBLIC_URL)?.replace(/\/$/, '');
  if (configuredOrigin) return NextResponse.json({ origin: configuredOrigin, access: 'public' });
  const host = request.nextUrl.hostname;
  // 0.0.0.0 is the address used by the dev server to listen on every network
  // interface. It cannot be opened from a phone, so treat it as localhost and
  // substitute the machine's actual Wi-Fi/LAN address below.
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1' && host !== '0.0.0.0') return NextResponse.json({ origin: request.nextUrl.origin, access: 'public' });
  const ip = localIpv4Address();
  if (!ip) return NextResponse.json({ origin: null, access: 'unavailable' });
  const port = request.nextUrl.port ? `:${request.nextUrl.port}` : '';
  return NextResponse.json({ origin: `http://${ip}${port}`, access: 'local-network' });
}
