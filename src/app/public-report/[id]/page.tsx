import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { notFound } from 'next/navigation';
import PublicReportCloseButton from '@/components/PublicReportCloseButton';
import PublicReportActions from '@/components/PublicReportActions';

export const dynamic = 'force-dynamic';

type Report = { analysisId: string; title: string; question: string; analysis: string; disasterType: string; confidence: string; limitations: string[]; createdAt: string; imageMimeType?: string; sourceNote: string; location: string };

function safeId(value: string) { return /^[a-f0-9-]{36}$/i.test(value) ? value : null; }

export default async function PublicReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = safeId(rawId);
  if (!id) notFound();
  let report: Report;
  try { report = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'satquery-shares', `${id}.json`), 'utf8')) as Report; }
  catch { notFound(); }
  return <main className="satquery-report-root min-h-screen bg-[#050a12] px-4 py-5 pb-16 text-white"><div className="mx-auto max-w-xl"><div className="mb-3 flex justify-end"><PublicReportCloseButton /></div><header className="rounded-2xl border border-cyan-300/25 bg-[radial-gradient(circle_at_top,rgba(0,229,255,0.16),transparent_54%),#08111d] p-6"><p className="font-mono text-[10px] tracking-[0.2em] text-cyan-200">SATQUERY AI · DISASTER INFORMATION REPORT</p><h1 className="mt-3 font-mono text-2xl font-bold tracking-wide">{report.disasterType}</h1><p className="mt-3 text-sm text-white/65">AI-based satellite-image interpretation — not an official emergency classification.</p><div className="mt-5 grid grid-cols-2 gap-3 text-xs"><div className="rounded-lg border border-white/10 p-3"><p className="font-mono text-[8px] tracking-widest text-white/40">LOCATION</p><p className="mt-1 leading-5 text-white/75">{report.location}</p></div><div className="rounded-lg border border-white/10 p-3"><p className="font-mono text-[8px] tracking-widest text-white/40">CONFIDENCE</p><p className="mt-1 uppercase text-cyan-100">{report.confidence}</p></div></div></header><PublicReportActions title={report.disasterType} location={report.location} confidence={report.confidence} analysis={report.analysis} limitations={report.limitations} />{report.imageMimeType && <section className="mt-4 overflow-hidden rounded-xl border border-cyan-300/25 bg-black"><p className="px-4 py-3 font-mono text-[9px] tracking-widest text-cyan-100">SATELLITE IMAGE</p><img src={`/api/satquery/share/image?id=${encodeURIComponent(report.analysisId)}`} alt="Satellite image used for this assessment" className="max-h-[420px] w-full object-contain" /></section>}<section className="mt-4 rounded-xl border border-white/10 bg-[#09121d] p-4"><p className="font-mono text-[9px] tracking-widest text-white/45">ANALYSIS QUESTION</p><p className="mt-2 text-sm leading-6 text-white/80">{report.question}</p></section><section className="mt-4 rounded-xl border border-cyan-300/30 bg-[#0a131f] p-4"><h2 className="font-mono text-[10px] tracking-[0.14em] text-cyan-100">WHAT WAS DETECTED?</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/75">{report.analysis}</p></section><section className="mt-4 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/[0.06] p-4"><h2 className="font-mono text-[10px] tracking-[0.14em] text-[#f4d889]">LIMITATIONS</h2>{report.limitations.length ? report.limitations.map((item) => <p key={item} className="mt-2 text-sm leading-6 text-white/70">• {item}</p>) : <p className="mt-2 text-sm leading-6 text-white/70">Confirm important findings using additional imagery, GIS data, and field validation.</p>}</section><footer className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4"><p className="font-mono text-[10px] tracking-widest text-white/55">INFORMATION &amp; SOURCES</p><p className="mt-2 text-sm leading-6 text-white/60">{report.sourceNote}</p><p className="mt-4 font-mono text-[9px] text-white/40">GENERATED {new Date(report.createdAt).toLocaleString()}</p></footer></div></main>;
}
