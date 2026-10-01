// Display market provider. CARDYX progressively replaces individual fields with verified local data.

const MARKET_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=cardano-ecosystem&order=market_cap_desc&per_page=200&page=1&sparkline=true&price_change_percentage=24h%2C7d&locale=en&platform=cardano';
const ADA_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd&include_24hr_change=true';
const TTL = 60_000;

export interface MinswapAssetMetrics {
  priceUsd: number;
  change24h: number;
  change7d: number;
  volume24hUsd: number;
  volume7dUsd: number;
  marketCapUsd: number;
  fdvUsd: number;
  circulatingSupply: number;
  totalSupply: number;
  liquidityUsd: number;
}

export interface MarketToken { id: string; ticker: string; name: string; image: string | null; policyId: string | null; priceUsd: number; priceAda: number; change24h: number; change7d: number; volume24hUsd: number; marketCapUsd: number; fdvUsd: number; volume24hAda: number; marketCapAda: number; fdvAda: number; marketCapRank: number | null; circulatingSupply: number; totalSupply: number | null; maxSupply: number | null; athUsd: number; athChangePct: number; athDate: string | null; atlUsd: number; atlChangePct: number; atlDate: string | null; high24hUsd: number; low24hUsd: number; sparkline7d: number[]; }
export interface MarketData { adaPriceUsd: number; adaChange24h: number; total: number; updatedAt: string; tokens: MarketToken[]; }
export type ChartRange = '7' | '30';
export interface ChartCandle { time: number; open: number; high: number; low: number; close: number; }

let cache: { data: MarketData; fetchedAt: number } | null = null;
const chartCache = new Map<string, { candles: ChartCandle[]; fetchedAt: number }>();
const minswapMetricsCache = new Map<string, { metrics: MinswapAssetMetrics | null; expiresAt: number }>();
const minswapMetricsRequests = new Map<string, Promise<MinswapAssetMetrics | null>>();
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
async function json(url: string): Promise<any> { const response = await fetch(url, { headers: { accept: 'application/json' } }); if (!response.ok) throw new Error(`Market provider HTTP ${response.status}`); return response.json(); }

export async function getMinswapAssetMetrics(policyId: string, assetName: string): Promise<MinswapAssetMetrics | null> {
  const normalizedPolicy = policyId.toLowerCase();
  const normalizedName = assetName.toLowerCase();
  if (!/^[a-f0-9]{56}$/.test(normalizedPolicy) || !/^(?:[a-f0-9]{2})*$/.test(normalizedName)) return null;

  const cacheKey = `${normalizedPolicy}${normalizedName}`;
  const cached = minswapMetricsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.metrics;
  const pending = minswapMetricsRequests.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(
        `https://api-mainnet-prod.minswap.org/v1/assets/${cacheKey}/metrics?currency=usd`,
        { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5_000) }
      );
      if (!response.ok) throw new Error(`Minswap metrics HTTP ${response.status}`);
      const payload = await response.json() as Record<string, unknown> | null;
      if (!payload || typeof payload !== 'object') return null;
      const asset = payload.asset as Record<string, unknown> | undefined;
      if (asset?.currency_symbol !== normalizedPolicy || asset?.token_name !== normalizedName) return null;

      const metrics = {
        priceUsd: number(payload.price),
        change24h: number(payload.price_change_24h),
        change7d: number(payload.price_change_7d),
        volume24hUsd: number(payload.volume_24h),
        volume7dUsd: number(payload.volume_7d),
        marketCapUsd: number(payload.market_cap),
        fdvUsd: number(payload.fully_diluted),
        circulatingSupply: number(payload.circulating_supply),
        totalSupply: number(payload.total_supply),
        liquidityUsd: number(payload.liquidity),
      };
      minswapMetricsCache.set(cacheKey, { metrics, expiresAt: Date.now() + 5 * 60_000 });
      return metrics;
    } catch {
      minswapMetricsCache.set(cacheKey, { metrics: null, expiresAt: Date.now() + 60_000 });
      return null;
    } finally {
      minswapMetricsRequests.delete(cacheKey);
    }
  })();

  minswapMetricsRequests.set(cacheKey, request);
  return request;
}

