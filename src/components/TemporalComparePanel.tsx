'use client';

import { CalendarRange, ImagePlus, Satellite } from 'lucide-react';

export default function TemporalComparePanel({ onOpenCompare }: { onOpenCompare: () => void }) {
  return (
    <section className="glass-panel w-[300px] overflow-hidden pointer-events-auto" aria-label="Temporal image comparison">
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/20 px-4 py-3">
        <CalendarRange className="h-4 w-4 text-cyan-200" />
        <div><h2 className="font-mono text-[11px] font-bold tracking-[0.15em] text-white">TEMPORAL COMPARE</h2><p className="mt-0.5 font-mono text-[8px] tracking-wider text-cyan-100/60">CHANGE DETECTION WORKSPACE</p></div>
      </div>
      <div className="space-y-3 p-4">
        <p className="font-mono text-[9px] leading-relaxed text-white/55">Compare satellite imagery from different dates to identify geographical changes.</p>
        <div className="grid grid-cols-2 gap-2">
          {['BEFORE IMAGE', 'AFTER IMAGE'].map((label) => <button key={label} onClick={onOpenCompare} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded border border-dashed border-cyan-300/30 bg-cyan-300/[0.025] font-mono text-[8px] tracking-wider text-white/60 transition hover:border-cyan-300/60 hover:bg-cyan-300/[0.07]"><ImagePlus className="h-4 w-4 text-cyan-200" /><span>{label}</span><span className="text-[7px] text-cyan-100">SELECT IMAGE</span></button>)}
        </div>
        <div className="flex items-center gap-2 border-l-2 border-[#d4af37]/60 bg-[#d4af37]/5 px-2 py-1.5 font-mono text-[8px] leading-relaxed text-white/50"><Satellite className="h-3.5 w-3.5 shrink-0 text-[#d4af37]" />Uses SatQuery AI&apos;s existing paired-image analysis. No comparison result is generated until images are submitted.</div>
        <button onClick={onOpenCompare} className="w-full rounded border border-cyan-300/45 bg-cyan-300/10 px-3 py-2.5 font-mono text-[9px] font-bold tracking-[0.14em] text-cyan-100 transition hover:bg-cyan-300/20">COMPARE IMAGES</button>
      </div>
    </section>
  );
}
