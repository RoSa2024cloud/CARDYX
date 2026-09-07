'use client';

import { useEffect, useMemo, useState } from 'react';
import { Zap } from 'lucide-react';
import Navbar from './components/Navbar';
import TickerBar from './components/TickerBar';
import FeaturedCarousel from './components/FeaturedCarousel';
import FeaturedTokens from './components/FeaturedTokens';
import TrendingRow from './components/TrendingRow';
import TokenTable from './components/TokenTable';
import TradePanel from './components/TradePanel';
import { WalletProvider } from './components/WalletProvider';
import { useLanguage } from './components/LanguageProvider';
import { API_URL } from './lib/api';
import { MarketToken } from './lib/tokens';

export default function Dashboard() {
  const { language } = useLanguage();
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [adaPriceUsd, setAdaPriceUsd] = useState<number | null>(null);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [tradeToken, setTradeToken] = useState<MarketToken | null>(null);
  const [tradeOpen, setTradeOpen] = useState(false);

  // Jeder Token führt auf seine eigene Analyse-Seite.
  const openToken = (token: MarketToken) => {
    window.location.assign(`/token/${encodeURIComponent(token.id)}`);
  };

  // Top-50-Marktdaten vom Backend abrufen (silent = Hintergrund-Update)
  const fetchMarket = (silent = false) => {
    fetch(`${API_URL}/api/market/top50`)
      .then((res) => {
        if (!res.ok) throw new Error('Fehler beim Abruf');
        return res.json();
      })
      .then((json) => {
        if (json.success && json.data) {
          setTokens(json.data.tokens ?? []);
          setAdaPriceUsd(json.data.adaPriceUsd ?? null);
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

    // Automatischer Taktgeber für die Marktdaten (alle 60 Sekunden)
    const marketInterval = setInterval(() => fetchMarket(true), 60_000);
    return () => clearInterval(marketInterval);
  }, [language]);

  // Abgeleitete Reihen aus den Live-Daten
  // Featured: alle Top 50 in Market-Cap-Reihenfolge (als Laufschrift)
  const featured = tokens;
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
      <Navbar />
      <TickerBar adaPriceUsd={adaPriceUsd} />

      <main className="mx-auto max-w-[1440px] space-y-10 px-4 pb-16 pt-6 sm:px-6">
        {priceError && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-3.5 text-sm text-red-400">
            ⚠️ {priceError}
          </div>
        )}

        <FeaturedCarousel />

        <FeaturedTokens tokens={featured} onSelectToken={openToken} />
        <TrendingRow tokens={trending} onSelectToken={openToken} />

        {/* Token-Tabelle in voller Breite */}
        <TokenTable tokens={tokens} loading={loadingMarket} onSelectToken={openToken} />

      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-600">
        CARDYX — {language === 'de' ? 'Cardano Digital Asset Intelligence' : 'Cardano Digital Asset Intelligence'} · cDOG, The On-Chain Scout
      </footer>

      {/* Schwebendes Trade Terminal (rechts oben) */}
      {tradeOpen && (
        <div className="fixed right-4 top-24 z-[90] w-[340px] sm:right-6">
          <TradePanel
            tokens={tokens}
            adaPriceUsd={adaPriceUsd}
            selectedToken={tradeToken}
            onSelectToken={setTradeToken}
            onClose={() => setTradeOpen(false)}
          />
        </div>
      )}

      {/* Trade-Toggle (immer erreichbar, unten rechts) */}
      {!tradeOpen && (
        <button
          type="button"
          onClick={() => setTradeOpen(true)}
          className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-2xl shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-cyan-300 active:scale-95"
        >
          <Zap className="h-4 w-4" />
          TRADE Terminal
        </button>
      )}
    </div>
    </WalletProvider>
  );
}
