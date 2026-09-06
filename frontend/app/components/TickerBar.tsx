'use client';

import { formatChange } from '../lib/tokens';

interface TickerBarProps {
  adaPriceUsd: number | null;
}

/**
 * Kennzahlen-Leiste unterhalb der Navbar.
 * 24h-Volumen und TVL sind Platzhalter, bis der Indexer (Phase 1/2) liefert.
 */
export default function TickerBar({ adaPriceUsd }: TickerBarProps) {
  const adaChange = 3.32; // Platzhalter, bis historische Daten verfügbar sind

  return (
    <div className="border-b border-white/5 bg-[#070a12]">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 divide-y divide-white/5 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
        <div className="flex items-baseline gap-3 py-2.5 sm:justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">ADA Price</span>
          <span className="text-sm font-bold text-blue-400">
            {adaPriceUsd !== null ? `$${adaPriceUsd.toFixed(4)}` : '—'}
          </span>
          <span className={`text-xs font-semibold ${adaChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatChange(adaChange)}
          </span>
        </div>
        <div className="flex items-baseline gap-3 py-2.5 sm:justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">24h Volume</span>
          <span className="text-sm font-bold text-blue-300">₳13.17M</span>
        </div>
        <div className="flex items-baseline gap-3 py-2.5 sm:justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">TVL</span>
          <span className="text-sm font-bold text-amber-400">₳97.52M</span>
        </div>
      </div>
    </div>
  );
}
