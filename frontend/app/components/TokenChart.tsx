'use client';

import { useEffect, useRef, useState } from 'react';
import { ChartCandle, formatUsd } from '../lib/tokens';

type Range = '7' | '30';

interface TokenChartProps {
  tokenId: string;
  ticker: string;
}

const W = 720;
const H = 240;
const PAD = { top: 16, right: 12, bottom: 24, left: 12 };

/**
 * Live-Chart eines Tokens: OHLC-Kerzen von der Backend-Route
 * /api/market/chart/:id als SVG-Preisverlauf mit Hover-Crosshair.
 */
export default function TokenChart({ tokenId, ticker }: TokenChartProps) {
  const [range, setRange] = useState<Range>('7');
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(false);
      }
      fetch(`http://localhost:4000/api/market/chart/${encodeURIComponent(tokenId)}?days=${range}`)
        .then((res) => {
          if (!res.ok) throw new Error('Fehler');
          return res.json();
        })
        .then((json) => {
          if (cancelled) return;
          setCandles(json?.data?.candles ?? []);
          setLoading(false);
          setError(false);
        })
        .catch(() => {
          if (cancelled) return;
          // Bei Rate-Limit: bisherige Kerzen behalten, Fehler nur beim Erstladen zeigen
          setLoading(false);
          setError((prev) => (candles.length === 0 ? true : prev));
        });
    };

    load();
    // Chart-Daten im geöffneten Fenster alle 60s leise aktualisieren
    const interval = setInterval(() => load(true), 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenId, range]);

  const closes = candles.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;

  const x = (i: number) => PAD.left + (i / Math.max(candles.length - 1, 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom);

  const up = closes.length > 1 && closes[closes.length - 1] >= closes[0];
  const lineColor = up ? '#4ade80' : '#f87171';
  const areaId = `chart-gradient-${ticker}`;

  const linePath = closes.length
    ? closes.map((c, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(c).toFixed(2)}`).join(' ')
    : '';
  const areaPath = linePath
    ? `${linePath} L${x(closes.length - 1).toFixed(2)},${H - PAD.bottom} L${PAD.left},${H - PAD.bottom} Z`
    : '';

  const handleMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg || candles.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((relX - PAD.left) / (W - PAD.left - PAD.right)) * (candles.length - 1));
    setHover(Math.max(0, Math.min(candles.length - 1, i)));
  };

  const hovered = hover !== null ? candles[hover] : null;

  return (
    <div>
      {/* Kopfzeile: aktueller/Hover-Wert + Zeitraum-Umschalter */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xl font-bold text-white">
            {hovered ? formatUsd(hovered.close) : closes.length ? formatUsd(closes[closes.length - 1]) : '—'}
          </p>
          <p className="text-[11px] text-slate-500">
            {hovered
              ? new Date(hovered.time).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : `${range} Tage · ${candles.length} Datenpunkte`}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
          {(['7', '30'] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                range === r ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {r}T
            </button>
          ))}
        </div>
      </div>

      {/* Chart-Fläche */}
      <div className="relative rounded-xl border border-white/5 bg-[#070a12] p-1">
        {loading && (
          <div className="flex h-[240px] items-center justify-center text-sm text-slate-500 animate-pulse">
            Chart wird geladen…
          </div>
        )}
        {error && !loading && (
          <div className="flex h-[240px] items-center justify-center text-sm text-red-400">
            Chartdaten aktuell nicht verfügbar.
          </div>
        )}
        {!loading && !error && candles.length > 0 && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="h-[240px] w-full cursor-crosshair"
            onMouseMove={handleMove}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* horizontale Hilfslinien */}
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={PAD.left}
                x2={W - PAD.right}
                y1={PAD.top + f * (H - PAD.top - PAD.bottom)}
                y2={PAD.top + f * (H - PAD.top - PAD.bottom)}
                stroke="rgba(255,255,255,0.04)"
                strokeDasharray="4 4"
              />
            ))}

            <path d={areaPath} fill={`url(#${areaId})`} />
            <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" />

            {/* Crosshair */}
            {hovered && hover !== null && (
              <>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={PAD.top}
                  y2={H - PAD.bottom}
                  stroke="rgba(255,255,255,0.25)"
                  strokeDasharray="3 3"
                />
                <circle cx={x(hover)} cy={y(hovered.close)} r="4" fill={lineColor} stroke="#05070d" strokeWidth="2" />
              </>
            )}

            {/* Min/Max-Beschriftung */}
            <text x={PAD.left} y={PAD.top - 5} className="fill-slate-500" fontSize="10">
              Hoch {formatUsd(max)}
            </text>
            <text x={PAD.left} y={H - 6} className="fill-slate-500" fontSize="10">
              Tief {formatUsd(min)}
            </text>
          </svg>
        )}
      </div>
    </div>
  );
}
