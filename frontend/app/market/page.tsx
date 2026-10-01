'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Database } from 'lucide-react';
import Navbar from '../components/Navbar';
import TickerBar from '../components/TickerBar';
import FeaturedCarousel from '../components/FeaturedCarousel';
import FeaturedTokens from '../components/FeaturedTokens';
import TrendingRow from '../components/TrendingRow';
import TokenTable from '../components/TokenTable';
import { WalletProvider } from '../components/WalletProvider';
import { useLanguage } from '../components/LanguageProvider';
import { API_URL } from '../lib/api';
import { MarketToken } from '../lib/tokens';

export default function Dashboard() {
  const { language } = useLanguage();
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [marketSource, setMarketSource] = useState('CARDYX Lokaler Tokenkatalog');
  const [priceIndexStatus, setPriceIndexStatus] = useState('Lokaler Pool-Index wird vorbereitet');
  const [pipelineStatus, setPipelineStatus] = useState('Indexer werden gestartet');

  const openToken = (token: MarketToken) => {
    window.location.assign(`/trade?token=${encodeURIComponent(token.id)}`);
  };

  // Katalogisierte lokale Tokens abrufen (silent = Hintergrund-Update)
  const fetchMarket = (silent = false) => {
    fetch(`${API_URL}/api/market/catalog`)
      .then((res) => {
        if (!res.ok) throw new Error('Fehler beim Abruf');
        return res.json();
      })
      .then((json) => {
        if (json.success && json.data) {
          setTokens(json.data.tokens ?? []);
          setMarketSource(json.data.usdConversionSource
            ? language === 'de' ? 'CARDYX Lokaler Katalog · USD via ADA/USD' : 'CARDYX Local Catalog · USD via ADA/USD'
            : language === 'de' ? 'CARDYX Lokaler Tokenkatalog' : 'CARDYX Local Token Catalog');
          setPriceIndexStatus(
            json.data.pricing === 'external-display-provider'
              ? language === 'de' ? 'Externe Marktwerte · lokale Umschaltung folgt' : 'External market values · local switching follows'
              : json.data.pricing === 'local-price-index'
                ? language === 'de' ? 'Eigener DEX-Pool-Index aktiv' : 'Local DEX pool index active'
                : language === 'de' ? 'Lokaler Preisindex wird vorbereitet' : 'Local price index is being prepared'
          );
          setPriceError(null);
        }
        setLoadingMarket(false);
      })
      .catch(() => {
        if (!silent) {
          setPriceError(language === 'de' ? 'Verbindung zum Backend fehlgeschlagen – Live-Daten aktuell nicht verfügbar.' : 'Backend connection failed – live data is currently unavailable.');
          setLoadingMarket(false);
        }
      });
  };

  useEffect(() => {
    fetchMarket();

    fetch(`${API_URL}/api/system/providers`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) return;
        if (!marketSource) setMarketSource(json.data?.market?.source === 'cardyx-local' ? 'CARDYX Local Market Feed' : json.data?.market?.source ?? 'CARDYX Local Market Feed');
        setPriceIndexStatus(json.data?.market?.price_refresh === 'pool-indexer'
          ? language === 'de' ? 'Eigener DEX-Pool-Index aktiv' : 'Local DEX pool index active'
          : language === 'de' ? 'Eigener DEX-Pool-Index wird vorbereitet' : 'Local DEX pool index is being prepared');
      })
      .catch(() => undefined);

    const refreshPipelineStatus = () => {
      Promise.all([
        fetch(`${API_URL}/api/indexer/local/status`).then((response) => response.json()),
        fetch(`${API_URL}/api/indexer/dex/status`).then((response) => response.json()),
      ])
        .then(([local, dex]) => {
          const localPhase = local.data?.runPhase;
          const dexResult = dex.data?.lastRunResult;
          if (localPhase === 'metadata') setPipelineStatus(language === 'de' ? 'Metadata-Indexer analysiert db-sync' : 'Metadata indexer is analyzing db-sync');
          else if (localPhase === 'balances') setPipelineStatus(language === 'de' ? 'On-Chain-Snapshots werden aktualisiert' : 'On-chain snapshots are being updated');
          else if (dexResult?.pools > 0) setPipelineStatus(language === 'de' ? `${dexResult.pools} lokale DEX-Pools aktiv` : `${dexResult.pools} local DEX pools active`);
          else setPipelineStatus(language === 'de' ? 'Lokaler DEX-Indexer wartet auf valide Pool-Datums' : 'Local DEX indexer is waiting for valid pool datums');
        })
        .catch(() => setPipelineStatus(language === 'de' ? 'Indexer-Status nicht verfügbar' : 'Indexer status unavailable'));
    };
    refreshPipelineStatus();
    const pipelineInterval = setInterval(refreshPipelineStatus, 10_000);

    // Automatischer Taktgeber für die Marktdaten (alle 60 Sekunden)
    const marketInterval = setInterval(() => fetchMarket(true), 60_000);
    return () => {
      clearInterval(marketInterval);
      clearInterval(pipelineInterval);
    };
  }, [language]);

  // Abgeleitete Reihen aus den Live-Daten
  // Featured bleibt bewusst auf die 50 groessten Werte begrenzt.
  const featured = tokens.slice(0, 50);
  const trending = useMemo(
    () =>
      [...tokens]
        .filter((t) => t.change24h !== 0)
        .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
        .slice(0, 10),
    [tokens]
  );

  return (
    <WalletProvider>
    <div className="cardyx-dashboard min-h-screen text-slate-200 antialiased">
      <Navbar onTradeClick={() => window.location.assign('/trade')} />
      <TickerBar />

      <main className="mx-auto max-w-[1440px] space-y-10 px-4 pb-16 pt-6 sm:px-6">
        {priceError && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-3.5 text-sm text-red-400">
            ⚠️ {priceError}
          </div>
        )}

        <FeaturedCarousel />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3">
            <Database className="h-5 w-5 shrink-0 text-cyan-300" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300/70">{language === 'de' ? 'Marktquelle' : 'Market source'}</p>
              <p className="text-sm font-semibold text-cyan-50">{marketSource}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3">
            <Activity className="h-5 w-5 shrink-0 text-emerald-300" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/70">{language === 'de' ? 'Preisindex' : 'Price index'}</p>
              <p className="text-sm font-semibold text-emerald-50">{priceIndexStatus}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 sm:col-span-2">
            <Activity className="h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/70">{language === 'de' ? 'Datenpipeline' : 'Data pipeline'}</p>
              <p className="text-sm font-semibold text-amber-50">{pipelineStatus}</p>
            </div>
          </div>
        </div>

        <FeaturedTokens tokens={featured} onSelectToken={openToken} />
        <TrendingRow tokens={trending} onSelectToken={openToken} />

        {/* Token-Tabelle in voller Breite */}
        <TokenTable tokens={tokens} loading={loadingMarket} onSelectToken={openToken} marketSource={marketSource} />

      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-600">
        CARDYX — {language === 'de' ? 'Cardano Digital Asset Intelligence' : 'Cardano Digital Asset Intelligence'} · cDOG, The On-Chain Scout
      </footer>

    </div>
    </WalletProvider>
  );
}
