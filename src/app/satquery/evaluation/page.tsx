'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardCheck, X } from 'lucide-react';

type AdapterStatus = {
  ready: boolean;
  gpu: boolean;
  changeMask: boolean;
  engine?: string | null;
  checkpoint?: string | null;
  reason?: string;
};

const criteria = [
  ['Single-image VQA', 'RSVQA / VRSBench held-out test split', 'Task accuracy and representative evidence overlays', 'Implemented; official held-out report pending'],
  ['Captioning or grounding', 'VRSBench held-out test split', 'Official caption score or grounding mIoU / threshold accuracy', 'Text-guided grounding implemented; official report pending'],
  ['Bi-temporal change VQA', 'CDVQA held-out test split', 'Change-VQA accuracy, answer file, and audit trace', 'Workflow implemented; official report pending'],
  ['Optical–SAR analysis', 'Co-registered optical–SAR pairs', 'Compatibility record, complementary findings, and limitations', 'Workflow implemented; adapted checkpoint required'],
  ['Remote-sensing adaptation', 'BigEarthNet training and held-out split', 'Checkpoint hash, training metadata, Recall@1 / Recall@5', 'Not complete — no trained checkpoint found'],
  ['ISRO/SAC final evaluation', 'Unseen Cartosat-2S / RISAT test set', 'Evaluator-provided normalized scores', 'Reserved for final judging; do not train on it'],
] as const;

