'use client';

export default function PublicReportCloseButton() {
  return <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else window.close(); }} className="rounded-lg border border-white/20 bg-white/[0.04] px-4 py-3 font-mono text-[10px] font-bold tracking-wider text-white/80 hover:bg-white/10">CLOSE REPORT</button>;
}
