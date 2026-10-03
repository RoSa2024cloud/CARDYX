'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, CheckCircle2, ChevronDown, Info, Loader2, Wallet, X, Zap } from 'lucide-react';
import TokenLogo from './TokenLogo';
import WalletConnectModal from './WalletConnectModal';
import { useWallet } from './WalletProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { API_URL } from '../lib/api';
import { DisplayCurrency, MarketToken, formatChange, formatPriceValue, formatTokenPrice, formatUsd } from '../lib/tokens';

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

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

async function readApiEnvelope<T>(response: Response): Promise<{ payload: ApiEnvelope<T> | null; malformed: boolean }> {
  const body = await response.text();
  if (!body.trim()) return { payload: null, malformed: false };
  try {
    return { payload: JSON.parse(body) as ApiEnvelope<T>, malformed: false };
  } catch {
    return { payload: null, malformed: true };
  }
}

const QUICK_PERCENTAGES = [25, 50, 75] as const;
const LIMIT_DISCOUNTS = [5, 10, 25, 50] as const;
const SLIPPAGE = 0.5;
const DEX_ROUTE_FALLBACKS = [['CSWAP'], ['WINGRIDERV2'], ['MINSWAPV2'], ['SPLASH']] as const;

function normalizeLimitPriceInput(value: string): string {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  const separator = normalized.indexOf('.');
  if (separator < 0) return normalized;
  const whole = normalized.slice(0, separator);
  const fraction = normalized.slice(separator + 1).replace(/\./g, '').slice(0, 14);
  return `${whole}.${fraction}`;
}

