import type { Pool } from 'pg';
import { assetKey, calculateAdaTokenPrice, getDexAdapter, minswapV2Adapter, type DexPoolRegistryEntry, type DexUtxoValue } from './dex-adapters';

let lastRunAt: string | null = null;
let lastRunResult: { discovered: number; pools: number; markets: number; candles: number } | null = null;
let lastRunError: string | null = null;
let isRunning = false;
const MINIMUM_ADA_LIQUIDITY = 500;
// Pools whose price deviates more than this from the liquidity-weighted median are ignored.
const PRICE_OUTLIER_TOLERANCE = 0.1;
const STABLE_OUTLIER_TOLERANCE = 0.03;
const MINIMUM_STABLE_POOL_ADA = 5_000;

export interface LocalAdaUsd { priceUsd: number; change24h: number | null; poolCount: number; reserveAda: number; observedAt: string }
let localAdaUsd: LocalAdaUsd | null = null;
let localDexTvlAda: number | null = null;

export function getLocalAdaUsd(): LocalAdaUsd | null {
  return localAdaUsd && Date.now() - new Date(localAdaUsd.observedAt).getTime() < 10 * 60_000 ? localAdaUsd : null;
}

export function getLocalDexTvlAda(): number | null {
  return localDexTvlAda;
}

