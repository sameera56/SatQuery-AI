'use client';

import { memo } from 'react';
import { Activity, Building2, CloudSun, Droplets, Image, Leaf, Map, Satellite, Sparkles, Waves } from 'lucide-react';

type Props = {
  isMobile?: boolean;
  onOpenAnalyst: (mode?: 'bi-temporal') => void;
  onOpenNewFeatureDetection?: () => void;
  onLayerSelect?: (layer: string) => void;
};

const capabilities = [
  { label: 'IMAGE ANALYSIS', icon: Image },
  { label: 'CHANGE DETECTION', icon: Activity },
  { label: 'FLOOD MAPPING', icon: Droplets },
  { label: 'LAND COVER', icon: Map },
  { label: 'OBJECT DETECTION', icon: Building2 },
];

const spectral = [
  { label: 'NDVI ANALYSIS', icon: Leaf },
  { label: 'WATER INDEX / NDWI', icon: Waves },
  { label: 'CLOUD MASK', icon: CloudSun },
];

function SatelliteIntelligencePanel({ isMobile, onOpenAnalyst, onOpenNewFeatureDetection, onLayerSelect }: Props) {
  const choose = (label: string) => {
    onLayerSelect?.(label);
    onOpenAnalyst(label === 'TEMPORAL COMPARE' ? 'bi-temporal' : undefined);
  };

  return (
    <section className={`glass-panel pointer-events-auto overflow-hidden ${isMobile ? 'w-full' : 'h-[500px] max-h-[80vh] w-[276px]'}`} aria-label="Satellite intelligence">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <Satellite className="h-4 w-4 text-cyan-200" />
          <div>
            <h2 className="font-mono text-[11px] font-bold tracking-[0.14em] text-white">SATELLITE INTELLIGENCE</h2>
            <p className="mt-0.5 font-mono text-[8px] tracking-wider text-cyan-100/60">EARTH OBSERVATION WORKSPACE</p>
          </div>
        </div>
        <span className="rounded border border-cyan-300/25 bg-cyan-300/10 px-1.5 py-0.5 font-mono text-[8px] text-cyan-100">READY</span>
      </div>

      <div className="max-h-[calc(80vh-52px)] space-y-4 overflow-y-auto p-3 styled-scrollbar">
        <div>
          <p className="mb-2 font-mono text-[9px] tracking-[0.14em] text-[#f4d889]">IMAGE ANALYSIS</p>
          <div className="grid grid-cols-2 gap-1.5">
            {capabilities.map(({ label, icon: Icon }) => <button key={label} onClick={() => choose(label)} className="flex min-h-12 items-center gap-2 rounded border border-white/10 bg-white/[0.025] px-2 text-left font-mono text-[8px] tracking-wide text-white/65 transition hover:border-cyan-300/45 hover:bg-cyan-300/[0.06] hover:text-cyan-100"><Icon className="h-3.5 w-3.5 shrink-0 text-cyan-200" />{label}</button>)}
          </div>
        </div>

        <div className="border-t border-white/10 pt-3">
          <p className="mb-2 font-mono text-[9px] tracking-[0.14em] text-[#f4d889]">IMAGE &amp; SPECTRAL</p>
          <div className="space-y-1">
            {spectral.map(({ label, icon: Icon }) => <button key={label} onClick={() => choose(label)} className="flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left font-mono text-[9px] tracking-wide text-white/60 transition hover:bg-white/5 hover:text-cyan-100"><Icon className="h-3.5 w-3.5 text-cyan-200" />{label}</button>)}
            <button onClick={() => choose('TEMPORAL COMPARE')} className="flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left font-mono text-[9px] tracking-wide text-white/60 transition hover:bg-white/5 hover:text-cyan-100"><Activity className="h-3.5 w-3.5 text-cyan-200" />TEMPORAL COMPARE</button>
          </div>
        </div>

        <div className="border border-cyan-300/25 bg-cyan-300/[0.035] p-2.5">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 rounded border border-cyan-300/35 bg-cyan-300/10 p-1"><Activity className="h-3.5 w-3.5 text-cyan-200" /></div>
            <div>
              <p className="font-mono text-[9px] font-bold tracking-[0.1em] text-cyan-100">NEW FEATURE DETECTION</p>
              <p className="mt-1 font-mono text-[8px] leading-relaxed text-white/50">Find visible additions, expansions, or removals between a before and after image.</p>
            </div>
          </div>
          <button onClick={() => onOpenNewFeatureDetection?.()} className="mt-2.5 w-full rounded border border-cyan-300/45 bg-cyan-300/10 px-2 py-2 font-mono text-[8px] font-bold tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-300/20">OPEN NEW FEATURE REVIEW</button>
        </div>

        <div className="border-t border-white/10 pt-3">
          <p className="mb-1.5 font-mono text-[9px] tracking-[0.14em] text-[#f4d889]">SCENE STATUS</p>
          <div className="grid grid-cols-2 gap-y-1.5 font-mono text-[8px] tracking-wide"><span className="text-white/45">IMAGE QUALITY</span><span className="text-right text-white/60">N/A</span><span className="text-white/45">CLOUD COVER</span><span className="text-right text-white/60">N/A</span><span className="text-white/45">CHANGE DETECTED</span><span className="text-right text-white/60">N/A</span><span className="text-white/45">AFFECTED AREA</span><span className="text-right text-white/60">N/A</span></div>
          <p className="mt-2 font-mono text-[8px] leading-relaxed text-white/35">Values appear after image analysis; no scene data is fabricated.</p>
        </div>

        <button onClick={() => onOpenAnalyst()} className="flex w-full items-center justify-center gap-2 rounded border border-cyan-300/45 bg-cyan-300/10 px-3 py-2.5 font-mono text-[9px] font-bold tracking-[0.14em] text-cyan-100 transition hover:bg-cyan-300/20"><Sparkles className="h-3.5 w-3.5" />ASK SATQUERY AI</button>
      </div>
    </section>
  );
}

export default memo(SatelliteIntelligencePanel);
