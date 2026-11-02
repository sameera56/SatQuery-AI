import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type GeocodedPlace = {
  display_name?: string;
  lat?: string;
  lon?: string;
  boundingbox?: string[];
};

function locationCandidates(query: string) {
  const contextual = query.match(/\b(?:in|near|around|at|for)\s+([^?.!,;]+?)(?=\s+\b(?:after|before|during|from|on|and|with|show|identify|analyze|detect|assess)\b|[?.!,;]|$)/i)?.[1];
  // Users naturally write both “flooding in Nepal” and “Nepal flood 2026”.
  // Try the explicit place first, then a cleaned geographic phrase.
  const cleaned = query
    .replace(/\b(?:what|where|which|how|is|are|was|were|the|a|an|please|can|you|show|give|me|find|identify|analyze|detect|assess|explain|check|fetch|image|images|satellite|imagery|map|floods?|flooding|fire|wildfires?|smoke|damage|risk|change|changed|impact|pollution|drought|earthquake|storm|cyclone|landslide|infrastructure|visible|areas?|region|today|latest)\b/gi, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...new Set([contextual, cleaned, query].filter((item): item is string => Boolean(item && item.trim().length >= 2)).map((item) => item.trim()))];
}

function boundsFor(place: GeocodedPlace) {
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const raw = place.boundingbox?.map(Number);
  // Nominatim returns south, north, west, east. Very broad place bounds are
  // capped so the returned satellite view remains useful to a person.
  const span = raw && raw.length === 4
    ? Math.min(0.35, Math.max(0.03, Math.max(Math.abs(raw[1] - raw[0]), Math.abs(raw[3] - raw[2])) * 1.25))
    : 0.12;
  const latitudeSpan = Math.min(span, 0.8);
  const longitudeSpan = Math.min(span / Math.max(0.25, Math.cos(lat * Math.PI / 180)), 1.2);
  return [lon - longitudeSpan, lat - latitudeSpan, lon + longitudeSpan, lat + latitudeSpan];
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')?.trim() || '';
  if (query.length < 3 || query.length > 240) {
    return NextResponse.json({ error: 'Add a short question that includes a city, district, or landmark.' }, { status: 400 });
  }
  const locations = locationCandidates(query);
  if (!locations.length) {
    return NextResponse.json({ error: 'Add a city, district, or landmark so SATQUERY can find an image.' }, { status: 400 });
  }
  try {
    let place: GeocodedPlace | undefined;
    let location = locations[0];
    for (const candidate of locations) {
      const geocodeUrl = new URL('https://nominatim.openstreetmap.org/search');
      geocodeUrl.searchParams.set('q', candidate);
      geocodeUrl.searchParams.set('format', 'jsonv2');
      geocodeUrl.searchParams.set('limit', '1');
      const geocode = await fetch(geocodeUrl, {
        headers: { 'User-Agent': 'OSIRIS-SATQUERY/1.0 (educational geospatial assistant)' },
        signal: AbortSignal.timeout(12_000),
      });
      const places = await geocode.json().catch(() => []) as GeocodedPlace[];
      if (geocode.ok && places[0] && boundsFor(places[0])) { place = places[0]; location = candidate; break; }
    }
    const bounds = place && boundsFor(place);
    if (!place || !bounds) {
      return NextResponse.json({ error: `No mappable location was found for “${location}”. Try a more specific city, district, or landmark.` }, { status: 404 });
    }
    const imageryUrl = new URL('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export');
    imageryUrl.searchParams.set('bbox', bounds.join(','));
    imageryUrl.searchParams.set('bboxSR', '4326');
    imageryUrl.searchParams.set('imageSR', '4326');
    imageryUrl.searchParams.set('size', '1280,1280');
    imageryUrl.searchParams.set('format', 'jpg');
    imageryUrl.searchParams.set('f', 'image');
    const imagery = await fetch(imageryUrl, { signal: AbortSignal.timeout(20_000) });
    if (!imagery.ok) throw new Error(`Imagery source returned ${imagery.status}`);
    const bytes = await imagery.arrayBuffer();
    if (!bytes.byteLength) throw new Error('Empty imagery response');
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
        'X-SatQuery-Location': (place.display_name || location).slice(0, 300),
        'X-SatQuery-Source': 'Esri World Imagery',
      },
    });
  } catch (error) {
    console.error('[SATQUERY AI] Imagery discovery failed:', error);
    return NextResponse.json({ error: 'Automatic imagery is temporarily unavailable. You can still upload an image and ask your question.' }, { status: 502 });
  }
}
