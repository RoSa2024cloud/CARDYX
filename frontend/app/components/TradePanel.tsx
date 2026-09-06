'use client';

import { useMemo, useState } from 'react';
import { ArrowDownUp, ChevronDown, ExternalLink, Info, Wallet, X, Zap } from 'lucide-react';
import TokenLogo from './TokenLogo';
import { useWallet } from './WalletProvider';
import { buildSwapUrl } from '../lib/dexhunter';
import { MarketToken, formatAdaPrice, formatChange, formatUsd } from '../lib/tokens';

interface TradePanelProps {
  tokens: MarketToken[];
  adaPriceUsd: number | null;
  /** Aktuell im Detail-Fenster geöffneter Token → wird im Panel voreingestellt */
  selectedToken: MarketToken | null;
  /** Setzt den Kauf-Token (z.B. aus dem Auswahl-Dropdown) */
  onSelectToken: (token: MarketToken) => void;
  /** Schließt das schwebende Panel */
  onClose?: () => void;
}

const QUICK_AMOUNTS = [10, 50, 100, 500];

// Geschätzte Gesamtkosten einer Aggregator-Order (DEX-Gebühr + Batcher + Slippage)
const FEE_ESTIMATE_ADA = 1.9;

/**
 * cDOG Trade Terminal: Abgetrennter Handelsbereich rechts neben dem Dashboard.
 * Berechnet Live-Quotes (geschätzter Erhalt, Preisimpact, Gebühren) und
 * leitet die Ausführung an DexHunter (Cardano DEX Aggregator) weiter.
 * Echte Wallet-Signierung folgt mit Phase 7 (CIP-30-Connector).
 */
