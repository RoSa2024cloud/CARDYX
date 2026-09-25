// Zentrale Typen & Formatierungs-Helpers für das CARDYX Dashboard.
//
// Die Token-Tabelle wird vollständig von der Backend-Route
// /api/market/top50 gespeist (Top 50 Cardano-Ökosystem-Token mit
// Live-Preisen, Market Cap, Volumen, 24h/7d-Änderungen und Logos
// via CoinGecko, serverseitig 60s gecached und in ADA umgerechnet).

export interface MarketToken {
  id: string;
  ticker: string;
  name: string;
  image: string | null;
  policyId: string | null;
  priceUsd: number;
  priceAda: number;
  change24h: number;
  change7d: number;
  volume24hUsd: number;
  marketCapUsd: number;
  fdvUsd: number;
  volume24hAda: number;
  marketCapAda: number;
  fdvAda: number;
  marketCapRank: number | null;
  circulatingSupply: number;
  totalSupply: number | null;
  maxSupply: number | null;
  athUsd: number;
  athChangePct: number;
  athDate: string | null;
  atlUsd: number;
  atlChangePct: number;
  atlDate: string | null;
  high24hUsd: number;
  low24hUsd: number;
  sparkline7d: number[];
  category?: string;
  catalogVerified?: boolean;
  assetName?: string | null;
  holderCount?: number;
  utxoCount?: number;
  circulatingQuantity?: number;
  latestActivity?: string | null;
  snapshotRefreshedAt?: string | null;
}

export interface ChartCandle {
  time: number; // Unix-ms
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MarketResponse {
  success: boolean;
  data?: {
    adaPriceUsd: number;
    total: number;
    updatedAt: string;
    tokens: MarketToken[];
  };
}

/** HSL-Farbton aus dem Ticker ableiten – stabil & dezent für Fallback-Icons. */
export function tickerHue(ticker: string): number {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash * 31 + ticker.charCodeAt(i)) % 360;
  }
  return hash;
}

// ---------------------------------------------------------------------------
// Formatierungs-Helper
// ---------------------------------------------------------------------------

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('en-US');

/** Preis in ADA mit ausreichend Nachkommastellen, z.B. ₳0.103336 */
export function formatAdaPrice(value: number): string {
  if (!value) return '—';
  return `₳${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
}

/** Kompakte ADA-Menge, z.B. ₳1.45B / ₳683.5K – oder "—" bei 0 */
export function formatCompactAda(value: number): string {
  if (!value) return '—';
  return `₳${compact.format(value)}`;
}

/** Ganzzahl mit Tausendertrennzeichen, z.B. 69,445 */
export function formatHolders(value: number): string {
  return integer.format(value);
}

/** Vorzeichen-Änderung in %, z.B. +3.32% / -1.72% */
export function formatChange(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/** USD-Betrag, z.B. $0.2217 */
export function formatUsd(value: number, digits = 4): string {
  if (!value) return '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** Kompakte USD-Menge, z.B. $8.19B */
export function formatCompactUsd(value: number): string {
  if (!value) return '—';
  return `$${compact.format(value)}`;
}

/** Kompakte Stückzahl, z.B. 36.73B */
export function formatCompactNumber(value: number): string {
  if (!value) return '—';
  return compact.format(value);
}

/** Datum im deutschen Format, z.B. 2. Sept. 2021 */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
