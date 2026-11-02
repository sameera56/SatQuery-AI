import { NextResponse } from 'next/server';

type RiskKind = 'flood' | 'landslide' | 'agriculture' | 'storm' | 'heat' | 'other';
type RiskLevel = 'critical' | 'high' | 'elevated';

type RiskSignal = {
  id: string;
  kind: RiskKind;
  level: RiskLevel;
  title: string;
  area: string;
  lat?: number;
  lng?: number;
  validUntil?: string;
  horizon: string;
  source: string;
  sourceUrl: string;
  basis: string;
};

const XML = (item: string, tag: string) =>
  (item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '').trim();

function representativePoint(geometry: { type?: string; coordinates?: unknown } | null | undefined) {
  const coords = geometry?.coordinates as number[] | number[][] | number[][][] | undefined;
  if (!coords) return undefined;
  if (geometry?.type === 'Point' && Array.isArray(coords) && typeof coords[0] === 'number') {
    return { lng: coords[0], lat: coords[1] as number };
  }
  const ring: number[][] | undefined = geometry?.type === 'Polygon'
    ? (coords as number[][][])[0]
    : geometry?.type === 'MultiPolygon'
      ? ((coords as unknown as number[][][][])[0]?.[0])
      : undefined;
  if (!ring?.length) return undefined;
  return ring.reduce((sum, point) => ({ lng: sum.lng + point[0] / ring.length, lat: sum.lat + point[1] / ring.length }), { lng: 0, lat: 0 });
}

function classify(text: string): RiskKind {
  const v = text.toLowerCase();
  if (/flood|inundation|coastal flood/.test(v)) return 'flood';
  if (/landslide|mudslide|debris flow/.test(v)) return 'landslide';
  if (/drought|freeze|frost|agricultur|crop/.test(v)) return 'agriculture';
  if (/heat/.test(v)) return 'heat';
  if (/storm|hurricane|tornado|cyclone|wind|thunderstorm/.test(v)) return 'storm';
  return 'other';
}

function level(value?: string): RiskLevel {
  if (/extreme|severe|red/i.test(value || '')) return 'critical';
  if (/moderate|orange/i.test(value || '')) return 'high';
  return 'elevated';
}

/**
 * Predictive-risk signals are only derived from published official early-warning
 * feeds. They are not claims that this application can predict disasters.
 */
export async function GET() {
  const signals: RiskSignal[] = [];
  const [nws, gdacs] = await Promise.allSettled([
    fetch('https://api.weather.gov/alerts/active', { headers: { 'User-Agent': 'SATQUERY-AI early-warning dashboard' }, signal: AbortSignal.timeout(10_000) }),
    fetch('https://www.gdacs.org/xml/rss.xml', { signal: AbortSignal.timeout(10_000) }),
  ]);

  if (nws.status === 'fulfilled' && nws.value.ok) {
    const data = await nws.value.json();
    for (const feature of (data.features || []).slice(0, 150)) {
      const p = feature.properties || {};
      const text = `${p.event || ''} ${p.headline || ''}`;
      const kind = classify(text);
      if (kind === 'other') continue;
      const point = representativePoint(feature.geometry);
      signals.push({
        id: `nws-${p.id || p['@id'] || signals.length}`,
        kind, level: level(p.severity), title: p.headline || p.event || 'Official weather alert',
        area: p.areaDesc || 'United States', lat: point?.lat, lng: point?.lng,
        validUntil: p.expires, horizon: p.expires ? 'Active through published expiry' : 'Active official alert',
        // `web` is NOAA's human-readable warning page. The API identifier is
        // retained only as a fallback so the operator always reaches an
        // official NWS record rather than a third-party page.
        source: 'NOAA / National Weather Service', sourceUrl: p.web || p['@id'] || 'https://www.weather.gov/',
        basis: 'Published government early-warning alert',
      });
    }
  }

  if (gdacs.status === 'fulfilled' && gdacs.value.ok) {
    const xml = await gdacs.value.text();
    for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
      const item = match[1];
      const code = XML(item, 'gdacs:eventtype');
      const kind: RiskKind | null = code === 'FL' ? 'flood' : code === 'DR' ? 'agriculture' : code === 'TC' ? 'storm' : null;
      if (!kind) continue;
      const lat = Number(XML(item, 'geo:lat'));
      const lng = Number(XML(item, 'geo:long'));
      signals.push({
        id: `gdacs-${XML(item, 'gdacs:eventid') || signals.length}`, kind,
        level: level(XML(item, 'gdacs:alertlevel')), title: XML(item, 'title') || 'GDACS early warning',
        area: 'Global monitoring area', lat: Number.isFinite(lat) ? lat : undefined, lng: Number.isFinite(lng) ? lng : undefined,
        horizon: 'Active early-warning bulletin', source: 'GDACS / UN disaster alerts',
        sourceUrl: XML(item, 'link') || 'https://www.gdacs.org/', basis: 'Published multi-agency early-warning bulletin',
      });
    }
  }

  const rank: Record<RiskLevel, number> = { critical: 0, high: 1, elevated: 2 };
  const ordered = signals.sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 30);
  return NextResponse.json({
    signals: ordered,
    generatedAt: new Date().toISOString(),
    disclaimer: 'Risk signals combine published early warnings and active hazard bulletins. They indicate elevated risk, not certain prediction or an official evacuation order.',
    coverage: 'Flood, landslide/mudslide, agricultural drought/frost, severe storm and heat alerts where source agencies publish coverage.',
  }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } });
}
