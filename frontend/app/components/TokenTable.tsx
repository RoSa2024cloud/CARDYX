'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import TokenLogo from './TokenLogo';
import { useLanguage } from './LanguageProvider';
import {
  ActiveMarketPool,
  MarketToken,
  formatChange,
  formatMarketValue,
  formatTokenPrice,
} from '../lib/tokens';
import { useCurrency } from './CurrencyProvider';

type SortKey = 'marketCapAda' | 'marketCapUsd' | 'priceAda' | 'priceUsd' | 'change24h' | 'change7d' | 'volume24hAda' | 'volume24hUsd' | 'fdvAda' | 'fdvUsd';

interface Column {
  label: string;
  key?: SortKey;
  alignRight?: boolean;
}

const PAGE_SIZE = 50;
const CATEGORIES = [
  { id: 'all', de: 'Alle', en: 'All' },
  { id: 'layer-1', de: 'Layer 1', en: 'Layer 1' },
  { id: 'defi', de: 'DeFi', en: 'DeFi' },
  { id: 'stablecoin', de: 'Stablecoins', en: 'Stablecoins' },
  { id: 'infrastructure', de: 'Infrastruktur', en: 'Infrastructure' },
  { id: 'gaming', de: 'Gaming', en: 'Gaming' },
  { id: 'ai', de: 'KI', en: 'AI' },
  { id: 'nft', de: 'NFT', en: 'NFT' },
  { id: 'meme', de: 'Memes', en: 'Memes' },
  { id: 'rwa', de: 'RWA', en: 'RWA' },
  { id: 'other', de: 'Weitere', en: 'Other' },
  { id: 'liqwid', de: 'Liqwid', en: 'Liqwid' },
] as const;

interface TokenTableProps {
  tokens: MarketToken[];
  loading: boolean;
  onSelectToken: (token: MarketToken) => void;
  marketSource?: string;
}

