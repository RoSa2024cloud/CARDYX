import { getTopTokens } from './market.service';
import { getLocalAdaUsd, getLocalDexTvlAda } from './dex-indexer.service';
import { getLocalDexVolume24hAda } from './pool-state-indexer.service';

const CARDANO_TVL_URL = 'https://api.llama.fi/v2/chains';
const CARDANO_DEX_VOLUME_URL = 'https://api.llama.fi/overview/dexs/Cardano?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true';
const CACHE_TTL_MS = 60_000;

export interface CardanoMarketSummary {
  adaPriceUsd: number;
  adaChange24h: number;
  dexVolume24hUsd: number | null;
  tvlUsd: number | null;
  dexTvlAda: number | null;
  updatedAt: string;
  sources: {
    adaPrice: 'CARDYX local stable pools' | 'CoinGecko' | 'configured-ada-usd';
    dexVolume: 'CARDYX local DEX pools' | 'DefiLlama' | null;
    tvl: 'CARDYX local DEX pools' | 'DefiLlama' | null;
  };
  stale: boolean;
}

let cached: { data: CardanoMarketSummary; fetchedAt: number } | null = null;

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Market summary HTTP ${response.status}`);
  return response.json();
}

function optionalNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function getCardanoMarketSummary(): Promise<CardanoMarketSummary> {
  const localAda = getLocalAdaUsd();
  const dexTvlAda = getLocalDexTvlAda();
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return withLocalData(cached.data, localAda, dexTvlAda);

  try {
    const [market, dex, chains] = await Promise.all([
      getTopTokens().catch(() => null),
      fetchJson(CARDANO_DEX_VOLUME_URL).catch(() => null),
      fetchJson(CARDANO_TVL_URL).catch(() => null),
    ]);
    const configuredAdaPriceUsd = Number(process.env.CARDYX_ADA_USD ?? 0.35);
    const adaPriceUsd = market?.adaPriceUsd || (Number.isFinite(configuredAdaPriceUsd) && configuredAdaPriceUsd > 0 ? configuredAdaPriceUsd : 0.35);
    const cardano = Array.isArray(chains) ? chains.find((chain: any) => chain?.name === 'Cardano') : null;
    const dexVolume24hUsd = optionalNumber(dex?.total24h);
    const tvlUsd = optionalNumber(cardano?.tvl);
    if (!market && dexVolume24hUsd === null && tvlUsd === null && cached) return withLocalData({ ...cached.data, stale: true }, localAda, dexTvlAda);
    const data: CardanoMarketSummary = {
      adaPriceUsd,
      adaChange24h: market?.adaChange24h ?? 0,
      dexVolume24hUsd,
      tvlUsd,
      dexTvlAda: null,
      updatedAt: new Date().toISOString(),
      sources: {
        adaPrice: market ? 'CoinGecko' : 'configured-ada-usd',
        dexVolume: dexVolume24hUsd === null ? null : 'DefiLlama',
        tvl: tvlUsd === null ? null : 'DefiLlama',
      },
      stale: !market,
    };
    cached = { data, fetchedAt: Date.now() };
    return withLocalData(data, localAda, dexTvlAda);
  } catch (error) {
    if (cached) return withLocalData({ ...cached.data, stale: true }, localAda, dexTvlAda);
    throw error;
  }
}

function withLocalData(data: CardanoMarketSummary, localAda: ReturnType<typeof getLocalAdaUsd>, dexTvlAda: number | null): CardanoMarketSummary {
  const adaPriceUsd = localAda?.priceUsd ?? data.adaPriceUsd;
  const dexVolumeAda = getLocalDexVolume24hAda();
  return {
    ...data,
    adaPriceUsd,
    adaChange24h: localAda?.change24h ?? data.adaChange24h,
    dexTvlAda,
    dexVolume24hUsd: dexVolumeAda !== null ? dexVolumeAda * adaPriceUsd : data.dexVolume24hUsd,
    tvlUsd: dexTvlAda !== null ? dexTvlAda * adaPriceUsd : data.tvlUsd,
    sources: {
      ...data.sources,
      adaPrice: localAda ? 'CARDYX local stable pools' : data.sources.adaPrice,
      dexVolume: dexVolumeAda !== null ? 'CARDYX local DEX pools' : data.sources.dexVolume,
      tvl: dexTvlAda !== null ? 'CARDYX local DEX pools' : data.sources.tvl,
    },
  };
}