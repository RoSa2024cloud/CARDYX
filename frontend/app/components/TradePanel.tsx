'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, CheckCircle2, ChevronDown, Info, Loader2, Wallet, X, Zap } from 'lucide-react';
import TokenLogo from './TokenLogo';
import WalletConnectModal from './WalletConnectModal';
import { useWallet } from './WalletProvider';
import { useLanguage } from './LanguageProvider';
import { API_URL } from '../lib/api';
import { MarketToken, formatAdaPrice, formatChange, formatUsd } from '../lib/tokens';

interface TradePanelProps {
  tokens: MarketToken[];
  adaPriceUsd: number | null;
  selectedToken: MarketToken | null;
  onSelectToken: (token: MarketToken) => void;
  onClose?: () => void;
}

interface DexHunterToken {
  token_id: string;
  ticker: string;
  name?: string;
  image?: string | null;
}

interface SwapQuote {
  total_output: number;
  total_output_without_slippage: number;
  partner_fee?: number;
  splits?: { dex: string }[];
}

const QUICK_AMOUNTS = [10, 50, 100, 500];
const SLIPPAGE = 0.5;

export default function TradePanel({ tokens, adaPriceUsd, selectedToken, onSelectToken, onClose }: TradePanelProps) {
  const wallet = useWallet();
  const { language } = useLanguage();
  const [sellAmount, setSellAmount] = useState('100');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [remoteTokens, setRemoteTokens] = useState<DexHunterToken[]>([]);
  const [remoteSearchState, setRemoteSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [asset, setAsset] = useState<DexHunterToken | null>(null);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [tradeState, setTradeState] = useState<'idle' | 'building' | 'signing' | 'submitting' | 'complete'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const copy = language === 'de'
    ? { pay: 'Du zahlst', receive: 'Du erhältst', minReceive: 'Min. Erhalt', route: 'Route', partnerFee: 'Partner-Fee', liveQuote: 'Live Quote', connect: 'Wallet verbinden, um zu handeln', confirm: 'Swap in Wallet bestätigen', building: 'Transaktion wird erstellt…', signing: 'In Wallet bestätigen…', submitting: 'Transaktion wird gesendet…', complete: 'Swap gesendet', close: 'Trade Terminal schließen', disclaimer: 'Live-Quote und Routing über DexHunter. CARDYX verwahrt keine Assets; jede Transaktion wird in deiner Wallet bestätigt.' }
    : { pay: 'You pay', receive: 'You receive', minReceive: 'Min. received', route: 'Route', partnerFee: 'Partner fee', liveQuote: 'Live quote', connect: 'Connect wallet to trade', confirm: 'Confirm swap in wallet', building: 'Building transaction…', signing: 'Confirm in wallet…', submitting: 'Submitting transaction…', complete: 'Swap submitted', close: 'Close trade terminal', disclaimer: 'Live quote and routing via DexHunter. CARDYX never holds assets; every transaction is confirmed in your wallet.' };

  const buyToken = useMemo(() => {
    if (selectedToken && selectedToken.ticker !== 'ADA') return selectedToken;
    return tokens.find((token) => token.ticker !== 'ADA') ?? null;
  }, [selectedToken, tokens]);
  const amountAda = Number(sellAmount.replace(',', '.')) || 0;

  const pickerList = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase();
    const available = tokens.filter((token) => token.ticker !== 'ADA');
    return query ? available.filter((token) => token.ticker.toLowerCase().includes(query) || token.name.toLowerCase().includes(query)) : available;
  }, [tokens, pickerQuery]);

  useEffect(() => {
    const query = pickerQuery.trim();
    if (!pickerOpen || query.length < 2) {
      setRemoteTokens([]);
      setRemoteSearchState('idle');
      return;
    }

    let cancelled = false;
    setRemoteSearchState('loading');
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/trade/tokens?query=${encodeURIComponent(query)}`);
        const json = await response.json();
        if (!response.ok || !json.success || !Array.isArray(json.data)) throw new Error('Search failed');
        if (!cancelled) {
          setRemoteTokens(json.data.filter((entry: DexHunterToken) => entry?.token_id && entry?.ticker));
          setRemoteSearchState('ready');
        }
      } catch {
        if (!cancelled) {
          setRemoteTokens([]);
          setRemoteSearchState('error');
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pickerOpen, pickerQuery]);

  const selectRemoteToken = (token: DexHunterToken) => {
    onSelectToken({
      id: token.token_id,
      ticker: token.ticker.toUpperCase(),
      name: token.name ?? token.ticker,
      image: token.image ?? null,
      policyId: null,
      priceUsd: 0,
      priceAda: 0,
      change24h: 0,
      change7d: 0,
      volume24hUsd: 0,
      marketCapUsd: 0,
      fdvUsd: 0,
      volume24hAda: 0,
      marketCapAda: 0,
      fdvAda: 0,
      marketCapRank: null,
      circulatingSupply: 0,
      totalSupply: null,
      maxSupply: null,
      athUsd: 0,
      athChangePct: 0,
      athDate: null,
      atlUsd: 0,
      atlChangePct: 0,
      atlDate: null,
      high24hUsd: 0,
      low24hUsd: 0,
      sparkline7d: [],
    });
    setPickerOpen(false);
    setPickerQuery('');
  };

  // DexHunter liefert die vollständige, handelbare Asset-ID und die echte Quote.
  useEffect(() => {
    if (!buyToken?.ticker || amountAda <= 0) {
      setAsset(null);
      setQuote(null);
      setQuoteState('idle');
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setQuoteState('loading');
      setError(null);
      setTxHash(null);
      try {
        const searchResponse = await fetch(`${API_URL}/api/trade/tokens?query=${encodeURIComponent(buyToken.ticker)}`);
        const searchJson = await searchResponse.json();
        if (!searchResponse.ok || !searchJson.success || !Array.isArray(searchJson.data)) throw new Error(searchJson.error ?? 'Token nicht handelbar.');
        const resolved = searchJson.data.find((entry: DexHunterToken) => entry.ticker?.toUpperCase() === buyToken.ticker.toUpperCase());
        if (!resolved?.token_id) throw new Error(`${buyToken.ticker} ist bei DexHunter nicht handelbar.`);
        if (cancelled) return;
        setAsset(resolved);

        const estimateResponse = await fetch(`${API_URL}/api/trade/estimate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token_in: '', token_out: resolved.token_id, amount_in: amountAda, slippage: SLIPPAGE, blacklisted_dexes: [] }),
        });
        const estimateJson = await estimateResponse.json();
        if (!estimateResponse.ok || !estimateJson.success) throw new Error(estimateJson.error ?? 'Live-Quote nicht verfügbar.');
        if (cancelled) return;
        setQuote(estimateJson.data);
        setQuoteState('ready');
      } catch (requestError: any) {
        if (cancelled) return;
        setAsset(null);
        setQuote(null);
        setError(requestError.message ?? 'Live-Quote nicht verfügbar.');
        setQuoteState('error');
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [buyToken?.ticker, amountAda]);

  const executeSwap = async () => {
    if (!wallet.address || !wallet.api) return setError(language === 'de' ? 'Bitte zuerst oben rechts eine Wallet verbinden.' : 'Connect a wallet first.');
    if (wallet.networkId !== 1) return setError(language === 'de' ? 'Bitte deine Wallet auf Cardano Mainnet umstellen.' : 'Switch your wallet to Cardano Mainnet.');
    if (!asset || !quote) return setError(language === 'de' ? 'Noch keine gültige Live-Quote vorhanden.' : 'No valid live quote is available yet.');

    setError(null);
    setTxHash(null);
    try {
      const payload = { buyer_address: wallet.address, token_in: '', token_out: asset.token_id, amount_in: amountAda, slippage: SLIPPAGE, blacklisted_dexes: [] };
      setTradeState('building');
      const buildResponse = await fetch(`${API_URL}/api/trade/build`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const buildJson = await buildResponse.json();
      if (!buildResponse.ok || !buildJson.success || !buildJson.data?.cbor) throw new Error(buildJson.error ?? 'Transaktion konnte nicht erstellt werden.');

      setTradeState('signing');
      const signatures = await wallet.api.signTx(buildJson.data.cbor, true);
      setTradeState('submitting');
      const signResponse = await fetch(`${API_URL}/api/trade/sign`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ txCbor: buildJson.data.cbor, signatures }) });
      const signJson = await signResponse.json();
      if (!signResponse.ok || !signJson.success || !signJson.data?.cbor) throw new Error(signJson.error ?? 'Signatur konnte nicht verarbeitet werden.');

      setTxHash(await wallet.api.submitTx(signJson.data.cbor));
      setTradeState('complete');
    } catch (tradeError: any) {
      setTradeState('idle');
      setError(tradeError?.info ?? tradeError?.message ?? 'Swap wurde nicht ausgeführt.');
    }
  };

  const busy = ['building', 'signing', 'submitting'].includes(tradeState);
  const buttonText = tradeState === 'building' ? copy.building : tradeState === 'signing' ? copy.signing : tradeState === 'submitting' ? copy.submitting : wallet.address ? copy.confirm : copy.connect;
  const route = quote?.splits?.map((split) => split.dex).filter((dex, index, dexes) => dexes.indexOf(dex) === index).join(' + ');

  return (
    <aside aria-label="TRADE Terminal" className="cardyx-glass-strong w-full overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-cyan-100/10 bg-gradient-to-r from-blue-600/30 via-cyan-400/10 to-violet-500/20 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Zap className="h-4 w-4 text-cyan-300" />TRADE Terminal</h2>
        <div className="flex items-center gap-2"><span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400">{copy.liveQuote}</span>{onClose && <button type="button" onClick={onClose} aria-label={copy.close} className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>}</div>
      </div>
      {pickerOpen && remoteTokens.length > 0 && (
        <div className="border-b border-cyan-200/10 bg-cyan-300/[0.03] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
            {language === 'de' ? 'DexHunter-Suchergebnisse' : 'DexHunter search results'}
          </p>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {remoteTokens.map((token) => (
              <button
                key={`remote-panel-${token.token_id}`}
                type="button"
                onClick={() => selectRemoteToken(token)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-cyan-300/10"
              >
                <TokenLogo src={token.image ?? null} ticker={token.ticker} size={22} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-white">{token.ticker}</span>
                  <span className="block truncate text-[10px] text-slate-500">{token.name ?? token.token_id}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-3 p-4">
        <div><label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">{copy.pay}</label><div className="rounded-xl border border-white/10 bg-[#05070d] p-3 focus-within:border-blue-500/50"><div className="flex items-center justify-between gap-3"><input type="text" inputMode="decimal" value={sellAmount} onChange={(event) => setSellAmount(event.target.value.replace(/[^0-9.,]/g, ''))} className="w-full bg-transparent text-xl font-bold text-white focus:outline-none" /><span className="rounded-lg bg-white/5 px-2.5 py-1.5 text-sm font-bold text-white">₳ ADA</span></div><p className="mt-1 text-[11px] text-slate-500">≈ {adaPriceUsd && amountAda > 0 ? formatUsd(amountAda * adaPriceUsd, 2) : '$0.00'}</p></div><div className="mt-2 flex gap-1.5">{QUICK_AMOUNTS.map((value) => <button key={value} type="button" onClick={() => setSellAmount(String(value))} className={`flex-1 rounded-lg border px-2 py-1 text-[11px] font-semibold ${amountAda === value ? 'border-blue-500/50 bg-blue-600/20 text-blue-300' : 'border-white/5 bg-white/[0.02] text-slate-400'}`}>{value} ₳</button>)}</div></div>
        <div className="flex justify-center"><span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10"><ArrowDownUp className="h-3.5 w-3.5 text-slate-400" /></span></div>
        <div><label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">{copy.receive}</label><div className="relative rounded-xl border border-white/10 bg-[#05070d] p-3"><div className="flex items-center justify-between gap-3"><span className={`text-xl font-bold ${quote ? 'text-green-400' : 'text-slate-700'}`}>{quote ? Number(quote.total_output_without_slippage).toLocaleString('en-US', { maximumFractionDigits: 6 }) : quoteState === 'loading' ? '…' : '0.0'}</span><button type="button" onClick={() => setPickerOpen((open) => !open)} className="flex items-center gap-2 rounded-lg bg-blue-600/20 px-2.5 py-1.5 text-sm font-bold text-white">{buyToken && <TokenLogo src={buyToken.image} ticker={buyToken.ticker} size={20} />}{buyToken?.ticker ?? '—'}<ChevronDown className="h-3.5 w-3.5" /></button></div>{buyToken && <p className="mt-1 text-[11px] text-slate-500">1 {buyToken.ticker} = {formatAdaPrice(buyToken.priceAda)} · {formatChange(buyToken.change24h)}</p>}{pickerOpen && <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#0a0f1c] shadow-2xl"><div className="sticky top-0 bg-[#0a0f1c] p-2"><input type="text" autoFocus value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder={language === 'de' ? 'Token suchen…' : 'Search token…'} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none" /></div>{pickerList.map((token) => <button key={token.id} type="button" onClick={() => { onSelectToken(token); setPickerOpen(false); setPickerQuery(''); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5"><TokenLogo src={token.image} ticker={token.ticker} size={24} /><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-white">{token.ticker}</span><span className="block truncate text-[10px] text-slate-500">{token.name}</span></span></button>)}</div>}</div></div>
        {quote && <dl className="space-y-1 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px]"><div className="flex justify-between"><dt className="text-slate-500">{copy.minReceive} ({SLIPPAGE.toFixed(1)}% {language === 'de' ? 'Slippage' : 'slippage'})</dt><dd className="font-semibold text-slate-200">{Number(quote.total_output).toLocaleString('en-US', { maximumFractionDigits: 6 })} {asset?.ticker}</dd></div><div className="flex justify-between"><dt className="text-slate-500">{copy.route}</dt><dd className="max-w-[170px] truncate text-right font-semibold text-blue-300">{route || 'DexHunter Smart Routing'}</dd></div>{typeof quote.partner_fee === 'number' && <div className="flex justify-between"><dt className="text-slate-500">{copy.partnerFee}</dt><dd className="font-semibold text-slate-200">{quote.partner_fee.toLocaleString('en-US', { maximumFractionDigits: 6 })} ₳</dd></div>}</dl>}
        {error && <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">{error}</p>}
        {txHash && <a href={`https://cardanoscan.io/transaction/${txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-300"><CheckCircle2 className="h-4 w-4" />{language === 'de' ? 'Swap gesendet – auf Cardanoscan ansehen' : 'Swap submitted – view on Cardanoscan'}</a>}
        <button type="button" onClick={wallet.address ? executeSwap : () => setWalletModalOpen(true)} disabled={!quote || busy || tradeState === 'complete'} className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold ${quote && !busy && tradeState !== 'complete' ? 'bg-gradient-to-r from-blue-600 to-cyan-400 text-white' : 'cursor-not-allowed bg-white/5 text-slate-600'}`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : wallet.address ? <Zap className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}{tradeState === 'complete' ? copy.complete : buttonText}</button>
        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-600"><Info className="mt-0.5 h-3 w-3 shrink-0" />{copy.disclaimer}</p>
      </div>
      {walletModalOpen && <WalletConnectModal onClose={() => setWalletModalOpen(false)} />}
    </aside>
  );
}
