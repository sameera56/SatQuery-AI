import type { Metadata, Viewport } from "next";
import ErrorBoundary from '@/components/ErrorBoundary';
import "./globals.css";

const SITE_URL = "http://localhost:3000";
const SITE_NAME = "SATQUERY AI";
const SITE_TITLE = "SATQUERY AI — Satellite Image Intelligence";
const SITE_DESCRIPTION = "Upload satellite imagery, ask natural-language questions, and receive evidence-grounded remote-sensing analysis.";

export const viewport: Viewport = {
  themeColor: "#D4AF37",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | SATQUERY AI",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "satellite image analysis", "earth observation", "remote sensing",
    "geospatial intelligence", "geospatial analysis", "satellite imagery",
    "flood mapping", "flood assessment", "disaster monitoring",
    "change detection", "temporal comparison", "land cover analysis",
    "NDVI analysis", "NDWI water index", "multispectral imagery",
    "object detection", "infrastructure mapping", "AI image analysis",
    "interactive geospatial map", "3D terrain", "satellite intelligence",
    "satquery ai", "satellite image intelligence",
  ],
  authors: [{ name: "SATQUERY AI", url: SITE_URL }],
  creator: "SATQUERY AI",
  publisher: "SATQUERY AI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/android-chrome-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    shortcut: "/favicon.ico",
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: "/apple-touch-icon.png",
      },
    ],
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: SITE_TITLE,
    description: "Analyze satellite imagery with AI for flood assessment, change detection, land cover, infrastructure, and disaster monitoring on an interactive geospatial map.",
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "SATQUERY AI satellite image analysis workspace",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "🛰️ SATQUERY AI — Satellite Image Intelligence",
    description: "Professional satellite image intelligence for change detection, flood assessment, land cover, and geospatial analysis.",
    creator: "@simplifaisoul",
    site: "@simplifaisoul",
    images: [`${SITE_URL}/og-image.png`],
  },
  category: "technology",
  classification: "Earth Observation & Geospatial Analysis",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "SATQUERY AI",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#06060C",
    "msapplication-config": "none",
  },
};

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SATQUERY AI — Satellite Image Intelligence",
  alternateName: ["SATQUERY AI"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "GeospatialApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires a modern web browser",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  featureList: [
    "AI-assisted satellite image analysis",
    "Flood assessment and disaster monitoring",
    "Temporal image comparison and change detection",
    "Land cover, vegetation, and water analysis",
    "Satellite and terrain visualization",
    "Interactive 2D and 3D geospatial map",
    "Earthquake, wildfire, and severe-weather context layers",
    "Evidence-grounded image analysis reports",
  ],
  screenshot: `${SITE_URL}/og-image.png`,
  author: {
    "@type": "Organization",
    name: "SATQUERY AI",
    url: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="canonical" href={SITE_URL} />
        
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

      </head>
      <body className="antialiased">
        <ErrorBoundary name="SATQUERY AI">
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