export default function SatQueryEvaluationPage() {
  const [adapter, setAdapter] = useState<AdapterStatus | null>(null);
  const closePage = () => {
    if (window.history.length > 1) window.history.back();
    else window.close();
  };
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  useEffect(() => {
    fetch('/api/satquery/capabilities', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: AdapterStatus) => setAdapter(payload))
      .catch(() => setAdapter({ ready: false, gpu: false, changeMask: false, reason: 'Capability endpoint could not be reached.' }));
  }, []);

  const adapterLabel = adapter === null ? 'Checking live adapter…' : adapter.ready ? `Ready · ${adapter.engine || 'adapted model'} · ${adapter.checkpoint || 'checkpoint connected'}` : `Not ready · ${adapter.reason || 'No trained adapter configured.'}`;

  return (
    <main className="satquery-evaluation-root min-h-screen bg-[#050a12] px-4 py-6 text-white sm:px-8">
      <section className="mx-auto max-w-6xl">
        <header className="sticky top-3 z-20 mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/20 bg-[#07101a]/95 px-4 py-3 shadow-lg backdrop-blur-md"><div className="flex items-center gap-3"><ClipboardCheck className="h-5 w-5 text-cyan-200" /><div><p className="font-mono text-[10px] tracking-[0.18em] text-cyan-200">SATQUERY AI · JURY REVIEW</p><p className="text-xs text-white/50">Evaluation &amp; judging readiness</p></div></div><div className="flex flex-wrap gap-2"><button onClick={() => scrollTo('readiness')} className="flex items-center gap-1.5 rounded border border-cyan-300/30 px-3 py-2 font-mono text-[9px] tracking-wider text-cyan-100 hover:bg-cyan-300/10"><ChevronDown className="h-3.5 w-3.5" />READINESS</button><button onClick={closePage} className="flex items-center gap-1.5 rounded border border-white/20 px-3 py-2 font-mono text-[9px] tracking-wider text-white/75 hover:border-[#ff9c8c]/60 hover:text-[#ffb3a8]"><X className="h-3.5 w-3.5" />CLOSE</button></div></header>
        <p className="font-mono text-xs tracking-[0.22em] text-cyan-200">SATQUERY AI · SIH26167</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Evaluation & judging readiness</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">This is the project&apos;s honest readiness note for judges. It distinguishes what SATQUERY demonstrates today from the benchmark evidence still required before a final research claim is made.</p>

        <section className="mt-6 grid gap-3 md:grid-cols-3"><article className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.05] p-4"><p className="font-mono text-[9px] tracking-widest text-cyan-100">WHAT THIS PAGE SHOWS</p><p className="mt-2 text-sm leading-6 text-white/70">Live system capability, benchmark requirements, and the work remaining before final evaluation.</p></article><article className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.04] p-4"><p className="font-mono text-[9px] tracking-widest text-emerald-200">WHAT IS READY</p><p className="mt-2 text-sm leading-6 text-white/70">User workflows, evidence reporting, paired-image checks, and the adapter connection point.</p></article><article className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4"><p className="font-mono text-[9px] tracking-widest text-amber-200">WHAT STILL NEEDS PROOF</p><p className="mt-2 text-sm leading-6 text-white/70">Official held-out benchmark runs, trained checkpoint metadata, and final unseen-set scores.</p></article></section>

        <div className={`mt-7 rounded-xl border p-5 ${adapter?.ready ? 'border-emerald-300/40 bg-emerald-300/10' : 'border-amber-300/40 bg-amber-300/10'}`}>
          <p className="font-mono text-xs tracking-[0.16em] text-white/60">LIVE REMOTE-SENSING ADAPTER</p>
          <p className="mt-2 text-sm font-medium">{adapterLabel}</p>
          {adapter?.ready && <p className="mt-2 text-xs text-white/60">{adapter.gpu ? 'CUDA acceleration available.' : 'Running on CPU.'} {adapter.changeMask ? 'Coarse semantic change heatmap enabled.' : 'Change heatmap unavailable.'}</p>}
        </div>

        <div id="readiness" className="mt-8 scroll-mt-24 overflow-x-auto rounded-xl border border-white/15">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-white/10 font-mono text-xs tracking-wide text-cyan-100"><tr><th className="p-4">Judging criterion</th><th className="p-4">Evaluation data</th><th className="p-4">Required evidence</th><th className="p-4">Current status</th></tr></thead>
            <tbody>{criteria.map(([criterion, data, evidence, status]) => <tr key={criterion} className="border-t border-white/10 align-top"><td className="p-4 font-medium">{criterion}</td><td className="p-4 text-white/65">{data}</td><td className="p-4 text-white/65">{evidence}</td><td className={`p-4 ${status.startsWith('Implemented') ? 'text-cyan-100' : status.startsWith('Reserved') ? 'text-white/55' : 'text-amber-200'}`}>{status}</td></tr>)}</tbody>
          </table>
        </div>

        <section id="next-steps" className="mt-8 scroll-mt-24 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.05] p-5">
          <h2 className="font-mono text-sm tracking-[0.14em] text-cyan-100">WHAT REMAINS BEFORE SUBMISSION</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-white/70">
            <li>Prepare separate BigEarthNet training and held-out manifests, then train the supplied CLIP adapter.</li>
            <li>Connect the trained checkpoint through <code className="text-cyan-100">SATQUERY_ADAPTER_URL</code> and retain its metadata and SHA-256 sidecar.</li>
            <li>Run the official held-out VRSBench, RSVQA, and CDVQA evaluators; retain predictions, split names, coverage, and metrics.</li>
            <li>Keep the ISRO/SAC evaluation data unseen until judging.</li>
          </ol>
        </section>
      </section>
      <div id="page-end" className="h-px" aria-hidden="true" />
      <nav aria-label="Page scroll controls" className="fixed bottom-5 right-5 z-30 overflow-hidden rounded-full border border-cyan-300/60 bg-[#07101a]/95 shadow-[0_0_22px_rgba(0,229,255,0.16)] backdrop-blur">
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex h-11 w-11 items-center justify-center border-b border-cyan-300/25 text-cyan-100 transition hover:bg-cyan-300/15" aria-label="Scroll to top" title="Scroll to top"><ChevronUp className="h-5 w-5" /></button>
        <button type="button" onClick={() => document.getElementById('page-end')?.scrollIntoView({ behavior: 'smooth', block: 'end' })} className="flex h-11 w-11 items-center justify-center text-cyan-100 transition hover:bg-cyan-300/15" aria-label="Scroll to bottom" title="Scroll to bottom"><ChevronDown className="h-5 w-5" /></button>
      </nav>
    </main>
  );
}
