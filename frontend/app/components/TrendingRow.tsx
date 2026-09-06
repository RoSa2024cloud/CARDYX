'use client';

import { Flame } from 'lucide-react';
import TokenLogo from './TokenLogo';
import { MarketToken, formatAdaPrice, formatChange } from '../lib/tokens';

interface TrendingRowProps {
  tokens: MarketToken[];
  onSelectToken: (token: MarketToken) => void;
}

/**
 * TRENDING-Laufschrift: Zeigt die Top 10 Token mit den stärksten
 * 24h-Bewegungen als endlos laufende Marquee (pausiert bei Hover).
 * Die Liste wird verdoppelt gerendert, damit der Loop nahtlos wirkt.
 */
export default function TrendingRow({ tokens, onSelectToken }: TrendingRowProps) {
  if (tokens.length === 0) return null;

  const marqueeTokens = [...tokens, ...tokens];

  return (
    <section aria-label="Trending Tokens">
      <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
        <Flame className="h-3.5 w-3.5 text-orange-400" />
        Trending · 24h
      </h2>

      <div className="group relative -mx-4 overflow-hidden sm:-mx-6">
        {/* Weiche Ränder links/rechts */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#05070d] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#05070d] to-transparent" />

        <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-2.5 px-4 pb-1 group-hover:[animation-play-state:paused] motion-reduce:animate-none sm:px-6">
          {marqueeTokens.map((token, index) => (
            <button
              key={`${token.id || token.ticker}-${index}`}
              type="button"
              onClick={() => onSelectToken(token)}
              aria-hidden={index >= tokens.length}
              tabIndex={index >= tokens.length ? -1 : 0}
              className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 transition-colors hover:border-white/15 hover:bg-white/[0.04]"
            >
              <TokenLogo src={token.image} ticker={token.ticker} size={26} />
              <span className="text-[13px] font-bold text-white">{token.ticker}</span>
              <span className="text-[11px] text-slate-500">{formatAdaPrice(token.priceAda)}</span>
              <span
                className={`text-[12px] font-bold ${
                  token.change24h > 0
                    ? 'text-green-400'
                    : token.change24h < 0
                      ? 'text-red-400'
                      : 'text-slate-500'
                }`}
              >
                {formatChange(token.change24h)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
