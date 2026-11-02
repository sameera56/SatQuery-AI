'use client';

import { FormEvent, useState } from 'react';
import { Bot, Loader2, MessageCircle, Send, X } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; text: string };

export default function QutriyaiAssistant({ context }: { context: Record<string, unknown[]> }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: 'Hi — I’m SATQUERY AI Assistant. Ask about the live map, alerts, layers, or satellite-image analysis.' }]);
  const [loading, setLoading] = useState(false);

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || loading) return;
    setQuestion('');
    setMessages(current => [...current, { role: 'user', text }]);
    setLoading(true);
    try {
      const response = await fetch('/api/ai/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, context }) });
      const payload = await response.json();
      setMessages(current => [...current, { role: 'assistant', text: response.ok ? payload.answer : payload.error || 'I could not answer that right now.' }]);
    } catch {
      setMessages(current => [...current, { role: 'assistant', text: 'I could not reach the assistant. Please try again.' }]);
    } finally { setLoading(false); }
  };

  return <div className="fixed bottom-5 right-5 z-[1000] font-mono">
    {open ? <section aria-label="SATQUERY AI Assistant" className="mb-3 flex h-[min(480px,70vh)] w-[min(360px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded border border-cyan-300/40 bg-[#070b12]/95 shadow-[0_0_40px_rgba(0,229,255,.2)] backdrop-blur">
      <header className="flex items-center justify-between border-b border-cyan-300/20 px-3 py-2"><span className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-cyan-100"><Bot className="h-4 w-4" />SATQUERY AI ASSISTANT</span><button onClick={() => setOpen(false)} aria-label="Close assistant" className="p-1 text-white/60 hover:text-white"><X className="h-4 w-4" /></button></header>
      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-[11px] leading-relaxed">{messages.map((message, index) => <div key={index} className={`max-w-[92%] whitespace-pre-wrap rounded border px-2.5 py-2 ${message.role === 'user' ? 'ml-auto border-[#d4af37]/35 bg-[#d4af37]/10 text-[#fff0be]' : 'border-cyan-300/20 bg-cyan-300/[.05] text-white/80'}`}>{message.text}</div>)}{loading && <div className="flex items-center gap-2 text-cyan-100"><Loader2 className="h-3 w-3 animate-spin" />Thinking…</div>}</div>
      <form onSubmit={ask} className="flex gap-2 border-t border-cyan-300/20 p-2"><input value={question} onChange={event => setQuestion(event.target.value)} maxLength={800} placeholder="Ask a question…" className="min-w-0 flex-1 rounded border border-white/15 bg-black/30 px-2 py-2 text-[11px] text-white outline-none focus:border-cyan-300/70" /><button disabled={loading} aria-label="Send question" className="rounded border border-cyan-300/45 bg-cyan-300/10 p-2 text-cyan-100 disabled:opacity-50"><Send className="h-4 w-4" /></button></form>
    </section> : null}
    <button onClick={() => setOpen(value => !value)} aria-label="Open SATQUERY AI Assistant" className="ml-auto flex items-center gap-2 rounded-full border border-cyan-300/55 bg-[#07111a]/95 px-4 py-3 text-[10px] font-bold tracking-widest text-cyan-100 shadow-[0_0_24px_rgba(0,229,255,.2)] transition-colors hover:bg-cyan-300/15"><MessageCircle className="h-4 w-4" />ASK AI</button>
  </div>;
}
