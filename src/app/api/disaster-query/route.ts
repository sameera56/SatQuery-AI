import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';


type EonetEvent = {
  title?: string;
  description?: string;
  categories?: Array<{ title?: string }>;
  sources?: Array<{ id?: string; url?: string }>;
  geometry?: Array<{ date?: string }>;
  closed?: string | null;
};

function getApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_KEY_1?.trim();
}

function userFacingAnalysis(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (!cleaned.startsWith('{')) return text;
  try {
    const parsed = JSON.parse(cleaned) as { analysis?: unknown; clarification?: unknown; status?: unknown };
    if (parsed.status === 'needs_clarification') {
      return typeof parsed.clarification === 'string'
        ? parsed.clarification
        : 'I could not understand that query. Please ask a clear disaster-related question.';
    }
    return typeof parsed.analysis === 'string'
      ? parsed.analysis
      : 'I could not understand that query. Please ask a clear disaster-related question.';
  } catch {
    return 'I could not understand that query. Please ask a clear disaster-related question.';
  }
}

function formatReports(events: EonetEvent[], query: string) {
  const terms = query.toLowerCase().match(/[a-z]{3,}/g) || [];
  // Location words must match too. Without this guard, a query such as
  // "flood incident in Assam" was ranked against every global flood merely
  // because all of them contain the word "flood".
  const genericTerms = new Set([
    'about', 'active', 'affected', 'current', 'disaster', 'emergency', 'event',
    'flood', 'flooding', 'fire', 'fires', 'incident', 'incidents', 'latest',
    'natural', 'recent', 'show', 'the', 'today', 'update', 'updates', 'wildfire', 'wildfires',
  ]);
  const locationTerms = terms.filter((term) => !genericTerms.has(term));
  const ranked = events.map((event) => {
    const searchable = `${event.title || ''} ${event.description || ''} ${(event.categories || []).map((category) => category.title).join(' ')}`.toLowerCase();
    const locationMatches = locationTerms.every((term) => searchable.includes(term));
    return { event, score: terms.filter((term) => searchable.includes(term)).length, locationMatches };
  }).filter(({ score, locationMatches }) => score > 0 && locationMatches).sort((a, b) => b.score - a.score).slice(0, 8);
  // Never attach unrelated events merely because the live feed returned data.
  // Doing so made ordinary questions look as though they had been answered by
  // records from completely different countries.
  const selected = ranked.map(({ event }) => event);
  return selected.map((event, index) => ({
    index: index + 1,
    title: event.title || 'Untitled event',
    date: event.geometry?.[event.geometry.length - 1]?.date || event.closed || 'Date unavailable',
    source: 'NASA EONET',
    countries: 'Geospatial event record',
    disasters: event.categories?.map((category) => category.title).filter(Boolean).join(', ') || 'Natural event',
    url: event.sources?.[0]?.url || null,
  }));
}

export async function POST(request: NextRequest) {
  let query = '';
  let responseLanguage = 'English';
  try {
    const body = await request.json() as { query?: unknown; responseLanguage?: unknown };
    query = String(body.query || '').trim();
    responseLanguage = typeof body.responseLanguage === 'string' ? body.responseLanguage.trim().slice(0, 32) || 'English' : 'English';
  } catch { /* response below */ }
  if (!query) return NextResponse.json({ error: 'A disaster or situation query is required.' }, { status: 400 });
  if (query.length > 240) return NextResponse.json({ error: 'Keep the query under 240 characters.' }, { status: 400 });

  // A question without an image is an assistant request, not necessarily a
  // disaster search.  Prefer a key explicitly supplied by the panel, which
  // lets the same optional key work for both text and image queries.
  const apiKey = request.headers.get('x-gemini-key')?.trim() || getApiKey();

  try {
    const now = new Date();
    const start = `${now.getUTCFullYear()}-01-01`;
    const end = now.toISOString().slice(0, 10);
    // Live disaster data enriches relevant answers, but it must never prevent
    // the assistant from answering an ordinary question when EONET is down.
    let events: EonetEvent[] = [];
    try {
      const response = await fetch(`https://eonet.gsfc.nasa.gov/api/v3/events?status=all&start=${start}&end=${end}&limit=200`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`NASA EONET returned ${response.status}`);
      const payload = await response.json() as { events?: EonetEvent[] };
      events = payload.events || [];
    } catch (error) {
      console.warn('[SATQUERY AI] NASA EONET unavailable; continuing without live disaster context:', error);
    }
    const reports = formatReports(events, query);
    const sourceFacts = reports.map((report) => `${report.index}. ${report.title} | ${report.date} | ${report.source} | ${report.countries} | ${report.disasters}`).join('\n');
    let analysis = reports.length
      ? `Retrieved ${reports.length} relevant NASA EONET event records from ${start} through ${end}.\n\n${sourceFacts}`
      : `No matching NASA EONET events were found from ${start} through ${end}.`;
    if (apiKey) {
      const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-flash-lite-latest' });
      const generated = await model.generateContent(`You are SATQUERY AI, a helpful intelligence and geospatial assistant. Answer entirely in this user-selected language: ${responseLanguage}. This overrides the language of the question. You can answer general questions as well as disaster questions. Do not claim that live information, imagery, or a source record confirms something unless it is present below. If the question needs current, local, or otherwise unavailable information, say what you can answer and state that limitation briefly.\n\nUSER QUESTION: ${query}\n\nOPTIONAL LIVE NASA EONET RECORDS (use only when relevant):\n${sourceFacts || 'No matching records were retrieved.'}`);
      analysis = userFacingAnalysis(generated.response.text());
    }
    return NextResponse.json({
      analysis,
      reports,
      model: apiKey ? 'Gemini Flash Lite + NASA EONET when relevant' : 'NASA EONET (add a Gemini API key for general questions)',
      timestamp: new Date().toISOString(),
      cutoff: now.toISOString(),
    });
  } catch (error) {
    console.error('[SAT QUTRIYAI] Disaster query failed:', error);
    return NextResponse.json({ error: 'Live disaster sources are unavailable right now. Please try again shortly.' }, { status: 502 });
  }
}