export default function TradePanel({ tokens, adaPriceUsd, selectedToken, onSelectToken, onClose }: TradePanelProps) {
  const wallet = useWallet();
  const { language } = useLanguage();
  const { currency } = useCurrency();
  const [sellAmount, setSellAmount] = useState('100');
  const [mode, setMode] = useState<'trade' | 'limit' | 'dca'>('trade');
  const [targetPrice, setTargetPrice] = useState('');
  const [targetPriceCurrency, setTargetPriceCurrency] = useState<DisplayCurrency>('ADA');
  const [dcaInterval, setDcaInterval] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [dcaIntervalLength, setDcaIntervalLength] = useState('1');
  const [dcaCycles, setDcaCycles] = useState('10');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [asset, setAsset] = useState<DexHunterToken | null>(null);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [canRetryQuote, setCanRetryQuote] = useState(false);
  const [quoteRetryKey, setQuoteRetryKey] = useState(0);
  const [quoteBlacklist, setQuoteBlacklist] = useState<string[]>([]);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [tradeState, setTradeState] = useState<'idle' | 'building' | 'signing' | 'submitting' | 'complete'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const copy = language === 'de'
    ? { pay: 'Du zahlst', receive: 'Du erhältst', minReceive: 'Min. Erhalt', route: 'Route', partnerFee: 'Partner-Fee', liveQuote: 'Live Quote', connect: 'Wallet verbinden, um zu handeln', confirm: 'Swap in Wallet bestätigen', building: 'Transaktion wird erstellt…', signing: 'In Wallet bestätigen…', submitting: 'Transaktion wird gesendet…', complete: 'Transaktion gesendet', close: 'Trade Terminal schließen', disclaimer: 'Live-Quote und Routing über DexHunter. CARDYX verwahrt keine Assets; jede Transaktion wird in deiner Wallet bestätigt.', trade: 'Handel', limit: 'Limit', dca: 'DCA', target: 'Zielpreis', current: 'Aktueller Preis', placeLimit: 'Limitorder platzieren', createDca: 'DCA starten', budget: 'Gesamtbudget', interval: 'Intervall', intervalLength: 'Alle', cycles: 'Ausführungen', hourly: 'Stündlich', daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich', perCycle: 'ADA je Ausführung', orders: 'Order wird erstellt…', belowMarket: 'unter Markt' }
    : { pay: 'You pay', receive: 'You receive', minReceive: 'Min. received', route: 'Route', partnerFee: 'Partner fee', liveQuote: 'Live quote', connect: 'Connect wallet to trade', confirm: 'Confirm swap in wallet', building: 'Building transaction…', signing: 'Confirm in wallet…', submitting: 'Submitting transaction…', complete: 'Transaction submitted', close: 'Close trade terminal', disclaimer: 'Live quote and routing via DexHunter. CARDYX never holds assets; every transaction is confirmed in your wallet.', trade: 'Trade', limit: 'Limit', dca: 'DCA', target: 'Target price', current: 'Current price', placeLimit: 'Place limit order', createDca: 'Start DCA', budget: 'Total budget', interval: 'Interval', intervalLength: 'Every', cycles: 'Cycles', hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', perCycle: 'ADA per cycle', orders: 'Creating order…', belowMarket: 'below market' };

  const buyToken = useMemo(() => {
    if (selectedToken && selectedToken.ticker !== 'ADA') return selectedToken;
    return tokens.find((token) => token.ticker !== 'ADA') ?? null;
  }, [selectedToken, tokens]);
  const expectedAssetId = buyToken?.policyId && buyToken.assetName != null
    ? `${buyToken.policyId}${buyToken.assetName}`.toLowerCase() : null;
  const amountAda = Number(sellAmount.replace(',', '.')) || 0;
  const spendableAda = Math.max(0, (wallet.balanceAda ?? 0) - 2);
  const currentPriceAda = buyToken?.priceAda ?? 0;
  const currentPriceDisplay = currency === 'USD' ? buyToken?.priceUsd ?? 0 : currentPriceAda;
  const preciseCurrentPrice = currentPriceDisplay > 0 ? formatPriceValue(currentPriceDisplay) : '';
  const targetPriceNumber = Number(targetPrice.replace(',', '.')) || 0;
  const targetPriceAda = targetPriceCurrency === 'USD'
    ? adaPriceUsd ? targetPriceNumber / adaPriceUsd : 0
    : targetPriceNumber;
  const targetPriceDisplay = targetPriceCurrency === currency || !adaPriceUsd
    ? targetPrice
    : formatPriceValue(targetPriceCurrency === 'ADA' ? targetPriceNumber * adaPriceUsd : targetPriceNumber / adaPriceUsd);

  const pickerList = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase();
    const available = tokens.filter((token) => token.ticker !== 'ADA');
    return query ? available.filter((token) => token.ticker.toLowerCase().includes(query) || token.name.toLowerCase().includes(query)) : available;
  }, [tokens, pickerQuery]);

  // DexHunter liefert die vollständige, handelbare Asset-ID und die echte Quote.
  useEffect(() => {
    if (!buyToken?.ticker || !expectedAssetId || amountAda <= 0 || (mode === 'limit' && targetPriceAda <= 0)) {
      const resetTimer = window.setTimeout(() => {
        setAsset(null);
        setQuote(null);
        setQuoteState('idle');
        setCanRetryQuote(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setQuoteState('loading');
      setError(null);
      setCanRetryQuote(false);
      setQuote(null);
      setAsset(null);
      setQuoteBlacklist([]);
      setTxHash(null);
      let retryableQuoteFailure = false;
      try {
        const searchResponse = await fetch(`${API_URL}/api/trade/tokens?query=${encodeURIComponent(buyToken.ticker)}`);
        const searchResult = await readApiEnvelope<DexHunterToken[]>(searchResponse);
        const searchJson = searchResult.payload;
        if (!searchResponse.ok || !searchJson?.success || !Array.isArray(searchJson.data)) {
          throw new Error(searchJson?.error ?? (searchResult.malformed ? `Token-API antwortete mit HTTP ${searchResponse.status} und ungültigem JSON.` : 'Token nicht handelbar.'));
        }
        const resolved = searchJson.data.find((entry: DexHunterToken) => entry.token_id?.toLowerCase() === expectedAssetId);
        if (!resolved?.token_id) throw new Error(`${buyToken.ticker} ist bei DexHunter nicht handelbar.`);
        if (cancelled) return;
        setAsset(resolved);

        const estimateEndpoint = `${API_URL}${mode === 'limit' ? '/api/trade/limit/estimate' : '/api/trade/estimate'}`;
        const requestEstimate = (amount: number, blacklistedDexes: readonly string[]) => fetch(estimateEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token_in: '', token_out: resolved.token_id, amount_in: amount, ...(mode === 'limit' ? { wanted_price: targetPriceAda } : { slippage: SLIPPAGE }), blacklisted_dexes: blacklistedDexes }),
        });
        let estimateResult: Awaited<ReturnType<typeof readApiEnvelope<SwapQuote>>> = { payload: null, malformed: false };
        let estimateStatus = 0;
        let selectedBlacklist: readonly string[] = [];
        let quoteAccepted = false;
        const routeAttempts: readonly (readonly string[])[] = [[], ...(mode === 'trade' ? DEX_ROUTE_FALLBACKS : [])];

        for (const blacklistedDexes of routeAttempts) {
          if (cancelled) return;
          const retryLimit = blacklistedDexes.length === 0 ? 2 : 0;
          for (let retry = 0; retry <= retryLimit; retry += 1) {
            const estimateResponse = await requestEstimate(amountAda, blacklistedDexes);
            estimateStatus = estimateResponse.status;
            estimateResult = await readApiEnvelope<SwapQuote>(estimateResponse);
            const payload = estimateResult.payload;
            if (estimateResponse.ok && payload?.success && payload.data) {
              selectedBlacklist = blacklistedDexes;
              quoteAccepted = true;
              break;
            }
            const routeRejected = (payload?.error ?? '').includes('HTTP 400');
            retryableQuoteFailure = routeRejected || estimateStatus >= 500 || estimateResult.malformed;
            if (!retryableQuoteFailure) break;
            if (!routeRejected && retry < retryLimit) await new Promise((resolve) => window.setTimeout(resolve, 350 * (retry + 1)));
          }
          if (quoteAccepted) break;
        }

        if (!quoteAccepted) {
          const message = estimateResult.payload?.error
            ?? (estimateResult.malformed ? `Trade-API antwortete mit HTTP ${estimateStatus} und ungültigem JSON.` : 'Live-Quote nicht verfügbar.');
          throw new Error(message);
        }
        if (cancelled) return;
        const estimateJson = estimateResult.payload;
        if (!estimateJson?.data) throw new Error('Live-Quote nicht verfügbar.');
        setQuoteBlacklist([...selectedBlacklist]);
        setQuote({
          ...estimateJson.data,
          total_output_without_slippage: estimateJson.data.total_output_without_slippage ?? estimateJson.data.total_output,
        });
        setQuoteState('ready');
      } catch (requestError: unknown) {
        if (cancelled) return;
        setAsset(null);
        setQuote(null);
        setCanRetryQuote(retryableQuoteFailure);
        setError(requestError instanceof Error ? requestError.message : 'Live-Quote nicht verfügbar.');
        setQuoteState('error');
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [buyToken?.ticker, expectedAssetId, amountAda, mode, targetPriceAda, quoteRetryKey]);

  const executeSwap = async () => {
    if (!wallet.address || !wallet.api) return setError(language === 'de' ? 'Bitte zuerst oben rechts eine Wallet verbinden.' : 'Connect a wallet first.');
    if (wallet.networkId !== 1) return setError(language === 'de' ? 'Bitte deine Wallet auf Cardano Mainnet umstellen.' : 'Switch your wallet to Cardano Mainnet.');
    if (!asset || !quote || asset.token_id.toLowerCase() !== expectedAssetId) return setError(language === 'de' ? 'Noch keine gültige Live-Quote vorhanden.' : 'No valid live quote is available yet.');

    const intervalLength = Number(dcaIntervalLength) || 0;
    const cycles = Number(dcaCycles) || 0;
    if (mode === 'limit' && targetPriceAda <= 0) return setError(language === 'de' ? 'Bitte einen gültigen Zielpreis eingeben.' : 'Enter a valid target price.');
    if (mode === 'dca' && (!Number.isInteger(intervalLength) || intervalLength < 1 || intervalLength > 30 || !Number.isInteger(cycles) || cycles < 1 || cycles > 1000)) {
      return setError(language === 'de' ? 'Bitte Intervall und Ausführungszahl prüfen.' : 'Check the interval and cycle count.');
    }

    setError(null);
    setTxHash(null);
    try {
      const buildEndpoint = mode === 'limit' ? '/api/trade/limit/build' : mode === 'dca' ? '/api/trade/dca/create' : '/api/trade/build';
      const payload = mode === 'limit'
        ? { buyer_address: wallet.address, token_in: '', token_out: asset.token_id, amount_in: amountAda, wanted_price: targetPriceAda, multiples: 1, blacklisted_dexes: quoteBlacklist }
        : mode === 'dca'
          ? { user_address: wallet.address, token_in: '', token_out: asset.token_id, amount_in: amountAda, interval: dcaInterval, interval_length: intervalLength, slippage: SLIPPAGE, cycles, dex_allowlist: [] }
          : { buyer_address: wallet.address, token_in: '', token_out: asset.token_id, amount_in: amountAda, slippage: SLIPPAGE, blacklisted_dexes: quoteBlacklist };
      setTradeState('building');
      const buildResponse = await fetch(`${API_URL}${buildEndpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
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
    } catch (tradeError: unknown) {
      setTradeState('idle');
      const details = tradeError && typeof tradeError === 'object' ? tradeError as { info?: unknown; message?: unknown } : null;
      setError(typeof details?.info === 'string' ? details.info : typeof details?.message === 'string' ? details.message : 'Swap wurde nicht ausgeführt.');
    }
  };

  const busy = ['building', 'signing', 'submitting'].includes(tradeState);
  const buttonText = !wallet.address ? copy.connect : mode === 'limit' ? copy.placeLimit : mode === 'dca' ? copy.createDca : tradeState === 'building' ? copy.building : tradeState === 'signing' ? copy.signing : tradeState === 'submitting' ? copy.submitting : copy.confirm;
  const route = quote?.splits?.map((split) => split.dex).filter((dex, index, dexes) => dexes.indexOf(dex) === index).join(' + ');
  const displayedError = error?.includes('HTTP 400')
    ? language === 'de'
      ? 'DexHunter konnte diese Quote gerade nicht berechnen. Bitte versuche es erneut oder passe den Betrag an.'
      : 'DexHunter could not calculate this quote right now. Retry or adjust the amount.'
    : language === 'en' && error
    ? error.includes('Partner-ID')
      ? 'DexHunter partner ID is not configured in the backend.'
      : error.includes('Token nicht handelbar')
        ? 'Token is not tradable through DexHunter.'
        : error.includes('Live-Quote nicht verfügbar')
          ? 'Live quote is currently unavailable.'
          : error
    : error;

  return (
    <aside aria-label="TRADE Terminal" className="cardyx-glass-strong w-full overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-cyan-100/10 bg-gradient-to-r from-blue-600/30 via-cyan-400/10 to-violet-500/20 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Zap className="h-4 w-4 text-cyan-300" />{language === 'de' ? 'Handelsterminal' : 'Trade Terminal'}</h2>
        <div className="flex items-center gap-2"><span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400">{copy.liveQuote}</span>{onClose && <button type="button" onClick={onClose} aria-label={copy.close} className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>}</div>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 rounded-lg border border-white/10 bg-white/[0.02] p-0.5">
          {(['trade', 'limit', 'dca'] as const).map((entry) => (
            <button key={entry} type="button" onClick={() => { setMode(entry); if (entry === 'limit' && !targetPrice && preciseCurrentPrice) { setTargetPrice(preciseCurrentPrice); setTargetPriceCurrency(currency); } setError(null); setTradeState('idle'); setTxHash(null); }} className={`rounded-md px-2 py-1.5 text-xs font-bold ${mode === entry ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {entry === 'trade' ? copy.trade : entry === 'limit' ? copy.limit : copy.dca}
            </button>
          ))}
        </div>
        {mode === 'dca' && <div className="space-y-2 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.03] p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_68px_76px] gap-2">
            <label className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">{copy.interval}</span><select value={dcaInterval} onChange={(event) => setDcaInterval(event.target.value as typeof dcaInterval)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#05070d] px-2 py-2 text-xs font-semibold text-white"><option value="hourly">{copy.hourly}</option><option value="daily">{copy.daily}</option><option value="weekly">{copy.weekly}</option><option value="monthly">{copy.monthly}</option></select></label>
            <label><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">{copy.intervalLength}</span><input type="number" min="1" max="30" value={dcaIntervalLength} onChange={(event) => setDcaIntervalLength(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#05070d] px-2 py-2 text-xs font-semibold text-white" /></label>
            <label><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">{copy.cycles}</span><input type="number" min="1" max="1000" value={dcaCycles} onChange={(event) => setDcaCycles(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#05070d] px-2 py-2 text-xs font-semibold text-white" /></label>
          </div>
          <p className="text-[11px] text-slate-400">{copy.budget}: ₳{amountAda.toLocaleString('en-US', { maximumFractionDigits: 6 })} · {copy.perCycle}: ₳{Number(dcaCycles) > 0 ? (amountAda / Number(dcaCycles)).toLocaleString('en-US', { maximumFractionDigits: 6 }) : '0'}</p>
        </div>}
        <div><label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">{copy.pay}</label><div className="rounded-xl border border-white/10 bg-[#05070d] p-3 focus-within:border-blue-500/50"><div className="flex items-center justify-between gap-3"><input type="text" inputMode="decimal" value={sellAmount} onChange={(event) => setSellAmount(event.target.value.replace(/[^0-9.,]/g, ''))} className="w-full min-w-0 bg-transparent text-xl font-bold text-white focus:outline-none" /><span className="flex h-8 shrink-0 items-center rounded-lg bg-white/5 px-2.5 text-sm font-bold text-white">₳ ADA</span></div><p className="mt-1 text-[11px] text-slate-500">≈ {adaPriceUsd && amountAda > 0 ? formatUsd(amountAda * adaPriceUsd, 2) : '$0.00'}</p></div><div className="mt-2 grid grid-cols-4 gap-1.5">{QUICK_PERCENTAGES.map((value) => <button key={value} type="button" disabled={wallet.balanceAda === null} onClick={() => setSellAmount((spendableAda * value / 100).toFixed(6))} className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1 text-[11px] font-semibold text-slate-400 hover:border-blue-500/30 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40">{value}%</button>)}<button type="button" disabled={wallet.balanceAda === null} onClick={() => setSellAmount(spendableAda.toFixed(6))} className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1 text-[11px] font-semibold text-slate-400 hover:border-blue-500/30 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40">MAX</button></div></div>
        <div className="flex justify-center"><span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10"><ArrowDownUp className="h-3.5 w-3.5 text-slate-400" /></span></div>
        <div><label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">{copy.receive}</label><div className="relative rounded-xl border border-white/10 bg-[#05070d] p-3"><div className="flex items-center justify-between gap-2"><span className={`min-w-0 truncate font-bold ${Number(quote?.total_output_without_slippage ?? 0) >= 1e9 ? 'text-base' : 'text-lg'} ${quote ? 'text-green-400' : 'text-slate-700'}`}>{quote ? Number(quote.total_output_without_slippage).toLocaleString('en-US', { maximumFractionDigits: Number(quote.total_output_without_slippage) >= 1000 ? 0 : 6 }) : quoteState === 'loading' ? '…' : '0.0'}</span><button type="button" onClick={() => setPickerOpen((open) => !open)} className="flex h-8 max-w-[108px] shrink-0 items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-600/20 px-1.5 text-sm font-bold text-white hover:border-cyan-400/60">{buyToken && <TokenLogo src={buyToken.image} ticker={buyToken.ticker} size={18} />}<span className="truncate">{buyToken?.ticker ?? '—'}</span><ChevronDown className="h-3.5 w-3.5 shrink-0" /></button></div>{buyToken && <p className="mt-1 text-[11px] text-slate-500">1 {buyToken.ticker} = {formatTokenPrice(buyToken.priceAda, buyToken.priceUsd, currency)} · {formatChange(buyToken.change24h)}</p>}{pickerOpen && <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#0a0f1c] shadow-2xl"><div className="sticky top-0 bg-[#0a0f1c] p-2"><input type="text" autoFocus value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder={language === 'de' ? 'Token suchen…' : 'Search token…'} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none" /></div>{pickerList.map((token) => <button key={token.id} type="button" onClick={() => { onSelectToken(token); setPickerOpen(false); setPickerQuery(''); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5"><TokenLogo src={token.image} ticker={token.ticker} size={24} /><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-white">{token.ticker}</span><span className="block truncate text-[10px] text-slate-500">{token.name}</span></span></button>)}</div>}</div></div>
        {mode === 'limit' && buyToken && <section aria-label={copy.target} className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <label className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/70">{copy.target}</span><div className="mt-1 flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#05070d] px-2.5 py-2 focus-within:border-amber-300/50"><input type="text" inputMode="decimal" value={targetPriceDisplay} onChange={(event) => { setTargetPrice(normalizeLimitPriceInput(event.target.value)); setTargetPriceCurrency(currency); }} placeholder={preciseCurrentPrice || '0'} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none" /><span className="shrink-0 text-[10px] font-semibold text-slate-500">{currency}/{buyToken.ticker}</span></div></label>
            <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{copy.current}</p><p className="mt-1 whitespace-nowrap text-xs font-semibold text-slate-200">{formatTokenPrice(buyToken.priceAda, buyToken.priceUsd, currency)}</p><button type="button" disabled={!preciseCurrentPrice} onClick={() => { setTargetPrice(preciseCurrentPrice); setTargetPriceCurrency(currency); }} className="mt-1 text-[10px] font-semibold text-cyan-300 hover:text-cyan-200 disabled:opacity-40">{language === 'de' ? 'Aktuellen Preis nutzen' : 'Use current price'}</button></div>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5"><span className="mr-auto text-[10px] text-slate-500">{copy.belowMarket}</span>{LIMIT_DISCOUNTS.map((discount) => <button key={discount} type="button" disabled={!currentPriceDisplay} onClick={() => { setTargetPrice(formatPriceValue(currentPriceDisplay * (1 - discount / 100))); setTargetPriceCurrency(currency); }} className="rounded-md border border-red-400/20 bg-red-500/[0.08] px-2 py-1 text-[10px] font-bold text-red-300 hover:border-red-300/50 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40">−{discount}%</button>)}</div>
        </section>}
        {quote && <dl className="space-y-1 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px]"><div className="flex justify-between"><dt className="text-slate-500">{copy.minReceive} ({SLIPPAGE.toFixed(1)}% {language === 'de' ? 'Slippage' : 'slippage'})</dt><dd className="font-semibold text-slate-200">{Number(quote.total_output).toLocaleString('en-US', { maximumFractionDigits: 6 })} {asset?.ticker}</dd></div><div className="flex justify-between"><dt className="text-slate-500">{copy.route}</dt><dd className="max-w-[170px] truncate text-right font-semibold text-blue-300">{route || 'DexHunter Smart Routing'}</dd></div>{typeof quote.partner_fee === 'number' && <div className="flex justify-between"><dt className="text-slate-500">{copy.partnerFee}</dt><dd className="font-semibold text-slate-200">{quote.partner_fee.toLocaleString('en-US', { maximumFractionDigits: 6 })} ₳</dd></div>}</dl>}
        {displayedError && <div role="alert" className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400"><p>{displayedError}</p>{canRetryQuote && <button type="button" onClick={() => { setError(null); setQuoteRetryKey((key) => key + 1); }} className="mt-2 rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 font-semibold text-cyan-200 hover:bg-cyan-400/20">{language === 'de' ? 'Quote erneut versuchen' : 'Retry quote'}</button>}</div>}
        {txHash && <a href={`https://cardanoscan.io/transaction/${txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-300"><CheckCircle2 className="h-4 w-4" />{language === 'de' ? 'Swap gesendet – auf Cardanoscan ansehen' : 'Swap submitted – view on Cardanoscan'}</a>}
        <button type="button" onClick={wallet.address ? executeSwap : () => setWalletModalOpen(true)} disabled={!quote || quoteState !== 'ready' || asset?.token_id.toLowerCase() !== expectedAssetId || busy || tradeState === 'complete'} className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold ${quote && quoteState === 'ready' && asset?.token_id.toLowerCase() === expectedAssetId && !busy && tradeState !== 'complete' ? 'bg-gradient-to-r from-blue-600 to-cyan-400 text-white' : 'cursor-not-allowed bg-white/5 text-slate-600'}`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : wallet.address ? <Zap className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}{tradeState === 'complete' ? copy.complete : buttonText}</button>
        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-600"><Info className="mt-0.5 h-3 w-3 shrink-0" />{copy.disclaimer}</p>
      </div>
      {walletModalOpen && <WalletConnectModal onClose={() => setWalletModalOpen(false)} />}
    </aside>
  );
}
