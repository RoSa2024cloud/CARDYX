'use client';

import { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import TokenLogo from './TokenLogo';
import {
  MarketToken,
  formatAdaPrice,
  formatChange,
  formatCompactAda,
} from '../lib/tokens';

type SortKey = 'marketCapAda' | 'priceAda' | 'change24h' | 'change7d' | 'volume24hAda' | 'fdvAda';

interface Column {
  label: string;
  key?: SortKey;
  alignRight?: boolean;
}

const COLUMNS: Column[] = [
  { label: '#' },
  { label: 'Token' },
  { label: 'Price', key: 'priceAda', alignRight: true },
  { label: '24h', key: 'change24h', alignRight: true },
  { label: '7d', key: 'change7d', alignRight: true },
  { label: 'Volume 24h', key: 'volume24hAda', alignRight: true },
  { label: 'Market Cap', key: 'marketCapAda', alignRight: true },
  { label: 'FDV', key: 'fdvAda', alignRight: true },
];

interface TokenTableProps {
  tokens: MarketToken[];
  loading: boolean;
  onSelectToken: (token: MarketToken) => void;
}

/** Zentrale Token-Tabelle: Top 50 Cardano-Ökosystem-Token (Live-Daten). */
export default function TokenTable({ tokens, loading, onSelectToken }: TokenTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('marketCapAda');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [query, setQuery] = useState('');

  const visibleTokens = useMemo(() => {
    const filtered = query
      ? tokens.filter(
          (t) =>
            t.ticker.toLowerCase().includes(query.toLowerCase()) ||
            t.name.toLowerCase().includes(query.toLowerCase())
        )
      : tokens;
    const direction = sortAsc ? 1 : -1;
    return [...filtered].sort((a, b) => (a[sortKey] - b[sortKey]) * direction);
  }, [tokens, query, sortKey, sortAsc]);

  const maxMarketCap = Math.max(...tokens.map((t) => t.marketCapAda), 1);

  const handleSort = (key?: SortKey) => {
    if (!key) return;
    if (key === sortKey) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <section aria-label="Top Cardano Tokens">
      {/* Filter-Leiste */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
          <span className="text-slate-500">Filter:</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ticker oder Name…"
            className="w-36 bg-transparent font-semibold text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
        </label>
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
          </span>
          {visibleTokens.length} tokens · Live via CoinGecko
        </span>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.01]">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left">
              {COLUMNS.map((col) => (
                <th
                  key={col.label}
                  onClick={() => handleSort(col.key)}
                  className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 ${
                    col.alignRight ? 'text-right' : ''
                  } ${col.key ? 'cursor-pointer select-none hover:text-slate-300' : ''} ${
                    sortKey === col.key ? 'text-blue-400' : ''
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.key && sortKey !== col.key && (
                      <ArrowUpDown className="h-3 w-3 text-slate-700" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && tokens.length === 0
              ? // Skeleton-Reihen während des ersten Ladens
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5 animate-pulse">
                    <td className="px-4 py-3.5"><div className="h-4 w-6 rounded bg-white/5" /></td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-white/5" />
                        <div className="space-y-1.5">
                          <div className="h-3.5 w-20 rounded bg-white/5" />
                          <div className="h-2.5 w-12 rounded bg-white/5" />
                        </div>
                      </div>
                    </td>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="ml-auto h-4 w-16 rounded bg-white/5" />
                      </td>
                    ))}
                  </tr>
                ))
              : visibleTokens.map((token, index) => (
                  <tr
                    key={token.id || token.ticker}
                    onClick={() => onSelectToken(token)}
                    className="cursor-pointer border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
                  >
                    {/* Rang */}
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                      {String(index + 1).padStart(2, '0')}
                    </td>

                    {/* Token mit echtem Logo */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <TokenLogo src={token.image} ticker={token.ticker} size={32} />
                        <div>
                          <p className="font-bold text-white">{token.ticker}</p>
                          <p className="max-w-[160px] truncate text-[11px] text-slate-500">
                            {token.name}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Preis in ADA */}
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-100">
                      {formatAdaPrice(token.priceAda)}
                    </td>

                    {/* Veränderungen */}
                    <ChangeCell value={token.change24h} />
                    <ChangeCell value={token.change7d} />

                    {/* Volumen */}
                    <td className="px-4 py-3.5 text-right text-slate-300">
                      {formatCompactAda(token.volume24hAda)}
                    </td>

                    {/* Market Cap + Mini-Balken */}
                    <td className="px-4 py-3.5 text-right">
                      <p className="font-semibold text-blue-300">
                        {formatCompactAda(token.marketCapAda)}
                      </p>
                      <MiniBar value={token.marketCapAda} max={maxMarketCap} />
                    </td>

                    {/* FDV */}
                    <td className="px-4 py-3.5 text-right text-slate-300">
                      {formatCompactAda(token.fdvAda)}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-Komponenten
// ---------------------------------------------------------------------------

function ChangeCell({ value }: { value: number }) {
  return (
    <td
      className={`px-4 py-3.5 text-right text-[13px] font-semibold ${
        value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-slate-500'
      }`}
    >
      {formatChange(value)}
    </td>
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const width = Math.max((value / max) * 100, 2);
  return (
    <div className="ml-auto mt-1 h-0.5 w-16 overflow-hidden rounded-full bg-white/5">
      <div className="h-full rounded-full bg-blue-500" style={{ width: `${width}%` }} />
    </div>
  );
}
