'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeftRight, ArrowRight, Bell, ChartNoAxesCombined, Check, ChevronDown, Code2, Compass, Copy, CreditCard, Database, Droplets, Gauge, Landmark, LayoutDashboard, Loader2, MessageCircle, PieChart, Rocket, Search, ShieldCheck, Wallet, WalletCards } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import styles from './terminal.module.css';
import TokenLogo from '../components/TokenLogo';
import WalletConnectModal from '../components/WalletConnectModal';
import TradeChart from '../components/TradeChart';
import OrderBookPanel from '../components/OrderBookPanel';
import TradePanel from '../components/TradePanel';
import TokenActivity from '../components/TokenActivity';
import MarketSentimentIndex from '../components/MarketSentimentIndex';
import TerminalTopbar from '../components/TerminalTopbar';
import { SubscriptionProvider, useSubscription } from '../components/SubscriptionProvider';
import { useApplicationConfiguration } from '../components/ApplicationConfigurationProvider';
import { useAdminSession } from '../components/AdminSessionProvider';
import { WalletProvider, useDetectedWallets, useWallet } from '../components/WalletProvider';
import { useCurrency } from '../components/CurrencyProvider';
import { useLanguage } from '../components/LanguageProvider';
import { API_URL } from '../lib/api';
import { MarketToken, formatChange, formatMarketValue, formatTokenPrice } from '../lib/tokens';

export default function NewTradePage() {
  return <WalletProvider><SubscriptionProvider><NewTradeWorkspace /></SubscriptionProvider></WalletProvider>;
}

