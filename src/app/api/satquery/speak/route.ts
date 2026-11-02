import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const BHASHINI_PIPELINE_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

function apiKey(request: NextRequest) {
  return request.headers.get('x-gemini-key')?.trim()
    || process.env.GEMINI_API_KEY?.trim()
    || process.env.GEMINI_API_KEY_1?.trim()
    || '';
}

/** Gemini TTS returns 24 kHz, mono, signed 16-bit PCM. Wrap it in WAV so a
 * browser can play it directly without any client-side audio codec library. */
function wav(pcm: Buffer) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24_000, 24);
  header.writeUInt32LE(48_000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function readBhashiniAudio(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const responses = Array.isArray((payload as Record<string, unknown>).pipelineResponse)
    ? (payload as Record<string, unknown>).pipelineResponse as unknown[] : [];
  for (const response of responses) {
    const output = response && typeof response === 'object' ? (response as Record<string, unknown>).output : null;
    if (!Array.isArray(output)) continue;
    for (const item of output) {
      const audio = item && typeof item === 'object' ? (item as Record<string, unknown>).audioContent : null;
      if (typeof audio === 'string' && audio) return audio;
    }
  }
  return '';
}

async function speakWithBhashini(text: string, language: string) {
  const key = process.env.BHASHINI_INFERENCE_API_KEY?.trim();
  const serviceId = process.env.BHASHINI_TTS_SERVICE_ID?.trim();
  if (!key || !serviceId) return null;
  const sourceLanguage = language.slice(0, 2).toLowerCase() || 'en';
  const response = await fetch(BHASHINI_PIPELINE_URL, {
    method: 'POST',
    headers: { Accept: '*/*', Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: 'tts', config: { serviceId, language: { sourceLanguage }, gender: 'female' } }],
      inputData: { input: [{ source: text }] },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('BHASHINI speech generation was unavailable.');
  const audioContent = readBhashiniAudio(payload);
  if (!audioContent) throw new Error('BHASHINI returned no playable audio.');
  return Buffer.from(audioContent, 'base64');
}

export async function POST(request: NextRequest) {
  const key = apiKey(request);
  let text = '';
  let language = 'en';
  try {
    const body = await request.json() as { text?: unknown; language?: unknown };
    text = typeof body.text === 'string' ? body.text.trim() : '';
    language = typeof body.language === 'string' ? body.language.trim().slice(0, 12) : 'en';
  } catch { /* handled below */ }
  if (!text) return NextResponse.json({ error: 'Text is required for speech.' }, { status: 400 });
  if (text.length > 3_000) text = text.slice(0, 3_000);

  try {
    try {
      const audio = await speakWithBhashini(text, language);
      if (audio) return new NextResponse(audio, {
        headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', 'X-Speech-Engine': 'bhashini-tts' },
      });
    } catch (error) {
      console.warn('[SATQUERY AI] BHASHINI TTS unavailable; using Gemini fallback.', error);
    }
    if (!key) return NextResponse.json({ error: 'Configure BHASHINI TTS or add a Gemini API key to use multilingual speech.' }, { status: 401 });
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        model: 'gemini-3.1-flash-tts-preview',
        input: `Read the following satellite-analysis report naturally and clearly in ${language}. Preserve its language and do not add or omit information:\n\n${text}`,
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice: 'Kore' }] },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const payload = await response.json() as { output_audio?: { data?: string }; error?: { message?: string } };
    const base64 = payload.output_audio?.data;
    if (!response.ok || !base64) {
      return NextResponse.json({ error: payload.error?.message || 'Gemini speech generation was unavailable.' }, { status: response.status || 502 });
    }
    return new NextResponse(wav(Buffer.from(base64, 'base64')), {
      headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Speech generation could not be reached. Please try again.' }, { status: 502 });
  }
}
