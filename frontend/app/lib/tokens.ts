// Zentrale Typen & Formatierungs-Helpers für das CARDYX Dashboard.
//
// Die Token-Tabelle wird vollständig von der Backend-Route
// /api/market/top50 gespeist (Top 50 Cardano-Ökosystem-Token mit
// Live-Preisen, Market Cap, Volumen, 24h/7d-Änderungen und Logos
// via CoinGecko, serverseitig 60s gecached und in ADA umgerechnet).

export interface ActiveMarketPool {
  dex: string;
  version: string;
  poolId: string;
}

export interface MarketToken {
  id: string;
  ticker: string;
  name: string;
  protocol?: string | null;
  description?: string | null;
  activePools?: ActiveMarketPool[];
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
  maxSupplyExact?: string | null;
  maxSupplySource?: 'cardyx-expired-native-policy' | 'minswap-api' | 'market-provider' | null;
  policyMaxSupplyRaw?: string | null;
  currentSupplyRaw?: string | null;
  athUsd: number;
  athChangePct: number;
  athDate: string | null;
  atlUsd: number;
  atlChangePct: number;
  atlDate: string | null;
  high24hUsd: number;
  low24hUsd: number;
  sparkline7d: number[];
  liquidityAda?: number;
  holderChange24h?: number | null;
  holderChange7d?: number | null;
  category?: string;
  catalogVerified?: boolean;
  assetName?: string | null;
  fingerprint?: string | null;
  decimals?: number | null;
  holderCount?: number;
  utxoCount?: number;
  circulatingQuantity?: number;
  circulatingQuantityRaw?: string | null;
  onchainSupply?: number | null;
  onchainSupplyExact?: string | null;
  marketCapBasis?: 'verified-circulating-supply' | 'on-chain-supply-estimate' | null;
  fdvBasis?: 'maximum-supply' | 'provider-total-supply' | 'on-chain-supply' | null;
  supplySource?: 'minswap-api' | 'cardyx-on-chain' | null;
  latestActivity?: string | null;
  snapshotRefreshedAt?: string | null;
  source?: string | null;
  marketDataSource?: string | null;
  pricing?: string | null;
}

export type DisplayCurrency = 'ADA' | 'USD';

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
const MAX_PRICE_DISPLAY_CHARACTERS = 7;
const subscriptDigits = '₀₁₂₃₄₅₆₇₈₉';

function formatSmallPrice(value: number): string | null {
  const absoluteValue = Math.abs(value);
  if (absoluteValue === 0) return null;
  const scientificValue = absoluteValue.toExponential(14);
  const scientificExponent = Number(scientificValue.slice(scientificValue.indexOf('e') + 1));
  const zeroCount = Math.max(0, -scientificExponent - 1);
  if (zeroCount <= 3) return null;

  const sign = value < 0 ? '-' : '';
  const budget = MAX_PRICE_DISPLAY_CHARACTERS - sign.length;
  for (let significantDigits = budget; significantDigits >= 1; significantDigits -= 1) {
    const scientific = absoluteValue.toExponential(significantDigits - 1);
    const exponentIndex = scientific.indexOf('e');
    const exponent = Number(scientific.slice(exponentIndex + 1));
    const roundedZeroCount = Math.max(0, -exponent - 1);
    const zeroCountSubscript = String(roundedZeroCount).replace(/\d/g, (digit) => subscriptDigits[Number(digit)] ?? digit);
    const prefix = `0.0${zeroCountSubscript}`;
    const digits = scientific.slice(0, exponentIndex).replace('.', '');
    const candidate = `${prefix}${digits}`;
    if (candidate.length <= budget) {
      return `${sign}${candidate}`;
    }
  }

  return null;
}

function formatPriceMagnitude(value: number): string {
  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const budget = MAX_PRICE_DISPLAY_CHARACTERS - sign.length;
  const integerDigits = Math.floor(absoluteValue).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 }).length;
  const fractionalDigits = Math.max(0, budget - integerDigits - 1);
  const rounded = absoluteValue.toLocaleString('en-US', {
    useGrouping: false,
    minimumFractionDigits: fractionalDigits,
    maximumFractionDigits: fractionalDigits,
  });
  if (rounded.length <= budget) return `${sign}${rounded}`;

  for (let digits = budget - 1; digits >= 0; digits -= 1) {
    const scientific = absoluteValue.toExponential(digits);
    if (scientific.length <= budget) return `${sign}${scientific}`;
  }
  return `${sign}${absoluteValue.toExponential(0)}`;
}

/** Price formatting keeps small token prices distinguishable without fixed trailing zeros. */
export function formatAdaPrice(value: number): string {
  if (!value) return '—';
  const smallPrice = formatSmallPrice(value);
  if (smallPrice) return `₳${smallPrice}`;
  const sign = value < 0 ? '-' : '';
  return `₳${sign}${formatPriceMagnitude(value)}`;
}

export function formatUsdPrice(value: number): string {
  if (!value) return '—';
  const smallPrice = formatSmallPrice(value);
  if (smallPrice) return `$${smallPrice}`;
  const sign = value < 0 ? '-' : '';
  return `$${sign}${formatPriceMagnitude(value)}`;
}

export function formatPriceValue(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 14 });
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

export function formatTokenPrice(priceAda: number, priceUsd: number, currency: DisplayCurrency): string {
  return currency === 'USD' ? formatUsdPrice(priceUsd) : formatAdaPrice(priceAda);
}

export function formatMarketValue(valueAda: number, valueUsd: number, currency: DisplayCurrency): string {
  return currency === 'USD' ? formatCompactUsd(valueUsd) : formatCompactAda(valueAda);
}

export function formatUsdInCurrency(valueUsd: number, adaPriceUsd: number | null, currency: DisplayCurrency): string {
  if (currency === 'USD') return formatUsdPrice(valueUsd);
  if (!adaPriceUsd) return '—';
  return formatAdaPrice(valueUsd / adaPriceUsd);
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