function NewTradeWorkspace() {
  const router = useRouter();
  const { currency } = useCurrency();
  const { language } = useLanguage();
  const wallet = useWallet();
  const { session: adminSession } = useAdminSession();
  const isAdmin = adminSession?.authenticated === true;
  const { configuration, loaded: configurationLoaded, error: configurationError } = useApplicationConfiguration();
  const { canAccess } = useSubscription();
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<MarketToken | null>(null);
  const [adaPriceUsd, setAdaPriceUsd] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let initialized = false;
    const refreshMarket = () => fetch(`${API_URL}/api/market/catalog`, { cache: 'no-store' })
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
        setSelectedToken((current) => current
          ? catalog.find((token) => token.id === current.id) ?? current
          : catalog.find((token) => token.id === requested) ?? catalog.find((token) => token.ticker !== 'ADA' && token.priceAda > 0) ?? catalog[0] ?? null);
        initialized = true;
        setError(false);
        setLoading(false);
      })
      .catch(() => { if (active && !initialized) { setError(true); setLoading(false); } });
    void refreshMarket();
    const interval = window.setInterval(refreshMarket, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const selectToken = (token: MarketToken) => {
    setSelectedToken(token);
    setQuery('');
    router.replace(`/trade?token=${encodeURIComponent(token.id)}`, { scroll: false });
  };

  return <main className="min-h-screen bg-[#020711] text-slate-200 lg:h-dvh lg:overflow-hidden">
    <TerminalTopbar onCommunity={() => router.push('/community')} query={query} onQueryChange={setQuery} choices={tokens} selectedTokenId={selectedToken?.id} onSelectToken={selectToken} />
    <div className="flex min-h-[calc(100vh-64px)] lg:h-[calc(100dvh-64px)] lg:min-h-0">
      <NewTerminalSidebar onNavigate={(path) => router.push(path)} tokens={tokens} />
      <div className="min-w-0 flex-1 lg:overflow-hidden">
        <div className="w-full px-3 py-3 sm:px-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:gap-1 lg:px-0 lg:py-1">
          {(!configurationLoaded && !isAdmin) || loading ? <div className="flex min-h-[70vh] items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Terminal wird geladen...</div>
            : configurationError && !isAdmin ? <p role="alert" className="py-16 text-center text-sm text-slate-400">{language === 'de' ? 'Zugangsregeln derzeit nicht verfügbar.' : 'Access rules are currently unavailable.'}</p>
            : !isAdmin && (!configuration.features.trading.enabled || !canAccess(configuration.features.trading.minimumTier)) ? <div className="py-16 text-center text-sm text-slate-400"><p>{!configuration.features.trading.enabled ? (language === 'de' ? 'Trading Terminal derzeit deaktiviert.' : 'Trading terminal is currently disabled.') : `${configuration.features.trading.minimumTier} ${language === 'de' ? 'Abo erforderlich.' : 'plan required.'}`}</p><Link href="/subscription" className="mt-4 inline-flex text-cyan-300">{language === 'de' ? 'Aboverwaltung' : 'Subscription management'}</Link></div>
            : error || !selectedToken ? <p className="py-16 text-center text-sm text-slate-400">Lokale Tokendaten sind derzeit nicht verfügbar.</p>
              : <>
                <header className="mb-3 flex flex-wrap items-center gap-3 border-b border-cyan-300/15 pb-3 lg:mb-0 lg:min-h-12 lg:shrink-0 lg:flex-nowrap lg:gap-2 lg:pb-1">
                  <span className="lg:ml-1"><TokenLogo src={selectedToken.image} ticker={selectedToken.ticker} size={42} /></span>
                  <div className="min-w-[102px] max-w-[340px]"><h1 className="truncate text-lg font-black text-white">{selectedToken.name}</h1><p className="mt-1 truncate text-[10px] text-slate-500">{selectedToken.category ?? 'Cardano asset'} · {selectedToken.activePools?.length ?? 0} local pools</p></div>
                  <TradePairPicker tokens={tokens} selectedToken={selectedToken} currency={currency} onSelectToken={selectToken} />
                </header>
                <MarketStatsBar token={selectedToken} adaPriceUsd={adaPriceUsd} currency={currency} language={language} />
                <div className={styles.workspace}>
                  {(isAdmin || configuration.terminal.chart) && <div className={styles.chartPane}><TradeChart key={selectedToken.id} marketTokenId={selectedToken.id} ticker={selectedToken.ticker} adaPriceUsd={adaPriceUsd} /></div>}
                  {(isAdmin || configuration.terminal.activity) && <div className={styles.activityPane}><TokenActivity marketId={selectedToken.id} ticker={selectedToken.ticker} holderCount={selectedToken.holderCount ?? 0} adaPriceUsd={adaPriceUsd} policyId={selectedToken.policyId} assetName={selectedToken.assetName} /></div>}
                  {(isAdmin || configuration.terminal.orderbook) && <div className={styles.orderPane}><OrderBookPanel tokenId={selectedToken.policyId && selectedToken.assetName != null ? `${selectedToken.policyId}${selectedToken.assetName}` : null} ticker={selectedToken.ticker} adaPriceUsd={adaPriceUsd} currentPriceAda={selectedToken.priceAda} /></div>}
                  {(isAdmin || configuration.terminal.sentiment) && <MarketSentimentIndex language={language} tokens={tokens} variant="token" selectedToken={selectedToken} />}
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

function NewTerminalSidebar({ onNavigate, tokens }: { onNavigate: (path: string) => void; tokens: MarketToken[] }) {
  const { configuration } = useApplicationConfiguration();
  const { session: adminSession } = useAdminSession();
  const isAdmin = adminSession?.authenticated === true;
  const { canAccess } = useSubscription();
  const entries = [[LayoutDashboard, 'dashboard', '/market'], [ChartNoAxesCombined, 'trading', '/trade'], [Compass, 'explorer', '/token-explorer'], [WalletCards, 'portfolio', null], [Activity, 'watchlist', null], [ShieldCheck, 'onchain', null], [Database, 'analytics', null], [Gauge, 'staking', null], [Rocket, 'launches', null], [Droplets, 'pools', null], [Bell, 'alerts', null], [Code2, 'builders', null], [MessageCircle, 'community', '/community']] as const;
  return <aside className={`${styles.sidebarGlass} hidden w-[64px] shrink-0 flex-col overflow-hidden px-2 py-3 lg:flex xl:w-[256px]`}><div className="mb-3 hidden px-3 text-[11px] font-bold uppercase text-cyan-500/60 xl:block">Workspace</div><nav className="min-h-0 space-y-0.5 overflow-y-auto">{entries.map(([Icon, key, path]) => {
    const feature = configuration.features[key];
    if (path && !feature.enabled && !isAdmin) return null;
    const accessible = isAdmin || canAccess(feature.minimumTier);
    const target = path ?? (isAdmin ? `/admin?section=terminal&feature=${key}` : null);
    return <button key={key} type="button" disabled={!target} aria-label={feature.label} title={!target ? `${feature.label} – Noch nicht verfügbar` : !path ? `${feature.label} – Admin-Konfiguration (Anwendung geplant)` : accessible ? feature.label : `${feature.minimumTier} Abo erforderlich`} onClick={() => { if (target) onNavigate(accessible ? target : '/subscription'); }} className={`flex w-full items-center justify-center gap-2.5 rounded px-2 py-1.5 text-left text-[13px] font-semibold xl:justify-start xl:px-3 ${key === 'trading' && accessible ? styles.activeNav : target ? 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200' : 'cursor-not-allowed text-slate-600'}`}><Icon className="h-4 w-4 shrink-0 xl:h-3.5 xl:w-3.5" /><span className="hidden min-w-0 truncate xl:inline">{feature.label}</span>{target && !accessible && <span className="hidden shrink-0 text-[9px] text-amber-300 xl:inline">{feature.minimumTier}</span>}</button>;
  })}<div className="-mx-2 mt-1 hidden justify-center xl:flex"><Image src="/cardyx-sidebar-logo.jpeg" alt="CARDYX" width={776} height={427} sizes="252px" loading="eager" className="h-auto w-[252px] object-contain" /></div></nav><div className="mt-auto hidden shrink-0 pt-2 xl:block"><WalletSummary onNavigate={onNavigate} tokens={tokens} /></div></aside>;
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
  const price = (usd: number) => usd > 0 && (currency === 'USD' || (adaPriceUsd ?? 0) > 0)
    ? formatTokenPrice(adaPriceUsd ? usd / adaPriceUsd : 0, usd, currency)
    : '—';
  const change = Number.isFinite(token.change24h) ? token.change24h : null;
  const onChainSupply = token.circulatingQuantity ? Number(token.circulatingQuantity) / 10 ** (token.decimals ?? 0) : 0;
  const fdvAda = token.fdvAda || (token.priceAda > 0 && onChainSupply > 0 ? token.priceAda * onChainSupply : 0);
  const items = [
    { label: language === 'de' ? 'Lokaler Preis' : 'Local Price', value: formatTokenPrice(token.priceAda, token.priceUsd, currency), className: 'text-white' },
    { label: '24H Change', value: change != null ? formatChange(change) : '—', className: change == null ? 'text-slate-500' : change >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: '24H High', value: price(token.high24hUsd), className: 'text-slate-100' },
    { label: '24H Low', value: price(token.low24hUsd), className: 'text-slate-100' },
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

