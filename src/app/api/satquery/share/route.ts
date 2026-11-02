import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHARE_ROOT = path.join(process.cwd(), 'data', 'satquery-shares');
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

export type SharedDisasterReport = {
  analysisId: string; title: string; question: string; analysis: string; disasterType: string;
  confidence: string; limitations: string[]; createdAt: string; imageMimeType?: string;
  imageName?: string; sourceNote: string; location: string;
};

function cleanId(id: string) { return /^[0-9a-f-]{36}$/i.test(id) ? id : null; }
function detectDisasterType(question: string, analysis: string) {
  const text = `${question} ${analysis}`.toLowerCase();
  if (/flood|inundat|water.?log|water expansion/.test(text)) return 'Possible flooding / water expansion';
  if (/fire|burn|wildfire/.test(text)) return 'Possible fire or burn impact';
  if (/drought|vegetation stress/.test(text)) return 'Possible drought or vegetation stress';
  if (/landslide|erosion/.test(text)) return 'Possible landslide or erosion';
  if (/cyclone|storm/.test(text)) return 'Possible storm-related impact';
  if (/damage|disaster/.test(text)) return 'Possible visible disaster impact';
  return 'Satellite-image assessment';
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const analysis = String(form.get('analysis') || '').trim();
    const question = String(form.get('question') || '').trim();
    const confidence = String(form.get('confidence') || 'Medium');
    const limitations = JSON.parse(String(form.get('limitations') || '[]')) as unknown;
    const image = form.get('image');
    if (!analysis || !question) return NextResponse.json({ error: 'Complete an image analysis before generating a disaster QR report.' }, { status: 400 });
    if (image instanceof File && image.size > MAX_IMAGE_SIZE) return NextResponse.json({ error: 'The shared image is too large. Re-run analysis using a smaller image.' }, { status: 413 });
    const analysisId = randomUUID();
    const report: SharedDisasterReport = {
      analysisId, title: 'SATQUERY AI · Disaster Information Report', question, analysis,
      disasterType: detectDisasterType(question, analysis), confidence: /^(low|medium|high)$/i.test(confidence) ? confidence : 'Medium',
      limitations: Array.isArray(limitations) ? limitations.filter((item): item is string => typeof item === 'string').slice(0, 6) : [],
      createdAt: new Date().toISOString(), imageMimeType: image instanceof File ? image.type : undefined,
      imageName: image instanceof File ? image.name.replace(/[^a-z0-9._-]/gi, '_') : undefined,
      location: 'Location information is not available from this image.',
      sourceNote: 'Analysis based on the uploaded remote-sensing image and AI interpretation.',
    };
    await mkdir(SHARE_ROOT, { recursive: true });
    await writeFile(path.join(SHARE_ROOT, `${analysisId}.json`), JSON.stringify(report), 'utf8');
    if (image instanceof File && image.size) await writeFile(path.join(SHARE_ROOT, `${analysisId}.image`), Buffer.from(await image.arrayBuffer()));
    return NextResponse.json({ analysisId, path: `/public-report/${analysisId}` });
  } catch {
    return NextResponse.json({ error: 'The disaster QR report could not be saved. Please try again.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const id = cleanId(request.nextUrl.searchParams.get('id') || '');
  if (!id) return NextResponse.json({ error: 'Invalid report link.' }, { status: 400 });
  try {
    return NextResponse.json(JSON.parse(await readFile(path.join(SHARE_ROOT, `${id}.json`), 'utf8')) as SharedDisasterReport);
  } catch { return NextResponse.json({ error: 'This disaster report was not found or is no longer available.' }, { status: 404 }); }
}

export async function HEAD(request: NextRequest) {
  const id = cleanId(request.nextUrl.searchParams.get('id') || '');
  if (!id) return new NextResponse(null, { status: 404 });
  try { await stat(path.join(SHARE_ROOT, `${id}.image`)); return new NextResponse(null, { status: 200 }); } catch { return new NextResponse(null, { status: 404 }); }
}
