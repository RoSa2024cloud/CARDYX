'use client';

import { useEffect, useState } from 'react';
import { Activity, ArrowLeft, Bell, ChartNoAxesCombined, CircleDollarSign, Compass, Database, Gauge, LayoutDashboard, Loader2, MessageCircle, Search, Settings2, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { useRouter } from 'next/navigation';
import TokenLogo from '../components/TokenLogo';
import WalletConnectModal from '../components/WalletConnectModal';
import TokenActivity from '../components/TokenActivity';
import TradeChart from '../components/TradeChart';
import TradePanel from '../components/TradePanel';
import OrderBookPanel from '../components/OrderBookPanel';
import { WalletProvider } from '../components/WalletProvider';
import { useCurrency } from '../components/CurrencyProvider';
import { useLanguage } from '../components/LanguageProvider';
import { useWallet } from '../components/WalletProvider';
import { API_URL } from '../lib/api';
import { MarketToken, formatChange, formatCompactNumber, formatDate, formatMarketValue, formatTokenPrice } from '../lib/tokens';

export default function TokenExplorerPage() {
  return <WalletProvider><TradeWorkspace /></WalletProvider>;
}

function TradeWorkspace() {
  const router = useRouter();
  const { language } = useLanguage();
  const { currency } = useCurrency();
  const wallet = useWallet();
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<MarketToken | null>(null);
  const [adaPriceUsd, setAdaPriceUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketError, setMarketError] = useState(false);
  const [tokenQuery, setTokenQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/market/catalog`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error('Market unavailable');
        return json.data;
      })
      .then((data) => {
        if (cancelled) return;
        const marketTokens: MarketToken[] = data.tokens ?? [];
        const requestedId = new URLSearchParams(window.location.search).get('token');
        setTokens(marketTokens);
        setAdaPriceUsd(data.adaPriceUsd ?? null);
        setMarketError(false);
        setSelectedToken(
          marketTokens.find((token) => token.id === requestedId) ??
          marketTokens.find((token) => token.ticker !== 'ADA' && token.priceAda > 0) ??
          marketTokens[0] ??
          null
        );
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setMarketError(true);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const handleSelectToken = (token: MarketToken) => {
    setSelectedToken(token);
    setTokenQuery('');
    router.replace(`/token-explorer?token=${encodeURIComponent(token.id)}`, { scroll: false });
  };
  const visibleTokens = [
    ...(selectedToken ? [selectedToken] : []),
    ...tokens.filter((token) => token.id !== selectedToken?.id && (tokenQuery.trim()
      ? `${token.ticker} ${token.name} ${token.policyId ?? ''}`.toLowerCase().includes(tokenQuery.trim().toLowerCase())
      : token.ticker !== 'ADA' && token.priceAda > 0)).slice(0, 59),
  ];

  return (
    <main className="min-h-screen bg-[#050914] text-slate-200">
      <TerminalTopbar language={language} walletAddress={wallet.address} walletBalance={wallet.balanceAda} onCommunity={() => router.push('/community')} />
      <div className="flex min-h-[calc(100vh-56px)]">
        <TerminalSidebar language={language} onNavigate={(path) => router.push(path)} />
        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1320px] space-y-3 px-3 py-2 sm:px-5 lg:px-6">
            {selectedToken && <TerminalTokenHeader token={selectedToken} tokens={visibleTokens} tokenQuery={tokenQuery} currency={currency} language={language} onQuery={setTokenQuery} onSelect={handleSelectToken} onBack={() => router.push('/market')} />}
            {selectedToken && <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-cyan-300/15 bg-cyan-300/10 sm:grid-cols-4 xl:grid-cols-8">
              <TradeMetric label={language === 'de' ? 'Preis' : 'Price'} value={formatTokenPrice(selectedToken.priceAda, selectedToken.priceUsd, currency)} />
              <TradeMetric label="24H" value={selectedToken.change24h ? formatChange(selectedToken.change24h) : '—'} tone={selectedToken.change24h} />
              <TradeMetric label="7D" value={selectedToken.change7d ? formatChange(selectedToken.change7d) : '—'} tone={selectedToken.change7d} />
              <TradeMetric label={language === 'de' ? 'Volumen 24H' : 'Volume 24H'} value={selectedToken.volume24hAda || selectedToken.volume24hUsd ? formatMarketValue(selectedToken.volume24hAda, selectedToken.volume24hUsd, currency) : '—'} />
              <TradeMetric label={language === 'de' ? 'Marktkap.' : 'Market cap'} value={selectedToken.marketCapAda || selectedToken.marketCapUsd ? formatMarketValue(selectedToken.marketCapAda, selectedToken.marketCapUsd, currency) : '—'} />
              <TradeMetric label="FDV" value={selectedToken.fdvAda || selectedToken.fdvUsd ? formatMarketValue(selectedToken.fdvAda, selectedToken.fdvUsd, currency) : '—'} />
              <TradeMetric label={language === 'de' ? 'Halter' : 'Holders'} value={selectedToken.holderCount ? formatCompactNumber(selectedToken.holderCount) : '—'} />
              <TradeMetric label="UTxO" value={selectedToken.utxoCount ? formatCompactNumber(selectedToken.utxoCount) : '—'} />
            </dl>}
            {loading ? <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4" />{language === 'de' ? 'Terminal wird geladen…' : 'Loading terminal…'}</div>
              : marketError || !selectedToken ? <p role="alert" className="py-12 text-center text-sm text-slate-400">{language === 'de' ? 'Lokale Tokendaten sind derzeit nicht verfügbar.' : 'Local token data is currently unavailable.'}</p>
              : <div className="grid items-start gap-3 [grid-template-areas:'chart'_'sidebar'_'identity'_'activity'] xl:grid-cols-[minmax(0,1fr)_310px] xl:[grid-template-areas:'chart_sidebar'_'identity_sidebar'_'activity_activity']">
                <div className="min-w-0 [grid-area:chart]"><TradeChart marketTokenId={selectedToken.id} ticker={selectedToken.ticker} adaPriceUsd={adaPriceUsd} /></div>
                <div className="min-w-0 space-y-3 xl:sticky xl:top-3 [grid-area:sidebar]">
                  <OrderBookPanel tokenId={selectedToken.policyId && selectedToken.assetName != null ? `${selectedToken.policyId}${selectedToken.assetName}` : null} ticker={selectedToken.ticker} adaPriceUsd={adaPriceUsd} currentPriceAda={selectedToken.priceAda} />
                  <TradePanel tokens={tokens} adaPriceUsd={adaPriceUsd} selectedToken={selectedToken} onSelectToken={handleSelectToken} onClose={() => router.push('/market')} />
                  <TerminalQuickRail language={language} onCommunity={() => router.push('/community')} />
                  <FearGreedCard language={language} />
                  <PaymentMethodCard language={language} />
                </div>
                <section className="min-w-0 border-t border-white/10 px-1 pt-4 [grid-area:identity]" aria-label={language === 'de' ? 'Token Explorer' : 'Token explorer'}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-white">{language === 'de' ? 'Token-Identität' : 'Token identity'}</h2><span className="text-[10px] font-semibold text-cyan-400">CARDYX / db-sync</span></div>
                  {selectedToken.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{selectedToken.description}</p>}
                  <dl className="mt-4 grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"><InfoStat label="Policy ID" value={selectedToken.policyId ?? '—'} /><InfoStat label="Asset Name" value={selectedToken.assetName ?? '—'} /><InfoStat label="Fingerprint" value={selectedToken.fingerprint ?? '—'} /><InfoStat label={language === 'de' ? 'Kategorie' : 'Category'} value={selectedToken.category ?? '—'} /><InfoStat label={language === 'de' ? 'Protokoll' : 'Protocol'} value={selectedToken.protocol ?? '—'} /><InfoStat label={language === 'de' ? 'Dezimalstellen' : 'Decimals'} value={selectedToken.decimals == null ? '—' : String(selectedToken.decimals)} /><InfoStat label={language === 'de' ? 'Umlaufmenge' : 'Circulating supply'} value={selectedToken.circulatingSupply > 0 ? `${formatCompactNumber(selectedToken.circulatingSupply)} ${selectedToken.ticker}` : '—'} /><InfoStat label={language === 'de' ? 'Letzte Aktivität' : 'Latest activity'} value={selectedToken.latestActivity ? formatDate(selectedToken.latestActivity) : '—'} /><InfoStat label={language === 'de' ? 'Aktive DEX-Pools' : 'Active DEX pools'} value={selectedToken.activePools?.length ? selectedToken.activePools.map((pool) => `${pool.dex} ${pool.version}`).join(', ') : '—'} /></dl>
                </section>
                <div className="min-w-0 [grid-area:activity]"><TokenActivity marketId={selectedToken.id} ticker={selectedToken.ticker} holderCount={selectedToken.holderCount ?? 0} circulatingSupply={selectedToken.circulatingSupply} adaPriceUsd={adaPriceUsd} /></div>
              </div>}
          </div>
        </div>
      </div>
    </main>
  );
}

function TerminalTopbar({ language, walletAddress, walletBalance, onCommunity }: { language: string; walletAddress: string | null; walletBalance: number | null; onCommunity: () => void }) {
  const wallet = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  return <>
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-cyan-300/20 bg-[#030713]/95 px-3 backdrop-blur-xl sm:px-5">
      <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-cyan-200" aria-label="CARDYX"><Sparkles className="h-5 w-5" /></button>
      <div className="hidden shrink-0 sm:block"><p className="text-sm font-black tracking-tight text-white">CARDYX</p><p className="text-[7px] uppercase tracking-[0.18em] text-cyan-400">Cardano market intelligence</p></div>
      <div className="relative min-w-0 max-w-xl flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" /><input className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] pl-9 pr-16 text-xs text-white placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none" placeholder={language === 'de' ? 'Token, Adresse, Pool oder Symbol suchen...' : 'Search token, address, pool or symbol...'} /><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-600">Ctrl K</span></div>
      <div className="hidden items-center gap-2 text-right text-[10px] xl:flex"><span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="text-slate-400">Cardano Mainnet<br /><strong className="text-emerald-300">Epoch 542</strong></span></div>
      <div className="ml-auto flex items-center gap-1.5"><span className="hidden text-[10px] text-slate-500 lg:inline">CARDANO MAINNET · LIVE</span><button type="button" aria-label="Notifications" className="rounded p-2 text-slate-400 hover:bg-white/5 hover:text-white"><Bell className="h-4 w-4" /></button><button type="button" aria-label="Settings" className="rounded p-2 text-slate-400 hover:bg-white/5 hover:text-white"><Settings2 className="h-4 w-4" /></button><button type="button" onClick={walletAddress ? wallet.disconnect : () => setWalletModalOpen(true)} className="hidden items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-bold text-cyan-100 sm:flex">{walletAddress ? <><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{walletAddress.slice(0, 7)}...{walletAddress.slice(-4)}</> : <><WalletCards className="h-3.5 w-3.5" /> Wallet connect</>}</button><button type="button" onClick={onCommunity} aria-label="Community" className="rounded p-2 text-slate-400 hover:bg-white/5 hover:text-cyan-200"><MessageCircle className="h-4 w-4" /></button></div>
      {walletBalance !== null && <span className="sr-only">Wallet balance {walletBalance}</span>}
    </header>
    {walletModalOpen && <WalletConnectModal onClose={() => setWalletModalOpen(false)} />}
  </>;
}

function TerminalSidebar({ language, onNavigate }: { language: string; onNavigate: (path: string) => void }) {
  const entries = [
    [LayoutDashboard, language === 'de' ? 'Dashboard' : 'Dashboard', '/market'],
    [ChartNoAxesCombined, language === 'de' ? 'Trading Terminal' : 'Trading terminal', '/trade'],
    [Compass, language === 'de' ? 'Token Explorer' : 'Token explorer', '/token-explorer'],
    [WalletCards, language === 'de' ? 'Portfolio' : 'Portfolio', '/wallet'],
    [Activity, language === 'de' ? 'Watchlist' : 'Watchlist', '/market'],
    [ShieldCheck, language === 'de' ? 'On-Chain Intelligence' : 'On-chain intelligence', '/market'],
    [Database, language === 'de' ? 'Charts & Analytics' : 'Charts & analytics', '/market'],
    [Gauge, language === 'de' ? 'Staking' : 'Staking', '/market'],
    [Settings2, language === 'de' ? 'Developer API' : 'Developer API', '/market'],
    [MessageCircle, 'Community', '/community'],
  ] as const;
  return <aside className="hidden min-h-[calc(100vh-56px)] w-[190px] shrink-0 flex-col border-r border-white/10 bg-[#040812] px-2 py-3 lg:flex"><div className="mb-3 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">CARDYX workspace</div><nav className="space-y-0.5">{entries.map(([Icon, label, path]) => <button key={label} type="button" onClick={() => onNavigate(path)} className={`flex w-full items-center gap-2.5 rounded px-3 py-2.5 text-left text-[11px] font-semibold transition-colors ${label.includes('Explorer') ? 'bg-cyan-400/10 text-cyan-200' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'}`}><Icon className="h-3.5 w-3.5 shrink-0" />{label}{label.includes('Explorer') && <span className="ml-auto text-cyan-400">›</span>}</button>)}</nav><div className="mt-auto space-y-3 pt-8"><TerminalWalletCard language={language} /><div className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-3"><Sparkles className="h-5 w-5 text-cyan-300" /><p className="mt-3 text-xs font-bold text-white">CARDYX</p><p className="mt-1 text-[9px] leading-4 text-slate-500">Real data. Real insights.</p></div></div></aside>;
}

function TerminalTokenHeader({ token, tokens, tokenQuery, currency, language, onQuery, onSelect, onBack }: { token: MarketToken; tokens: MarketToken[]; tokenQuery: string; currency: 'ADA' | 'USD'; language: string; onQuery: (value: string) => void; onSelect: (token: MarketToken) => void; onBack: () => void }) {
  return <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-3"><button type="button" onClick={onBack} aria-label="Back" className="rounded p-2 text-slate-500 hover:bg-white/5 hover:text-white"><ArrowLeft className="h-4 w-4" /></button><TokenLogo src={token.image} ticker={token.ticker} size={38} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-lg font-bold text-white">{token.name}</h1><span className="rounded border border-cyan-300/20 bg-cyan-300/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">{token.ticker}</span></div><div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500"><span>{token.category ?? 'Cardano asset'}</span><span>·</span><span>{token.activePools?.length ?? 0} local pools</span></div></div><input type="search" value={tokenQuery} onChange={(event) => onQuery(event.target.value)} aria-label={language === 'de' ? 'Token suchen' : 'Search token'} placeholder={language === 'de' ? 'Token wechseln...' : 'Switch token...'} className="h-8 w-40 rounded border border-white/10 bg-white/[0.03] px-2.5 text-[11px] text-white placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none" /><select value={token.id} onChange={(event) => { const next = tokens.find((entry) => entry.id === event.target.value); if (next) onSelect(next); }} aria-label="Trading pair" className="h-8 max-w-[130px] rounded border border-cyan-300/20 bg-[#09121f] px-2 text-[11px] font-bold text-cyan-100 focus:outline-none"><option value={token.id}>{token.ticker}/{currency}</option>{tokens.filter((entry) => entry.id !== token.id).slice(0, 25).map((entry) => <option key={entry.id} value={entry.id}>{entry.ticker}/{currency}</option>)}</select><div className="text-right"><p className="text-[9px] uppercase text-slate-500">Local price</p><p className="font-mono text-lg font-bold text-white">{formatTokenPrice(token.priceAda, token.priceUsd, currency)}</p></div></div>;
}

function TerminalQuickRail({ language, onCommunity }: { language: string; onCommunity: () => void }) {
  return <div className="grid grid-cols-2 gap-2"><button type="button" className="rounded border border-cyan-300/15 bg-cyan-300/[0.04] p-3 text-left text-xs font-semibold text-slate-200"><CircleDollarSign className="mb-2 h-4 w-4 text-cyan-300" />{language === 'de' ? 'Kaufen' : 'Buy'}<span className="mt-1 block text-[9px] font-normal text-slate-500">ADA / Token</span></button><button type="button" className="rounded border border-white/10 bg-white/[0.03] p-3 text-left text-xs font-semibold text-slate-200"><Activity className="mb-2 h-4 w-4 text-emerald-300" />{language === 'de' ? 'Alerts' : 'Alerts'}<span className="mt-1 block text-[9px] font-normal text-slate-500">Price watch</span></button><button type="button" onClick={onCommunity} className="col-span-2 flex items-center gap-2 rounded border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2 text-left text-xs font-semibold text-cyan-100"><MessageCircle className="h-4 w-4" />{language === 'de' ? 'Community Chat beitreten' : 'Join community chat'}</button></div>;
}

function TerminalWalletCard({ language }: { language: string }) {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  return <div className="rounded-lg border border-cyan-300/20 bg-gradient-to-br from-cyan-400/[0.12] to-blue-600/[0.05] p-3"><div className="flex items-center justify-between"><WalletCards className="h-5 w-5 text-cyan-300" /><span className={`h-1.5 w-1.5 rounded-full ${wallet.address ? 'bg-emerald-400' : 'bg-slate-600'}`} /></div><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{language === 'de' ? 'Wallet' : 'Wallet'}</p>{wallet.address ? <><p className="mt-1 truncate text-[10px] text-slate-300">{wallet.address}</p><button type="button" onClick={wallet.disconnect} className="mt-3 w-full rounded border border-white/10 bg-white/5 py-1.5 text-[10px] font-semibold text-slate-300">Disconnect</button></> : <><p className="mt-1 text-[10px] text-slate-500">{language === 'de' ? 'Verbinde deine Cardano Wallet.' : 'Connect your Cardano wallet.'}</p><button type="button" onClick={() => setOpen(true)} className="mt-3 w-full rounded bg-cyan-400 py-1.5 text-[10px] font-bold text-[#061016]">Wallet connect</button></>}{open && <WalletConnectModal onClose={() => setOpen(false)} />}</div>;
}

function FearGreedCard({ language }: { language: string }) {
  return <section className="rounded border border-violet-300/20 bg-gradient-to-br from-violet-500/[0.12] to-cyan-400/[0.04] p-3"><div className="flex items-center justify-between"><h2 className="text-xs font-bold text-white">Fear &amp; Greed Index</h2><span className="h-2 w-2 rounded-full bg-violet-300" /></div><div className="mt-3 flex items-center gap-3"><div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-violet-400/50 text-xl font-black text-violet-200">—</div><div className="text-[10px] text-slate-500"><p>{language === 'de' ? 'Lokaler Sentimentfeed' : 'Local sentiment feed'}</p><p className="mt-1 text-violet-200">{language === 'de' ? 'Noch nicht indexiert' : 'Not indexed yet'}</p></div></div></section>;
}

function PaymentMethodCard({ language }: { language: string }) {
  return <section className="rounded border border-white/10 bg-[#0b111b] p-3"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase text-slate-500">{language === 'de' ? 'Cardano kaufen' : 'Buy Cardano'}</p><p className="mt-1 text-xs font-bold text-white">{language === 'de' ? 'Zahlungsmethoden' : 'Payment methods'}</p></div><CircleDollarSign className="h-5 w-5 text-cyan-300" /></div><div className="mt-3 grid grid-cols-3 gap-1.5"><button type="button" disabled className="rounded border border-white/10 bg-white/[0.03] py-2 text-[9px] font-bold text-slate-500">PayPal</button><button type="button" disabled className="rounded border border-white/10 bg-white/[0.03] py-2 text-[9px] font-bold text-slate-500">VISA</button><button type="button" disabled className="rounded border border-white/10 bg-white/[0.03] py-2 text-[9px] font-bold text-slate-500">Mastercard</button></div><p className="mt-2 text-[9px] text-slate-600">{language === 'de' ? 'Fiat-Onramp folgt in einer späteren CARDYX-Phase.' : 'Fiat on-ramp arrives in a later CARDYX phase.'}</p></section>;
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-l border-cyan-300/20 pl-3"><dt className="text-[10px] font-semibold uppercase text-slate-500">{label}</dt><dd className="mt-1 break-all text-xs font-semibold text-slate-200" title={value}>{value}</dd></div>;
}

function TradeMetric({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return <div className="min-w-0 bg-[#0b111b] px-3 py-2.5"><dt className="text-[10px] font-semibold uppercase text-slate-500">{label}</dt><dd className={`mt-1 truncate text-sm font-bold ${tone ? tone > 0 ? 'text-emerald-400' : 'text-rose-400' : 'text-slate-100'}`} title={value}>{value}</dd></div>;
}