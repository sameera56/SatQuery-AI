import { cachedSource } from '@/lib/sourceCache';

export interface Quote {
  group: string;
  name: string;
  symbol: string;
  price: number;
  change_percent: number;
  up: boolean;
  spark: number[];
  currency: string;
  market_open: boolean;
}

type Ticker = { symbol: string; name: string; group: string };

const TICKERS: Ticker[] = [
  { symbol: 'ES=F', name: 'S&P 500', group: 'indices' }, { symbol: 'NQ=F', name: 'Nasdaq 100', group: 'indices' }, { symbol: '^VIX', name: 'VIX', group: 'indices' }, { symbol: 'DX-Y.NYB', name: 'Dollar Index', group: 'indices' }, { symbol: '^TNX', name: 'US 10Y', group: 'indices' },
  { symbol: 'RTX', name: 'RTX', group: 'stocks' }, { symbol: 'LMT', name: 'LMT', group: 'stocks' }, { symbol: 'NOC', name: 'NOC', group: 'stocks' }, { symbol: 'GD', name: 'GD', group: 'stocks' }, { symbol: 'BA', name: 'BA', group: 'stocks' }, { symbol: 'LHX', name: 'LHX', group: 'stocks' }, { symbol: 'PLTR', name: 'PLTR', group: 'stocks' },
  { symbol: 'CL=F', name: 'WTI Crude', group: 'oil' }, { symbol: 'BZ=F', name: 'Brent Crude', group: 'oil' }, { symbol: 'NG=F', name: 'Natural Gas', group: 'oil' },
  { symbol: 'GC=F', name: 'Gold', group: 'commodities' }, { symbol: 'SI=F', name: 'Silver', group: 'commodities' }, { symbol: 'HG=F', name: 'Copper', group: 'commodities' }, { symbol: 'ZW=F', name: 'Wheat', group: 'commodities' }, { symbol: 'ZC=F', name: 'Corn', group: 'commodities' },
  { symbol: 'BTC-USD', name: 'Bitcoin', group: 'crypto' }, { symbol: 'ETH-USD', name: 'Ethereum', group: 'crypto' }, { symbol: 'SOL-USD', name: 'Solana', group: 'crypto' }, { symbol: 'XRP-USD', name: 'XRP', group: 'crypto' },
  { symbol: 'EURUSD=X', name: 'EUR/USD', group: 'fx' }, { symbol: 'USDJPY=X', name: 'USD/JPY', group: 'fx' }, { symbol: 'GBPUSD=X', name: 'GBP/USD', group: 'fx' }, { symbol: 'USDCNY=X', name: 'USD/CNY', group: 'fx' },
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function fetchQuote(t: Ticker): Promise<Quote | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t.symbol)}?interval=1d&range=1mo`, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) return null;
    const result = (await res.json())?.chart?.result?.[0]; const meta = result?.meta;
    if (!meta || !Number.isFinite(meta.regularMarketPrice)) return null;
    const spark: number[] = (result.indicators?.quote?.[0]?.close || []).filter((c: unknown): c is number => Number.isFinite(c)).map(r2);
    const prevClose = spark.length >= 2 ? spark.at(-2) : meta.chartPreviousClose;
    if (!Number.isFinite(prevClose) || prevClose === 0) return null;
    const changePercent = ((meta.regularMarketPrice - prevClose) / prevClose) * 100;
    const period = meta.currentTradingPeriod?.regular; const nowSec = Date.now() / 1000;
    return { group: t.group, name: t.name, symbol: t.symbol, price: r2(meta.regularMarketPrice), change_percent: r2(changePercent), up: changePercent >= 0, spark, currency: meta.currency || 'USD', market_open: Number.isFinite(period?.start) && Number.isFinite(period?.end) ? nowSec >= period.start && nowSec <= period.end : false };
  } catch { return null; }
}

const CONCURRENCY = 5;
const lastGood = new Map<string, Quote>();
async function fetchBatch(tickers: Ticker[], into: Map<string, Quote>): Promise<void> { let next = 0; const worker = async () => { while (next < tickers.length) { const ticker = tickers[next++]; const quote = await fetchQuote(ticker); if (quote) into.set(ticker.symbol, quote); } }; await Promise.all(Array.from({ length: CONCURRENCY }, worker)); }
export async function fetchAllQuotes(): Promise<Quote[]> { const fresh = new Map<string, Quote>(); await fetchBatch(TICKERS, fresh); const missed = TICKERS.filter(t => !fresh.has(t.symbol)); if (missed.length) await fetchBatch(missed, fresh); for (const [symbol, quote] of fresh) lastGood.set(symbol, quote); return TICKERS.map(t => fresh.get(t.symbol) || lastGood.get(t.symbol)).filter((q): q is Quote => q !== undefined); }
export const getQuotes = cachedSource<Quote>('markets', fetchAllQuotes, 60_000);
export function groupQuotes(quotes: Quote[]): Record<string, Record<string, Quote>> { const out: Record<string, Record<string, Quote>> = { indices: {}, stocks: {}, oil: {}, commodities: {}, crypto: {}, fx: {} }; for (const q of quotes) (out[q.group] ||= {})[q.name] = q; return out; }
