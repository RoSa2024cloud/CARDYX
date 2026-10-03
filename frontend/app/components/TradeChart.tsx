'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type UTCTimestamp,
} from 'lightweight-charts';
import { Activity, BarChart3, Loader2 } from 'lucide-react';
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';
import styles from '../trade/terminal.module.css';
import { API_URL } from '../lib/api';
import { formatAdaPrice, formatChange, formatUsdPrice } from '../lib/tokens';

type Range = '15m' | '1h' | '4h' | '1D' | '1W' | '1Y';

const RANGE_OPTIONS: { value: Range; label: string; bucket: string }[] = [
  { value: '15m', label: '15m', bucket: '1 minute' },
  { value: '1h', label: '1h', bucket: '5 minutes' },
  { value: '4h', label: '4h', bucket: '15 minutes' },
  { value: '1D', label: '1D', bucket: '1 hour' },
  { value: '1W', label: '1W', bucket: '1 hour' },
  { value: '1Y', label: '1Y', bucket: '1 day' },
];

interface Candle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradeChartProps {
  marketTokenId: string | null;
  ticker: string;
  adaPriceUsd: number | null;
}

function movingAverage(candles: Candle[], windowSize: number) {
  return candles.flatMap((candle, index) => {
    if (index + 1 < windowSize) return [];
    const values = candles.slice(index + 1 - windowSize, index + 1);
    return [{ time: candle.time, value: values.reduce((sum, item) => sum + item.close, 0) / windowSize }];
  });
}

function calculateRsi(candles: Candle[], period = 14): number | null {
  if (candles.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let index = candles.length - period; index < candles.length; index++) {
    const change = candles[index].close - candles[index - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

function normalizeCandles(value: unknown): Candle[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return [];
    const candle = entry as Record<string, unknown>;
    const timestampValue = candle.time ?? candle.unix ?? candle.timestamp;
    const timestamp = Number(timestampValue instanceof Date ? timestampValue.getTime() / 1000 : typeof timestampValue === 'string' && Number.isNaN(Number(timestampValue)) ? Date.parse(timestampValue) / 1000 : timestampValue);
    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);
    const volume = Number(candle.volume ?? candle.vol ?? 0);
    if (![timestamp, open, high, low, close].every(Number.isFinite) || timestamp <= 0 || Math.max(open, high, low, close) <= 0) return [];
    const seconds = timestamp > 1_000_000_000_000 ? Math.floor(timestamp / 1000) : Math.floor(timestamp);
    return [{ time: seconds as UTCTimestamp, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 }];
  }).sort((left, right) => left.time - right.time);
}

