'use client';

import { useEffect, useState } from 'react';
import { Activity, Gauge } from 'lucide-react';
import type { MarketToken } from '../lib/tokens';
import { API_URL } from '../lib/api';
import styles from '../trade/terminal.module.css';

interface SentimentRow {
  label: string;
  value?: string;
  color?: string;
}

interface SocialSnapshot {
  sentiment: number;
  posts24h: number;
  interactions24h: number;
  trend: 'up' | 'down' | 'flat';
  updatedAt: number;
  sources: string[];
}

const SENTIMENT_BANDS = [
  { start: 0, color: '#ef4444' },
  { start: 20, color: '#f97316' },
  { start: 40, color: '#facc15' },
  { start: 59, color: '#86efac' },
  { start: 79, color: '#166534' },
];

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clampScore(value: number) {
  return Math.min(100, Math.max(0, value));
}

function computeSentiment(tokens: MarketToken[], social: SocialSnapshot | null) {
  const active = tokens.filter((token) => token.ticker !== 'ADA'
    && token.category !== 'stablecoin'
    && token.priceAda > 0
    && (token.liquidityAda ?? 0) > 0
    && Number.isFinite(token.change24h)
    && token.change24h !== 0);
  if (active.length < 5) return null;

  const changes = active.map((token) => token.change24h);
  const breadth = (changes.filter((change) => change > 0).length / changes.length) * 100;
  const momentum = Math.min(100, Math.max(0, 50 + median(changes) * 5));
  const weekly = active.map((token) => token.change7d).filter(Number.isFinite);
  const marketScore = breadth * 0.5 + momentum * 0.5;
  const socialTrendScore = social?.trend === 'up' ? 75 : social?.trend === 'down' ? 25 : 50;
  const socialScore = social ? social.sentiment * 0.8 + socialTrendScore * 0.2 : null;
  return {
    score: Math.round(socialScore === null ? marketScore : marketScore * 0.8 + socialScore * 0.2),
    breadth,
    dailyChange: median(changes),
    volatility: median(changes.map(Math.abs)),
    trend: weekly.length ? median(weekly) : 0,
    social,
  };
}

function computeTokenSentiment(token: MarketToken, social: SocialSnapshot | null) {
  const dailyChange = Number.isFinite(token.change24h) ? token.change24h : 0;
  const weeklyChange = Number.isFinite(token.change7d) ? token.change7d : 0;
  const rangeChange = token.priceUsd > 0
    ? ((token.high24hUsd - token.low24hUsd) / token.priceUsd) * 100
    : Math.abs(dailyChange);
  const directionScore = clampScore(50 + dailyChange * 4);
  const weeklyTrendScore = clampScore(50 + weeklyChange * 1.5);
  const tokenMarketScore = directionScore * 0.65 + weeklyTrendScore * 0.35;
  const activityTrendScore = social?.trend === 'up' ? 75 : social?.trend === 'down' ? 25 : 50;
  const socialScore = social ? social.sentiment * 0.8 + activityTrendScore * 0.2 : null;

  return {
    score: Math.round(socialScore === null ? tokenMarketScore : tokenMarketScore * 0.8 + socialScore * 0.2),
    breadth: dailyChange > 0 ? 100 : 0,
    volatility: Math.max(Math.abs(dailyChange), Number.isFinite(rangeChange) ? rangeChange : 0),
    trend: weeklyChange,
    dailyChange,
    weeklyChange,
    social,
  };
}

