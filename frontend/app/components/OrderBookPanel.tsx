'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownWideNarrow, Loader2 } from 'lucide-react';
import { API_URL } from '../lib/api';
import { formatAdaPrice, formatUsdPrice } from '../lib/tokens';
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';

interface OrderBookPanelProps {
  tokenId: string | null;
  ticker: string;
  adaPriceUsd: number | null;
  currentPriceAda: number;
}

interface OrderRow {
  id: string;
  side: 'buy' | 'sell';
  priceAda: number;
  amount: number;
  totalAda: number;
}

function normalizeOrders(data: any, tokenId: string, ticker: string): OrderRow[] {
  const rows = Array.isArray(data) ? data : data?.data ?? data?.orders ?? data?.limit_orders ?? [];
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row: any, index: number) => {
    if (row?.status && row.status !== 'LIMIT') return [];
    if (row?.is_dca || row?.is_stop_loss || row?.is_oor) return [];
    const amountIn = Number(row?.amount_in ?? row?.amountIn ?? 0);
    const expectedOut = Number(row?.expected_out_amount ?? row?.expectedOutput ?? 0);
    const outputIsSelected = row?.token_id_out === tokenId || row?.token_out_symbol?.toUpperCase() === ticker.toUpperCase();
    const inputIsSelected = row?.token_id_in === tokenId || row?.token_in_symbol?.toUpperCase() === ticker.toUpperCase();
    if ((!outputIsSelected && !inputIsSelected) || amountIn <= 0 || expectedOut <= 0) return [];
    const side = outputIsSelected ? 'buy' : 'sell';
    const expectedOutAda = side === 'sell' ? expectedOut / 1_000_000 : expectedOut;
    const priceAda = side === 'buy' ? amountIn / expectedOut : expectedOutAda / amountIn;
    const amount = side === 'buy' ? expectedOut : amountIn;
    const totalAda = side === 'buy' ? amountIn : expectedOutAda;
    if (!Number.isFinite(priceAda) || priceAda <= 0) return [];
    return [{
      id: String(row?._id ?? row?.id ?? row?.order_id ?? index),
      side,
      priceAda,
      amount,
      totalAda,
    }];
  });
}

export default function OrderBookPanel({ tokenId, ticker, adaPriceUsd, currentPriceAda }: OrderBookPanelProps) {
  const { language } = useLanguage();
  const { currency } = useCurrency();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!tokenId) {
      setOrders([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      if (!cancelled) setLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/trade/orderbook/${encodeURIComponent(tokenId)}`);
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error('Orderbook unavailable');
        if (!cancelled) {
          setOrders(normalizeOrders(json.data, tokenId, ticker));
          setUnavailable(false);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setUnavailable(true);
          setLoading(false);
        }
      }
    };
    void load();
    const interval = window.setInterval(load, 20_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [tokenId]);

  const bids = useMemo(() => orders.filter((order) => order.side === 'buy').sort((a, b) => b.priceAda - a.priceAda).slice(0, 8), [orders]);
  const asks = useMemo(() => orders.filter((order) => order.side === 'sell').sort((a, b) => a.priceAda - b.priceAda).slice(0, 8), [orders]);
  const convertPrice = (priceAda: number) => currency === 'USD'
    ? adaPriceUsd ? formatUsdPrice(priceAda * adaPriceUsd) : '—'
    : formatAdaPrice(priceAda);

  return (
    <section className="overflow-hidden rounded-md border border-white/10 bg-[#090d14] lg:flex lg:min-h-0 lg:flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-2.5">
        <div className="flex items-center gap-2"><ArrowDownWideNarrow className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-bold text-white">{language === 'de' ? 'Orderbook' : 'Order book'}</h2></div>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
      </header>
      <div className="px-2 py-1.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <div className="mb-1.5 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.8fr)] gap-2 px-1 text-[10px] font-bold uppercase text-slate-500">
          <span>{language === 'de' ? 'Preis' : 'Price'} ({currency})</span><span className="text-right">{language === 'de' ? 'Menge' : 'Amount'} ({ticker})</span><span className="text-right">ADA</span>
        </div>
        {unavailable ? <p className="py-8 text-center text-xs text-slate-500">{language === 'de' ? 'DexHunter-Orderbook nicht verfügbar.' : 'DexHunter order book unavailable.'}</p>
          : orders.length === 0 && !loading ? <p className="py-8 text-center text-xs text-slate-500">{language === 'de' ? 'Keine offenen DexHunter-Limitorders.' : 'No open DexHunter limit orders.'}</p>
            : <div className="space-y-1">
              {asks.length > 0 && <p className="px-1 text-[11px] font-bold uppercase text-red-400">{language === 'de' ? 'Verkäufe' : 'Asks'}</p>}
              <OrderRows rows={asks} side="sell" ticker={ticker} convertPrice={convertPrice} />
              <div className="my-1 flex items-center justify-between border-y border-white/5 py-1.5 text-xs"><span className="text-slate-500">{language === 'de' ? 'Marktpreis' : 'Market price'}</span><strong className="text-cyan-300">{convertPrice(currentPriceAda)}</strong></div>
              {bids.length > 0 && <p className="px-1 text-[11px] font-bold uppercase text-green-400">{language === 'de' ? 'Käufe' : 'Bids'}</p>}
              <OrderRows rows={bids} side="buy" ticker={ticker} convertPrice={convertPrice} />
            </div>}
      </div>
      <footer className="shrink-0 border-t border-white/5 px-3 py-1.5 text-[10px] text-slate-500">{language === 'de' ? 'Offene Limitorders · 20 s' : 'Open limit orders · 20s'}</footer>
    </section>
  );
}

function OrderRows({ rows, side, ticker, convertPrice }: { rows: OrderRow[]; side: 'buy' | 'sell'; ticker: string; convertPrice: (priceAda: number) => string }) {
  return <div className="space-y-0">{rows.map((order) => <div key={order.id} className="relative grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.8fr)] gap-2 overflow-hidden rounded px-1 py-0.5 text-[11px] tabular-nums">
    <span className={`relative z-10 min-w-0 break-all font-semibold ${side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>{convertPrice(order.priceAda)}</span>
    <span className="relative z-10 min-w-0 break-all text-right text-slate-300">{order.amount.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
    <span className="relative z-10 min-w-0 break-all text-right text-slate-500">{order.totalAda.toLocaleString('en-US', { maximumFractionDigits: 3 })}</span>
    <span className={`absolute inset-y-0 right-0 ${side === 'buy' ? 'bg-green-500/[0.08]' : 'bg-red-500/[0.08]'}`} style={{ width: `${Math.min(100, (order.totalAda / 1000) * 100)}%` }} />
  </div>)}</div>;
}