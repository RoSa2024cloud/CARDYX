// backend/src/market.service.ts
//
// Marktdaten-Service: Lädt die Top 200 Token des Cardano-Ökosystems
// (Preise, Market Cap, Volumen, 24h/7d-Änderungen, Logos) von CoinGecko
// und rechnet die USD-Werte auf Basis des Live-ADA-Kurses in ADA um.
//
// Ein 60-Sekunden-In-Memory-Cache schont die öffentlichen Rate-Limits.

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/coins/markets' +
  '?vs_currency=usd&category=cardano-ecosystem&order=market_cap_desc' +
  '&per_page=200&page=1&sparkline=true&price_change_percentage=24h%2C7d' +
  '&locale=en&platform=cardano';

const COINGECKO_ADA_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd';

const CACHE_TTL_MS = 60_000; // 60 Sekunden

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
}

export interface MarketData {
  adaPriceUsd: number;
  total: number;
  updatedAt: string;
  tokens: MarketToken[];
}

let cache: { data: MarketData; fetchedAt: number } | null = null;

// ---------------------------------------------------------------------------
// Chart-Daten (OHLC-Kerzen via CoinGecko, pro Token & Zeitraum gecached)
// ---------------------------------------------------------------------------

export type ChartRange = '7' | '30';

export interface ChartCandle {
  time: number; // Unix-ms
  open: number;
  high: number;
  low: number;
  close: number;
}

const chartCache = new Map<string, { candles: ChartCandle[]; fetchedAt: number }>();

/** Lädt OHLC-Kerzen eines Tokens (7 oder 30 Tage, 60s gecached). */
export async function getTokenChart(id: string, days: ChartRange): Promise<ChartCandle[]> {
  const key = `${id}:${days}`;
  const hit = chartCache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.candles;
  }

  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`;

  try {
    const raw = await fetchJson(url);
    const candles: ChartCandle[] = (Array.isArray(raw) ? raw : [])
      .filter((c: any) => Array.isArray(c) && c.length >= 5)
      .map((c: any[]) => ({
        time: toNumber(c[0]),
        open: toNumber(c[1]),
        high: toNumber(c[2]),
        low: toNumber(c[3]),
        close: toNumber(c[4]),
      }));

    chartCache.set(key, { candles, fetchedAt: Date.now() });
    return candles;
  } catch (error: any) {
    if (hit) {
      console.warn(`⚠️ Chart-Cache-Fallback für ${key}:`, error.message);
      return hit.candles;
    }
    throw error;
  }
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`CoinGecko antwortet mit HTTP ${response.status}`);
  }
  return response.json();
}

/** Lädt die Top-200-Marktdaten (gecached) und rechnet sie in ADA um. */
export async function getTopTokens(): Promise<MarketData> {
  // Frischen Cache direkt zurückgeben
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const [coins, adaPriceJson] = await Promise.all([
      fetchJson(COINGECKO_URL),
      fetchJson(COINGECKO_ADA_URL),
    ]);

    const adaPriceUsd = toNumber(adaPriceJson?.cardano?.usd) || cache?.data.adaPriceUsd || 0;

    const tokens: MarketToken[] = (Array.isArray(coins) ? coins : []).map((coin: any) => {
      const priceUsd = toNumber(coin.current_price);
      const volume24hUsd = toNumber(coin.total_volume);
      const marketCapUsd = toNumber(coin.market_cap);
      const fdvUsd = toNumber(coin.fully_diluted_valuation);

      return {
        id: String(coin.id ?? ''),
        ticker: String(coin.symbol ?? '').toUpperCase(),
        name: String(coin.name ?? ''),
        image: typeof coin.image === 'string' ? coin.image : null,
        policyId: coin.platforms?.cardano ? String(coin.platforms.cardano) : null,
        priceUsd,
        priceAda: adaPriceUsd > 0 ? priceUsd / adaPriceUsd : 0,
        change24h: toNumber(coin.price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h),
        change7d: toNumber(coin.price_change_percentage_7d_in_currency),
        volume24hUsd,
        marketCapUsd,
        fdvUsd,
        volume24hAda: adaPriceUsd > 0 ? volume24hUsd / adaPriceUsd : 0,
        marketCapAda: adaPriceUsd > 0 ? marketCapUsd / adaPriceUsd : 0,
        fdvAda: adaPriceUsd > 0 ? fdvUsd / adaPriceUsd : 0,
        marketCapRank: coin.market_cap_rank ?? null,
        circulatingSupply: toNumber(coin.circulating_supply),
        totalSupply: coin.total_supply != null ? toNumber(coin.total_supply) : null,
        maxSupply: coin.max_supply != null ? toNumber(coin.max_supply) : null,
        athUsd: toNumber(coin.ath),
        athChangePct: toNumber(coin.ath_change_percentage),
        athDate: coin.ath_date ?? null,
        atlUsd: toNumber(coin.atl),
        atlChangePct: toNumber(coin.atl_change_percentage),
        atlDate: coin.atl_date ?? null,
        high24hUsd: toNumber(coin.high_24h),
        low24hUsd: toNumber(coin.low_24h),
        sparkline7d: Array.isArray(coin.sparkline_in_7d?.price)
          ? coin.sparkline_in_7d.price.map(toNumber).filter((value: number) => value > 0)
          : [],
      };
    });

    const data: MarketData = {
      adaPriceUsd,
      total: tokens.length,
      updatedAt: new Date().toISOString(),
      tokens,
    };

    cache = { data, fetchedAt: Date.now() };
    return data;
  } catch (error: any) {
    // Bei API-Ausfall/Rate-Limit: letzten bekannten Stand weiter ausliefern
    if (cache) {
      console.warn('⚠️ CoinGecko nicht erreichbar – liefere Cache aus:', error.message);
      return cache.data;
    }
    throw error;
  }
}

/**
 * Liefert einen einzelnen Token aus dem gecachten Top-200-Dataset.
 * Die Route bleibt damit konsistent zur Übersicht und erzeugt keinen
 * zusätzlichen CoinGecko-Abruf für jeden Seitenaufruf.
 */
export async function getTokenById(id: string): Promise<{ token: MarketToken; adaPriceUsd: number } | null> {
  const market = await getTopTokens();
  const token = market.tokens.find((entry) => entry.id === id);
  return token ? { token, adaPriceUsd: market.adaPriceUsd } : null;
}
