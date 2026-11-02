import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const VOICE_SERVICE_URL = process.env.VOICE_TRANSCRIBER_URL || 'http://127.0.0.1:8000';
const BHASHINI_PIPELINE_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

function readBhashiniTranscript(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  const responses = Array.isArray(record.pipelineResponse) ? record.pipelineResponse : [];
  for (const response of responses) {
    if (!response || typeof response !== 'object') continue;
    const output = (response as Record<string, unknown>).output;
    if (!Array.isArray(output)) continue;
    for (const item of output) {
      if (!item || typeof item !== 'object') continue;
      const text = (item as Record<string, unknown>).source;
      if (typeof text === 'string' && text.trim()) return text.trim();
    }
  }
  return '';
}

async function transcribeWithBhashini(audio: File, sourceLanguage: string) {
  const key = process.env.BHASHINI_INFERENCE_API_KEY?.trim();
  const serviceId = process.env.BHASHINI_ASR_SERVICE_ID?.trim();
  if (!key || !serviceId) return null;

  const audioContent = Buffer.from(await audio.arrayBuffer()).toString('base64');
  const response = await fetch(BHASHINI_PIPELINE_URL, {
    method: 'POST',
    headers: { Accept: '*/*', Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: 'asr', config: { serviceId, language: { sourceLanguage } } }],
      inputData: { audio: [{ audioContent }] },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('BHASHINI could not transcribe this recording.');
  const transcript = readBhashiniTranscript(payload);
  if (!transcript) throw new Error('BHASHINI did not detect speech in this recording.');
  return transcript;
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const audio = form.get('audio');
    const requestedLanguage = typeof form.get('sourceLanguage') === 'string' ? String(form.get('sourceLanguage')) : 'en';
    const sourceLanguage = /^[a-z]{2}$/i.test(requestedLanguage) ? requestedLanguage.toLowerCase() : 'en';
    if (!(audio instanceof File) || !audio.size) return NextResponse.json({ error: 'No voice recording was received.' }, { status: 400 });
    if (audio.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Voice recordings must be 8 MB or smaller.' }, { status: 413 });

    try {
      const transcript = await transcribeWithBhashini(audio, sourceLanguage);
      if (transcript) return NextResponse.json({ transcript, engine: 'bhashini-asr' });
    } catch (error) {
      console.warn('[SATQUERY AI] BHASHINI transcription unavailable; using offline fallback.', error);
    }

    const upstreamForm = new FormData();
    upstreamForm.append('audio', audio, audio.name || 'voice.webm');
    const response = await fetch(`${VOICE_SERVICE_URL.replace(/\/$/, '')}/transcribe`, {
      method: 'POST', body: upstreamForm, signal: AbortSignal.timeout(90_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: payload.detail || payload.error || 'Offline voice transcription could not be completed.' }, { status: response.status });
    if (typeof payload.transcript !== 'string' || !payload.transcript.trim()) return NextResponse.json({ error: 'No speech was detected. Please try again.' }, { status: 422 });
    return NextResponse.json({ transcript: payload.transcript.trim(), engine: 'local-whisper' });
  } catch (error) {
    console.error('[SATQUERY AI] Offline voice transcription failed:', error);
    return NextResponse.json({ error: 'Offline voice service is unavailable. Start the voice service once, then try the microphone again.' }, { status: 503 });
  }
}
