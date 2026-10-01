'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Users } from 'lucide-react';
import { API_URL } from '../lib/api';
import { formatCompactNumber } from '../lib/tokens';
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';

interface LocalTrade {
  tx_hash: string;
  occurred_at: string;
  dex: string;
  version: string;
  side: 'buy' | 'sell';
  amount: string;
  ada_notional: string;
}

const thresholds = [0, 5, 10, 25];

export default function TokenActivity({ marketId, ticker, holderCount, circulatingSupply, adaPriceUsd }: {
  marketId: string;
  ticker: string;
  holderCount: number;
  circulatingSupply: number;
  adaPriceUsd: number | null;
}) {
  const { language } = useLanguage();
  const { currency } = useCurrency();
  const [feed, setFeed] = useState<{ marketId: string; trades: LocalTrade[]; error: boolean } | null>(null);
  const [threshold, setThreshold] = useState(0);
  const trades = feed?.marketId === marketId ? feed.trades : [];
  const visibleTrades = trades.filter((trade) => Number(trade.ada_notional) >= threshold);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/api/market/trades/${encodeURIComponent(marketId)}`);
        const json = await response.json();
        if (!response.ok || !json.success || !Array.isArray(json.data?.trades)) throw new Error('Local trades unavailable');
        if (active) setFeed({ marketId, trades: json.data.trades, error: false });
      } catch {
        if (active) setFeed({ marketId, trades: [], error: true });
      }
    };
    void load();
    const interval = window.setInterval(load, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [marketId]);

  return <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section className="overflow-hidden rounded-md border border-white/10 bg-[#0b111b]" aria-label={language === 'de' ? 'Letzte Trades' : 'Latest trades'}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div><h2 className="text-sm font-semibold text-white">{language === 'de' ? 'Letzte Trades' : 'Latest trades'}</h2><p className="text-[10px] text-slate-500">CARDYX / db-sync · {ticker}/ADA</p></div>
        <div className="flex items-center gap-1" role="group" aria-label={language === 'de' ? 'Mindestwert in ADA' : 'Minimum ADA value'}>
          {thresholds.map((value) => <button key={value} type="button" aria-pressed={threshold === value} onClick={() => setThreshold(value)} className={`rounded border px-2 py-1 text-[10px] font-semibold ${threshold === value ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200' : 'border-white/10 text-slate-500 hover:text-slate-200'}`}>{value ? `₳${value}+` : language === 'de' ? 'Alle' : 'All'}</button>)}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] table-fixed text-left text-[11px]">
          <thead><tr className="border-b border-white/10 text-[10px] uppercase text-slate-500"><th className="w-[90px] px-4 py-2 font-medium">{language === 'de' ? 'Zeit' : 'Time'}</th><th className="w-[80px] px-2 py-2 font-medium">{language === 'de' ? 'Seite' : 'Side'}</th><th className="px-2 py-2 font-medium">{language === 'de' ? 'Menge' : 'Amount'}</th><th className="w-[110px] px-2 py-2 text-right font-medium">{currency}</th><th className="w-[120px] px-2 py-2 font-medium">DEX</th><th className="w-[52px] px-2 py-2 text-right font-medium">TX</th></tr></thead>
          <tbody>{visibleTrades.map((trade, index) => <tr key={`${trade.tx_hash}-${trade.dex}-${index}`} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
            <td className="px-4 py-2 text-slate-400" title={new Date(trade.occurred_at).toLocaleString()}>{new Date(trade.occurred_at).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
            <td className="px-2 py-2"><span className={`rounded px-1.5 py-0.5 font-bold ${trade.side === 'buy' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-rose-400/10 text-rose-400'}`}>{trade.side === 'buy' ? language === 'de' ? 'KAUF' : 'BUY' : language === 'de' ? 'VERK.' : 'SELL'}</span></td>
            <td className="truncate px-2 py-2 font-mono text-slate-200" title={`${trade.amount} ${ticker}`}>{Number(trade.amount).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 4 })} {ticker} <span className="text-slate-500">{trade.side === 'buy' ? '← ADA' : '→ ADA'}</span></td>
            <td className="px-2 py-2 text-right font-mono font-semibold text-slate-200">{currency === 'USD' ? adaPriceUsd ? `$${(Number(trade.ada_notional) * adaPriceUsd).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 })}` : '—' : `₳${Number(trade.ada_notional).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 })}`}</td>
            <td className="truncate px-2 py-2 text-slate-400" title={`${trade.dex} ${trade.version}`}>{trade.dex} {trade.version}</td>
            <td className="px-2 py-2 text-right"><a href={`https://cardanoscan.io/transaction/${trade.tx_hash}`} target="_blank" rel="noopener noreferrer" title={trade.tx_hash} aria-label={`${language === 'de' ? 'Transaktion öffnen' : 'Open transaction'} ${trade.tx_hash}`} className="inline-flex text-cyan-400 hover:text-cyan-200"><ExternalLink className="h-3.5 w-3.5" /></a></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!feed || feed.marketId !== marketId ? <p className="px-4 py-7 text-center text-xs text-slate-500">{language === 'de' ? 'Lokale Trades werden geladen…' : 'Loading local trades…'}</p>
        : feed.error ? <p className="px-4 py-7 text-center text-xs text-slate-500">{language === 'de' ? 'Lokale Handelsdaten für diesen Token noch nicht verfügbar.' : 'Local trade data for this token is not available yet.'}</p>
        : visibleTrades.length === 0 ? <p className="px-4 py-7 text-center text-xs text-slate-500">{language === 'de' ? 'Keine verifizierten Pool-Trades für diese Auswahl.' : 'No verified pool trades for this selection.'}</p> : null}
    </section>

    <section className="overflow-hidden rounded-md border border-white/10 bg-[#0b111b]" aria-label={language === 'de' ? 'Top Halter' : 'Top holders'}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Users className="h-4 w-4 text-cyan-400" />{language === 'de' ? 'Top Halter' : 'Top holders'}</h2><p className="mt-0.5 text-[10px] text-slate-500">CARDYX / db-sync</p></div><span className="text-xs font-semibold text-slate-300">{holderCount ? formatCompactNumber(holderCount) : '—'}</span></div>
      <div className="grid grid-cols-2 gap-4 border-b border-white/5 px-4 py-3 text-xs"><div><p className="text-[10px] uppercase text-slate-500">{language === 'de' ? 'Verifizierte Halter' : 'Verified holders'}</p><p className="mt-1 font-mono font-semibold text-white">{holderCount ? holderCount.toLocaleString(language === 'de' ? 'de-DE' : 'en-US') : '—'}</p></div><div><p className="text-[10px] uppercase text-slate-500">{language === 'de' ? 'Umlaufmenge' : 'Circulating supply'}</p><p className="mt-1 font-mono font-semibold text-white">{circulatingSupply ? formatCompactNumber(circulatingSupply) : '—'} {ticker}</p></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[480px] table-fixed text-left text-[11px]">
        <thead><tr className="border-b border-white/10 text-[10px] uppercase text-slate-500"><th className="w-12 px-4 py-2 font-medium">#</th><th className="px-2 py-2 font-medium">{language === 'de' ? 'Adresse' : 'Address'}</th><th className="w-32 px-2 py-2 text-right font-medium">{language === 'de' ? 'Bestand' : 'Balance'}</th><th className="w-20 px-4 py-2 text-right font-medium">{language === 'de' ? 'Anteil' : 'Share'}</th></tr></thead>
        <tbody><tr><td colSpan={4} className="px-4 py-10 text-center text-xs text-slate-500">{language === 'de' ? 'Adressbasiertes Ranking noch nicht lokal indexiert.' : 'Address-level ranking has not been indexed locally yet.'}</td></tr></tbody>
      </table></div>
    </section>
  </div>;
}