'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CloudRain, ExternalLink, Info, MapPin, Mountain, RefreshCw, ShieldAlert, Sprout, ThermometerSun, Wind } from 'lucide-react';

type Signal = { id: string; kind: string; level: 'critical' | 'high' | 'elevated'; title: string; area: string; lat?: number; lng?: number; validUntil?: string; horizon: string; source: string; sourceUrl: string; basis: string };
type RiskResponse = { signals: Signal[]; generatedAt: string; disclaimer: string; coverage: string };

const iconFor = (kind: string) => ({ flood: CloudRain, landslide: Mountain, agriculture: Sprout, heat: ThermometerSun, storm: Wind }[kind] || AlertTriangle);
const colors = { critical: '#ff4d5e', high: '#ff9f43', elevated: '#f4d35e' };

export default function PredictiveRiskPanel({ onLocate }: { onLocate: (lat: number, lng: number) => void }) {
  const [report, setReport] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/predictive-risk', { cache: 'no-store' });
      if (!res.ok) throw new Error('Risk sources unavailable');
      setReport(await res.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Risk sources unavailable'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const timer = setInterval(load, 300_000); return () => clearInterval(timer); }, [load]);
  const signals = report?.signals || [];
  return <div className="glass-panel overflow-hidden max-h-[70vh] flex flex-col bg-[#0a0b10]/95">
    <div className="px-3 py-2.5 border-b border-white/10 bg-[#ff9f43]/[0.07]">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-[#ff9f43]" /><div><p className="text-[11px] font-mono font-bold tracking-wider text-white">PREDICTIVE RISK</p><p className="text-[9px] font-mono text-[#ffcf8a]">EARLY-WARNING INTELLIGENCE</p></div></div><button onClick={load} title="Refresh risk signals" className="p-1.5 text-white/50 hover:text-white"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button></div>
    </div>
    <div className="px-3 py-2 border-b border-white/5 text-[9px] leading-relaxed font-mono text-white/55"><span className="text-[#ffcf8a]">NOT A CERTAINTY:</span> {report?.disclaimer || 'Loading published warning sources…'}</div>
    <div className="overflow-y-auto styled-scrollbar p-2.5 space-y-2">
      {loading && !report && <p className="py-5 text-center text-[10px] font-mono text-white/50">ANALYSING WARNING FEEDS…</p>}
      {error && <p className="py-5 text-center text-[10px] font-mono text-red-300">{error}</p>}
      {!loading && !error && signals.length === 0 && <p className="py-5 text-center text-[10px] font-mono text-white/50">No published elevated-risk signals at this refresh.</p>}
      {signals.map(signal => { const Icon = iconFor(signal.kind); const color = colors[signal.level]; return <div key={signal.id} className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-2.5 hover:bg-white/[0.05] transition-colors">
        <div className="flex gap-2"><div className="mt-0.5"><Icon className="w-4 h-4" style={{ color }} /></div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="text-[10px] leading-snug font-mono text-white/90">{signal.title}</p><span className="shrink-0 text-[8px] font-mono font-bold" style={{ color }}>{signal.level.toUpperCase()}</span></div><p className="mt-1 text-[9px] font-mono text-white/45 truncate">{signal.area}</p><p className="mt-1 text-[9px] font-mono text-[#ffcf8a]">{signal.horizon}</p><div className="mt-2 flex items-center justify-between gap-2"><a href={signal.sourceUrl} target="_blank" rel="noreferrer" title="Open the official issuing-agency warning" className="inline-flex max-w-[220px] items-center gap-1 text-[8px] font-mono text-cyan-300 hover:underline"><span className="truncate">{signal.source}</span><ExternalLink className="h-3 w-3 shrink-0" /></a>{signal.lat !== undefined && signal.lng !== undefined && <button onClick={() => onLocate(signal.lat!, signal.lng!)} className="p-1 text-white/50 hover:text-white" title="Locate on map"><MapPin className="w-3.5 h-3.5" /></button>}</div></div></div>
      </div>; })}
    </div>
    <div className="px-3 py-2 border-t border-white/5 flex gap-1.5 text-[8px] leading-relaxed font-mono text-white/40"><Info className="w-3 h-3 shrink-0 mt-0.5" />{report?.coverage || 'Coverage depends on published source agency alerts.'}</div>
  </div>;
}
