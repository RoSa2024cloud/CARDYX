'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  ChevronRight,
  CircleAlert,
  Coins,
  Layers3,
  ShieldAlert,
  Users,
  Zap,
} from 'lucide-react';
import TokenChart from '../../components/TokenChart';
import TokenLogo from '../../components/TokenLogo';
import TradePanel from '../../components/TradePanel';
import { WalletProvider } from '../../components/WalletProvider';
import { API_URL } from '../../lib/api';
import {
  MarketToken,
  formatChange,
  formatCompactNumber,
  formatCompactUsd,
  formatDate,
  formatUsd,
} from '../../lib/tokens';

interface TokenApiResponse {
  success: boolean;
  error?: string;
  data?: {
    token: MarketToken;
    adaPriceUsd: number;
  };
}

export default function TokenExplorerPage() {
  const params = useParams<{ id: string }>();
  const tokenId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [token, setToken] = useState<MarketToken | null>(null);
  const [adaPriceUsd, setAdaPriceUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tradeOpen, setTradeOpen] = useState(false);

  useEffect(() => {
    if (!tokenId) return;

    fetch(`${API_URL}/api/market/token/${encodeURIComponent(tokenId)}`)
      .then(async (response) => {
        const json: TokenApiResponse = await response.json();
        if (!response.ok || !json.success || !json.data) {
          throw new Error(json.error ?? 'Token nicht verfügbar');
        }
        return json.data;
      })
      .then((data) => {
        setToken(data.token);
        setAdaPriceUsd(data.adaPriceUsd);
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [tokenId]);

  if (loading) {
    return <ExplorerLoading />;
  }

  if (error || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05070d] px-4 text-slate-200">
        <div className="max-w-md rounded-2xl border border-red-900/40 bg-red-950/20 p-6 text-center">
          <CircleAlert className="mx-auto h-7 w-7 text-red-400" />
          <h1 className="mt-3 text-lg font-bold text-white">Token nicht verfügbar</h1>
          <p className="mt-2 text-sm text-slate-400">{error ?? 'Dieser Token ist nicht in den CARDYX Top 50 gelistet.'}</p>
          <Link href="/" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300">
            <ArrowLeft className="h-4 w-4" /> Zur Übersicht
          </Link>
        </div>
      </main>
    );
  }

  const isPositive = token.change24h >= 0;
  const supplyProgress =
    token.maxSupply && token.circulatingSupply
      ? Math.min((token.circulatingSupply / token.maxSupply) * 100, 100)
      : null;

  return (
    <WalletProvider>
    <main className="min-h-screen bg-[#05070d] text-slate-200">
      <header className="border-b border-white/5 bg-[#05070d]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="mx-3 text-slate-700">/</span>
          <span className="text-sm text-slate-500">Token Explorer</span>
          <span className="mx-2 text-slate-700">/</span>
          <span className="text-sm font-semibold text-slate-200">{token.ticker}</span>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6">
        {/* Identität & Preis */}
        <section className="border-b border-white/5 pb-7">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="flex items-center gap-4">
              <TokenLogo src={token.image} ticker={token.ticker} size={56} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-extrabold tracking-tight text-white">{token.name}</h1>
                  <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-bold text-slate-400">
                    {token.ticker}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  Cardano Ecosystem
                  {token.marketCapRank && <><span>·</span> Marktrang #{token.marketCapRank}</>}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-x-5 gap-y-2 lg:justify-end">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Aktueller Preis</p>
                <p className="mt-1 text-3xl font-extrabold text-white">{formatUsd(token.priceUsd)}</p>
              </div>
              <div className={`mb-1 text-lg font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {formatChange(token.change24h)} <span className="text-xs font-medium text-slate-500">24h</span>
              </div>
              <button
                type="button"
                onClick={() => setTradeOpen(true)}
                className="mb-1 flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:from-blue-500 hover:to-cyan-400"
              >
                <Zap className="h-4 w-4" />
                {token.ticker} handeln
              </button>
            </div>
          </div>
        </section>

        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <Panel title="Historische Preisentwicklung" icon={BarChart3}>
              <TokenChart tokenId={token.id} ticker={token.ticker} />
            </Panel>

            <Panel title="Marktdaten" icon={Activity}>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                <Stat label="Marktkapitalisierung" value={formatCompactUsd(token.marketCapUsd)} />
                <Stat label="24h-Volumen" value={formatCompactUsd(token.volume24hUsd)} />
                <Stat label="FDV" value={formatCompactUsd(token.fdvUsd)} />
                <Stat label="24h-Tief" value={formatUsd(token.low24hUsd)} />
                <Stat label="24h-Hoch" value={formatUsd(token.high24hUsd)} />
                <Stat label="7 Tage" value={formatChange(token.change7d)} tone={token.change7d >= 0 ? 'positive' : 'negative'} />
                <Stat label="Allzeithoch" value={formatUsd(token.athUsd)} sub={formatDate(token.athDate)} />
                <Stat label="ATH-Abstand" value={formatChange(token.athChangePct)} tone={token.athChangePct >= 0 ? 'positive' : 'negative'} />
                <Stat label="Allzeittief" value={formatUsd(token.atlUsd)} sub={formatDate(token.atlDate)} />
              </dl>
            </Panel>

            <Panel title="Supply" icon={Coins}>
              <div className="grid gap-5 sm:grid-cols-3">
                <Stat label="Umlaufmenge" value={`${formatCompactNumber(token.circulatingSupply)} ${token.ticker}`} />
                <Stat label="Gesamtangebot" value={token.totalSupply ? `${formatCompactNumber(token.totalSupply)} ${token.ticker}` : 'Nicht angegeben'} />
                <Stat label="Max. Gesamtmenge" value={token.maxSupply ? `${formatCompactNumber(token.maxSupply)} ${token.ticker}` : 'Nicht angegeben'} />
              </div>
              {supplyProgress !== null && (
                <div className="mt-6">
                  <div className="mb-2 flex justify-between text-xs text-slate-500">
                    <span>Umlaufmenge</span>
                    <span className="font-semibold text-slate-300">{supplyProgress.toFixed(2)} %</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${supplyProgress}%` }} />
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <aside className="space-y-6">
            <Panel title="Asset-Identität" icon={Layers3} compact>
              <IdentityRow label="Token" value={token.name} />
              <IdentityRow label="Ticker" value={token.ticker} />
              <IdentityRow label="CoinGecko-ID" value={token.id} />
              <IdentityRow label="Policy ID" value={token.policyId ?? 'Wird mit dem Cardano Data Layer indexiert'} mono />
              <IdentityRow label="Asset Name" value="Wird mit dem Cardano Data Layer indexiert" />
            </Panel>

            <OnChainPanel token={token} />

            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
              <div className="flex gap-2.5">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <h2 className="text-sm font-bold text-amber-200">Analyse-Hinweis</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Marktdaten werden live von CoinGecko bereitgestellt. On-Chain-Werte werden erst nach Start des eigenen CARDYX Indexers verifiziert. Keine Anlageberatung.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      {tradeOpen && (
        <div className="fixed right-4 top-24 z-[90] w-[340px] sm:right-6">
          <TradePanel
            tokens={[token]}
            adaPriceUsd={adaPriceUsd}
            selectedToken={token}
            onSelectToken={setToken}
            onClose={() => setTradeOpen(false)}
          />
        </div>
      )}
    </main>
    </WalletProvider>
  );
}

function OnChainPanel({ token }: { token: MarketToken }) {
  return (
    <Panel title="On-Chain Intelligence" icon={Users} compact>
      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        Diese Kennzahlen benötigen den im Masterplan vorgesehenen Cardano Data Layer und werden nicht geschätzt dargestellt.
      </p>
      {['Liquidität & DEX-Paare', 'Transaktionen & Trading-Historie', 'Holder & Holder Distribution', 'Top Holder', 'Liquiditätsentwicklung'].map((label) => (
        <div key={label} className="flex items-center justify-between border-t border-white/5 py-2.5 first:border-t-0 first:pt-0">
          <span className="text-xs text-slate-400">{label}</span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">
            Data Layer folgt <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      ))}
    </Panel>
  );
}

function Panel({ title, icon: Icon, compact = false, children }: { title: string; icon: typeof Activity; compact?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-white/5 bg-white/[0.02] ${compact ? 'p-4' : 'p-5'}`}>
      <h2 className="mb-5 flex items-center gap-2 text-sm font-bold text-white">
        <Icon className="h-4 w-4 text-blue-400" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'positive' | 'negative' }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm font-bold ${tone === 'positive' ? 'text-green-400' : tone === 'negative' ? 'text-red-400' : 'text-slate-100'}`}>{value}</dd>
      {sub && <dd className="mt-0.5 text-[11px] text-slate-600">{sub}</dd>}
    </div>
  );
}

function IdentityRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-t border-white/5 py-2.5 first:border-t-0 first:pt-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}</dt>
      <dd className={`mt-1 break-all text-xs text-slate-300 ${mono ? 'font-mono text-[10px]' : ''}`}>{value}</dd>
    </div>
  );
}

function ExplorerLoading() {
  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-7 sm:px-6">
      <div className="mx-auto max-w-[1440px] animate-pulse space-y-7">
        <div className="h-16 rounded-xl bg-white/[0.03]" />
        <div className="h-24 rounded-xl bg-white/[0.03]" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-96 rounded-xl bg-white/[0.03]" />
          <div className="h-96 rounded-xl bg-white/[0.03]" />
        </div>
      </div>
    </main>
  );
}
