import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function configuredKey() {
  return process.env.GEMINI_API_KEY?.trim() || Array.from({ length: 8 }, (_, index) => process.env[`GEMINI_API_KEY_${index + 1}`]?.trim()).find(Boolean) || '';
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const image = form.get('image');
    if (!(image instanceof File) || !ALLOWED_TYPES.has(image.type) || image.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Use a JPG, PNG, or WebP image no larger than 12 MB.' }, { status: 415 });
    const apiKey = request.headers.get('x-gemini-key')?.trim() || configuredKey();
    if (!apiKey) return NextResponse.json({ error: 'Image validation is unavailable.' }, { status: 503 });
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: 'gemini-flash-lite-latest',
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 100, temperature: 0 },
      systemInstruction: 'Classify whether an uploaded image is suitable for a satellite-imagery analysis tool. Accept only a real overhead satellite, aerial, drone, or radar image of the Earth. Reject faces, selfies, portraits, cartoons, illustrations, memes, logos, documents, UI screenshots, ordinary ground-level photos, and AI-generated art. Return only valid JSON: {"accepted":boolean,"message":"short explanation"}. When uncertain, reject it to protect the satellite-only workflow.',
    });
    const data = Buffer.from(await image.arrayBuffer()).toString('base64');
    const response = await model.generateContent([{ inlineData: { data, mimeType: image.type } }, { text: 'Validate this upload.' }]);
    const parsed = JSON.parse(response.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as { accepted?: unknown; message?: unknown };
    const accepted = parsed.accepted === true;
    return NextResponse.json({ accepted, message: typeof parsed.message === 'string' ? parsed.message : accepted ? 'Satellite imagery accepted.' : 'This does not appear to be satellite-based Earth imagery.' });
  } catch {
    return NextResponse.json({ error: 'Image validation is unavailable.' }, { status: 503 });
  }
}