export default function MarketSentimentIndex({ tokens, language, variant, selectedToken }: {
  tokens: MarketToken[];
  language: 'de' | 'en';
  variant: 'market' | 'token';
  selectedToken?: MarketToken | null;
}) {
  const de = language === 'de';
  const selectedTokenId = selectedToken?.id;
  const socialKey = variant === 'market' ? 'market' : selectedTokenId ?? 'none';
  const [socialState, setSocialState] = useState<{ key: string; snapshot: SocialSnapshot | null; loaded: boolean } | null>(null);

  useEffect(() => {
    if (variant === 'token' && !selectedTokenId) return;
    let active = true;
    const refreshSocial = () => {
      const endpoint = variant === 'market'
        ? `${API_URL}/api/market/social-sentiment`
        : `${API_URL}/api/market/token-sentiment/${encodeURIComponent(selectedTokenId!)}`;
      fetch(endpoint)
        .then((response) => response.json())
        .then((json) => {
          if (active) setSocialState({ key: socialKey, snapshot: json.success ? json.data ?? null : null, loaded: true });
        })
        .catch(() => {
          if (active) setSocialState({ key: socialKey, snapshot: null, loaded: true });
        });
    };
    refreshSocial();
    const interval = setInterval(refreshSocial, variant === 'token' ? 15_000 : 60_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [variant, selectedTokenId, socialKey]);

  const snapshot = socialState?.key === socialKey ? socialState.snapshot : null;
  const social = variant === 'token' && !snapshot?.posts24h ? null : snapshot;
  const socialLoaded = socialState?.key === socialKey && socialState.loaded;
  const data = variant === 'market'
    ? computeSentiment(tokens, social)
    : selectedToken ? computeTokenSentiment(selectedToken, social) : null;
  const score = data?.score ?? 0;
  const zone = !data ? null
    : score <= 20 ? { label: de ? 'Extreme Angst' : 'Extreme Fear', mood: de ? 'Sehr negativ' : 'Very negative', color: 'text-red-400', arcColor: '#ef4444', hint: de ? 'Panik schafft oft die besten Einstiege.' : 'Panic often creates the best entries.' }
      : score <= 40 ? { label: de ? 'Angst' : 'Fear', mood: de ? 'Negativ' : 'Negative', color: 'text-orange-400', arcColor: '#f97316', hint: de ? 'Vorsicht dominiert den Markt.' : 'Caution dominates the market.' }
        : score <= 59 ? { label: 'Neutral', mood: 'Neutral', color: 'text-yellow-300', arcColor: '#facc15', hint: de ? 'Der Markt wartet auf eine Richtung.' : 'The market is waiting for direction.' }
          : score <= 79 ? { label: 'Greed', mood: de ? 'Positiv' : 'Positive', color: 'text-green-300', arcColor: '#86efac', hint: de ? 'Gier baut oft den nächsten Pump auf.' : 'Greed often builds the next pump.' }
            : { label: 'Extreme Greed', mood: de ? 'Euphorisch' : 'Euphoric', color: 'text-green-800', arcColor: '#166534', hint: de ? 'Euphorie – Gewinne absichern.' : 'Euphoria – consider taking profits.' };
  const angle = Math.PI * (1 - score / 100);
  const title = variant === 'market' ? 'Fear & Greed Index' : 'CARDYX Token Sentiment Index';
  const labels = variant === 'market'
    ? de ? ['Volatilität', 'Social Buzz', 'Marktbreite', 'Trend'] : ['Volatility', 'Social Buzz', 'Breadth', 'Trend']
    : de ? ['Volatilität', 'Social Buzz', '24h Änderung', '7T Trend'] : ['Volatility', 'Social Buzz', '24h change', '7D trend'];
  const socialValue = data?.social
    ? `${Math.round(data.social.sentiment)}% · ${Intl.NumberFormat(de ? 'de-DE' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(data.social.posts24h)}`
    : socialLoaded ? (de ? 'Wird aufgebaut' : 'Building baseline')
      : (de ? 'Lädt…' : 'Loading…');
  const rows: SentimentRow[] = data && zone ? [
    { label: labels[0], value: `${data.volatility.toFixed(1).replace('.', de ? ',' : '.')}%`, color: 'text-cyan-300' },
    { label: labels[1], value: socialValue, color: data.social ? zone.color : 'text-slate-500' },
    { label: labels[2], value: variant === 'market'
      ? `${Math.round(data.breadth)}% ${de ? 'im Plus' : 'up'}`
      : `${data.dailyChange >= 0 ? '+' : ''}${data.dailyChange.toFixed(2).replace('.', de ? ',' : '.')}%`,
    color: variant === 'market' ? data.breadth >= 50 ? 'text-emerald-400' : 'text-rose-400' : data.dailyChange >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: labels[3], value: data.trend > 1 ? (de ? 'Aufwärts' : 'Upward') : data.trend < -1 ? (de ? 'Abwärts' : 'Downward') : (de ? 'Seitwärts' : 'Sideways'), color: data.trend > 1 ? 'text-emerald-400' : data.trend < -1 ? 'text-rose-400' : 'text-amber-300' },
  ] : [];
  const displayRows: SentimentRow[] = rows.length ? rows : labels.map((label): SentimentRow => ({ label }));
  const tokenHint = selectedToken && data
    ? score <= 20 ? (de ? `${selectedToken.ticker}: stark negatives Token-Signal.` : `${selectedToken.ticker}: strongly negative token signal.`)
      : score <= 40 ? (de ? `${selectedToken.ticker}: negatives Token-Signal.` : `${selectedToken.ticker}: negative token signal.`)
        : score <= 59 ? (de ? `${selectedToken.ticker}: neutrales Token-Signal.` : `${selectedToken.ticker}: neutral token signal.`)
          : score <= 79 ? (de ? `${selectedToken.ticker}: positives Token-Signal.` : `${selectedToken.ticker}: positive token signal.`)
            : (de ? `${selectedToken.ticker}: stark positives Token-Signal.` : `${selectedToken.ticker}: strongly positive token signal.`)
    : (de ? 'Zu wenig lokale Tokendaten.' : 'Not enough local token data.');
  const hint = variant === 'token' ? tokenHint : zone?.hint ?? (de ? 'Zu wenig lokale Marktdaten.' : 'Not enough local market data.');
  const attribution = data?.social
    ? `${data.social.sources.join(' · ')} · ${variant === 'market' ? (de ? 'CARDYX Schätzung' : 'CARDYX estimate') : (de ? `${selectedToken?.ticker} Social-Schätzung` : `${selectedToken?.ticker} social estimate`)}`
    : variant === 'token'
      ? (de ? 'Kursbasierte Schätzung · Social-Daten ausstehend' : 'Price-based estimate · Social data pending')
      : 'CARDYX Intelligence';

  return <section className={variant === 'market' ? `${styles.fearMarketPanel} ${styles.fearMarketCompact}` : styles.fearPanel} aria-label={title}>
    <h2 className="flex shrink-0 items-center gap-2 text-[12px] font-bold text-white"><span className={styles.fearIcon}><Gauge className="h-3 w-3 text-white" /></span>{title}</h2>
    <div className="flex min-h-0 flex-1 items-center gap-3">
      <div className={variant === 'market' ? styles.fearMarketGauge : 'relative w-[92px] shrink-0'}>
        <svg viewBox="0 0 100 58" className="w-full overflow-visible" role="img" aria-label={data && zone ? `${score} ${zone.label}` : (de ? 'Kein Index' : 'No index')}>
          {SENTIMENT_BANDS.map((band, index) => {
            const nextBand = SENTIMENT_BANDS[index + 1];
            const end = nextBand?.start ?? 100;
            return <path key={band.start} d="M 8 50 A 42 42 0 0 1 92 50" fill="none" stroke={band.color} strokeWidth="8" strokeLinecap="butt" pathLength={100} strokeDasharray={`${end - band.start} 100`} strokeDashoffset={-band.start} />;
          })}
          {data && <circle cx={50 + 42 * Math.cos(angle)} cy={50 - 42 * Math.sin(angle)} r="4.5" fill="#fff" stroke={zone?.arcColor ?? '#fff'} strokeWidth="2" />}
        </svg>
        <div className="absolute inset-x-0 top-[18px] text-center"><p className="text-[22px] font-bold leading-none text-white">{data ? score : '—'}</p><p className={`mt-0.5 text-[10px] font-bold ${zone?.color ?? 'text-slate-500'}`}>{zone?.label ?? (de ? 'Kein Index' : 'No index')}</p></div>
        <div className="flex justify-between px-0.5 text-[8px] text-slate-500"><span>0</span><span>100</span></div>
      </div>
      <dl className={`min-w-0 flex-1 space-y-1 border-l border-violet-300/20 pl-3 ${variant === 'market' ? 'market-sentiment-rows' : ''}`}>
        {displayRows.map((row) => <div key={row.label} className="flex items-center justify-between gap-2 text-[10px]"><dt className="truncate text-slate-300">{row.label}</dt><dd className={`shrink-0 font-semibold ${row.color ?? 'text-slate-500'}`}>{row.value ?? '—'}</dd></div>)}
      </dl>
    </div>
    <div className={styles.fearHint}><Activity className="h-3.5 w-3.5 shrink-0 text-cyan-300" /><p className="min-w-0 break-words leading-snug"><span className="block text-slate-200">{hint}</span><span className="block text-[10px] text-violet-300">{attribution}</span></p></div>
  </section>;
}
