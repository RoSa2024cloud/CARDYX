'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeftRight, ArrowRight, Bell, ChartNoAxesCombined, Check, ChevronDown, Compass, Copy, CreditCard, Database, Gauge, Landmark, LayoutDashboard, Loader2, MessageCircle, PieChart, Search, Settings2, ShieldCheck, Wallet, WalletCards } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from './terminal.module.css';
import TokenLogo from '../components/TokenLogo';
import WalletConnectModal from '../components/WalletConnectModal';
import TradeChart from '../components/TradeChart';
import OrderBookPanel from '../components/OrderBookPanel';
import TradePanel from '../components/TradePanel';
import TokenActivity from '../components/TokenActivity';
import { WalletProvider, useDetectedWallets, useWallet } from '../components/WalletProvider';
import { useCurrency } from '../components/CurrencyProvider';
import { useLanguage } from '../components/LanguageProvider';
import { API_URL } from '../lib/api';
import { MarketToken, formatChange, formatMarketValue, formatTokenPrice } from '../lib/tokens';

export default function NewTradePage() {
  return <WalletProvider><NewTradeWorkspace /></WalletProvider>;
}

function NewTradeWorkspace() {
  const router = useRouter();
  const { currency } = useCurrency();
  const { language } = useLanguage();
  const wallet = useWallet();
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<MarketToken | null>(null);
  const [adaPriceUsd, setAdaPriceUsd] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/market/catalog`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error('Market unavailable');
        return json.data;
      })
      .then((data) => {
        if (!active) return;
        const catalog: MarketToken[] = data.tokens ?? [];
        const requested = new URLSearchParams(window.location.search).get('token');
        setTokens(catalog);
        setAdaPriceUsd(data.adaPriceUsd ?? null);
        setSelectedToken(catalog.find((token) => token.id === requested) ?? catalog.find((token) => token.ticker !== 'ADA' && token.priceAda > 0) ?? catalog[0] ?? null);
        setLoading(false);
      })
      .catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, []);

  const selectToken = (token: MarketToken) => {
    setSelectedToken(token);
    setQuery('');
    router.replace(`/trade?token=${encodeURIComponent(token.id)}`, { scroll: false });
  };

  const choices = [
    ...(selectedToken ? [selectedToken] : []),
    ...tokens.filter((token) => token.id !== selectedToken?.id && (query ? `${token.ticker} ${token.name} ${token.policyId ?? ''}`.toLowerCase().includes(query.toLowerCase()) : token.ticker !== 'ADA' && token.priceAda > 0)).slice(0, 80),
  ];

  return <main className="min-h-screen bg-[#020711] text-slate-200 lg:h-dvh lg:overflow-hidden">
    <NewTerminalTopbar wallet={wallet} onCommunity={() => router.push('/community')} query={query} onQueryChange={setQuery} choices={choices} onSelectToken={selectToken} />
    <div className="flex min-h-[calc(100vh-64px)] lg:h-[calc(100dvh-64px)] lg:min-h-0">
      <NewTerminalSidebar onNavigate={(path) => router.push(path)} tokens={tokens} />
      <div className="min-w-0 flex-1 lg:overflow-hidden">
        <div className="w-full px-3 py-3 sm:px-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:gap-1 lg:px-0 lg:py-1">
          {loading ? <div className="flex min-h-[70vh] items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Terminal wird geladen...</div>
            : error || !selectedToken ? <p className="py-16 text-center text-sm text-slate-400">Lokale Tokendaten sind derzeit nicht verfügbar.</p>
              : <>
                <header className="mb-3 flex flex-wrap items-center gap-3 border-b border-cyan-300/15 pb-3 lg:mb-0 lg:min-h-12 lg:shrink-0 lg:flex-nowrap lg:gap-2 lg:pb-1">
                  <span className="lg:ml-1"><TokenLogo src={selectedToken.image} ticker={selectedToken.ticker} size={42} /></span>
                  <div className="min-w-[102px] max-w-[340px]"><h1 className="truncate text-lg font-black text-white">{selectedToken.name}</h1><p className="mt-1 truncate text-[10px] text-slate-500">{selectedToken.category ?? 'Cardano asset'} · {selectedToken.activePools?.length ?? 0} local pools</p></div>
                  <TradePairPicker tokens={tokens} selectedToken={selectedToken} currency={currency} onSelectToken={selectToken} />
                </header>
                <MarketStatsBar token={selectedToken} adaPriceUsd={adaPriceUsd} currency={currency} language={language} />
                <div className={styles.workspace}>
                  <div className={styles.chartPane}><TradeChart marketTokenId={selectedToken.id} ticker={selectedToken.ticker} adaPriceUsd={adaPriceUsd} /></div>
                  <div className={styles.activityPane}><TokenActivity marketId={selectedToken.id} ticker={selectedToken.ticker} holderCount={selectedToken.holderCount ?? 0} circulatingSupply={selectedToken.circulatingSupply} adaPriceUsd={adaPriceUsd} /></div>
                  <div className={styles.orderPane}><OrderBookPanel tokenId={selectedToken.policyId && selectedToken.assetName != null ? `${selectedToken.policyId}${selectedToken.assetName}` : null} ticker={selectedToken.ticker} adaPriceUsd={adaPriceUsd} currentPriceAda={selectedToken.priceAda} /></div>
                  <FearGreedPanel language={language} tokens={tokens} />
                  <aside className={styles.tradePane}><TradePanel tokens={tokens} adaPriceUsd={adaPriceUsd} selectedToken={selectedToken} onSelectToken={selectToken} onClose={() => router.push('/market')} /><QuickActions language={language} walletAddress={wallet.address ?? null} onNavigate={(path) => router.push(path)} /></aside>
                </div>
              </>}
        </div>
      </div>
    </div>
  </main>;
}

function TradePairPicker({ tokens, selectedToken, currency, onSelectToken }: { tokens: MarketToken[]; selectedToken: MarketToken; currency: 'ADA' | 'USD'; onSelectToken: (token: MarketToken) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const matches = tokens.filter((token) => token.ticker !== 'ADA' && (token.priceAda > 0 || token.id === selectedToken.id) && `${token.ticker} ${token.name} ${token.policyId ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 80);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) { setSearch(''); setOpen(false); }
    };
    document.addEventListener('pointerdown', onOutsideClick);
    return () => document.removeEventListener('pointerdown', onOutsideClick);
  }, [open]);

  const choose = (token: MarketToken) => {
    onSelectToken(token);
    setSearch('');
    setOpen(false);
    triggerRef.current?.focus();
  };

  return <div ref={containerRef} className="relative z-30 shrink-0 self-start" onKeyDown={(event) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); setSearch(''); setOpen(false); triggerRef.current?.focus(); }
    if (event.key === 'ArrowDown' && open && event.target === searchRef.current) { event.preventDefault(); containerRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus(); }
    if (event.key === 'ArrowDown' && open && (event.target as HTMLElement).getAttribute('role') === 'option') { event.preventDefault(); ((event.target as HTMLElement).nextElementSibling as HTMLElement | null)?.focus(); }
    if (event.key === 'ArrowUp' && open && (event.target as HTMLElement).getAttribute('role') === 'option') { event.preventDefault(); (((event.target as HTMLElement).previousElementSibling as HTMLElement | null) ?? searchRef.current)?.focus(); }
  }}>
    <button ref={triggerRef} type="button" aria-label="Trading pair" aria-haspopup="listbox" aria-expanded={open} aria-controls="trade-pair-list" onClick={() => { setSearch(''); setOpen((value) => !value); }} className={`${styles.pairSelect} flex h-7 max-w-[130px] items-center gap-2 rounded px-2 text-[11px] font-bold text-cyan-100 focus:outline-none`}>
      <span className="truncate">{selectedToken.ticker}/{currency}</span><ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className={`${styles.pairMenu} absolute left-0 top-full z-50 mt-2 w-[min(278px,calc(100vw-32px))] rounded-md p-1`}>
      <div className="relative mb-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sky-400" /><input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); containerRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus(); } }} aria-label="Paar suchen" placeholder="Token oder Policy suchen" className="h-8 w-full rounded border border-cyan-400/25 bg-[#08162b] pl-8 pr-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400/70 focus:outline-none" /></div>
      <div id="trade-pair-list" role="listbox" aria-label="Handelspaare" className="max-h-[min(330px,calc(100dvh-160px))] overflow-y-auto overscroll-contain">
        {matches.map((token) => <button key={token.id} type="button" role="option" aria-selected={token.id === selectedToken.id} onClick={() => choose(token)} className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-cyan-400/10 focus:bg-cyan-400/10 focus:outline-none ${token.id === selectedToken.id ? 'bg-violet-400/10 text-cyan-100' : 'text-slate-300'}`}><TokenLogo src={token.image} ticker={token.ticker} size={20} /><span className="min-w-0 flex-1"><span className="block font-bold">{token.ticker}/{currency}</span><span className="block truncate text-[10px] text-slate-500">{token.name}</span></span>{token.id === selectedToken.id && <Check className="h-3.5 w-3.5 shrink-0 text-cyan-300" />}</button>)}
        {matches.length === 0 && <p className="px-2 py-4 text-center text-xs text-slate-500">Keine Handelspaare gefunden.</p>}
      </div>
    </div>}
  </div>;
}

function NewTerminalTopbar({ wallet, onCommunity, query, onQueryChange, choices, onSelectToken }: { wallet: ReturnType<typeof useWallet>; onCommunity: () => void; query: string; onQueryChange: (query: string) => void; choices: MarketToken[]; onSelectToken: (token: MarketToken) => void }) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [utcNow, setUtcNow] = useState<Date | null>(null);
  const [chainTip, setChainTip] = useState<{ block_no: number | null; block_time: string; epoch?: number; slots_to_epoch_end?: number; db_sync_progress?: number | null } | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const { currency, setCurrency } = useCurrency();
  const { language } = useLanguage();
  const searchRef = useRef<HTMLInputElement>(null);

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
        if (active) setApiOnline(true);
        const json = await response.json();
        if (active) setChainTip(response.ok && json.success ? json.data : null);
      } catch {
        if (active) { setApiOnline(false); setChainTip(null); }
      }
    };
    void loadTip();
    const interval = window.setInterval(loadTip, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const lastBlock = chainTip ? new Date(chainTip.block_time).getTime() : NaN;
  const chainFresh = utcNow && Number.isFinite(lastBlock) && Math.abs(utcNow.getTime() - lastBlock) < 10 * 60_000;
  const dbSyncLagSeconds = utcNow && Number.isFinite(lastBlock) ? Math.max(0, Math.floor((utcNow.getTime() - lastBlock) / 1000)) : null;
  const dbSyncLag = dbSyncLagSeconds === null ? '—' : dbSyncLagSeconds < 120 ? `${dbSyncLagSeconds}s` : `${Math.floor(dbSyncLagSeconds / 60)}m`;
  const timeZone = language === 'de' ? 'Europe/Berlin' : 'UTC';
  const timeLocale = language === 'de' ? 'de-DE' : 'en-GB';

  return <>
    <header className={`${styles.topBar} sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 px-3 sm:px-4`}>
      <div className="h-[50px] w-12 shrink-0 overflow-hidden xl:w-[240px]"><Image src="/cardyx-trade-logo.jpeg" alt="CARDYX" width={240} height={50} priority className="h-[50px] w-[240px] max-w-none" /></div>
      <div className="relative min-w-0 max-w-xl flex-1 xl:ml-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-300" />
        <input ref={searchRef} type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} aria-label="Token suchen" placeholder="Token, Adresse, Pool oder Symbol suchen..." className={`${styles.searchGlass} h-10 w-full rounded-md pl-10 pr-12 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none`} />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-blue-500/30 bg-blue-500/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">K</kbd>
        {query && <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded border border-blue-500/50 bg-[#08162b] shadow-[0_12px_28px_rgba(0,25,65,0.8)]">{choices.slice(1, 9).map((token) => <button key={token.id} type="button" onClick={() => onSelectToken(token)} className="flex w-full items-center gap-2 border-b border-white/5 px-3 py-2 text-left text-xs text-slate-200 hover:bg-cyan-400/10"><TokenLogo src={token.image} ticker={token.ticker} size={20} /><span className="font-bold">{token.ticker}</span><span className="truncate text-slate-500">{token.name}</span></button>)}{choices.length <= 1 && <p className="px-3 py-2 text-xs text-slate-500">Kein Token gefunden.</p>}</div>}
      </div>
      <div className="hidden min-w-32 items-center gap-2 border-l border-sky-900/50 pl-3 text-[10px] xl:flex" title={chainTip ? `${language === 'de' ? 'Letzter Block' : 'Last block'}: ${chainTip.block_time}${chainTip.slots_to_epoch_end != null ? ` · ${chainTip.slots_to_epoch_end.toLocaleString('de-DE')} ${language === 'de' ? 'Slots bis Epochenende' : 'slots to epoch end'}` : ''}` : 'Chain-Status nicht verfügbar'}>
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${chainFresh ? 'border-emerald-400/50 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]' : 'border-amber-400/50 text-amber-400'}`}><Activity className="h-3 w-3" /></span>
        <span><strong className="block whitespace-nowrap font-medium text-sky-100">Cardano Mainnet</strong><span className={chainFresh ? 'text-emerald-400' : 'text-amber-400'}>{chainTip?.block_no != null ? `${chainTip.epoch != null ? `Epoch ${chainTip.epoch} · ` : ''}Block ${chainTip.block_no.toLocaleString('de-DE')}` : 'Status unbekannt'}</span></span>
      </div>
      <div className="hidden shrink-0 border-l border-sky-900/50 pl-3 text-right text-[10px] text-slate-400 lg:block"><span className="block font-mono text-sky-200">{utcNow ? utcNow.toLocaleTimeString(timeLocale, { timeZone, hour12: false, timeZoneName: 'short' }) : '—'}</span><span>{utcNow ? utcNow.toLocaleDateString(timeLocale, { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</span></div>
      <div className="hidden shrink-0 items-center gap-1.5 pl-1 xl:flex" aria-label={language === 'de' ? 'Systemstatus' : 'System status'}>
        <span className={styles.statusChip} title={apiOnline === null ? 'API-Status wird geprüft' : apiOnline ? 'CARDYX-API erreichbar' : 'CARDYX-API nicht erreichbar'}><span className={`h-1.5 w-1.5 rounded-full ${apiOnline === true ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : apiOnline === false ? 'bg-rose-400' : 'bg-slate-500'}`} /><span>API</span><strong className={apiOnline === true ? 'text-emerald-300' : apiOnline === false ? 'text-rose-300' : 'text-slate-400'}>{apiOnline === null ? '—' : apiOnline ? 'Online' : 'Offline'}</strong></span>
        <span className={styles.statusChip} title={language === 'de' ? 'Keine getrennte Node-Sync-Telemetrie verfügbar' : 'Separate node sync telemetry is unavailable'}><span className="h-1.5 w-1.5 rounded-full bg-slate-500" /><span>Node Sync</span><strong className="text-slate-400">—</strong></span>
        <span className={styles.statusChip} title={chainTip ? `${language === 'de' ? 'Letzter indexierter Block' : 'Last indexed block'}: ${chainTip.block_no ?? '—'} · ${chainTip.block_time}${chainTip.db_sync_progress != null ? ` · ${chainTip.db_sync_progress.toFixed(2)}%` : ''}` : language === 'de' ? 'db-sync-Status nicht verfügbar' : 'db-sync status unavailable'}><span className={`h-1.5 w-1.5 rounded-full ${chainFresh ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : dbSyncLagSeconds !== null ? 'bg-amber-400' : 'bg-slate-500'}`} /><span>DB Sync</span><strong className={chainFresh ? 'text-emerald-300' : 'text-amber-300'}>{dbSyncLag}</strong></span>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1 border-l border-sky-900/50 pl-2">
        <button type="button" disabled aria-label="Benachrichtigungen" title="Benachrichtigungen noch nicht verfügbar" className="rounded p-2 text-slate-600"><Bell className="h-4 w-4" /></button>
        <div className="relative"><button type="button" aria-label="Währung einstellen" aria-expanded={settingsOpen} title="Währung einstellen" onClick={() => setSettingsOpen((value) => !value)} className="rounded p-2 text-sky-300 hover:bg-blue-500/15 hover:text-white"><Settings2 className="h-4 w-4" /></button>{settingsOpen && <div className="absolute right-0 top-full z-50 mt-2 flex rounded border border-blue-500/50 bg-[#08162b] p-1 shadow-xl">{(['ADA', 'USD'] as const).map((unit) => <button key={unit} type="button" aria-pressed={currency === unit} onClick={() => { setCurrency(unit); setSettingsOpen(false); }} className={`rounded px-3 py-1.5 text-xs font-bold ${currency === unit ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>{unit}</button>)}</div>}</div>
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-sky-100 hover:border-cyan-400/70 hover:bg-blue-500/20"><span className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-400/50 bg-blue-500/20 shadow-[0_0_13px_rgba(34,211,238,0.35)]"><WalletCards className="h-4 w-4" /></span><span className="hidden text-left sm:block">{wallet.address ? `${wallet.address.slice(0, 8)}...` : 'Wallet verbinden'}</span></button>
        <button type="button" onClick={onCommunity} aria-label="Community" title="Community" className="rounded p-2 text-slate-500 hover:text-cyan-200"><MessageCircle className="h-4 w-4" /></button>
      </div>
    </header>
    {open && <WalletConnectModal onClose={() => setOpen(false)} />}
  </>;
}

function NewTerminalSidebar({ onNavigate, tokens }: { onNavigate: (path: string) => void; tokens: MarketToken[] }) {
  const entries = [[LayoutDashboard, 'Dashboard', '/market'], [ChartNoAxesCombined, 'Trading Terminal', '/trade'], [Compass, 'Token Explorer', '/token-explorer'], [WalletCards, 'Portfolio', null], [Activity, 'Watchlist', null], [ShieldCheck, 'On-Chain Intelligence', null], [Database, 'Charts & Analytics', null], [Gauge, 'Staking', null], [Settings2, 'Developer API', null], [MessageCircle, 'Community', '/community']] as const;
  return <aside className={`${styles.sidebarGlass} hidden w-[64px] shrink-0 flex-col overflow-hidden px-2 py-3 lg:flex xl:w-[256px]`}><div className="mb-3 hidden px-3 text-[11px] font-bold uppercase text-cyan-500/60 xl:block">Workspace</div><nav className="min-h-0 space-y-0.5 overflow-y-auto">{entries.map(([Icon, label, path]) => <button key={label} type="button" disabled={!path} aria-label={label} title={!path ? `${label} – Noch nicht verfügbar` : label} onClick={() => { if (path) onNavigate(path); }} className={`flex w-full items-center justify-center gap-2.5 rounded px-2 py-1.5 text-left text-[13px] font-semibold xl:justify-start xl:px-3 ${label === 'Trading Terminal' ? styles.activeNav : path ? 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200' : 'cursor-not-allowed text-slate-600'}`}><Icon className="h-4 w-4 shrink-0 xl:h-3.5 xl:w-3.5" /><span className="hidden xl:inline">{label}</span></button>)}<div className="-mx-2 mt-1 hidden justify-center xl:flex"><Image src="/cardyx-sidebar-logo.jpeg" alt="CARDYX" width={776} height={427} sizes="252px" loading="eager" className="h-auto w-[252px] object-contain" /></div></nav><div className="mt-auto hidden shrink-0 pt-2 xl:block"><WalletSummary onNavigate={onNavigate} tokens={tokens} /></div></aside>;
}

interface SidebarWalletAsset {
  policyId: string;
  assetName: string;
  fingerprint: string;
  displayQuantity: string;
}

function WalletSummary({ onNavigate, tokens }: { onNavigate: (path: string) => void; tokens: MarketToken[] }) {
  const wallet = useWallet();
  const wallets = useDetectedWallets();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [holdings, setHoldings] = useState<{ address: string; assets: SidebarWalletAsset[]; nftCount: number } | null>(null);
  const [holdingsError, setHoldingsError] = useState<string | null>(null);
  const connected = !!wallet.address;
  const walletIcon = wallets.find((entry) => entry.key === wallet.key)?.icon;
  const locale = language === 'de' ? 'de-DE' : 'en-US';
  const currentHoldings = holdings?.address === wallet.address ? holdings : null;

  useEffect(() => {
    if (!wallet.address || wallet.networkId !== 1) return;
    const controller = new AbortController();
    fetch(`${API_URL}/api/wallets/${encodeURIComponent(wallet.address)}/analysis`, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error('Holdings unavailable');
        return json.data as { assets: SidebarWalletAsset[]; nfts: unknown[] };
      })
      .then((data) => { setHoldings({ address: wallet.address!, assets: data.assets ?? [], nftCount: data.nfts?.length ?? 0 }); setHoldingsError(null); })
      .catch(() => { if (!controller.signal.aborted) setHoldingsError(wallet.address); });
    return () => controller.abort();
  }, [wallet.address, wallet.networkId]);
  const copyAddress = async () => {
    if (!wallet.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch { /* Clipboard may be unavailable outside a secure context. */ }
  };

  return <>
    <section className={`${styles.walletGlass} overflow-hidden rounded-md p-2.5`} aria-label={language === 'de' ? 'Wallet-Übersicht' : 'Wallet overview'}>
      <div className="flex items-center gap-2 border-b border-cyan-300/15 pb-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-cyan-300 shadow-[0_0_12px_rgba(45,244,255,0.25)]"><WalletCards className="h-4 w-4" /></span>
        <strong className="min-w-0 flex-1 truncate text-xs text-white">Wallet Connect</strong>
        <span className={`flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold ${connected ? wallet.networkId === 1 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300' : 'bg-white/5 text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${connected ? wallet.networkId === 1 ? 'bg-emerald-400' : 'bg-amber-400' : 'bg-slate-600'}`} />{connected ? wallet.networkId === 1 ? language === 'de' ? 'Verbunden' : 'Connected' : 'Testnet' : 'Offline'}</span>
      </div>
      {connected ? <>
        <div className="flex items-center gap-2 border-b border-cyan-300/10 py-2.5">
          {walletIcon ? <Image src={walletIcon} alt="" width={32} height={32} unoptimized className="h-8 w-8 shrink-0 rounded" /> : <WalletCards className="h-8 w-8 shrink-0 rounded bg-blue-500/20 p-1.5 text-cyan-300" />}
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{wallet.name ?? 'Cardano Wallet'}</p><p className="truncate font-mono text-[10px] text-cyan-300" title={wallet.address ?? undefined}>{wallet.address?.slice(0, 10)}…{wallet.address?.slice(-6)}</p></div>
          <button type="button" onClick={copyAddress} title={language === 'de' ? 'Adresse kopieren' : 'Copy address'} aria-label={language === 'de' ? 'Adresse kopieren' : 'Copy address'} className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-cyan-300/10 hover:text-cyan-200"><Copy className="h-3.5 w-3.5" /></button>
        </div>
        <div className="border-b border-cyan-300/10 py-2.5"><p className="text-[10px] text-slate-400">{language === 'de' ? 'ADA-Bestand' : 'ADA balance'}</p><p className="mt-1 font-mono text-base font-bold text-cyan-100">{wallet.balanceAda === null ? '—' : `₳${wallet.balanceAda.toLocaleString(locale, { maximumFractionDigits: 4 })}`}</p></div>
        {wallet.networkId === 1 && <div className="border-b border-cyan-300/10 py-2">
          <p className="mb-1 text-[10px] text-slate-400">{language === 'de' ? 'Token dieser Adresse' : 'Tokens at this address'}{currentHoldings?.nftCount ? ` · ${currentHoldings.nftCount} NFTs` : ''}</p>
          <div className="max-h-[68px] space-y-1 overflow-y-auto">
            {currentHoldings?.assets.length ? currentHoldings.assets.slice(0, 3).map((asset) => {
              const token = tokens.find((entry) => entry.policyId === asset.policyId && entry.assetName === asset.assetName);
              return <div key={asset.fingerprint} className="flex items-center gap-1.5 text-[10px]"><TokenLogo src={token?.image} ticker={token?.ticker ?? 'Asset'} size={17} /><span className="min-w-0 flex-1 truncate text-slate-200" title={asset.fingerprint}>{token?.ticker ?? asset.fingerprint.slice(0, 12)}</span><span className="shrink-0 font-mono text-slate-300">{asset.displayQuantity}</span></div>;
            }) : <p className="py-1 text-[10px] text-slate-500">{currentHoldings ? language === 'de' ? 'Keine weiteren Token' : 'No other tokens' : holdingsError === wallet.address ? language === 'de' ? 'Bestände nicht verfügbar' : 'Holdings unavailable' : language === 'de' ? 'Bestände werden geladen…' : 'Loading holdings…'}</p>}
          </div>
        </div>}
        {copied && <p className="pt-1 text-[10px] text-emerald-300">{language === 'de' ? 'Adresse kopiert' : 'Address copied'}</p>}
        <div className="mt-2 flex gap-1.5"><button type="button" disabled={wallet.networkId !== 1} onClick={() => onNavigate(`/wallet/${encodeURIComponent(wallet.address!)}`)} className="min-w-0 flex-1 rounded border border-blue-400/50 bg-blue-500/20 px-2 py-2 text-[10px] font-bold text-cyan-100 hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-40">{language === 'de' ? 'Portfolio anzeigen' : 'View portfolio'}</button><button type="button" onClick={wallet.disconnect} className="rounded border border-white/10 px-2 py-2 text-[10px] text-slate-300 hover:border-rose-300/30 hover:text-rose-200">{language === 'de' ? 'Trennen' : 'Disconnect'}</button></div>
      </> : <><p className="py-3 text-[11px] text-slate-400">{language === 'de' ? 'Keine Wallet verbunden' : 'No wallet connected'}</p><button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded border border-blue-400/40 bg-blue-500/20 py-2 text-xs font-bold text-cyan-100 hover:bg-blue-500/30"><WalletCards className="h-3.5 w-3.5" />{language === 'de' ? 'Wallet verbinden' : 'Connect wallet'}</button></>}
    </section>
    {open && <WalletConnectModal onClose={() => setOpen(false)} />}
  </>;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Score = 50 % Marktbreite (Anteil steigender Token) + 50 % Median-Momentum 24H, nur Token mit lokalem Preis und aktiver Pool-Liquidität.
function computeSentiment(tokens: MarketToken[]) {
  const active = tokens.filter((token) => token.ticker !== 'ADA' && token.category !== 'stablecoin' && token.priceAda > 0 && (token.liquidityAda ?? 0) > 0 && Number.isFinite(token.change24h) && token.change24h !== 0);
  if (active.length < 5) return null;
  const changes = active.map((token) => token.change24h);
  const breadth = (changes.filter((change) => change > 0).length / changes.length) * 100;
  const momentum = Math.min(100, Math.max(0, 50 + median(changes) * 5));
  const weekly = active.map((token) => token.change7d).filter(Number.isFinite);
  return {
    score: Math.round(breadth * 0.5 + momentum * 0.5),
    breadth,
    volatility: median(changes.map(Math.abs)),
    trend: weekly.length ? median(weekly) : 0,
  };
}

function FearGreedPanel({ language, tokens }: { language: 'de' | 'en'; tokens: MarketToken[] }) {
  const de = language === 'de';
  const data = computeSentiment(tokens);
  const score = data?.score ?? 0;
  const zone = !data ? null
    : score < 25 ? { label: de ? 'Extreme Angst' : 'Extreme Fear', mood: de ? 'Sehr negativ' : 'Very negative', color: 'text-rose-400', hint: de ? 'Panik schafft oft die besten Einstiege.' : 'Panic often creates the best entries.' }
      : score < 45 ? { label: de ? 'Angst' : 'Fear', mood: de ? 'Negativ' : 'Negative', color: 'text-orange-400', hint: de ? 'Vorsicht dominiert den Markt.' : 'Caution dominates the market.' }
        : score <= 55 ? { label: 'Neutral', mood: 'Neutral', color: 'text-amber-300', hint: de ? 'Der Markt wartet auf eine Richtung.' : 'The market is waiting for direction.' }
          : score <= 75 ? { label: 'Greed', mood: de ? 'Positiv' : 'Positive', color: 'text-emerald-400', hint: de ? 'Gier baut oft den nächsten Pump auf.' : 'Greed often builds the next pump.' }
            : { label: 'Extreme Greed', mood: de ? 'Euphorisch' : 'Euphoric', color: 'text-cyan-300', hint: de ? 'Euphorie – Gewinne absichern.' : 'Euphoria – consider taking profits.' };
  const angle = Math.PI * (1 - score / 100);
  const rows = data && zone ? [
    { label: de ? 'Volatilität' : 'Volatility', value: `${data.volatility.toFixed(1).replace('.', de ? ',' : '.')}%`, color: 'text-cyan-300' },
    { label: de ? 'Marktstimmung' : 'Market mood', value: zone.mood, color: zone.color },
    { label: de ? 'Marktbreite' : 'Breadth', value: `${Math.round(data.breadth)}% ${de ? 'im Plus' : 'up'}`, color: data.breadth >= 50 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Trend', value: data.trend > 1 ? (de ? 'Aufwärts' : 'Upward') : data.trend < -1 ? (de ? 'Abwärts' : 'Downward') : (de ? 'Seitwärts' : 'Sideways'), color: data.trend > 1 ? 'text-emerald-400' : data.trend < -1 ? 'text-rose-400' : 'text-amber-300' },
  ] : [];

  return <section className={styles.fearPanel} aria-label="Fear & Greed Index">
    <h2 className="flex shrink-0 items-center gap-2 text-[12px] font-bold text-white"><span className={styles.fearIcon}><Gauge className="h-3 w-3 text-white" /></span>Fear &amp; Greed Index</h2>
    <div className="flex min-h-0 flex-1 items-center gap-2">
      <div className="relative w-[92px] shrink-0">
        <svg viewBox="0 0 100 58" className="w-full overflow-visible" role="img" aria-label={data && zone ? `${score} ${zone.label}` : (de ? 'Kein Index' : 'No index')}>
          <defs><linearGradient id="fearGreedArc" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#10b981" /><stop offset="0.6" stopColor="#22d6af" /><stop offset="1" stopColor="#2df4ff" /></linearGradient></defs>
          <path d="M 8 50 A 42 42 0 0 1 92 50" fill="none" stroke="#1b2740" strokeWidth="8" strokeLinecap="round" />
          {data && <path d="M 8 50 A 42 42 0 0 1 92 50" fill="none" stroke="url(#fearGreedArc)" strokeWidth="8" strokeLinecap="round" pathLength={100} strokeDasharray={`${score} 100`} className={styles.fearArc} />}
          {data && <circle cx={50 + 42 * Math.cos(angle)} cy={50 - 42 * Math.sin(angle)} r="4.5" fill="#fff" stroke="#2df4ff" strokeWidth="2" />}
        </svg>
        <div className="absolute inset-x-0 top-[18px] text-center"><p className="text-[22px] font-bold leading-none text-white">{data ? score : '—'}</p><p className={`mt-0.5 text-[10px] font-bold ${zone?.color ?? 'text-slate-500'}`}>{zone?.label ?? (de ? 'Kein Index' : 'No index')}</p></div>
        <div className="flex justify-between px-0.5 text-[8px] text-slate-500"><span>0</span><span>100</span></div>
      </div>
      <dl className="min-w-0 flex-1 space-y-1 border-l border-violet-300/20 pl-2">{(rows.length ? rows : [{ label: de ? 'Volatilität' : 'Volatility' }, { label: de ? 'Marktstimmung' : 'Market mood' }, { label: de ? 'Marktbreite' : 'Breadth' }, { label: 'Trend' }]).map((row) => <div key={row.label} className="flex items-center justify-between gap-1 text-[9.5px]"><dt className="truncate text-slate-300">{row.label}</dt><dd className={`shrink-0 font-semibold ${'color' in row ? row.color : 'text-slate-500'}`}>{'value' in row ? row.value : '—'}</dd></div>)}</dl>
    </div>
    <div className={styles.fearHint}><Activity className="h-3.5 w-3.5 shrink-0 text-cyan-300" /><p className="min-w-0 leading-tight"><span className="block truncate text-slate-200">{zone?.hint ?? (de ? 'Zu wenig lokale Marktdaten.' : 'Not enough local market data.')}</span><span className="text-violet-300">– CARDYX Intelligence</span></p></div>
  </section>;
}

function QuickActions({ language, walletAddress, onNavigate }: { language: 'de' | 'en'; walletAddress: string | null; onNavigate: (path: string) => void }) {
  const de = language === 'de';
  const pending = de ? 'Zahlungsanbieter wird angebunden' : 'Payment provider coming soon';
  const focusSwap = () => document.querySelector<HTMLInputElement>(`.${styles.tradePane} aside input`)?.focus();
  const actions = [
    { label: 'PayPal', icon: Wallet, title: pending },
    { label: de ? 'Kreditkarte' : 'Card', icon: CreditCard, title: pending },
    { label: 'Staking', icon: Landmark, title: de ? 'Bald verfügbar' : 'Coming soon' },
    { label: 'Swap', icon: ArrowLeftRight, onClick: focusSwap },
    { label: 'Portfolio', icon: PieChart, onClick: walletAddress ? () => onNavigate(`/wallet/${encodeURIComponent(walletAddress)}`) : undefined, title: walletAddress ? undefined : (de ? 'Wallet verbinden' : 'Connect wallet') },
    { label: 'Alerts', icon: Bell, title: de ? 'Bald verfügbar' : 'Coming soon' },
  ];

  return <section className={styles.quickActions} aria-label="Quick Actions">
    <h2 className="shrink-0 text-[12px] font-bold text-white">Quick Actions</h2>
    <div className="grid shrink-0 grid-cols-[1.2fr_1.2fr_1fr] gap-1.5">{actions.map(({ label, icon: Icon, onClick, title }) => <button key={label} type="button" disabled={!onClick} title={title} onClick={onClick} className={`${styles.quickButton} flex h-[26px] min-w-0 items-center justify-center gap-1.5 rounded px-1.5 text-[10px] font-semibold text-slate-100`}><Icon className="h-3.5 w-3.5 shrink-0 text-cyan-300" /><span className="truncate">{label}</span></button>)}</div>
    <div className={styles.buyBanner}>
      <span className={styles.adaOrb} aria-hidden="true">₳</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-black tracking-wide text-white">{de ? 'CARDANO KAUFEN' : 'BUY CARDANO'}</p>
        <p className="truncate text-[9px] text-slate-400">{de ? 'Schnell · Sicher · Einfach' : 'Fast · Secure · Simple'}</p>
        <div className="mt-1 flex items-center gap-2" aria-label="PayPal, Visa, Mastercard">
          <span className="text-[11px] font-black italic"><span className="text-[#2a7fff]">Pay</span><span className="text-[#5fb6ff]">Pal</span></span>
          <span className="text-[11px] font-black italic tracking-tight text-white">VISA</span>
          <span className="relative flex h-3.5 w-6 shrink-0" aria-hidden="true"><span className="absolute left-0 h-3.5 w-3.5 rounded-full bg-[#eb001b]" /><span className="absolute right-0 h-3.5 w-3.5 rounded-full bg-[#f79e1b]/90 mix-blend-screen" /></span>
        </div>
      </div>
      <button type="button" disabled title={pending} aria-label={de ? 'Cardano kaufen' : 'Buy Cardano'} className={styles.buyArrow}><ArrowRight className="h-4 w-4" /></button>
    </div>
  </section>;
}

function MarketStatsBar({ token, adaPriceUsd, currency, language }: { token: MarketToken; adaPriceUsd: number | null; currency: 'ADA' | 'USD'; language: 'de' | 'en' }) {
  const [history, setHistory] = useState<{ id: string; stats: { change: number; high: number; low: number } | null } | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/market/chart/${encodeURIComponent(token.id)}?days=2`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success || !Array.isArray(json.data?.candles)) throw new Error('History unavailable');
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const candles = (json.data.candles as { time: number; open: number; high: number; low: number; close: number }[])
          .map((candle) => ({ ...candle, time: candle.time < 1_000_000_000_000 ? candle.time * 1000 : candle.time }))
          .filter((candle) => candle.time >= cutoff && candle.open > 0 && candle.close > 0)
          .sort((a, b) => a.time - b.time);
        if (active) setHistory({ id: token.id, stats: candles.length ? {
          change: ((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100,
          high: Math.max(...candles.map((candle) => candle.high)),
          low: Math.min(...candles.map((candle) => candle.low)),
        } : null });
      })
      .catch(() => { if (active) setHistory({ id: token.id, stats: null }); });
    return () => { active = false; };
  }, [token.id]);

  const stats = history?.id === token.id ? history.stats : null;
  const price = (ada: number) => formatTokenPrice(ada, adaPriceUsd ? ada * adaPriceUsd : 0, currency);
  const change = stats?.change ?? (token.change24h || null);
  const onChainSupply = token.circulatingQuantity ? Number(token.circulatingQuantity) / 10 ** (token.decimals ?? 0) : 0;
  const fdvAda = token.fdvAda || (token.priceAda > 0 && onChainSupply > 0 ? token.priceAda * onChainSupply : 0);
  const items = [
    { label: language === 'de' ? 'Lokaler Preis' : 'Local Price', value: formatTokenPrice(token.priceAda, token.priceUsd, currency), className: 'text-white' },
    { label: '24H Change', value: change != null ? formatChange(change) : '—', className: change == null ? 'text-slate-500' : change >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: '24H High', value: stats ? price(stats.high) : '—', className: 'text-slate-100' },
    { label: '24H Low', value: stats ? price(stats.low) : '—', className: 'text-slate-100' },
    { label: '24H Volume', value: token.volume24hAda || token.volume24hUsd ? formatMarketValue(token.volume24hAda, token.volume24hUsd, currency) : '—', className: 'text-slate-100' },
    { label: 'Market Cap', value: token.marketCapAda || token.marketCapUsd ? formatMarketValue(token.marketCapAda, token.marketCapUsd, currency) : '—', className: token.marketCapAda || token.marketCapUsd ? 'text-slate-100' : 'text-slate-500', title: token.marketCapAda || token.marketCapUsd ? undefined : (language === 'de' ? 'Freie Umlaufmenge (ohne Treasury/Locks) noch nicht ermittelt' : 'Free float (excluding treasury/locks) not determined yet') },
    { label: 'FDV', value: fdvAda ? formatMarketValue(fdvAda, adaPriceUsd ? fdvAda * adaPriceUsd : 0, currency) : '—', className: fdvAda ? 'text-slate-100' : 'text-slate-500', title: language === 'de' ? 'Preis × on-chain geprägte Menge' : 'Price × on-chain minted supply' },
    { label: language === 'de' ? 'Liquidität' : 'Liquidity', value: token.liquidityAda ? formatMarketValue(token.liquidityAda, adaPriceUsd ? token.liquidityAda * adaPriceUsd : 0, currency) : '—', className: token.liquidityAda ? 'text-slate-100' : 'text-slate-500', title: language === 'de' ? 'Summe der aktiven lokalen DEX-Pools (2 × ADA-Reserve)' : 'Sum of active local DEX pools (2 × ADA reserve)' },
  ];

  return <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded border border-white/[0.06] bg-[#0d0f13] px-4 py-2 sm:grid-cols-3 lg:mb-0 lg:shrink-0 xl:flex xl:items-center xl:gap-0">
    {items.map((item) => <div key={item.label} title={item.title} className="min-w-0 xl:min-w-[120px] xl:flex-1 xl:max-w-[200px]">
      <dt className="truncate text-[11px] uppercase tracking-[0.14em] text-slate-500">{item.label}</dt>
      <dd className={`mt-0.5 truncate text-[13px] font-semibold tabular-nums ${item.className}`}>{item.value}</dd>
    </div>)}
  </dl>;
}

