'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '../lib/api';
import { formatChange, formatCompactAda, formatCompactUsd } from '../lib/tokens';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';

interface Summary {
  adaPriceUsd: number;
  adaChange24h: number;
  dexVolume24hUsd: number | null;
  tvlUsd: number | null;
  updatedAt: string;
  stale: boolean;
  sources?: { adaPrice?: string; dexVolume?: string | null; tvl?: string | null };
}

/**
 * Kennzahlen-Leiste unterhalb der Navbar.
 * 24h-Volumen und TVL sind Platzhalter, bis der Indexer (Phase 1/2) liefert.
 */
export default function TickerBar() {
  const { language } = useLanguage();
  const { currency } = useCurrency();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/api/market/summary`);
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error('Summary unavailable');
        if (!cancelled) setSummary(json.data);
      } catch {
        if (!cancelled) setSummary(null);
      }
    };
    void load();
    const interval = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  const adaPrice = summary ? `$${summary.adaPriceUsd.toFixed(4)}` : '—';
  const volume = summary?.dexVolume24hUsd !== null && summary?.dexVolume24hUsd !== undefined && summary.adaPriceUsd > 0
    ? currency === 'USD' ? formatCompactUsd(summary.dexVolume24hUsd) : formatCompactAda(summary.dexVolume24hUsd / summary.adaPriceUsd)
    : '—';
  const tvl = summary?.tvlUsd !== null && summary?.tvlUsd !== undefined && summary.adaPriceUsd > 0
    ? currency === 'USD' ? formatCompactUsd(summary.tvlUsd) : formatCompactAda(summary.tvlUsd / summary.adaPriceUsd)
    : '—';
  const updatedTitle = summary ? `${summary.stale ? `${language === 'de' ? 'Zwischengespeichert · zuletzt aktualisiert' : 'Cached · last updated'}: ` : `${language === 'de' ? 'Quelle aktualisiert' : 'Source updated'}: `}${new Date(summary.updatedAt).toLocaleString()}` : undefined;

  return (
    <div className="border-b border-white/5 bg-[#070a12]">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 divide-y divide-white/5 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
        <div className="flex items-baseline gap-3 py-2.5 sm:justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{language === 'de' ? 'ADA Preis' : 'ADA Price'}</span>
          <span className="text-sm font-bold text-blue-400" title={summary?.sources?.adaPrice ?? updatedTitle}>{adaPrice}</span>
          <span className={`text-xs font-semibold ${(summary?.adaChange24h ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {summary ? formatChange(summary.adaChange24h) : '—'}
          </span>
        </div>
        <div className="flex items-baseline gap-3 py-2.5 sm:justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500" title={summary?.sources?.dexVolume ?? undefined}>{language === 'de' ? 'DEX-Volumen 24h' : '24h DEX volume'}</span>
          <span className="text-sm font-bold text-blue-300" title={updatedTitle}>{volume}</span>
        </div>
        <div className="flex items-baseline gap-3 py-2.5 sm:justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500" title={summary?.sources?.tvl ?? undefined}>{summary?.sources?.tvl === 'CARDYX local DEX pools' ? 'DEX TVL' : 'TVL'}</span>
          <span className="text-sm font-bold text-amber-400" title={updatedTitle}>{tvl}</span>
        </div>
      </div>
    </div>
  );
}
