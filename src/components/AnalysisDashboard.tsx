'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Globe2, LogOut, Satellite } from 'lucide-react';
import SatQueryPanel from '@/components/SatQueryPanel';

export default function AnalysisDashboard() {
  const router = useRouter(); const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.replace('/login'); router.refresh(); };
  return <main className="min-h-screen bg-[#050a12] text-white"><header className="flex items-center justify-between border-b border-cyan-300/15 bg-[#071019] px-5 py-3"><div className="flex items-center gap-2 font-mono text-sm font-bold tracking-[.18em] text-cyan-100"><Satellite className="h-5 w-5" />SATQUERY AI <span className="hidden text-[9px] font-normal tracking-widest text-white/40 sm:inline">SIMPLE IMAGE ANALYSIS</span></div><div className="flex items-center gap-2"><button type="button" onClick={() => router.push('/')} className="flex items-center gap-1.5 border border-cyan-300/35 px-2.5 py-1.5 font-mono text-[9px] tracking-wider text-cyan-100 transition hover:border-cyan-300/70 hover:bg-cyan-300/10" title="Return to the Global Dashboard"><Globe2 className="h-3.5 w-3.5" />GLOBAL DASHBOARD</button><button onClick={logout} className="flex items-center gap-1.5 border border-white/20 px-2.5 py-1.5 font-mono text-[9px] tracking-wider text-white/65 hover:border-cyan-300/50 hover:text-cyan-100"><LogOut className="h-3.5 w-3.5" />LOG OUT</button></div></header><div className="flex min-h-[calc(100vh-53px)] items-center justify-center p-4"><div className="max-w-lg text-center"><p className="font-mono text-[10px] tracking-[.2em] text-cyan-200">SIMPLE USER WORKSPACE</p><h1 className="mt-3 text-3xl font-semibold">Understand your satellite image</h1><p className="mt-3 text-sm leading-6 text-white/55">Upload an image. SATQUERY will suggest useful questions, then explain what it can see in simple words.</p>{!workspaceOpen && <button onClick={() => setWorkspaceOpen(true)} className="mt-7 border border-cyan-300/50 px-4 py-2 font-mono text-[10px] tracking-wider text-cyan-100">ANALYZE AN IMAGE</button>}</div></div><SatQueryPanel isOpen={workspaceOpen} onClose={() => setWorkspaceOpen(false)} expertAccess={false} initialExperience="simple" /></main>;
}
