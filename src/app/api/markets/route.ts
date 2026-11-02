import { NextResponse } from 'next/server';
import { getQuotes, groupQuotes } from '@/lib/market-quotes';

async function fetchScmAlerts(origin: string): Promise<string[]> {
  const alerts: string[] = [];
  try {
    const res = await fetch(`${origin}/api/maritime`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return alerts;
    const chokepoints = (await res.json())?.chokepoints || [];
    const atRisk = (name: string) => {
      const c = chokepoints.find((x: { name?: string; risk?: string }) => x.name === name);
      return c && (c.risk === 'CRITICAL' || c.risk === 'HIGH') ? c.risk : null;
    };
    const hormuz = atRisk('Strait of Hormuz');
    const suez = atRisk('Suez Canal');
    const panama = atRisk('Panama Canal');
    if (hormuz) alerts.push(`🚨 HORMUZ ${hormuz}: High risk of WTI/Brent Crude price spike due to congestion.`);
    if (suez) alerts.push(`🚨 SUEZ ${suez}: Potential supply chain delays impacting European markets and Energy.`);
    if (panama) alerts.push(`🚨 PANAMA ${panama}: LNG and Agriculture (Corn/Wheat) shipment delays expected.`);
  } catch { /* Market data can still be served without maritime alerts. */ }
  return alerts;
}

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const [quotes, scm_alerts] = await Promise.all([getQuotes(), fetchScmAlerts(origin)]);
    return NextResponse.json({ ...groupQuotes(quotes), scm_alerts, count: quotes.length, timestamp: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Markets fetch error:', error);
    return NextResponse.json({ ...groupQuotes([]), scm_alerts: [], count: 0, error: 'Failed' }, { status: 500 });
  }
}