export async function getTopTokens(): Promise<MarketData> {
  if (cache && Date.now() - cache.fetchedAt < TTL) return cache.data;
  try {
    const [coins, ada] = await Promise.all([json(MARKET_URL), json(ADA_URL)]);
    const adaPriceUsd = number(ada?.cardano?.usd) || cache?.data.adaPriceUsd || 0;
    const rawAdaChange = Number(ada?.cardano?.usd_24h_change);
    const adaChange24h = Number.isFinite(rawAdaChange) ? rawAdaChange : cache?.data.adaChange24h ?? 0;
    const tokens = (Array.isArray(coins) ? coins : []).map((coin: any): MarketToken => {
      const priceUsd = number(coin.current_price); const volume24hUsd = number(coin.total_volume); const marketCapUsd = number(coin.market_cap); const fdvUsd = number(coin.fully_diluted_valuation);
      return { id: String(coin.id ?? ''), ticker: String(coin.symbol ?? '').toUpperCase(), name: String(coin.name ?? ''), image: typeof coin.image === 'string' ? coin.image : null, policyId: coin.platforms?.cardano ? String(coin.platforms.cardano) : null, priceUsd, priceAda: adaPriceUsd ? priceUsd / adaPriceUsd : 0, change24h: number(coin.price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h), change7d: number(coin.price_change_percentage_7d_in_currency), volume24hUsd, marketCapUsd, fdvUsd, volume24hAda: adaPriceUsd ? volume24hUsd / adaPriceUsd : 0, marketCapAda: adaPriceUsd ? marketCapUsd / adaPriceUsd : 0, fdvAda: adaPriceUsd ? fdvUsd / adaPriceUsd : 0, marketCapRank: coin.market_cap_rank ?? null, circulatingSupply: number(coin.circulating_supply), totalSupply: coin.total_supply == null ? null : number(coin.total_supply), maxSupply: coin.max_supply == null ? null : number(coin.max_supply), athUsd: number(coin.ath), athChangePct: number(coin.ath_change_percentage), athDate: coin.ath_date ?? null, atlUsd: number(coin.atl), atlChangePct: number(coin.atl_change_percentage), atlDate: coin.atl_date ?? null, high24hUsd: number(coin.high_24h), low24hUsd: number(coin.low_24h), sparkline7d: Array.isArray(coin.sparkline_in_7d?.price) ? coin.sparkline_in_7d.price.map(number).filter((value: number) => value > 0) : [] };
    });
    const data = { adaPriceUsd, adaChange24h, total: tokens.length, updatedAt: new Date().toISOString(), tokens };
    cache = { data, fetchedAt: Date.now() }; return data;
  } catch (error) { if (cache) return cache.data; throw error; }
}

export async function getTokenChart(id: string, days: ChartRange): Promise<ChartCandle[]> {
  const key = `${id}:${days}`; const hit = chartCache.get(key); if (hit && Date.now() - hit.fetchedAt < TTL) return hit.candles;
  const rows = await json(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`);
  const candles = (Array.isArray(rows) ? rows : []).filter((row: unknown) => Array.isArray(row) && row.length >= 5).map((row: any[]) => ({ time: number(row[0]), open: number(row[1]), high: number(row[2]), low: number(row[3]), close: number(row[4]) }));
  chartCache.set(key, { candles, fetchedAt: Date.now() }); return candles;
}

export async function getTokenById(id: string): Promise<{ token: MarketToken; adaPriceUsd: number } | null> { const market = await getTopTokens(); const token = market.tokens.find((entry) => entry.id === id); return token ? { token, adaPriceUsd: market.adaPriceUsd } : null; }
