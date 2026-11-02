import type { NextConfig } from "next";
import { networkInterfaces } from 'node:os';

function lanDevOrigins() {
  const ips = Object.values(networkInterfaces()).flat().flatMap((addresses) => addresses || [])
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => address.address);
  return [...new Set([...ips, 'astrology-cameron-donate-sports.trycloudflare.com'])];
}

const nextConfig: NextConfig = {
  // OneDrive/Windows can reject a burst of child worker processes with EPERM.
  // One worker keeps local production builds reliable; deployment platforms may
  // still override this through their own build environment.
  experimental: { cpus: 1 },
  // The QR report is opened on a phone via the laptop's Wi-Fi address during
  // demos. Next dev otherwise blocks its own client resources for that host.
  allowedDevOrigins: lanDevOrigins(),
  // The workspace is synced by OneDrive. Its Files On-Demand placeholder
  // metadata can turn `.next/node_modules` into a protected reparse point,
  // which prevents both `next dev` and `next build` from replacing it. Keep
  // generated output in a separate, ordinary directory (and allow CI to
  // override it when desired).
  distDir: process.env.NEXT_DIST_DIR || '.next-osiris',
  // A separate lockfile exists higher in the local workspace. Pinning this
  // prevents Turbopack from treating that parent directory as this app's root.
  turbopack: {
    root: __dirname,
  },
  output: 'standalone',
  serverExternalPackages: ['ws'],
  transpilePackages: ['react-map-gl', 'mapbox-gl', 'maplibre-gl'],
  // Type errors block the build again. They were suppressed while 17 stood
  // unfixed; those are cleared, so the gate can do its job — the AstraPanel
  // crash (createPortal used without an import) shipped precisely because
  // nothing stopped it.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: wss: data: blob:;" },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
};

export default nextConfig;
