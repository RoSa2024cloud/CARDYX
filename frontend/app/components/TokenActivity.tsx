'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Users } from 'lucide-react';
import { API_URL } from '../lib/api';
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

interface Holder {
  key: string;
  address: string;
  addressCount: number;
  balance: number;
  share: number;
  totalHolders: number;
  totalSupply: number;
}

export default function TokenActivity({ marketId, ticker, holderCount, adaPriceUsd, policyId, assetName, compact = false, view = 'all', pageSize, scrollable = false }: {
  marketId: string;
  ticker: string;
  holderCount: number;
  adaPriceUsd: number | null;
  policyId: string | null;
  assetName: string | null | undefined;
  compact?: boolean;
  view?: 'all' | 'trades' | 'holders';
  pageSize?: number;
  scrollable?: boolean;
}) {
  const { language } = useLanguage();
  const { currency } = useCurrency();
  const [feed, setFeed] = useState<{ marketId: string; trades: LocalTrade[]; error: boolean } | null>(null);
  const [holderData, setHolderData] = useState<{ marketId: string; mode: 'wallets' | 'groups'; holders: Holder[]; error: boolean } | null>(null);
  const [holderMode, setHolderMode] = useState<'wallets' | 'groups'>('wallets');
  const [holderPage, setHolderPage] = useState(1);
  const [tradePage, setTradePage] = useState(1);
  const trades = feed?.marketId === marketId ? feed.trades : [];
  const holders = holderData?.marketId === marketId && holderData.mode === holderMode ? holderData.holders : [];
  const rowsPerPage = pageSize === undefined ? 10 : Math.max(1, Math.min(10, Math.floor(pageSize)));
  const holderPages = Math.max(1, Math.ceil(holders.length / rowsPerPage));
  const currentHolderPage = pageSize === undefined ? holderPage : Math.min(holderPage, holderPages);
  const tradePages = Math.max(1, Math.ceil(trades.length / rowsPerPage));
  const currentTradePage = Math.min(tradePage, tradePages);
  const visibleTrades = scrollable ? trades : pageSize === undefined ? (compact ? trades.slice(0, 5) : trades) : trades.slice((currentTradePage - 1) * rowsPerPage, currentTradePage * rowsPerPage);
  const visibleHolders = scrollable ? holders : pageSize === undefined ? (compact ? holders.slice(0, 5) : holders.slice((holderPage - 1) * 10, holderPage * 10)) : holders.slice((currentHolderPage - 1) * rowsPerPage, currentHolderPage * rowsPerPage);
  const knownHolderCount = holderMode === 'groups' ? holders[0]?.totalHolders ?? 100 : holderCount;
  const pageCount = Math.min(10, Math.max(1, Math.ceil(knownHolderCount / 10)));

  useEffect(() => {
    if (view === 'holders') return;
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
  }, [marketId, view]);

  useEffect(() => {
    if (view === 'trades' || !policyId || !assetName) return;
    let active = true;
    const load = async () => {
      for (let attempt = 0; attempt < 180 && active; attempt += 1) {
        try {
          const response = await fetch(`/api/market/holders/${encodeURIComponent(marketId)}?mode=${holderMode}`);
          const json = await response.json();
          if (response.status === 202 || json.data?.pending) {
            await new Promise((resolve) => window.setTimeout(resolve, 2000));
            continue;
          }
          if (!response.ok || !json.success || !Array.isArray(json.data?.holders)) throw new Error('Local holders unavailable');
          if (active) setHolderData({ marketId, mode: holderMode, holders: json.data.holders, error: false });
          return;
        } catch {
          if (active) setHolderData({ marketId, mode: holderMode, holders: [], error: true });
          return;
        }
      }
      if (active) setHolderData({ marketId, mode: holderMode, holders: [], error: true });
    };
    void load();
    return () => { active = false; };
  }, [marketId, holderMode, policyId, assetName, view]);

  return <div data-paginated={!scrollable && pageSize !== undefined || undefined} data-scrollable={scrollable || undefined} className={`grid min-w-0 gap-4 ${compact || view !== 'all' ? '' : 'xl:grid-cols-[minmax(0,1fr)_360px]'}`}>
    {view !== 'holders' && <section className={`${scrollable ? 'flex min-h-0 flex-col' : ''} overflow-hidden rounded-md border border-white/10 bg-[#0b111b]`} aria-label={language === 'de' ? 'Letzte Trades' : 'Latest trades'}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div><h2 className="text-sm font-semibold text-white">{language === 'de' ? 'Letzte Trades' : 'Latest trades'}</h2><p className="text-[10px] text-slate-500">CARDYX / db-sync · {ticker}/ADA</p></div>
      </div>
      <div className={scrollable ? 'min-h-0 flex-1 overflow-auto overscroll-contain' : 'overflow-x-auto'} tabIndex={scrollable ? 0 : undefined} role={scrollable ? 'region' : undefined} aria-label={scrollable ? (language === 'de' ? 'Trade-Liste' : 'Trade list') : undefined}>
        <table className={`w-full table-fixed text-left ${compact ? 'text-[10px]' : 'min-w-[620px] text-[11px]'}`}>
          <thead className={scrollable ? 'sticky top-0 z-10 bg-[#071225]' : undefined}><tr className="border-b border-white/10 text-[10px] uppercase text-slate-500"><th className={compact ? 'w-14 px-2 py-2 font-medium' : 'w-[90px] px-4 py-2 font-medium'}>{language === 'de' ? 'Zeit' : 'Time'}</th><th className={compact ? 'w-12 px-1 py-2 font-medium' : 'w-[80px] px-2 py-2 font-medium'}>{language === 'de' ? 'Seite' : 'Side'}</th><th className="px-2 py-2 font-medium">{language === 'de' ? 'Menge' : 'Amount'}</th><th className={compact ? 'w-20 px-2 py-2 text-right font-medium' : 'w-[110px] px-2 py-2 text-right font-medium'}>{currency}</th>{!compact && <th className="w-[120px] px-2 py-2 font-medium">DEX</th>}<th className={compact ? 'w-7 px-1 py-2 text-right font-medium' : 'w-[52px] px-2 py-2 text-right font-medium'}>TX</th></tr></thead>
          <tbody>{visibleTrades.map((trade, index) => <tr key={`${trade.tx_hash}-${trade.dex}-${index}`} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
            <td className={compact ? 'px-2 py-2 text-slate-400' : 'px-4 py-2 text-slate-400'} title={new Date(trade.occurred_at).toLocaleString()}>{new Date(trade.occurred_at).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', compact ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
            <td className={compact ? 'px-1 py-2' : 'px-2 py-2'}><span className={`rounded px-1.5 py-0.5 font-bold ${trade.side === 'buy' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-rose-400/10 text-rose-400'}`}>{trade.side === 'buy' ? language === 'de' ? 'KAUF' : 'BUY' : language === 'de' ? 'VERK.' : 'SELL'}</span></td>
            <td className={`${scrollable ? 'break-words [overflow-wrap:anywhere]' : 'truncate'} px-2 py-2 font-mono text-slate-200`} title={`${trade.amount} ${ticker}`}>{Number(trade.amount).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 4 })} {ticker} <span className="text-slate-500">{trade.side === 'buy' ? '← ADA' : '→ ADA'}</span></td>
            <td className={`${scrollable ? 'break-words [overflow-wrap:anywhere]' : 'truncate'} px-2 py-2 text-right font-mono font-semibold text-slate-200`}>{currency === 'USD' ? adaPriceUsd ? `$${(Number(trade.ada_notional) * adaPriceUsd).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 })}` : '—' : `₳${Number(trade.ada_notional).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 })}`}</td>
            {!compact && <td className="truncate px-2 py-2 text-slate-400" title={`${trade.dex} ${trade.version}`}>{trade.dex} {trade.version}</td>}
            <td className="px-2 py-2 text-right"><a href={`https://cardanoscan.io/transaction/${trade.tx_hash}`} target="_blank" rel="noopener noreferrer" title={trade.tx_hash} aria-label={`${language === 'de' ? 'Transaktion öffnen' : 'Open transaction'} ${trade.tx_hash}`} className="inline-flex text-cyan-400 hover:text-cyan-200"><ExternalLink className="h-3.5 w-3.5" /></a></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!feed || feed.marketId !== marketId ? <p className="px-4 py-7 text-center text-xs text-slate-500">{language === 'de' ? 'Lokale Trades werden geladen…' : 'Loading local trades…'}</p>
        : feed.error ? <p className="px-4 py-7 text-center text-xs text-slate-500">{language === 'de' ? 'Lokale Handelsdaten für diesen Token noch nicht verfügbar.' : 'Local trade data for this token is not available yet.'}</p>
        : trades.length === 0 ? <p className="px-4 py-7 text-center text-xs text-slate-500">{language === 'de' ? 'Keine verifizierten Pool-Trades für diese Auswahl.' : 'No verified pool trades for this selection.'}</p> : null}
      {!scrollable && pageSize !== undefined && <ActivityPages page={currentTradePage} pages={tradePages} onChange={setTradePage} label={language === 'de' ? 'Trade-Seiten' : 'Trade pages'} de={language === 'de'} />}
    </section>}

    {view !== 'trades' && <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-white/10 bg-[#0b111b]" aria-label={language === 'de' ? 'Top Halter' : 'Top holders'}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="min-w-0"><h2 className="flex items-center gap-2 truncate text-sm font-semibold text-white"><Users className="h-4 w-4 shrink-0 text-cyan-400" />{language === 'de' ? 'Top Halter' : 'Top holders'}</h2><p className="mt-0.5 text-[10px] text-slate-500">{holderCount ? holderCount.toLocaleString(language === 'de' ? 'de-DE' : 'en-US') : '—'} {language === 'de' ? 'Halter' : 'holders'}</p></div>
        {(!compact || ((pageSize !== undefined || scrollable) && view === 'holders')) && <div className="grid shrink-0 grid-cols-2 rounded border border-blue-400/25 bg-blue-950/40 p-0.5" role="group" aria-label={language === 'de' ? 'Holder gruppieren' : 'Holder grouping'}>
          <button type="button" aria-pressed={holderMode === 'wallets'} onClick={() => { setHolderMode('wallets'); setHolderPage(1); }} className={`rounded px-1.5 py-1 text-[9px] font-semibold ${holderMode === 'wallets' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{language === 'de' ? 'Wallets' : 'Wallets'}</button>
          <button type="button" aria-pressed={holderMode === 'groups'} title={language === 'de' ? 'Gruppiert nach gemeinsamem Stake-Credential.' : 'Grouped by shared stake credential.'} onClick={() => { setHolderMode('groups'); setHolderPage(1); }} className={`rounded px-1.5 py-1 text-[9px] font-semibold ${holderMode === 'groups' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{language === 'de' ? 'Gruppen' : 'Groups'}</button>
        </div>}
      </div>
      <div className={`min-h-0 flex-1 overflow-auto ${scrollable ? 'overscroll-contain' : ''}`} tabIndex={scrollable ? 0 : undefined} role={scrollable ? 'region' : undefined} aria-label={scrollable ? (language === 'de' ? 'Halter-Liste' : 'Holder list') : undefined}><table className="w-full min-w-[300px] table-fixed text-left text-[10px]">
        <thead className={scrollable ? 'sticky top-0 z-10 bg-[#071225]' : undefined}><tr className="border-b border-white/10 text-[9px] uppercase text-slate-500"><th className="w-8 px-3 py-1.5 font-medium">#</th><th className="px-1 py-1.5 font-medium">{language === 'de' ? 'Adresse' : 'Address'}</th><th className={`${scrollable ? 'w-[44%]' : 'w-24'} px-2 py-1.5 text-right font-medium`}>{language === 'de' ? `Bestand (${ticker})` : `Balance (${ticker})`}</th><th className="w-14 px-3 py-1.5 text-right font-medium">%</th></tr></thead>
          <tbody>{visibleHolders.length ? visibleHolders.map((holder, index) => <tr key={holder.key} className="border-b border-white/5 last:border-0"><td className="px-3 py-1.5 text-slate-500">{(scrollable ? 0 : (currentHolderPage - 1) * rowsPerPage) + index + 1}</td><td className="truncate px-1 py-1.5 font-mono text-slate-300" title={holder.address}>{shortAddress(holder.address)}{holderMode === 'groups' && holder.addressCount > 1 && <span className="ml-1 text-[9px] text-cyan-300">+{holder.addressCount - 1}</span>}</td><td className={`${scrollable ? 'break-words [overflow-wrap:anywhere]' : 'truncate'} px-2 py-1.5 text-right font-mono text-slate-200`}>{formatBalance(holder.balance, language)}</td><td className="px-3 py-1.5 text-right text-slate-400">{formatShare(holder.share, language)}%</td></tr>) : <tr><td colSpan={4} className="px-3 py-3 text-center text-[10px] text-slate-500">{!policyId || !assetName ? (language === 'de' ? 'Tokenidentität fehlt.' : 'Token identity unavailable.') : holderData?.marketId === marketId && holderData.mode === holderMode && holderData.error ? (language === 'de' ? 'Holderdaten nicht verfügbar.' : 'Holder data unavailable.') : (language === 'de' ? 'Holder werden geladen…' : 'Loading holders…')}</td></tr>}</tbody>
      </table></div>
      {!scrollable && (pageSize !== undefined ? <ActivityPages page={currentHolderPage} pages={holderPages} onChange={setHolderPage} label={language === 'de' ? 'Holder-Seiten' : 'Holder pages'} de={language === 'de'} /> : !compact && <div className="grid shrink-0 grid-cols-10 gap-1 border-t border-white/5 px-2 py-2" role="navigation" aria-label={language === 'de' ? 'Holder-Seiten' : 'Holder pages'}>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => <button key={number} type="button" aria-current={holderPage === number ? 'page' : undefined} disabled={number > pageCount} onClick={() => setHolderPage(number)} className={`min-w-0 rounded border px-0.5 py-1.5 text-[10px] font-semibold ${holderPage === number ? 'border-blue-400/60 bg-blue-600/70 text-white' : 'border-transparent text-slate-300 hover:bg-blue-500/15'} disabled:cursor-not-allowed disabled:opacity-30`}>{number}</button>)}
      </div>)}
    </section>}
  </div>;
}

function ActivityPages({ page, pages, onChange, label, de }: { page: number; pages: number; onChange: (page: number) => void; label: string; de: boolean }) {
  return <nav aria-label={label} className="flex shrink-0 items-center justify-center gap-3 border-t border-white/5 px-2 py-1">
    <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={`${de ? 'Vorherige Seite' : 'Previous page'}: ${label}`} title={de ? 'Vorherige Seite' : 'Previous page'} className="flex h-6 w-6 items-center justify-center rounded text-cyan-300 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
    <span aria-live="polite" className="min-w-16 text-center text-[10px] tabular-nums text-slate-400">{page} / {pages}</span>
    <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={`${de ? 'Nächste Seite' : 'Next page'}: ${label}`} title={de ? 'Nächste Seite' : 'Next page'} className="flex h-6 w-6 items-center justify-center rounded text-cyan-300 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
  </nav>;
}

function shortAddress(address: string): string {
  return address.length > 20 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address;
}

function formatBalance(value: number, language: string): string {
  return value.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 });
}

function formatShare(value: number, language: string): string {
  return value.toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}