/** Zentrale Token-Tabelle: Top 50 Cardano-Ökosystem-Token (Live-Daten). */
export default function TokenTable({ tokens, loading, onSelectToken, marketSource = 'CARDYX Local Feed' }: TokenTableProps) {
  const { language } = useLanguage();
  const { currency } = useCurrency();
  const adaMode = currency === 'ADA';
  const columns: Column[] = [
    { label: '#' }, { label: 'Token' },
    { label: language === 'de' ? 'Aktivierte LPs' : 'Activated LPs' },
    { label: `${language === 'de' ? 'Preis' : 'Price'} (${currency})`, key: adaMode ? 'priceAda' : 'priceUsd', alignRight: true },
    { label: '24h', key: 'change24h', alignRight: true },
    { label: language === 'de' ? '7T / Chart' : '7d / chart', key: 'change7d', alignRight: true },
    { label: `${language === 'de' ? 'Volumen 24h' : 'Volume 24h'} (${currency})`, key: adaMode ? 'volume24hAda' : 'volume24hUsd', alignRight: true },
    { label: `${language === 'de' ? 'Marktkapitalisierung' : 'Market Cap'} (${currency})`, key: adaMode ? 'marketCapAda' : 'marketCapUsd', alignRight: true },
    { label: `FDV (${currency})`, key: adaMode ? 'fdvAda' : 'fdvUsd', alignRight: true },
  ];
  const [sortKey, setSortKey] = useState<SortKey>(adaMode ? 'marketCapAda' : 'marketCapUsd');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('all');
  const [page, setPage] = useState(1);

  const visibleTokens = useMemo(() => {
    const searched = query
      ? tokens.filter(
          (t) =>
            t.ticker.toLowerCase().includes(query.toLowerCase()) ||
            t.name.toLowerCase().includes(query.toLowerCase())
        )
      : tokens;
    const filtered = category === 'all'
      ? searched
      : category === 'liqwid'
        ? searched.filter((token) => token.protocol === 'Liqwid')
        : searched.filter((token) => (token.category ?? 'other') === category);
    const direction = sortAsc ? 1 : -1;
    return [...filtered].sort((a, b) => (a[sortKey] - b[sortKey]) * direction);
  }, [tokens, query, category, sortKey, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(visibleTokens.length / PAGE_SIZE));
  const pageTokens = visibleTokens.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const maxMarketCap = Math.max(...visibleTokens.map((token) => adaMode ? token.marketCapAda : token.marketCapUsd), 1);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setSortKey(adaMode ? 'marketCapAda' : 'marketCapUsd');
    setSortAsc(false);
    setPage(1);
  }, [adaMode]);

  const handleSort = (key?: SortKey) => {
    if (!key) return;
    setPage(1);
    if (key === sortKey) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const handleCategory = (nextCategory: (typeof CATEGORIES)[number]['id']) => {
    setCategory(nextCategory);
    setPage(1);
  };

  return (
    <section aria-label={language === 'de' ? 'Top Cardano Token' : 'Top Cardano Tokens'}>
      {/* Filter-Leiste */}
      <div className="mb-3 space-y-2.5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={language === 'de' ? 'Token-Kategorie' : 'Token category'}>
          {CATEGORIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => handleCategory(entry.id)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                category === entry.id
                  ? 'border-cyan-300/55 bg-cyan-300/15 text-cyan-100'
                  : 'border-white/10 bg-white/[0.025] text-slate-400 hover:border-white/20 hover:text-slate-200'
              }`}
            >
              {language === 'de' ? entry.de : entry.en}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
          <span className="text-slate-500">{language === 'de' ? 'Filter:' : 'Filter:'}</span>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={language === 'de' ? 'Ticker oder Name…' : 'Ticker or name…'}
            className="w-36 bg-transparent font-semibold text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
        </label>
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
          </span>
          {visibleTokens.length} {language === 'de' ? `Token · ${marketSource}` : `tokens · ${marketSource}`}
        </span>
        </div>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.01]">
        <table className="w-full min-w-[1040px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left">
              {columns.map((col) => (
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
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="ml-auto h-4 w-16 rounded bg-white/5" />
                      </td>
                    ))}
                  </tr>
                ))
              : pageTokens.map((token, index) => (
                  <tr
                    key={token.id || token.ticker}
                    onClick={() => onSelectToken(token)}
                    className="cursor-pointer border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
                  >
                    {/* Rang */}
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                      {String(token.marketCapRank ?? (page - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}
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

                    <td className="px-4 py-3.5">
                      <ActivePoolLogos pools={token.activePools ?? []} />
                    </td>

                    {/* Preis in ADA */}
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-100">
                      {formatTokenPrice(token.priceAda, token.priceUsd, currency)}
                    </td>

                    {/* Veränderungen */}
                    <ChangeCell value={token.change24h} />
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex min-w-[118px] items-center justify-end gap-2">
                        <Sparkline values={token.sparkline7d} positive={token.change7d >= 0} />
                        <span
                          className={`text-[13px] font-semibold ${
                            token.change7d > 0 ? 'text-green-400' : token.change7d < 0 ? 'text-red-400' : 'text-slate-500'
                          }`}
                        >
                          {formatChange(token.change7d)}
                        </span>
                      </div>
                    </td>

                    {/* Volumen */}
                    <td className="px-4 py-3.5 text-right text-slate-300">
                      {formatMarketValue(token.volume24hAda, token.volume24hUsd, currency)}
                    </td>

                    {/* Market Cap + Mini-Balken */}
                    <td className="px-4 py-3.5 text-right">
                      <p className="font-semibold text-blue-300">
                        {formatMarketValue(token.marketCapAda, token.marketCapUsd, currency)}
                      </p>
                      <MiniBar value={adaMode ? token.marketCapAda : token.marketCapUsd} max={maxMarketCap} />
                    </td>

                    {/* FDV */}
                    <td className="px-4 py-3.5 text-right text-slate-300">
                      {formatMarketValue(token.fdvAda, token.fdvUsd, currency)}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex min-h-9 items-center justify-end gap-3">
        <span className="mr-auto text-xs text-slate-500">
          {language === 'de' ? `Seite ${page} von ${pageCount}` : `Page ${page} of ${pageCount}`}
        </span>
        <button
          type="button"
          onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
          disabled={page === 1}
          title={language === 'de' ? 'Vorherige Seite' : 'Previous page'}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition-colors hover:border-cyan-300/45 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))}
          disabled={page === pageCount}
          title={language === 'de' ? 'Naechste Seite' : 'Next page'}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition-colors hover:border-cyan-300/45 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-Komponenten
// ---------------------------------------------------------------------------

const DEX_POOL_LOGOS: Record<string, { name: string; shortName: string; image: string }> = {
  minswap: { name: 'Minswap', shortName: 'MI', image: 'https://minswap.org/favicon.ico' },
  sundaeswap: { name: 'SundaeSwap', shortName: 'SU', image: 'https://sundaeswap.finance/favicon.ico' },
  wingriders: { name: 'WingRiders', shortName: 'WR', image: 'https://app.wingriders.com/favicon.svg' },
  cswap: { name: 'CSWAP', shortName: 'CS', image: 'https://cswap.trade/assets/icons/dex/common/logo-tron.svg' },
  muesliswap: { name: 'MuesliSwap', shortName: 'MU', image: 'https://muesliswap.com/favicon.ico' },
};

function ActivePoolLogos({ pools }: { pools: ActiveMarketPool[] }) {
  if (pools.length === 0) return <span className="text-slate-600">—</span>;

  return (
    <div className="flex min-w-[112px] flex-wrap items-center gap-x-2 gap-y-2 py-1" aria-label={`${pools.length} aktive Preis-Pools`}>
      {pools.map((pool) => {
        const logo = DEX_POOL_LOGOS[pool.dex.toLowerCase()];
        return (
          <PoolSourceLogo
            key={pool.poolId}
            pool={pool}
            name={logo?.name ?? pool.dex}
            shortName={logo?.shortName ?? pool.dex.slice(0, 2).toUpperCase()}
            image={logo?.image}
          />
        );
      })}
    </div>
  );
}

function PoolSourceLogo({
  pool,
  name,
  shortName,
  image,
}: {
  pool: ActiveMarketPool;
  name: string;
  shortName: string;
  image?: string;
}) {
  const [failed, setFailed] = useState(false);
  const version = pool.version.toUpperCase();
  const title = `${name} ${version} · ${pool.poolId}`;

  return (
    <span
      className="relative mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#09122d] bg-slate-800 text-[8px] font-bold text-slate-200"
      title={title}
      aria-label={title}
    >
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-cyan-300/15 px-1 text-[7px] font-bold leading-3 text-cyan-200">
        {version}
      </span>
      {image && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- small official DEX logos, not token media
        <img src={image} alt="" width={20} height={20} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : shortName}
    </span>
  );
}

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

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) {
    return <div className="h-7 w-[76px] rounded-md bg-white/[0.035]" aria-label="7d chart unavailable" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 76;
      const y = 26 - ((value - min) / span) * 22;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 76 28" className="h-7 w-[76px]" role="img" aria-label="7-day price chart">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#4ade80' : '#f87171'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