async function refreshLocalAdaUsd(pool: Pool): Promise<void> {
  const result = await pool.query<{ price_usd: string; pool_count: string; reserve_ada: string; previous_usd: string | null }>(
    `WITH latest AS (
       SELECT DISTINCT ON (o.pool_id) o.pool_id, 1 / o.price_ada AS usd_per_ada, o.reserve_ada
       FROM cardyx.dex_pool_price_observation o
       JOIN cardyx.dex_pool_registry registry USING (pool_id)
       JOIN cardyx.asset_catalog catalog ON catalog.market_id = o.market_id
       WHERE registry.enabled = true
         AND catalog.category = 'stablecoin'
         AND upper(catalog.ticker) <> 'IUSD'
         AND o.observed_at >= now() - interval '30 minutes'
         AND o.price_ada > 0
         AND o.reserve_ada >= $2::numeric
       ORDER BY o.pool_id, o.observed_at DESC
     ), ranked AS (
       SELECT usd_per_ada,
              sum(reserve_ada) OVER (ORDER BY usd_per_ada) AS cumulative,
              sum(reserve_ada) OVER () AS total
       FROM latest
     ), median AS (
       SELECT usd_per_ada FROM ranked WHERE cumulative >= total / 2 ORDER BY usd_per_ada LIMIT 1
     ), filtered AS (
       SELECT latest.* FROM latest, median
       WHERE latest.usd_per_ada BETWEEN median.usd_per_ada * (1 - $1::numeric) AND median.usd_per_ada * (1 + $1::numeric)
     )
     SELECT (sum(usd_per_ada * reserve_ada) / sum(reserve_ada))::text AS price_usd,
            count(*)::text AS pool_count,
            sum(reserve_ada)::text AS reserve_ada,
            (SELECT price_usd::text FROM cardyx.ada_usd_observation
             WHERE observed_at BETWEEN now() - interval '25 hours' AND now() - interval '24 hours'
             ORDER BY observed_at DESC LIMIT 1) AS previous_usd
     FROM filtered
     HAVING count(*) >= 2`,
    [STABLE_OUTLIER_TOLERANCE, MINIMUM_STABLE_POOL_ADA]
  );
  const row = result.rows[0];
  const priceUsd = Number(row?.price_usd);
  if (!row || !Number.isFinite(priceUsd) || priceUsd <= 0) return;

  const observedAt = new Date().toISOString();
  await pool.query(
    `INSERT INTO cardyx.ada_usd_observation (observed_at, price_usd, pool_count, reserve_ada)
     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [observedAt, priceUsd, Number(row.pool_count), Number(row.reserve_ada)]
  );
  const previous = Number(row.previous_usd);
  localAdaUsd = {
    priceUsd,
    change24h: previous > 0 ? (priceUsd / previous - 1) * 100 : null,
    poolCount: Number(row.pool_count),
    reserveAda: Number(row.reserve_ada),
    observedAt,
  };
}

interface PoolRegistryRow {
  pool_id: string;
  dex: string;
  version: string;
  pool_address: string | null;
  asset_a_policy_id: string | null;
  asset_a_asset_name: string | null;
  asset_a_decimals: number;
  asset_b_policy_id: string | null;
  asset_b_asset_name: string | null;
  asset_b_decimals: number;
  pool_nft_policy_id: string;
  pool_nft_asset_name: string;
}

interface PoolUtxoRow {
  tx_out_id: string;
  lovelace: string;
  datum_json: unknown;
  assets: Array<{ policy_id: string; asset_name: string; quantity: string }>;
}

interface RegisteredPoolRow extends PoolRegistryRow {
  pool_id: string;
  dex: string;
  version: string;
  tx_out_id: string | null;
  enabled: boolean;
}

interface MinswapPoolCandidate extends PoolUtxoRow {
  address: string;
}

type DatumNode = { constructor?: number; fields?: DatumNode[]; bytes?: string; int?: number | string };

function datumAsset(node: DatumNode | undefined): { policyId: string | null; assetName: string | null } | null {
  if (node?.constructor !== 0 || !node.fields || node.fields.length !== 2) return null;
  const policyId = node.fields[0]?.bytes ?? null;
  const assetName = node.fields[1]?.bytes ?? null;
  if (policyId === null || assetName === null) return null;
  return { policyId: policyId || null, assetName: assetName || null };
}

function datumInt(node: DatumNode | undefined): bigint | null {
  if (node?.int === undefined) return null;
  try {
    const value = BigInt(node.int);
    return value > 0n ? value : null;
  } catch {
    return null;
  }
}

async function discoverMinswapV2Pools(pool: Pool): Promise<number> {
  const candidates = await pool.query<MinswapPoolCandidate>('SELECT * FROM cardyx.minswap_v2_pool_candidate');
  let discovered = 0;

  for (const candidate of candidates.rows) {
    const datum = candidate.datum_json as DatumNode;
    const fields = datum.constructor === 0 ? datum.fields ?? [] : [];
    if (fields.length < 8) continue;

    const assetA = datumAsset(fields[1]);
    const assetB = datumAsset(fields[2]);
    const totalLiquidity = datumInt(fields[3]);
    const reserveA = datumInt(fields[4]);
    const reserveB = datumInt(fields[5]);
    const feeA = datumInt(fields[6]);
    const feeB = datumInt(fields[7]);
    if (!assetA || !assetB || !totalLiquidity || !reserveA || !reserveB || !feeA || !feeB) continue;
    if (feeA < 5n || feeA > 2000n || feeB < 5n || feeB > 2000n) continue;

    const assets = new Map(candidate.assets.map((asset) => [`${asset.policy_id}:${asset.asset_name}`, BigInt(asset.quantity)]));
    const reserveInUtxo = (asset: { policyId: string | null; assetName: string | null }) =>
      asset.policyId === null && asset.assetName === null
        ? BigInt(candidate.lovelace)
        : assets.get(`${asset.policyId}:${asset.assetName}`) ?? 0n;
    if (reserveA > reserveInUtxo(assetA) || reserveB > reserveInUtxo(assetB)) continue;

    const lpAsset = candidate.assets.find((asset) =>
      asset.policy_id === 'f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c'
      && asset.asset_name !== '4d5350'
      && BigInt(asset.quantity) > 1n
    );
    if (!lpAsset) continue;

    const decimals = async (asset: { policyId: string | null; assetName: string | null }) => {
      if (asset.policyId === null && asset.assetName === null) return 6;
      const metadata = await pool.query<{ decimals: number | null }>(
        `SELECT coalesce(m.decimals, c.decimals) AS decimals
         FROM cardyx.asset_catalog c
         LEFT JOIN cardyx.asset_metadata m ON m.policy_id = c.policy_id AND m.asset_name = c.asset_name
         WHERE c.policy_id = $1 AND c.asset_name = $2 LIMIT 1`,
        [asset.policyId, asset.assetName]
      );
      return metadata.rows[0]?.decimals ?? 0;
    };

    const [assetADecimals, assetBDecimals] = await Promise.all([decimals(assetA), decimals(assetB)]);
    await pool.query(
      `INSERT INTO cardyx.dex_pool_registry (
         pool_id, dex, version, tx_out_id, pool_address,
         pool_nft_policy_id, pool_nft_asset_name,
         asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
         asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
         enabled, validated_at, updated_at
      ) VALUES ($1, 'minswap', 'v2', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
       ON CONFLICT DO NOTHING`,
      [
        `minswap-v2-${lpAsset.asset_name}`, candidate.tx_out_id, candidate.address,
        lpAsset.policy_id, lpAsset.asset_name,
        assetA.policyId, assetA.assetName, assetADecimals,
        assetB.policyId, assetB.assetName, assetBDecimals,
        BigInt(candidate.lovelace) >= 500000000,
      ]
    );
    discovered += 1;
  }

  return discovered;
}

async function refreshRegisteredPoolDecimals(pool: Pool): Promise<void> {
  await pool.query(
    `WITH metadata AS (
       SELECT registry.pool_id,
              CASE WHEN registry.asset_a_policy_id IS NULL THEN 6
                   ELSE coalesce(nullif(asset_a_metadata.decimals, 0), nullif(asset_a_catalog.decimals, 0), registry.asset_a_decimals)
              END AS asset_a_decimals,
              CASE WHEN registry.asset_b_policy_id IS NULL THEN 6
                   ELSE coalesce(nullif(asset_b_metadata.decimals, 0), nullif(asset_b_catalog.decimals, 0), registry.asset_b_decimals)
              END AS asset_b_decimals
       FROM cardyx.dex_pool_registry registry
       LEFT JOIN cardyx.asset_catalog asset_a_catalog
         ON asset_a_catalog.policy_id = registry.asset_a_policy_id
        AND asset_a_catalog.asset_name = registry.asset_a_asset_name
       LEFT JOIN cardyx.asset_metadata asset_a_metadata
         ON asset_a_metadata.policy_id = registry.asset_a_policy_id
        AND asset_a_metadata.asset_name = registry.asset_a_asset_name
       LEFT JOIN cardyx.asset_catalog asset_b_catalog
         ON asset_b_catalog.policy_id = registry.asset_b_policy_id
        AND asset_b_catalog.asset_name = registry.asset_b_asset_name
       LEFT JOIN cardyx.asset_metadata asset_b_metadata
         ON asset_b_metadata.policy_id = registry.asset_b_policy_id
        AND asset_b_metadata.asset_name = registry.asset_b_asset_name
     )
     UPDATE cardyx.dex_pool_registry registry
     SET asset_a_decimals = metadata.asset_a_decimals,
         asset_b_decimals = metadata.asset_b_decimals,
         updated_at = now()
     FROM metadata
     WHERE registry.pool_id = metadata.pool_id
       AND (registry.asset_a_decimals IS DISTINCT FROM metadata.asset_a_decimals
         OR registry.asset_b_decimals IS DISTINCT FROM metadata.asset_b_decimals)`
  );
}

async function refreshRegisteredPoolOutputs(pool: Pool): Promise<number> {
  const registered = await pool.query<RegisteredPoolRow>(
    `SELECT pool_id, dex, version, tx_out_id, pool_address,
            asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
            asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
            pool_nft_policy_id, pool_nft_asset_name, enabled
     FROM cardyx.dex_pool_registry
     WHERE validated_at IS NOT NULL
     ORDER BY updated_at ASC`
  );
  let refreshed = 0;

  for (const row of registered.rows) {
    const adapter = getDexAdapter(row.dex, row.version);
    if (!adapter) continue;
    const candidates = await pool.query<PoolUtxoRow & { tx_out_id: string }>(
      `SELECT tx_out_id::text, lovelace::text, datum_json, assets
       FROM cardyx.find_registered_pool_outputs($1, $2, $3, $4, $5)`,
      [row.pool_id, row.pool_nft_policy_id, row.pool_nft_asset_name, row.tx_out_id, row.pool_address]
    );

    for (const candidate of candidates.rows) {
      const decoded = adapter.decodePool(
        {
          poolId: row.pool_id,
          dex: row.dex,
          version: row.version,
          txOutId: candidate.tx_out_id,
          poolNft: { policyId: row.pool_nft_policy_id, assetName: row.pool_nft_asset_name, decimals: 0 },
          assetA: { policyId: row.asset_a_policy_id, assetName: row.asset_a_asset_name, decimals: row.asset_a_decimals },
          assetB: { policyId: row.asset_b_policy_id, assetName: row.asset_b_asset_name, decimals: row.asset_b_decimals },
          enabled: row.enabled,
        },
        {
          lovelace: BigInt(candidate.lovelace),
          assets: new Map(candidate.assets.map((asset) => [assetKey({ policyId: asset.policy_id, assetName: asset.asset_name, decimals: 0 }), BigInt(asset.quantity)])),
          datum: candidate.datum_json,
        }
      );
      if (!decoded) continue;
      if (candidate.tx_out_id === row.tx_out_id) break;
      await pool.query(
        `UPDATE cardyx.dex_pool_registry
         SET tx_out_id = $2, validated_at = now(), updated_at = now()
         WHERE pool_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM cardyx.dex_pool_registry other
             WHERE other.pool_id <> $1 AND other.tx_out_id = $2
           )`,
        [row.pool_id, candidate.tx_out_id]
      );
      refreshed += 1;
      break;
    }
  }

  return refreshed;
}

async function indexRegisteredPools(pool: Pool): Promise<number> {
  const candidates = await pool.query<PoolUtxoRow & PoolRegistryRow>('SELECT * FROM cardyx.dex_pool_utxo');
  let indexed = 0;

  for (const candidate of candidates.rows) {
    const adapter = getDexAdapter(candidate.dex, candidate.version);
    if (!adapter) continue;

    const entry: DexPoolRegistryEntry = {
      poolId: candidate.pool_id,
      dex: candidate.dex,
      version: candidate.version,
      txOutId: candidate.tx_out_id,
      poolNft: { policyId: candidate.pool_nft_policy_id, assetName: candidate.pool_nft_asset_name, decimals: 0 },
      assetA: { policyId: candidate.asset_a_policy_id, assetName: candidate.asset_a_asset_name, decimals: candidate.asset_a_decimals },
      assetB: { policyId: candidate.asset_b_policy_id, assetName: candidate.asset_b_asset_name, decimals: candidate.asset_b_decimals },
      enabled: true,
    };
    const utxo: DexUtxoValue = {
      lovelace: BigInt(candidate.lovelace),
      assets: new Map(candidate.assets.map((asset) => [assetKey({ policyId: asset.policy_id, assetName: asset.asset_name, decimals: 0 }), BigInt(asset.quantity)])),
      datum: candidate.datum_json,
    };
    const decoded = adapter.decodePool(entry, utxo);
    if (!decoded) continue;
    const price = calculateAdaTokenPrice(decoded);
    if (!price) continue;
    const catalog = await pool.query<{ market_id: string }>(
      `SELECT market_id FROM cardyx.asset_catalog
       WHERE policy_id = $1 AND asset_name = $2
       LIMIT 1`,
      [price.policyId, price.assetName]
    );
    const marketId = catalog.rows[0]?.market_id;
    if (!marketId) continue;

    const priceEnabled = price.reserveAda >= MINIMUM_ADA_LIQUIDITY;
    await pool.query(
      `UPDATE cardyx.dex_pool_registry
       SET enabled = $2, updated_at = now()
       WHERE pool_id = $1`,
      [decoded.poolId, priceEnabled]
    );

    await pool.query(
      `INSERT INTO cardyx.dex_pool_price_observation
         (pool_id, market_id, policy_id, asset_name, reserve_ada, reserve_asset, price_ada, observed_at, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now(), 'cardyx-local-dex-indexer')
       ON CONFLICT (pool_id, market_id)
       DO UPDATE SET reserve_ada = EXCLUDED.reserve_ada,
                     reserve_asset = EXCLUDED.reserve_asset,
                     price_ada = EXCLUDED.price_ada,
                     observed_at = EXCLUDED.observed_at,
                     source = EXCLUDED.source`,
      [decoded.poolId, marketId, price.policyId, price.assetName, price.reserveAda, price.reserveAsset, price.priceAda]
    );
    indexed += 1;
  }

  return indexed;
}

async function buildLocalCandles(pool: Pool): Promise<number> {
  const result = await pool.query<{ market_id: string }>(
    `WITH bucketed AS (
       SELECT market_id,
              date_trunc('hour', observed_at) AS bucket_start,
              observed_at,
              price_ada
       FROM cardyx.asset_market_snapshot
       WHERE source = 'cardyx-local-dex-indexer'
         AND observed_at >= now() - interval '7 days'
         AND price_ada > 0
     ), ranges AS (
       SELECT market_id, bucket_start, min(price_ada) AS low, max(price_ada) AS high
       FROM bucketed
       GROUP BY market_id, bucket_start
     ), opens AS (
       SELECT DISTINCT ON (market_id, bucket_start)
              market_id, bucket_start, price_ada AS open
       FROM bucketed
       ORDER BY market_id, bucket_start, observed_at ASC
     ), closes AS (
       SELECT DISTINCT ON (market_id, bucket_start)
              market_id, bucket_start, price_ada AS close
       FROM bucketed
       ORDER BY market_id, bucket_start, observed_at DESC
     )
     INSERT INTO cardyx.asset_market_candle
       (market_id, timeframe, bucket_start, open, high, low, close, volume_ada, source)
     SELECT r.market_id, '7d', r.bucket_start, o.open, r.high, r.low, c.close, 0, 'cardyx-local-dex-indexer'
     FROM ranges r
     JOIN opens o USING (market_id, bucket_start)
     JOIN closes c USING (market_id, bucket_start)
     ON CONFLICT (market_id, timeframe, bucket_start)
     DO UPDATE SET open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
                   close = EXCLUDED.close, source = EXCLUDED.source
     RETURNING market_id`
  );

  await pool.query(
    `WITH swaps AS (
       SELECT market_id, block_time, abs(delta_ada) AS value_ada FROM cardyx.dex_pool_state
       WHERE event_type IN ('buy', 'sell') AND block_time >= now() - interval '7 days' AND market_id IS NOT NULL
       UNION ALL
       SELECT market_a, block_time, value_ada FROM cardyx.dex_pair_state
       WHERE event_type = 'swap' AND block_time >= now() - interval '7 days' AND market_a IS NOT NULL AND value_ada IS NOT NULL
       UNION ALL
       SELECT market_b, block_time, value_ada FROM cardyx.dex_pair_state
       WHERE event_type = 'swap' AND block_time >= now() - interval '7 days' AND market_b IS NOT NULL AND value_ada IS NOT NULL
     ), traded AS (
       SELECT market_id, date_trunc('hour', block_time) AS bucket_start, sum(value_ada) AS volume_ada
       FROM swaps
       GROUP BY 1, 2
     )
     UPDATE cardyx.asset_market_candle candle
     SET volume_ada = traded.volume_ada
     FROM traded
     WHERE candle.market_id = traded.market_id
       AND candle.timeframe = '7d'
       AND candle.bucket_start = traded.bucket_start
       AND candle.volume_ada IS DISTINCT FROM traded.volume_ada`
  );

  return result.rowCount ?? 0;
}

export async function runDexIndexerOnce(pool: Pool): Promise<{ discovered: number; pools: number; markets: number; candles: number }> {
  if (isRunning) return lastRunResult ?? { discovered: 0, pools: 0, markets: 0, candles: 0 };
  isRunning = true;
  try {
    const discovered = await discoverMinswapV2Pools(pool);
    await refreshRegisteredPoolDecimals(pool);
    await pool.query('SELECT cardyx.refresh_snek_pool_output()');
    await refreshRegisteredPoolOutputs(pool);
    await indexRegisteredPools(pool);
    await refreshLocalAdaUsd(pool).catch((error: Error) => console.warn('Lokaler ADA/USD-Index fehlgeschlagen:', error.message));
    const result = await pool.query<{ market_id: string }>(
    `WITH latest AS (
       SELECT DISTINCT ON (pool_id, market_id)
              pool_id, market_id, price_ada, reserve_ada, observed_at
       FROM cardyx.dex_pool_price_observation
      JOIN cardyx.dex_pool_registry registry USING (pool_id)
       WHERE observed_at >= now() - interval '30 minutes'
        AND registry.enabled = true
        AND price_ada > 0
       ORDER BY pool_id, market_id, observed_at DESC
     ), ranked AS (
       SELECT market_id, price_ada,
              sum(reserve_ada) OVER (PARTITION BY market_id ORDER BY price_ada) AS cumulative,
              sum(reserve_ada) OVER (PARTITION BY market_id) AS total
       FROM latest
     ), medians AS (
       SELECT DISTINCT ON (market_id) market_id, price_ada AS median_price
       FROM ranked
       WHERE cumulative >= total / 2
       ORDER BY market_id, price_ada
     ), aggregated AS (
       SELECT latest.market_id,
              sum(latest.price_ada * latest.reserve_ada) / nullif(sum(latest.reserve_ada), 0) AS price_ada
       FROM latest
       JOIN medians USING (market_id)
       WHERE latest.price_ada BETWEEN medians.median_price * (1 - $2::numeric) AND medians.median_price * (1 + $2::numeric)
       GROUP BY latest.market_id
     ), stats AS (
       SELECT a.market_id, a.price_ada, ref_24h.open_24h, ref_7d.open_7d, range_24h.high_24h, range_24h.low_24h, traded.volume_24h
       FROM aggregated a
       LEFT JOIN LATERAL (
         SELECT open AS open_24h FROM cardyx.asset_market_candle
         WHERE market_id = a.market_id AND timeframe = '7d' AND source = 'cardyx-local-dex-indexer'
           AND bucket_start BETWEEN date_trunc('hour', now() - interval '24 hours') AND date_trunc('hour', now() - interval '23 hours')
         ORDER BY bucket_start LIMIT 1
       ) ref_24h ON true
       LEFT JOIN LATERAL (
         SELECT open AS open_7d FROM cardyx.asset_market_candle
         WHERE market_id = a.market_id AND timeframe = '7d' AND source = 'cardyx-local-dex-indexer'
           AND bucket_start BETWEEN date_trunc('hour', now() - interval '7 days') AND date_trunc('hour', now() - interval '167 hours')
         ORDER BY bucket_start LIMIT 1
       ) ref_7d ON true
       LEFT JOIN LATERAL (
         SELECT max(high) AS high_24h, min(low) AS low_24h FROM cardyx.asset_market_candle
         WHERE market_id = a.market_id AND timeframe = '7d' AND source = 'cardyx-local-dex-indexer'
           AND bucket_start >= date_trunc('hour', now() - interval '23 hours')
       ) range_24h ON true
       LEFT JOIN LATERAL (
         SELECT coalesce((SELECT sum(abs(delta_ada)) FROM cardyx.dex_pool_state
                          WHERE market_id = a.market_id AND event_type IN ('buy', 'sell')
                            AND block_time >= now() - interval '24 hours'), 0)
              + coalesce((SELECT sum(value_ada) FROM cardyx.dex_pair_state
                          WHERE (market_a = a.market_id OR market_b = a.market_id) AND event_type = 'swap'
                            AND block_time >= now() - interval '24 hours'), 0) AS volume_24h
       ) traded ON true
       WHERE a.price_ada > 0
     )
     INSERT INTO cardyx.asset_market_snapshot (
       market_id, observed_at, price_ada, price_usd, volume_24h_ada,
       volume_24h_usd, market_cap_ada, market_cap_usd, fdv_ada, fdv_usd,
       change_24h, change_7d, high_24h_usd, low_24h_usd, source
     )
     SELECT s.market_id,
            now(),
            s.price_ada,
            s.price_ada * $1::numeric,
            coalesce(s.volume_24h, 0),
            coalesce(s.volume_24h, 0) * $1::numeric,
            0,
            0,
            0,
            0,
            CASE WHEN s.open_24h > 0 THEN (s.price_ada / s.open_24h - 1) * 100 ELSE 0 END,
            CASE WHEN s.open_7d > 0 THEN (s.price_ada / s.open_7d - 1) * 100 ELSE 0 END,
            greatest(coalesce(s.high_24h, s.price_ada), s.price_ada) * $1::numeric,
            least(coalesce(s.low_24h, s.price_ada), s.price_ada) * $1::numeric,
            'cardyx-local-dex-indexer'
     FROM stats s
     ON CONFLICT DO NOTHING
     RETURNING market_id`,
    [localAdaUsd?.priceUsd ?? 0, PRICE_OUTLIER_TOLERANCE]
  );

    const pools = await pool.query<{ count: string; reserve_ada: string | null }>(
    `SELECT count(DISTINCT pool_id)::text AS count, sum(reserve_ada)::text AS reserve_ada
     FROM (
       SELECT DISTINCT ON (pool_id) pool_id, reserve_ada
       FROM cardyx.dex_pool_price_observation
       JOIN cardyx.dex_pool_registry registry USING (pool_id)
       WHERE observed_at >= now() - interval '30 minutes'
         AND registry.enabled = true
       ORDER BY pool_id, observed_at DESC
     ) latest`
  );
    const reserveAda = Number(pools.rows[0]?.reserve_ada ?? 0);
    // Constant-product pools hold equal value on both sides, so TVL is twice the ADA reserve.
    localDexTvlAda = reserveAda > 0 ? reserveAda * 2 : null;

    const candles = await buildLocalCandles(pool);
    lastRunAt = new Date().toISOString();
    lastRunResult = {
      discovered,
      pools: Number(pools.rows[0]?.count ?? 0),
      markets: result.rowCount ?? 0,
      candles,
    };
    lastRunError = null;
    console.log(`✅ CARDYX-DEX-Indexer abgeschlossen: discovered=${discovered}, pools=${lastRunResult.pools}, markets=${lastRunResult.markets}, candles=${candles}`);
    return lastRunResult;
  } finally {
    isRunning = false;
  }
}

export function startDexIndexer(pool: Pool, intervalMs = 30_000): void {
  const run = () => runDexIndexerOnce(pool).catch((error: Error) => {
    lastRunError = error.message;
    console.error('CARDYX-DEX-Indexer fehlgeschlagen:', error.message);
  });

  setTimeout(run, 3_000);
  setInterval(run, intervalMs);
}

export function getDexIndexerStatus() {
  return { lastRunAt, lastRunResult, lastRunError, isRunning, mode: 'cardyx-local-dex-indexer' };
}
