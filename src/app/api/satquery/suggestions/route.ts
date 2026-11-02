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
    if (!apiKey) return NextResponse.json({ error: 'No Gemini API key is available.' }, { status: 503 });
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: 'gemini-flash-lite-latest',
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 180, temperature: 0.2 },
      systemInstruction: 'You create helpful satellite-image analysis questions. Inspect only visible image content. Return valid JSON exactly in this form: {"suggestions":["question", "question", "question", "question"]}. Return 3 or 4 short, specific questions tailored to visible features. Prefer questions about visible land cover, water, agriculture, infrastructure, environment, or change. Do not state unsupported facts, locations, dates, or measurements. Do not ask generic scene-description questions unless the image content cannot support a more specific question.',
    });
    const data = Buffer.from(await image.arrayBuffer()).toString('base64');
    const response = await model.generateContent([{ inlineData: { data, mimeType: image.type } }, { text: 'Suggest questions specifically for this image.' }]);
    const parsed = JSON.parse(response.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as { suggestions?: unknown };
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((value): value is string => typeof value === 'string' && value.trim().length > 8).map((value) => value.trim()).slice(0, 4) : [];
    if (!suggestions.length) return NextResponse.json({ error: 'No image-specific suggestions were returned.' }, { status: 502 });
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: 'Image-specific suggestions are unavailable right now.' }, { status: 502 });
  }
}