export default function TradePanel({ tokens, adaPriceUsd, selectedToken, onSelectToken, onClose }: TradePanelProps) {
  const wallet = useWallet();
  const [sellAmount, setSellAmount] = useState<string>('100');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');

  // Kauf-Token: Vorauswahl aus dem Detail-Fenster, sonst erster Nicht-ADA-Token
  const buyToken = useMemo(() => {
    if (selectedToken && selectedToken.ticker !== 'ADA') return selectedToken;
    return tokens.find((t) => t.ticker !== 'ADA') ?? null;
  }, [tokens, selectedToken]);

  const amountAda = parseFloat(sellAmount.replace(',', '.')) || 0;

  // Live-Quote-Berechnung
  const quote = useMemo(() => {
    if (!buyToken || amountAda <= 0 || buyToken.priceAda <= 0) return null;
    const estReceive = amountAda / buyToken.priceAda;
    // Preisimpact-Schätzung: linear zum Volumen, hart begrenzt
    const impact =
      buyToken.volume24hAda > 0
        ? Math.min((amountAda / buyToken.volume24hAda) * 100 * 8, 15)
        : 2.5;
    const minReceive = estReceive * (1 - (impact + 0.5) / 100);
    return { estReceive, impact, minReceive };
  }, [buyToken, amountAda]);

  const dexhunterUrl = buildSwapUrl(buyToken?.policyId);

  const pickerList = useMemo(() => {
    const list = tokens.filter((t) => t.ticker !== 'ADA');
    if (!pickerQuery) return list;
    const q = pickerQuery.toLowerCase();
    return list.filter(
      (t) => t.ticker.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
    );
  }, [tokens, pickerQuery]);

  return (
    <aside
      aria-label="TRADE Terminal"
      className="w-full overflow-hidden rounded-2xl border border-blue-500/30 bg-[#0a0f1c]/95 shadow-2xl shadow-blue-950/50 backdrop-blur-md ring-1 ring-blue-500/20"
    >
      {/* Kopf */}
      <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-blue-600/15 to-transparent px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white">
          <Zap className="h-4 w-4 text-blue-400" />
          TRADE Terminal
        </h2>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60"></span>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500"></span>
            </span>
            Aggregator
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Trade Terminal schließen"
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 transition-colors hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {/* Du zahlst */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Du zahlst
          </label>
          <div className="rounded-xl border border-white/10 bg-[#05070d] p-3 transition-colors focus-within:border-blue-500/50">
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0.0"
                className="w-full bg-transparent text-xl font-bold text-white placeholder:text-slate-700 focus:outline-none"
              />
              <span className="flex shrink-0 items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-sm font-bold text-white">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-700 text-[9px] font-extrabold">
                  ₳
                </span>
                ADA
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              ≈ {adaPriceUsd && amountAda > 0 ? formatUsd(amountAda * adaPriceUsd, 2) : '$0.00'}
            </p>
          </div>
          {/* Schnellauswahl */}
          <div className="mt-2 flex gap-1.5">
            {QUICK_AMOUNTS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSellAmount(String(v))}
                className={`flex-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
                  amountAda === v
                    ? 'border-blue-500/50 bg-blue-600/20 text-blue-300'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/15 hover:text-white'
                }`}
              >
                {v} ₳
              </button>
            ))}
          </div>
        </div>

        {/* Trenner */}
        <div className="relative flex justify-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#0a0f1c] text-slate-400">
            <ArrowDownUp className="h-3.5 w-3.5" />
          </span>
        </div>

        {/* Du erhältst */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Du erhältst (geschätzt)
          </label>
          <div className="relative rounded-xl border border-white/10 bg-[#05070d] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className={`text-xl font-bold ${quote ? 'text-green-400' : 'text-slate-700'}`}>
                {quote
                  ? quote.estReceive.toLocaleString('en-US', { maximumFractionDigits: 2 })
                  : '0.0'}
              </span>

              {/* Token-Auswahl */}
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600/20 px-2.5 py-1.5 text-sm font-bold text-white transition-colors hover:bg-blue-600/30"
              >
                {buyToken && <TokenLogo src={buyToken.image} ticker={buyToken.ticker} size={20} />}
                {buyToken?.ticker ?? '—'}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>
            {buyToken && (
              <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                1 {buyToken.ticker} = {formatAdaPrice(buyToken.priceAda)}
                <span className={buyToken.change24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {formatChange(buyToken.change24h)}
                </span>
              </p>
            )}

            {/* Auswahl-Dropdown */}
            {pickerOpen && (
              <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#0a0f1c] shadow-2xl shadow-black/60">
                <div className="sticky top-0 border-b border-white/5 bg-[#0a0f1c] p-2">
                  <input
                    type="text"
                    autoFocus
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Token suchen…"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
                  />
                </div>
                {pickerList.map((t) => (
                  <button
                    key={t.id || t.ticker}
                    type="button"
                    onClick={() => {
                      onSelectToken(t);
                      setPickerOpen(false);
                      setPickerQuery('');
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/5 ${
                      t.id === buyToken?.id ? 'bg-blue-600/10' : ''
                    }`}
                  >
                    <TokenLogo src={t.image} ticker={t.ticker} size={24} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-white">{t.ticker}</span>
                      <span className="block truncate text-[10px] text-slate-500">{t.name}</span>
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">{formatAdaPrice(t.priceAda)}</span>
                  </button>
                ))}
                {pickerList.length === 0 && (
                  <p className="px-4 py-3 text-xs text-slate-500">Kein Token gefunden.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quote-Details */}
        {quote && buyToken && (
          <dl className="space-y-1 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px]">
            <div className="flex justify-between">
              <dt className="text-slate-500">Kurs</dt>
              <dd className="font-semibold text-slate-200">
                1 ADA ≈{' '}
                {(1 / buyToken.priceAda).toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
                {buyToken.ticker}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Preisimpact (geschätzt)</dt>
              <dd
                className={`font-semibold ${
                  quote.impact < 1
                    ? 'text-green-400'
                    : quote.impact < 3
                      ? 'text-amber-400'
                      : 'text-red-400'
                }`}
              >
                ~{quote.impact.toFixed(2)}%
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Min. Erhalt (Slippage 0,5%)</dt>
              <dd className="font-semibold text-slate-200">
                {quote.minReceive.toLocaleString('en-US', { maximumFractionDigits: 2 })}{' '}
                {buyToken.ticker}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">DEX- & Netzwerkgebühren (ca.)</dt>
              <dd className="font-semibold text-slate-200">~{FEE_ESTIMATE_ADA} ₳</dd>
            </div>
          </dl>
        )}

        {/* Ausführen */}
        <a
          href={dexhunterUrl}
          target="_blank"
          rel="noopener noreferrer"
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-lg transition-all ${
            quote
              ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-blue-600/25 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98]'
              : 'pointer-events-none bg-white/5 text-slate-600 shadow-none'
          }`}
        >
          <Zap className="h-4 w-4" />
          {buyToken ? `${buyToken.ticker} kaufen` : 'Token wählen'}
          <ExternalLink className="h-3.5 w-3.5 opacity-60" />
        </a>

        {/* Wallet-Status */}
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px]">
          {wallet.address ? (
            <>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
              <span className="truncate text-slate-400">
                {wallet.name} verbunden
                {wallet.balanceAda !== null && (
                  <span className="font-semibold text-slate-200">
                    {' '}· ₳{wallet.balanceAda.toLocaleString('de-DE', { maximumFractionDigits: 2 })} verfügbar
                  </span>
                )}
              </span>
            </>
          ) : (
            <>
              <Wallet className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="text-slate-500">
                Keine Wallet verbunden – Ausführung aktuell über DexHunter. Oben rechts verbinden.
              </span>
            </>
          )}
        </div>

        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-600">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          Ausführung über DexHunter – Cardano DEX Aggregator (Minswap, SundaeSwap, Splash u.a.).
          Quote = Schätzwert. Direkter In-App-Swap mit verbundener Wallet folgt. Keine Anlageberatung.
        </p>
      </div>
    </aside>
  );
}
