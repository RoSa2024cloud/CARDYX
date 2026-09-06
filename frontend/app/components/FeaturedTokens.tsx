'use client';

import TokenLogo from './TokenLogo';
import { MarketToken, formatAdaPrice, formatChange, formatCompactAda } from '../lib/tokens';

interface FeaturedTokensProps {
  tokens: MarketToken[];
  onSelectToken: (token: MarketToken) => void;
}

/**
 * FEATURED-Laufschrift: Alle Top-50-Token laufen der Reihe nach
 * (Market-Cap-Rangfolge) als endlose Marquee durch – pausiert bei Hover.
 * Die Liste wird verdoppelt gerendert, damit der Loop nahtlos wirkt.
 */
export default function FeaturedTokens({ tokens, onSelectToken }: FeaturedTokensProps) {
  if (tokens.length === 0) return null;

  const marqueeTokens = [...tokens, ...tokens];

  return (
    <section aria-label="Featured Tokens">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
        Featured
      </h2>

      <div className="group relative -mx-4 overflow-hidden sm:-mx-6">
        {/* Weiche Ränder links/rechts */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#05070d] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#05070d] to-transparent" />

        <div className="flex w-max animate-[marquee_90s_linear_infinite] gap-3 px-4 pb-1 group-hover:[animation-play-state:paused] motion-reduce:animate-none sm:px-6">
          {marqueeTokens.map((token, index) => (
            <button
              key={`${token.id || token.ticker}-${index}`}
              type="button"
              onClick={() => onSelectToken(token)}
              aria-hidden={index >= tokens.length}
              tabIndex={index >= tokens.length ? -1 : 0}
              className="w-[210px] shrink-0 cursor-pointer rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left transition-colors hover:border-blue-500/30 hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-2.5">
                <TokenLogo src={token.image} ticker={token.ticker} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{token.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{token.ticker}</p>
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-100">{formatAdaPrice(token.priceAda)}</span>
                <span
                  className={`text-xs font-semibold ${
                    token.change24h > 0
                      ? 'text-green-400'
                      : token.change24h < 0
                        ? 'text-red-400'
                        : 'text-slate-500'
                  }`}
                >
                  {formatChange(token.change24h)}
                </span>
              </div>
              <p className="mt-2 border-t border-white/5 pt-2 text-[10px] text-slate-500">
                MC {formatCompactAda(token.marketCapAda)}&nbsp;&nbsp;Vol {formatCompactAda(token.volume24hAda)}
              </p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
