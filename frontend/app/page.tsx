'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dog, Zap } from 'lucide-react';
import Navbar from './components/Navbar';
import TickerBar from './components/TickerBar';
import FeaturedCarousel from './components/FeaturedCarousel';
import FeaturedTokens from './components/FeaturedTokens';
import TrendingRow from './components/TrendingRow';
import TokenTable from './components/TokenTable';
import WalletRadar from './components/WalletRadar';
import TokenDetailModal from './components/TokenDetailModal';
import TradePanel from './components/TradePanel';
import { WalletProvider } from './components/WalletProvider';
import { API_URL } from './lib/api';
import { MarketToken } from './lib/tokens';

export default function Dashboard() {
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [adaPriceUsd, setAdaPriceUsd] = useState<number | null>(null);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedToken, setSelectedToken] = useState<MarketToken | null>(null);
  const [tradeToken, setTradeToken] = useState<MarketToken | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);

  // Klick auf einen Token öffnet das Analyse-Fenster UND stellt das Trade-Panel ein
  const openToken = (token: MarketToken) => {
    setSelectedToken(token);
    setTradeToken(token);
    setModalOpen(true);
  };

  // Kauf-Button im Analyse-Fenster öffnet das schwebende Trade-Panel
  const openTrade = () => {
    setModalOpen(false);
    setTradeOpen(true);
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
          setPriceError('Verbindung zum Backend fehlgeschlagen – Live-Daten aktuell nicht verfügbar.');
          setLoadingMarket(false);
        }
      });
  };

  // Registrierte Wallets abrufen
  const fetchWallets = () => {
    fetch(`${API_URL}/api/wallets`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setWallets(json.data);
      })
      .catch((err) => console.error('Fehler:', err));
  };

  useEffect(() => {
    fetchMarket();
    fetchWallets();

    // Automatischer Taktgeber für die Marktdaten (alle 60 Sekunden)
    const marketInterval = setInterval(() => fetchMarket(true), 60_000);
    return () => clearInterval(marketInterval);
  }, []);

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
    <div className="min-h-screen bg-[#05070d] text-slate-200 antialiased">
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

        {/* cDOG Wallet Radar */}
        <section aria-label="cDOG Wallet Radar" className="space-y-4">
          <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
            <Dog className="h-4 w-4 text-blue-400" />
            cDOG Wallet Radar
          </h2>
          <WalletRadar wallets={wallets} onWalletAdded={fetchWallets} />
        </section>
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-600">
        CARDYX — Cardano Digital Asset Intelligence · cDOG, The On-Chain Scout
      </footer>

      {/* Token-Detailfenster: aktuelle Marktdaten + Live-Chart */}
      {modalOpen && selectedToken && (
        <TokenDetailModal
          token={selectedToken}
          adaPriceUsd={adaPriceUsd}
          onClose={() => setModalOpen(false)}
          onTrade={openTrade}
        />
      )}

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
          className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-blue-600/40 transition-all hover:from-blue-500 hover:to-cyan-400 active:scale-95"
        >
          <Zap className="h-4 w-4" />
          TRADE Terminal
        </button>
      )}
    </div>
    </WalletProvider>
  );
}
