'use client';

import { useEffect, useRef, useState } from 'react';
import { AreaSeries, ColorType, createChart, type UTCTimestamp } from 'lightweight-charts';
import { ChartNoAxesCombined, Loader2 } from 'lucide-react';
import { API_URL } from '../lib/api';
import { formatTokenPrice } from '../lib/tokens';
import { useCurrency } from '../components/CurrencyProvider';
import { useLanguage } from '../components/LanguageProvider';
import styles from './explorer.module.css';

const RANGES = ['4h', '1D', '1W', '1Y'] as const;
type ChartRange = typeof RANGES[number];
interface PricePoint { time: UTCTimestamp; value: number }

export default function ExplorerPriceChart({ marketId, ticker, adaPriceUsd }: { marketId: string; ticker: string; adaPriceUsd: number | null }) {
  const { currency } = useCurrency();
  const { language } = useLanguage();
  const de = language === 'de';
  const [range, setRange] = useState<ChartRange>('1W');
  const [feed, setFeed] = useState<{ key: string; points: PricePoint[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const key = `${marketId}:${range}`;
  const points = feed?.key === key ? feed.points : null;

  useEffect(() => {
    let active = true;
    let running = false;
    const load = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch(`${API_URL}/api/market/chart/${encodeURIComponent(marketId)}?range=${range}`, { cache: 'no-store' });
        const json = await response.json();
        if (!response.ok || !json.success || !Array.isArray(json.data?.candles)) throw new Error('Chart unavailable.');
        const valid = json.data.candles.flatMap((entry: unknown) => {
          if (!entry || typeof entry !== 'object') return [];
          const candle = entry as Record<string, unknown>;
          const timestamp = Number(candle.time);
          const value = Number(candle.close);
          if (!Number.isFinite(timestamp) || !Number.isFinite(value) || timestamp <= 0 || value <= 0) return [];
          return [{ time: Math.floor(timestamp > 1_000_000_000_000 ? timestamp / 1000 : timestamp) as UTCTimestamp, value }];
        }) as PricePoint[];
        const unique = [...new Map(valid.map((point) => [point.time, point])).values()].sort((left, right) => left.time - right.time);
        if (active) { setFeed({ key, points: unique }); setFailed(null); }
      } catch { if (active) setFailed(key); }
      finally { running = false; }
    };
    void load();
    const interval = window.setInterval(load, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [marketId, range, key]);

  useEffect(() => {
    if (!container.current || !points?.length || (currency === 'USD' && !(adaPriceUsd && adaPriceUsd > 0))) return;
    const multiplier = currency === 'USD' ? adaPriceUsd! : 1;
    const up = points[points.length - 1]!.value >= points[0]!.value;
    const chart = createChart(container.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#7895ad', fontSize: 10, fontFamily: 'Geist, sans-serif' },
      grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(119,169,192,0.08)' } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.15, bottom: 0.12 } },
      timeScale: { borderVisible: false, timeVisible: range === '4h' || range === '1D', secondsVisible: false, rightOffset: 2 },
      localization: { locale: de ? 'de-DE' : 'en-US' },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: up ? '#38e5b6' : '#fa7f98', topColor: up ? 'rgba(56,229,182,0.25)' : 'rgba(250,127,152,0.22)', bottomColor: 'transparent',
      lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
      priceFormat: { type: 'custom', minMove: 0.000000000001, formatter: (value: number) => formatTokenPrice(currency === 'ADA' ? value : value / multiplier, currency === 'USD' ? value : value * (adaPriceUsd ?? 0), currency) },
    });
    series.setData(points.map((point) => ({ time: point.time, value: point.value * multiplier })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [points, currency, adaPriceUsd, range, de]);

  const unavailable = currency === 'USD' && !(adaPriceUsd && adaPriceUsd > 0);
  return <section className={styles.priceChart} aria-label={`${ticker} ${de ? 'Preisverlauf' : 'price history'}`}>
    <header className={styles.chartHeader}><h2><ChartNoAxesCombined size={14} />{de ? 'Preisverlauf' : 'Price history'}</h2><div role="group" aria-label={de ? 'Chart-Zeitraum' : 'Chart range'}>{RANGES.map((value) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)}>{value === '1W' ? (de ? '7T' : '7D') : value === '1Y' ? (de ? '1J' : '1Y') : value === '1D' ? '24H' : '4H'}</button>)}</div></header>
    <div className={styles.chartPlot}>
      {unavailable ? <p className={styles.chartMessage}>{de ? 'USD-Umrechnung nicht verfügbar.' : 'USD conversion unavailable.'}</p>
        : !points ? <p className={styles.chartMessage}>{failed === key ? (de ? 'Chartdaten nicht verfügbar.' : 'Chart data unavailable.') : <><Loader2 size={15} className="animate-spin" />{de ? 'Chart wird geladen' : 'Loading chart'}</>}</p>
          : points.length === 0 ? <p className={styles.chartMessage}>{de ? 'Noch keine lokale Preishistorie.' : 'No local price history yet.'}</p>
            : <div ref={container} className={styles.chartCanvas} />}
    </div>
    <footer><span className={styles.liveDot} />CARDYX · {de ? 'Lokaler Preisindex' : 'Local price index'}{failed === key && points && <span>{de ? 'Letzter Datenstand' : 'Last available data'}</span>}</footer>
  </section>;
}