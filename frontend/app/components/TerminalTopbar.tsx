'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Activity, ArrowUpRight, Bell, ChartNoAxesCombined, Check, ChevronDown, MessageCircle, Search, Settings2 } from 'lucide-react';
import TokenLogo from './TokenLogo';
import SubscriptionBadge from './SubscriptionBadge';
import AdminControls from './AdminControls';
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';
import { API_URL } from '../lib/api';
import type { MarketToken } from '../lib/tokens';
import styles from '../trade/terminal.module.css';

interface TerminalTopbarProps {
  onCommunity: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  choices: MarketToken[];
  onSelectToken: (token: MarketToken) => void;
  tradeHref?: string;
  selectedTokenId?: string;
}

export default function TerminalTopbar({ onCommunity, query, onQueryChange, choices, onSelectToken, tradeHref, selectedTokenId }: TerminalTopbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [utcNow, setUtcNow] = useState<Date | null>(null);
  const [chainTip, setChainTip] = useState<{ block_no: number | null; block_time: string; epoch?: number; slots_to_epoch_end?: number | null; db_sync_progress?: number | null } | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const { currency, setCurrency } = useCurrency();
  const { language } = useLanguage();
  const de = language === 'de';
  const searchRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerSearchRef = useRef<HTMLInputElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const results = choices.filter((token) => `${token.ticker} ${token.name} ${token.policyId ?? ''} ${token.fingerprint ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8);
  const pickerTokens = choices.filter((token) => token.ticker !== 'ADA' && `${token.ticker} ${token.name} ${token.policyId ?? ''}`.toLowerCase().includes(pickerQuery.trim().toLowerCase()));

  useEffect(() => {
    if (!pickerOpen) return;
    pickerSearchRef.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node) && !pickerButtonRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    window.addEventListener('pointerdown', outside);
    return () => window.removeEventListener('pointerdown', outside);
  }, [pickerOpen]);

  const choose = (token: MarketToken) => {
    onSelectToken(token);
    setPickerOpen(false);
    setPickerQuery('');
    onQueryChange('');
    pickerButtonRef.current?.focus();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key.toLowerCase() === 'k' && ((event.ctrlKey || event.metaKey) || !target.closest('input, textarea, select, [contenteditable="true"]'))) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === searchRef.current) searchRef.current?.blur();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const clock = window.setInterval(() => setUtcNow(new Date()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    let active = true;
    const loadTip = async () => {
      try {
        const response = await fetch(`${API_URL}/api/chain/status`);
        const json = await response.json();
        if (active) { setApiOnline(response.ok); setChainTip(response.ok && json.success ? json.data : null); }
      } catch { if (active) { setApiOnline(false); setChainTip(null); } }
    };
    void loadTip();
    const interval = window.setInterval(loadTip, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const lastBlock = chainTip ? new Date(chainTip.block_time).getTime() : NaN;
  const chainFresh = utcNow && Number.isFinite(lastBlock) && Math.abs(utcNow.getTime() - lastBlock) < 10 * 60_000;
  const lagSeconds = utcNow && Number.isFinite(lastBlock) ? Math.max(0, Math.floor((utcNow.getTime() - lastBlock) / 1000)) : null;
  const lag = lagSeconds === null ? '—' : lagSeconds < 120 ? `${lagSeconds}s` : `${Math.floor(lagSeconds / 60)}m`;
  const timeZone = de ? 'Europe/Berlin' : 'UTC';
  const timeLocale = de ? 'de-DE' : 'en-GB';

  return <header data-cardyx-topbar className={`${styles.topBar} sticky top-0 z-40 flex min-h-16 shrink-0 flex-wrap items-center gap-2 px-3 pb-3 sm:h-16 sm:flex-nowrap sm:px-4 sm:pb-0`}>
    <Link href="/market" aria-label={de ? 'Zurück zur Übersicht' : 'Back to overview'} title={de ? 'Zurück zur Übersicht' : 'Back to overview'} className="h-[50px] w-12 shrink-0 overflow-hidden xl:w-[240px]"><Image src="/cardyx-trade-logo.jpeg" alt="CARDYX" width={240} height={50} priority className="h-[50px] w-[240px] max-w-none" /></Link>
    <div className="relative order-last min-w-0 max-w-xl flex-1 basis-full sm:order-none sm:basis-auto xl:ml-2">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-300" />
      <input ref={searchRef} type="search" value={query} onChange={(event) => { setPickerOpen(false); onQueryChange(event.target.value); }} onKeyDown={(event) => { if (event.key === 'Escape') onQueryChange(''); if (event.key === 'Enter' && results[0]) choose(results[0]); }} aria-label={de ? 'Token suchen' : 'Search token'} placeholder={de ? 'Token, Adresse, Pool oder Symbol suchen...' : 'Search token, address, pool or symbol...'} className={`${styles.searchGlass} h-10 w-full rounded-md pl-10 pr-12 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none`} />
      <button ref={pickerButtonRef} type="button" aria-label={de ? 'Token auswählen' : 'Select token'} title={de ? 'Token auswählen' : 'Select token'} aria-haspopup="listbox" aria-expanded={pickerOpen} aria-controls="topbar-token-list" onClick={() => { onQueryChange(''); setPickerQuery(''); setPickerOpen((open) => !open); }} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded border border-blue-500/30 bg-blue-500/15 text-sky-300 hover:bg-blue-500/25"><ChevronDown className="h-4 w-4" /></button>
      {pickerOpen && <div ref={pickerRef} onKeyDown={(event) => {
        if (event.key === 'Escape') { setPickerOpen(false); pickerButtonRef.current?.focus(); }
        if (event.key === 'ArrowDown' && event.target === pickerSearchRef.current) { event.preventDefault(); pickerRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus(); }
        if (event.key === 'ArrowDown' && (event.target as HTMLElement).getAttribute('role') === 'option') { event.preventDefault(); ((event.target as HTMLElement).nextElementSibling as HTMLElement | null)?.focus(); }
        if (event.key === 'ArrowUp' && (event.target as HTMLElement).getAttribute('role') === 'option') { event.preventDefault(); (((event.target as HTMLElement).previousElementSibling as HTMLElement | null) ?? pickerSearchRef.current)?.focus(); }
      }} className="absolute left-0 right-0 top-full z-50 mt-1 rounded border border-blue-500/50 bg-[#08162b] p-1 shadow-xl">
        <input ref={pickerSearchRef} type="search" aria-label={de ? 'Tokenliste filtern' : 'Filter token list'} placeholder={de ? 'Token oder Policy' : 'Token or policy'} value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && pickerTokens[0]) choose(pickerTokens[0]); }} className="mb-1 h-8 w-full min-w-0 rounded border border-white/10 bg-[#061122] px-2 text-xs text-white outline-none focus:border-cyan-400/50" />
        <div id="topbar-token-list" role="listbox" aria-label={de ? 'Tokenauswahl' : 'Token selection'} className="max-h-[min(280px,calc(100dvh-180px))] overflow-y-auto">{pickerTokens.map((token) => <button key={token.id} type="button" role="option" aria-selected={token.id === selectedTokenId} onClick={() => choose(token)} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-slate-200 hover:bg-cyan-400/10 focus:bg-cyan-400/10 focus:outline-none"><TokenLogo src={token.image} ticker={token.ticker} size={20} /><span className="min-w-0 flex-1"><strong className="block">{token.ticker}</strong><span className="block truncate text-[10px] text-slate-500">{token.name}</span></span>{token.id === selectedTokenId && <Check className="h-3 w-3 shrink-0 text-cyan-300" />}</button>)}</div>
        {!pickerTokens.length && <p className="px-2 py-3 text-xs text-slate-500">{de ? 'Kein Token gefunden.' : 'No token found.'}</p>}
      </div>}
      {query.trim() && !pickerOpen && <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(256px,calc(100dvh-120px))] overflow-y-auto rounded border border-blue-500/50 bg-[#08162b] shadow-[0_12px_28px_rgba(0,25,65,0.8)]">{results.map((token) => <button key={token.id} type="button" onClick={() => choose(token)} className="flex w-full items-center gap-2 border-b border-white/5 px-3 py-2 text-left text-xs text-slate-200 hover:bg-cyan-400/10"><TokenLogo src={token.image} ticker={token.ticker} size={20} /><span className="font-bold">{token.ticker}</span><span className="min-w-0 truncate text-slate-500">{token.name}</span></button>)}{!results.length && <p className="px-3 py-2 text-xs text-slate-500">{de ? 'Kein Token gefunden.' : 'No token found.'}</p>}</div>}
    </div>
    <div className="hidden min-w-32 items-center gap-2 border-l border-sky-900/50 pl-3 text-[10px] xl:flex" title={chainTip ? `${de ? 'Letzter Block' : 'Last block'}: ${chainTip.block_time}${chainTip.slots_to_epoch_end != null ? ` · ${chainTip.slots_to_epoch_end.toLocaleString(timeLocale)} ${de ? 'Slots bis Epochenende' : 'slots to epoch end'}` : ''}` : (de ? 'Chain-Status nicht verfügbar' : 'Chain status unavailable')}>
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${chainFresh ? 'border-emerald-400/50 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]' : 'border-amber-400/50 text-amber-400'}`}><Activity className="h-3 w-3" /></span>
      <span><strong className="block whitespace-nowrap font-medium text-sky-100">Cardano Mainnet</strong><span className={chainFresh ? 'text-emerald-400' : 'text-amber-400'}>{chainTip?.block_no != null ? `${chainTip.epoch != null ? `Epoch ${chainTip.epoch} · ` : ''}Block ${chainTip.block_no.toLocaleString(timeLocale)}` : (de ? 'Status unbekannt' : 'Status unknown')}</span></span>
    </div>
    <div className="hidden shrink-0 border-l border-sky-900/50 pl-3 text-right text-[10px] text-slate-400 lg:block"><span className="block font-mono text-sky-200">{utcNow ? utcNow.toLocaleTimeString(timeLocale, { timeZone, hour12: false, timeZoneName: 'short' }) : '—'}</span><span>{utcNow ? utcNow.toLocaleDateString(timeLocale, { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</span></div>
    <div className="hidden shrink-0 items-center gap-1.5 pl-1 xl:flex" aria-label={de ? 'Systemstatus' : 'System status'}>
      <span className={styles.statusChip} title={de ? 'CARDYX API-Status' : 'CARDYX API status'}><span className={`h-1.5 w-1.5 rounded-full ${apiOnline === true ? 'bg-emerald-400' : apiOnline === false ? 'bg-rose-400' : 'bg-slate-500'}`} /><span>API</span><strong className={apiOnline === true ? 'text-emerald-300' : apiOnline === false ? 'text-rose-300' : 'text-slate-400'}>{apiOnline === null ? '—' : apiOnline ? 'Online' : 'Offline'}</strong></span>
      <span className={styles.statusChip} title={de ? 'Keine getrennte Node-Sync-Telemetrie verfügbar' : 'Separate node sync telemetry is unavailable'}><span className="h-1.5 w-1.5 rounded-full bg-slate-500" /><span>Node Sync</span><strong className="text-slate-400">—</strong></span>
      <span className={styles.statusChip} title={chainTip ? `${de ? 'Letzter indexierter Block' : 'Last indexed block'}: ${chainTip.block_no ?? '—'} · ${chainTip.block_time}${chainTip.db_sync_progress != null ? ` · ${chainTip.db_sync_progress.toFixed(2)}%` : ''}` : (de ? 'db-sync-Status nicht verfügbar' : 'db-sync status unavailable')}><span className={`h-1.5 w-1.5 rounded-full ${chainFresh ? 'bg-emerald-400' : lagSeconds !== null ? 'bg-amber-400' : 'bg-slate-500'}`} /><span>DB Sync</span><strong className={chainFresh ? 'text-emerald-300' : 'text-amber-300'}>{lag}</strong></span>
    </div>
    <div className="ml-auto flex shrink-0 items-center gap-1">
      {tradeHref && <Link href={tradeHref} aria-label={de ? 'Trading Terminal öffnen' : 'Open trading terminal'} title={de ? 'Trading Terminal öffnen' : 'Open trading terminal'} className={`${styles.statusChip} hover:brightness-125`}><ChartNoAxesCombined className="h-3 w-3" /><strong className="hidden 2xl:inline">Trading Terminal</strong><ArrowUpRight className="hidden h-3 w-3 2xl:block" /></Link>}
      <AdminControls />
      <div className="flex shrink-0 items-center gap-1 border-l border-sky-900/50 pl-2">
        <button type="button" disabled aria-label={de ? 'Benachrichtigungen' : 'Notifications'} title={de ? 'Benachrichtigungen noch nicht verfügbar' : 'Notifications are not available yet'} className="hidden rounded p-2 text-slate-600 sm:block"><Bell className="h-4 w-4" /></button>
        <div className="relative"><button type="button" aria-label={de ? 'Währung einstellen' : 'Currency settings'} aria-expanded={settingsOpen} title={de ? 'Währung einstellen' : 'Currency settings'} onClick={() => setSettingsOpen((value) => !value)} className="rounded p-2 text-sky-300 hover:bg-blue-500/15 hover:text-white"><Settings2 className="h-4 w-4" /></button>{settingsOpen && <div className="absolute right-0 top-full z-50 mt-2 flex rounded border border-blue-500/50 bg-[#08162b] p-1 shadow-xl">{(['ADA', 'USD'] as const).map((unit) => <button key={unit} type="button" aria-pressed={currency === unit} onClick={() => { setCurrency(unit); setSettingsOpen(false); }} className={`rounded px-3 py-1.5 text-xs font-bold ${currency === unit ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>{unit}</button>)}</div>}</div>
        <SubscriptionBadge compact={!!tradeHref} />
        <button type="button" onClick={onCommunity} aria-label="Community" title="Community" className={`${tradeHref ? 'hidden sm:block' : ''} rounded p-2 text-slate-500 hover:text-cyan-200`}><MessageCircle className="h-4 w-4" /></button>
      </div>
    </div>
  </header>;
}