export default function TradeChart({ marketTokenId, ticker, adaPriceUsd }: TradeChartProps) {
  const { language } = useLanguage();
  const { currency } = useCurrency();
  const chartElement = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<Range>('1D');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [sourceLabel, setSourceLabel] = useState('CARDYX local history');
  const [candleCurrency, setCandleCurrency] = useState<'ADA' | 'USD'>('ADA');
  const [showMa20, setShowMa20] = useState(true);
  const [showMa50, setShowMa50] = useState(false);
  const [hoverTime, setHoverTime] = useState<UTCTimestamp | null>(null);

  useEffect(() => {
    if (!marketTokenId) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(false);
      let candles: Candle[] = [];
      const rangeOption = RANGE_OPTIONS.find((option) => option.value === range) ?? RANGE_OPTIONS[3];
      try {
        const response = await fetch(`${API_URL}/api/market/chart/${encodeURIComponent(marketTokenId)}?range=${range}`);
        const json = await response.json();
        if (response.ok && json.success) {
          candles = normalizeCandles(json.data?.candles);
          if (!cancelled && candles.length > 0) {
            setCandles(candles);
            setSourceLabel('CARDYX local price index');
            setCandleCurrency('ADA');
            setLoading(false);
            return;
          }
        }
      } catch {
        // Keep the unavailable state when local history is missing.
      }
      if (!cancelled) {
        setCandles([]);
        setError(true);
        setLoading(false);
      }
    };
    void load();

    return () => { cancelled = true; };
  }, [marketTokenId, range]);

  const rsi = useMemo(() => calculateRsi(candles), [candles]);
  const conversionUnavailable = currency === 'USD' && !(adaPriceUsd && adaPriceUsd > 0);
  const convertedCandles = useMemo(() => {
    if (currency === 'USD' && !(adaPriceUsd && adaPriceUsd > 0)) return [];
    const factor = candleCurrency === 'ADA'
      ? currency === 'USD' ? adaPriceUsd ?? 0 : 1
      : currency === 'ADA' ? adaPriceUsd ? 1 / adaPriceUsd : 0 : 1;
    return candles.map((candle) => ({
      ...candle,
      open: candle.open * factor,
      high: candle.high * factor,
      low: candle.low * factor,
      close: candle.close * factor,
    }));
  }, [candles, currency, adaPriceUsd, candleCurrency]);
  const latest = convertedCandles.at(-1);
  const first = convertedCandles[0];
  const activeCandle = convertedCandles.find((candle) => candle.time === hoverTime) ?? latest;
  const change = first && latest && first.close > 0 ? ((latest.close - first.close) / first.close) * 100 : 0;
  const formatPrice = (value: number) => currency === 'USD' ? formatUsdPrice(value) : formatAdaPrice(value);

  useEffect(() => {
    const element = chartElement.current;
    if (!element || convertedCandles.length === 0) return;
    const precision = Math.min(12, Math.max(4, Math.ceil(-Math.log10(Math.abs(convertedCandles.at(-1)?.close ?? 1))) + 3));

    const chart = createChart(element, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#070a12' },
        textColor: '#718096',
        fontFamily: 'var(--font-geist-mono)',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.06)' },
        horzLines: { color: 'rgba(148,163,184,0.08)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(148,163,184,0.15)' },
      timeScale: { borderColor: 'rgba(148,163,184,0.15)', timeVisible: true, secondsVisible: false },
      localization: { priceFormatter: formatPrice },
    });
    const candlesSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceFormat: { type: 'price', precision, minMove: 10 ** -precision },
      priceLineVisible: true,
    });
    candlesSeries.setData(convertedCandles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));

    if (convertedCandles.some((candle) => candle.volume > 0)) {
      const volumes = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
      });
      volumes.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volumes.setData(convertedCandles.map((candle) => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? 'rgba(34,197,94,0.38)' : 'rgba(239,68,68,0.38)',
      })));
    }

    if (showMa20 && convertedCandles.length >= 20) {
      const ma20 = chart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      ma20.setData(movingAverage(convertedCandles, 20));
    }
    if (showMa50 && convertedCandles.length >= 50) {
      const ma50 = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      ma50.setData(movingAverage(convertedCandles, 50));
    }
    chart.subscribeCrosshairMove((param) => setHoverTime((param.time as UTCTimestamp) ?? null));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [convertedCandles, showMa20, showMa50]);

  return (
    <section className={`min-w-0 min-h-0 overflow-hidden rounded-md border border-white/10 bg-[#070a12] shadow-[0_16px_45px_rgba(0,0,0,0.16)] ${styles.chartRoot}`}>
      <div className={styles.chartBody}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-cyan-400/10 text-cyan-300"><BarChart3 className="h-4 w-4" /></span>
          <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{ticker} / ADA <span className="ml-2 text-[10px] font-normal text-slate-500">{range}</span></p><p className="text-[10px] text-slate-500">{sourceLabel}</p></div>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="sr-only">{language === 'de' ? 'Chart-Zeitraum' : 'Chart range'}</span>
          <select value={range} onChange={(event) => setRange(event.target.value as Range)} className="h-7 rounded border border-white/10 bg-[#0b1020] px-2 text-[11px] font-bold text-slate-200 outline-none focus:border-cyan-400/50">
            {RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/5 px-4 py-2 font-mono text-[10px] text-slate-400">
        <span className="font-semibold text-slate-200">{ticker}/{currency}</span>
        {activeCandle && <><span>O <strong className="text-slate-200">{formatPrice(activeCandle.open)}</strong></span><span>H <strong className="text-slate-200">{formatPrice(activeCandle.high)}</strong></span><span>L <strong className="text-slate-200">{formatPrice(activeCandle.low)}</strong></span><span>C <strong className={activeCandle.close >= activeCandle.open ? 'text-green-400' : 'text-red-400'}>{formatPrice(activeCandle.close)}</strong></span></>}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-2">
        <span className="mr-1 flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500"><Activity className="h-3 w-3" />{language === 'de' ? 'Indikatoren' : 'Indicators'}</span>
        <button type="button" aria-pressed={showMa20} onClick={() => setShowMa20((value) => !value)} className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${showMa20 ? 'border-sky-400/30 bg-sky-400/10 text-sky-200' : 'border-white/10 text-slate-500'}`}>MA20</button>
        <button type="button" aria-pressed={showMa50} onClick={() => setShowMa50((value) => !value)} className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${showMa50 ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-white/10 text-slate-500'}`}>MA50</button>
        <span className="ml-auto text-[10px] text-slate-500">RSI(14) <strong className={`${rsi !== null && rsi >= 70 ? 'text-red-300' : rsi !== null && rsi <= 30 ? 'text-green-300' : 'text-slate-300'}`}>{rsi === null ? '—' : rsi.toFixed(1)}</strong></span>
        {latest && <span className={`text-[10px] font-semibold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPrice(latest.close)} · {formatChange(change)}</span>}
      </div>
      <div className={styles.chartPlot}>
        {loading ? <div className="flex h-full min-h-[240px] items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{language === 'de' ? 'Chart wird geladen…' : 'Loading chart…'}</div>
          : conversionUnavailable ? <div className="flex h-full min-h-[240px] items-center justify-center px-6 text-center text-sm text-slate-500">{language === 'de' ? 'ADA/USD-Umrechnung derzeit nicht verfügbar.' : 'ADA/USD conversion is currently unavailable.'}</div>
          : error ? <div className="flex h-full min-h-[240px] items-center justify-center px-6 text-center text-sm text-slate-500">{language === 'de' ? 'Keine lokale Preishistorie für dieses Intervall verfügbar.' : 'No local price history is available for this range.'}</div>
            : <div ref={chartElement} className="absolute inset-0" />}
      </div>
      <div className="flex items-center justify-end border-t border-white/5 px-4 py-2 text-[10px] text-slate-500">{currency}/{ticker}</div>
      </div>
    </section>
  );
}