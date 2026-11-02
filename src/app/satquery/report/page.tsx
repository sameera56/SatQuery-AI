'use client';

import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Download, MapPinned, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

type AreaBrief = { title: string; question: string; condition: string; opportunity: string; concern: string; recommendation: string; confidence: string; limitations: string; createdAt: string };

function decodeBrief(value: string | null): AreaBrief | null {
  if (!value) return null;
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '='));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as AreaBrief;
  } catch { return null; }
}

function downloadBriefPdf(brief: AreaBrief) {
  const escape = (value: string) => value.replace(/[^\x20-\x7e]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const wrap = (value: string) => value.split(/\s+/).reduce<string[]>((lines, word) => {
    const previous = lines.at(-1) || '';
    if (previous && `${previous} ${word}`.length > 78) lines.push(word);
    else if (previous) lines[lines.length - 1] = `${previous} ${word}`;
    else lines.push(word);
    return lines;
  }, []);
  const sections = [['SATQUERY AI AREA BRIEF', ''], ['QUESTION', brief.question], ['VISIBLE CONDITION', brief.condition], ['POTENTIAL OPPORTUNITY', brief.opportunity], ['ENVIRONMENTAL CONCERN', brief.concern], ['RECOMMENDED NEXT STEP', brief.recommendation], ['CONFIDENCE', brief.confidence], ['LIMITATIONS', brief.limitations || 'Confirm important decisions with local data or field validation.']];
  const lines = sections.flatMap(([heading, value]) => [heading, ...wrap(value), '']);
  const content = `BT\n/F1 10 Tf\n48 790 Td\n14 TL\n${lines.map((line) => `(${escape(line)}) Tj\nT*`).join('')}ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [4 0 R] /Count 1 >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  const link = document.createElement('a'); link.href = url; link.download = 'satquery-area-brief.pdf'; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AreaBriefContent() {
  const brief = decodeBrief(useSearchParams().get('data'));
  const [isListening, setIsListening] = useState(false);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  if (!brief) return <main className="min-h-screen bg-[#050a12] px-6 py-24 text-center text-white"><Sparkles className="mx-auto h-9 w-9 text-cyan-200" /><h1 className="mt-4 font-mono text-xl">AREA BRIEF UNAVAILABLE</h1><p className="mx-auto mt-3 max-w-sm text-sm text-white/60">Please scan a new QR code from a completed SATQUERY analysis.</p></main>;
  const listen = () => {
    const speech = window.speechSynthesis;
    if (isListening) { speech?.cancel(); setIsListening(false); return; }
    if (!speech) return;
    const utterance = new SpeechSynthesisUtterance(`${brief.question}. Visible condition: ${brief.condition}. Potential opportunity: ${brief.opportunity}. Environmental concern: ${brief.concern}. Recommended next step: ${brief.recommendation}. Confidence: ${brief.confidence}. Limitations: ${brief.limitations}`);
    utterance.rate = 0.95; utterance.onend = () => setIsListening(false); utterance.onerror = () => setIsListening(false); speech.cancel(); speech.speak(utterance); setIsListening(true);
  };
  const close = () => { if (window.history.length > 1) window.history.back(); else window.close(); };
  const items = [
    { label: 'VISIBLE CONDITION', value: brief.condition, icon: MapPinned, tone: 'border-cyan-300/35' },
    { label: 'POTENTIAL OPPORTUNITY', value: brief.opportunity, icon: Sparkles, tone: 'border-[#d4af37]/35' },
    { label: 'ENVIRONMENTAL CONCERN', value: brief.concern, icon: AlertTriangle, tone: 'border-[#ffcf87]/35' },
    { label: 'RECOMMENDED NEXT STEP', value: brief.recommendation, icon: CheckCircle2, tone: 'border-[#7fffa4]/35' },
  ];
  return <main className="satquery-report-root min-h-screen bg-[#050a12] px-4 py-5 pb-16 text-white sm:px-6"><div className="mx-auto max-w-xl"><div className="mb-3 flex gap-2"><button onClick={close} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-3 font-mono text-[10px] font-bold tracking-wider text-white/75"><X className="h-4 w-4" />CLOSE</button><button onClick={listen} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-3 font-mono text-[10px] font-bold tracking-wider text-cyan-100">{isListening ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}{isListening ? 'STOP' : 'LISTEN'}</button><button onClick={() => downloadBriefPdf(brief)} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-3 font-mono text-[10px] font-bold tracking-wider text-[#f4d889]"><Download className="h-4 w-4" />PDF</button></div><div className="rounded-2xl border border-cyan-300/25 bg-[radial-gradient(circle_at_top,rgba(0,229,255,0.16),transparent_54%),#08111d] p-6 shadow-[0_0_50px_rgba(0,229,255,0.12)]"><p className="font-mono text-[10px] tracking-[0.2em] text-cyan-200">SATQUERY AI · SCANNED AREA BRIEF</p><h1 className="mt-3 font-mono text-2xl font-bold tracking-wide">UNDERSTAND THIS PLACE</h1><p className="mt-3 text-sm leading-6 text-white/65">A simple, evidence-based summary of the satellite-image analysis.</p><div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4"><p className="font-mono text-[9px] tracking-widest text-white/45">ANALYSIS QUESTION</p><p className="mt-2 text-sm leading-6 text-white/85">{brief.question}</p></div><div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 font-mono text-[9px]"><span className="text-white/45">CONFIDENCE</span><span className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 uppercase text-cyan-100">{brief.confidence}</span></div><a href="#area-findings" className="mt-5 flex w-full items-center justify-center rounded-lg border border-cyan-300/45 bg-cyan-300/10 px-4 py-3 font-mono text-[10px] font-bold tracking-[0.14em] text-cyan-100">VIEW FINDINGS ↓</a></div><section id="area-findings" className="mt-5 space-y-3 scroll-mt-4">{items.map(({ label, value, icon: Icon, tone }) => <article key={label} className={`rounded-xl border ${tone} bg-[#0a131f] p-4`}><div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-cyan-100"><Icon className="h-4 w-4" />{label}</div><p className="mt-3 text-sm leading-6 text-white/75">{value || 'Not determined from the available image.'}</p></article>)}</section><section className="mt-5 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/[0.06] p-4"><p className="font-mono text-[10px] tracking-[0.14em] text-[#f4d889]">IMPORTANT LIMITATION</p><p className="mt-2 text-sm leading-6 text-white/70">{brief.limitations || 'This is an image-based screening result. Confirm important decisions with local data or field validation.'}</p></section><p className="py-7 text-center font-mono text-[9px] tracking-wider text-white/35">GENERATED {new Date(brief.createdAt).toLocaleString()}</p></div></main>;
}

export default function SatQueryAreaBriefPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#050a12]" />}><AreaBriefContent /></Suspense>;
}
