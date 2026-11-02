import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Reports deployment truth, rather than inferring GPU/model availability. */
export async function GET() {
  const adapterUrl = process.env.SATQUERY_ADAPTER_URL?.replace(/\/$/, '');
  if (!adapterUrl) return NextResponse.json({ ready: false, gpu: false, changeMask: false, reason: 'Remote-sensing adapter is not configured.' });
  try {
    const response = await fetch(`${adapterUrl}/health`, { signal: AbortSignal.timeout(3_000), cache: 'no-store' });
    const health = await response.json() as { ready?: boolean; device?: string; engine?: string; checkpoint?: string; changeMask?: boolean; reason?: string };
    const ready = health.ready === true;
    return NextResponse.json({ ready, gpu: ready && health.device === 'cuda', engine: health.engine || null, checkpoint: health.checkpoint || null, changeMask: ready && health.changeMask === true, reason: health.reason || (ready ? 'Image-text adapter ready. Bi-temporal semantic heatmap available; a task-trained segmentation model is required for survey-grade masks.' : 'Adapter is unavailable.') });
  } catch {
    return NextResponse.json({ ready: false, gpu: false, changeMask: false, reason: 'Remote-sensing adapter could not be reached.' });
  }
}
