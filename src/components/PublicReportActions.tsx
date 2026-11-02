'use client';

import { Download, Share2 } from 'lucide-react';
import { useState } from 'react';

type Props = { title: string; location: string; confidence: string; analysis: string; limitations: string[] };

export default function PublicReportActions({ title, location, confidence, analysis, limitations }: Props) {
  const [message, setMessage] = useState('');
  const reportText = `SATQUERY AI DISASTER INFORMATION REPORT\n\nAssessment: ${title}\nLocation: ${location}\nConfidence: ${confidence}\n\nWhat was detected:\n${analysis}\n\nLimitations:\n${limitations.length ? limitations.map((item) => `• ${item}`).join('\n') : 'Confirm important findings using additional imagery, GIS data, and field validation.'}`;
  const download = () => { const url = URL.createObjectURL(new Blob([reportText], { type: 'text/plain;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'satquery-disaster-report.txt'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('Report downloaded to this device.'); };
  const share = async () => {
    const data = { title: 'SATQUERY AI Disaster Report', text: `Satellite-image assessment: ${title}`, url: window.location.href };
    try { if (navigator.share) { await navigator.share(data); setMessage('Share options opened.'); } else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(window.location.href); setMessage('Report link copied. You can send it to your team.'); } else setMessage('Use your browser’s Share button to send this report.'); }
    catch (error) { if ((error as DOMException).name !== 'AbortError') setMessage('Could not open sharing options.'); }
  };
  return <section className="mt-4 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.05] p-4"><p className="font-mono text-[10px] tracking-[0.14em] text-cyan-100">OPENED FROM A SCANNED REPORT</p><p className="mt-2 text-sm leading-6 text-white/70">This is a brief satellite-image assessment. Download a copy for your records or share this report with your team or anyone who needs the information.</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={download} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d4af37]/45 bg-[#d4af37]/10 px-3 py-3 font-mono text-[9px] font-bold tracking-wider text-[#f4d889]"><Download className="h-4 w-4" />DOWNLOAD</button><button type="button" onClick={() => void share()} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-300/45 bg-cyan-300/10 px-3 py-3 font-mono text-[9px] font-bold tracking-wider text-cyan-100"><Share2 className="h-4 w-4" />SHARE</button></div>{message && <p role="status" className="mt-3 text-center text-xs text-cyan-100">{message}</p>}</section>;
}
