'use client';

import { useEffect } from 'react';
import { Bell, X, Zap } from 'lucide-react';
import TokenLogo from './TokenLogo';
import TokenChart from './TokenChart';
import { buildSwapUrl } from '../lib/dexhunter';
import {
  MarketToken,
  formatChange,
  formatCompactNumber,
  formatCompactUsd,
  formatDate,
  formatUsd,
} from '../lib/tokens';

interface TokenDetailModalProps {
  token: MarketToken;
  adaPriceUsd: number | null;
  onClose: () => void;
  /** Öffnet das schwebende Trade-Panel mit diesem Token */
  onTrade?: () => void;
}

/**
 * Detail-Fenster eines Tokens: aktuelle Marktdaten, Allzeithoch/-tief,
 * 24h-Kursspanne und Live-Chart. Öffnet sich beim Klick auf einen Token.
 */
export default function TokenDetailModal({ token, adaPriceUsd, onClose, onTrade }: TokenDetailModalProps) {
  // Escape schließt das Fenster, Scrollen im Hintergrund wird gesperrt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const changePositive = token.change24h >= 0;
  const supplyPct =
    token.maxSupply && token.circulatingSupply
      ? (token.circulatingSupply / token.maxSupply) * 100
      : null;

  // Position des aktuellen Preises innerhalb der 24h-Spanne (0–100 %)
  const rangePosition =
    token.high24hUsd > token.low24hUsd
      ? Math.min(
          Math.max(
            ((token.priceUsd - token.low24hUsd) / (token.high24hUsd - token.low24hUsd)) * 100,
            0
          ),
          100
        )
      : 50;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${token.name} Analysedaten`}
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Fenster */}
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f1c] shadow-2xl shadow-black/60">
        {/* Kopf */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/5 bg-[#0a0f1c]/95 px-6 py-4 backdrop-blur-sm">
          <TokenLogo src={token.image} ticker={token.ticker} size={40} />
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 truncate text-lg font-bold text-white">
              {token.name}
              {token.marketCapRank && (
                <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                  Rang #{token.marketCapRank}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">{token.ticker} · Cardano Ecosystem</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fenster schließen"
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* Preis-Zeile */}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-3xl font-extrabold text-white">{formatUsd(token.priceUsd)}</span>
            <span className={`text-sm font-bold ${changePositive ? 'text-green-400' : 'text-red-400'}`}>
              {formatChange(token.change24h)} (24h)
            </span>
            {adaPriceUsd && (
              <span className="text-sm text-slate-400">≈ ₳{token.priceAda.toFixed(6)}</span>
            )}
          </div>

          {/* Marktdaten-Grid */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Marktdaten
            </h3>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <Stat label="Marktkapitalisierung" value={formatCompactUsd(token.marketCapUsd)} />
              <Stat label="Rang" value={token.marketCapRank ? `#${token.marketCapRank}` : '—'} />
              <Stat label="24h-Volumen" value={formatCompactUsd(token.volume24hUsd)} />
              <Stat
                label="Umlaufmenge"
                value={`${formatCompactNumber(token.circulatingSupply)} ${token.ticker}`}
                sub={supplyPct !== null ? `${supplyPct.toFixed(2)} % der Maximalmenge` : undefined}
              />
              <Stat
                label="Gesamtangebot"
                value={token.totalSupply ? `${formatCompactNumber(token.totalSupply)} ${token.ticker}` : '—'}
              />
              <Stat
                label="Max. Gesamtmenge"
                value={token.maxSupply ? `${formatCompactNumber(token.maxSupply)} ${token.ticker}` : '—'}
              />
              <Stat
                label="Allzeithoch"
                value={formatUsd(token.athUsd)}
                valueClass="text-white"
                badge={formatChange(token.athChangePct)}
                badgePositive={token.athChangePct >= 0}
                sub={formatDate(token.athDate)}
              />
              <Stat
                label="Allzeittief"
                value={formatUsd(token.atlUsd)}
                valueClass="text-white"
                badge={formatChange(token.atlChangePct)}
                badgePositive={token.atlChangePct >= 0}
                sub={formatDate(token.atlDate)}
              />
            </dl>
          </div>

          {/* Historische Kursspanne (24h) */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Historische Kursspanne</h3>
              <span className="text-xs font-medium text-blue-400">In den letzten 24 Stunden</span>
            </div>

            {/* Positions-Marker */}
            <div className="relative mb-1.5 h-4">
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap text-xs font-bold text-white"
                style={{ left: `${rangePosition}%` }}
              >
                Now {formatUsd(token.priceUsd)}
              </span>
            </div>
            <div className="relative">
              <div className="h-2 rounded-full bg-gradient-to-r from-red-400/70 via-slate-500/40 to-green-400/70" />
              <span
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow"
                style={{ left: `${rangePosition}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-slate-400">
                Tief <span className="font-semibold text-slate-200">{formatUsd(token.low24hUsd)}</span>
              </span>
              <span className="text-slate-400">
                Hoch <span className="font-semibold text-slate-200">{formatUsd(token.high24hUsd)}</span>
              </span>
            </div>
          </div>

          {/* Live-Chart */}
          <TokenChart tokenId={token.id} ticker={token.ticker} />

          {/* Aktionen */}
          <div className="flex gap-3 pb-1">
            {onTrade && token.ticker !== 'ADA' ? (
              <button
                type="button"
                onClick={onTrade}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98]"
              >
                <Zap className="h-4 w-4" />
                {token.ticker} handeln
              </button>
            ) : (
              <a
                href={buildSwapUrl(token.policyId)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98]"
              >
                <Zap className="h-4 w-4" />
                {token.ticker} handeln
              </a>
            )}
            <button
              type="button"
              title="Kursalarm festlegen (kommt mit Phase 5)"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/10 py-3 text-sm font-bold text-blue-300 transition-colors hover:bg-blue-600/20"
            >
              <Bell className="h-4 w-4" />
              Kursalarm festlegen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Komponente für einzelne Marktdaten-Werte
// ---------------------------------------------------------------------------

interface StatProps {
  label: string;
  value: string;
  sub?: string;
  badge?: string;
  badgePositive?: boolean;
  valueClass?: string;
}

function Stat({ label, value, sub, badge, badgePositive, valueClass }: StatProps) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm font-bold ${valueClass ?? 'text-slate-100'}`}>
        {value}
        {badge && (
          <span className={`ml-2 text-xs font-semibold ${badgePositive ? 'text-green-400' : 'text-red-400'}`}>
            {badge}
          </span>
        )}
      </dd>
      {sub && <dd className="text-[11px] text-slate-500">{sub}</dd>}
    </div>
  );
}
