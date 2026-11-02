import { NextRequest, NextResponse } from 'next/server';
import { createGeminiClient, rotateApiKey } from '@/lib/ai-engine';

export const dynamic = 'force-dynamic';

function getKeys() {
  const keys = process.env.GEMINI_API_KEY?.trim() ? [process.env.GEMINI_API_KEY.trim()] : [];
  for (let i = 1; i <= 8; i += 1) {
    const key = process.env[`GEMINI_API_KEY_${i}`]?.trim();
    if (key) keys.push(key);
  }
  return keys;
}

function fallback(question: string, context: Record<string, unknown>) {
  const counts = Object.entries(context).filter(([, value]) => Array.isArray(value)).map(([key, value]) => `${(value as unknown[]).length} ${key.replace(/_/g, ' ')}`);
  return `I can help you use SATQUERY AI: inspect the live map, open layers, search locations, review alerts, or analyze an uploaded optical/SAR image. ${counts.length ? `The current dashboard has ${counts.slice(0, 4).join(', ')} loaded.` : 'Live data is still loading.'} Ask a specific question such as “What are the highest-priority active alerts?” or “How do I analyze a SAR image?”`;
}

export async function POST(request: NextRequest) {
  let body: { question?: unknown; context?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > 800) return NextResponse.json({ error: 'Ask a question between 1 and 800 characters.' }, { status: 400 });
  const context = body.context && typeof body.context === 'object' && !Array.isArray(body.context) ? body.context as Record<string, unknown> : {};
  const keys = getKeys();
  if (!keys.length) return NextResponse.json({ answer: fallback(question, context), generatedBy: 'assistant', timestamp: new Date().toISOString() });
  try {
    const model = createGeminiClient(rotateApiKey(keys)).getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: 'You are SATQUERY AI Assistant, the helpful in-product guide for the SATQUERY AI intelligence dashboard. Answer plainly and concisely. Use only the supplied dashboard snapshot for claims about live data. Never invent current events, future events, or capabilities. If the user asks for a forecast, distinguish published alerts from uncertainty. Explain how to use the app when asked.',
    });
    const snapshot = JSON.stringify(context).slice(0, 18_000);
    const response = await model.generateContent(`DASHBOARD SNAPSHOT:\n${snapshot}\n\nUSER QUESTION: ${question}`);
    const answer = response.response.text().trim();
    return NextResponse.json({ answer: answer || fallback(question, context), generatedBy: 'gemini', timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ answer: fallback(question, context), generatedBy: 'assistant', timestamp: new Date().toISOString() });
  }
}
