import type { Pool } from 'pg';
import { assetKey, calculateAdaTokenPrice, getDexAdapter, type DexPoolRegistryEntry } from './dex-adapters';
import { getPoolStateIndexerLimits, selectRoundRobinPoolIds } from './pool-state-indexer.controls';

const BACKFILL_DAYS = 8;
const RETENTION_DAYS = 90;

interface RegistryRow {
  pool_id: string;
  dex: string;
  version: string;
  pool_address: string | null;
  pool_nft_policy_id: string;
  pool_nft_asset_name: string;
  asset_a_policy_id: string | null;
  asset_a_asset_name: string | null;
  asset_a_decimals: number;
  asset_b_policy_id: string | null;
  asset_b_asset_name: string | null;
  asset_b_decimals: number;
  enabled: boolean;
}

interface OutputRow {
  tx_out_id: string;
  tx_hash: string;
  block_time: Date;
  lovelace: string;
  datum_json: unknown;
  assets: Array<{ policy_id: string; asset_name: string; quantity: string }>;
}

interface PoolCursor { txOutId: string; reserveAda: number; reserveAsset: number }

interface PoolScanCursorRow { pool_id: string; last_tx_out_id: string }

let lastRunAt: string | null = null;
let lastRunResult: { pools: number; scannedPools: number; states: number; swaps: number; caughtUp: boolean } | null = null;
let lastRunError: string | null = null;
let isRunning = false;
let lastRetentionAt = 0;
let localDexVolume24hAda: number | null = null;

export function getLocalDexVolume24hAda(): number | null {
  return lastRunResult?.caughtUp ? localDexVolume24hAda : null;
}

function classify(deltaAda: number, deltaAsset: number): string {
  if (deltaAda > 0 && deltaAsset < 0) return 'buy';
  if (deltaAda < 0 && deltaAsset > 0) return 'sell';
  if (deltaAda > 0 && deltaAsset > 0) return 'deposit';
  if (deltaAda < 0 && deltaAsset < 0) return 'withdraw';
  return 'other';
}

async function persistPoolStateBatch(pool: Pool, poolId: string, lastTxOutId: string, insertSql: string | null, values: unknown[] = []): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (insertSql) await client.query(insertSql, values);
    await client.query(
      `INSERT INTO cardyx.dex_pool_state_scan_cursor (pool_id, last_tx_out_id, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (pool_id) DO UPDATE
       SET last_tx_out_id = EXCLUDED.last_tx_out_id, updated_at = now()`,
      [poolId, lastTxOutId]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function advancePoolRoundRobin(pool: Pool, poolId: string): Promise<void> {
  await pool.query(
    `UPDATE cardyx.dex_pool_state_indexer_control
     SET last_pool_id = $1, updated_at = now()
     WHERE singleton = 1`,
    [poolId]
  );
}

export async function runPoolStateIndexerOnce(pool: Pool): Promise<typeof lastRunResult> {
  if (isRunning) return lastRunResult ?? { pools: 0, scannedPools: 0, states: 0, swaps: 0, caughtUp: false };
  isRunning = true;
  try {
    const reconciliation = await pool.query<{ pool_states_deleted: string; pair_states_deleted: string }>(
      'SELECT * FROM cardyx.reconcile_dex_pool_state_rollbacks()'
    );
    const poolStatesDeleted = Number(reconciliation.rows[0]?.pool_states_deleted ?? 0);
    const pairStatesDeleted = Number(reconciliation.rows[0]?.pair_states_deleted ?? 0);
    if (poolStatesDeleted > 0 || pairStatesDeleted > 0) {
      console.warn(`CARDYX-Pool-State-Indexer: Reorg bereinigt poolStates=${poolStatesDeleted}, pairStates=${pairStatesDeleted}`);
    }
    const resetScanCursors = await pool.query<{ reconcile_dex_pool_state_scan_cursors: string }>(
      'SELECT cardyx.reconcile_dex_pool_state_scan_cursors()::text'
    );
    if (Number(resetScanCursors.rows[0]?.reconcile_dex_pool_state_scan_cursors ?? 0) > 0) {
      console.warn(`CARDYX-Pool-State-Indexer: Reorg-Cursor zurueckgesetzt=${resetScanCursors.rows[0]?.reconcile_dex_pool_state_scan_cursors}`);
    }

    const registry = await pool.query<RegistryRow>(
      `SELECT pool_id, dex, version, pool_address, pool_nft_policy_id, pool_nft_asset_name,
              asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
              asset_b_policy_id, asset_b_asset_name, asset_b_decimals, enabled
       FROM cardyx.dex_pool_registry
       WHERE enabled = true AND validated_at IS NOT NULL
       ORDER BY pool_id`
    );
    const limits = getPoolStateIndexerLimits();
    const control = await pool.query<{ last_pool_id: string | null }>(
      'SELECT last_pool_id FROM cardyx.dex_pool_state_indexer_control WHERE singleton = 1'
    );
    const selectedPoolIds = selectRoundRobinPoolIds(
      registry.rows.map((row) => row.pool_id),
      control.rows[0]?.last_pool_id ?? null,
      limits.poolsPerRun
    );
    const registryByPoolId = new Map(registry.rows.map((row) => [row.pool_id, row]));
    const selectedRows = selectedPoolIds.map((poolId) => registryByPoolId.get(poolId)).filter((row): row is RegistryRow => row !== undefined);
    const scanCursorRows = await pool.query<PoolScanCursorRow>(
      'SELECT pool_id, last_tx_out_id::text FROM cardyx.dex_pool_state_scan_cursor WHERE pool_id = ANY($1::text[])',
      [selectedPoolIds]
    );
    const scanCursors = new Map(scanCursorRows.rows.map((row) => [row.pool_id, row.last_tx_out_id]));
    const cursorRows = await pool.query<{ pool_id: string; tx_out_id: string; reserve_ada: string; reserve_asset: string }>(
      `SELECT DISTINCT ON (pool_id) pool_id, tx_out_id::text, reserve_ada::text, reserve_asset::text
       FROM cardyx.dex_pool_state
       ORDER BY pool_id, tx_out_id DESC`
    );
    const pairCursorRows = await pool.query<{ pool_id: string; tx_out_id: string; reserve_a: string; reserve_b: string }>(
      `SELECT DISTINCT ON (pool_id) pool_id, tx_out_id::text, reserve_a::text, reserve_b::text
       FROM cardyx.dex_pair_state
       ORDER BY pool_id, tx_out_id DESC`
    );
    const cursors = new Map<string, PoolCursor>([
      ...cursorRows.rows.map((row): [string, PoolCursor] => [row.pool_id, { txOutId: row.tx_out_id, reserveAda: Number(row.reserve_ada), reserveAsset: Number(row.reserve_asset) }]),
      ...pairCursorRows.rows.map((row): [string, PoolCursor] => [row.pool_id, { txOutId: row.tx_out_id, reserveAda: Number(row.reserve_a), reserveAsset: Number(row.reserve_b) }]),
    ]);
    const priceRows = await pool.query<{ market_id: string; price_ada: string }>(
      `SELECT DISTINCT ON (market_id) market_id, price_ada::text
       FROM cardyx.asset_market_snapshot
       WHERE source = 'cardyx-local-dex-indexer' AND observed_at >= now() - interval '2 hours' AND price_ada > 0
       ORDER BY market_id, observed_at DESC`
    );
    const pricesAda = new Map(priceRows.rows.map((row) => [row.market_id, Number(row.price_ada)]));
    const catalog = await pool.query<{ policy_id: string; asset_name: string; market_id: string }>(
      'SELECT policy_id, asset_name, market_id FROM cardyx.asset_catalog WHERE policy_id IS NOT NULL AND asset_name IS NOT NULL'
    );
    const marketIds = new Map(catalog.rows.map((row) => [`${row.policy_id}:${row.asset_name}`, row.market_id]));

    let backfillStart: string | null = null;
    let states = 0;
    let swaps = 0;
    let caughtUp = selectedRows.length === registry.rows.length;

    for (const row of selectedRows) {
      const adapter = getDexAdapter(row.dex, row.version);
      if (!adapter) {
        caughtUp = false;
        await advancePoolRoundRobin(pool, row.pool_id);
        continue;
      }
      const entry: DexPoolRegistryEntry = {
        poolId: row.pool_id,
        dex: row.dex,
        version: row.version,
        txOutId: null,
        poolNft: { policyId: row.pool_nft_policy_id, assetName: row.pool_nft_asset_name, decimals: 0 },
        assetA: { policyId: row.asset_a_policy_id, assetName: row.asset_a_asset_name, decimals: row.asset_a_decimals },
        assetB: { policyId: row.asset_b_policy_id, assetName: row.asset_b_asset_name, decimals: row.asset_b_decimals },
        enabled: row.enabled,
      };
      let cursor = cursors.get(row.pool_id) ?? null;
      if (!cursor && backfillStart === null) {
        const start = await pool.query<{ id: string | null }>(
          `SELECT cardyx.first_tx_out_id_since(now() - make_interval(days => $1))::text AS id`,
          [BACKFILL_DAYS]
        );
        backfillStart = start.rows[0]?.id ?? '0';
      }
      let after = scanCursors.get(row.pool_id) ?? cursor?.txOutId ?? String(BigInt(backfillStart ?? '1') - 1n);
      const isAdaPair = row.asset_a_policy_id === null || row.asset_b_policy_id === null;
      const marketA = row.asset_a_policy_id ? marketIds.get(`${row.asset_a_policy_id}:${row.asset_a_asset_name}`) ?? null : null;
      const marketB = row.asset_b_policy_id ? marketIds.get(`${row.asset_b_policy_id}:${row.asset_b_asset_name}`) ?? null : null;
      const priceA = marketA ? pricesAda.get(marketA) : undefined;
      const priceB = marketB ? pricesAda.get(marketB) : undefined;
      if (!isAdaPair && priceA === undefined && priceB === undefined) {
        caughtUp = false;
        await advancePoolRoundRobin(pool, row.pool_id);
        continue;
      }

      for (let batch = 0; batch < limits.batchesPerPool; batch += 1) {
        const outputs = await pool.query<OutputRow>(
          `SELECT tx_out_id::text, tx_hash, block_time, lovelace::text, datum_json, assets
           FROM cardyx.dex_pool_outputs_after($1, $2, $3, $4::bigint, $5)`,
          [row.pool_nft_policy_id, row.pool_nft_asset_name, row.pool_address, after, limits.batchSize]
        );
        if (outputs.rows.length === 0) break;

        if (!isAdaPair) {
          const pairRows: Array<[string, string, Date, number, number, number | null, number | null, number | null, string]> = [];
          for (const output of outputs.rows) {
            after = output.tx_out_id;
            const decoded = adapter.decodePool(entry, {
              lovelace: BigInt(output.lovelace),
              assets: new Map(output.assets.map((asset) => [assetKey({ policyId: asset.policy_id, assetName: asset.asset_name, decimals: 0 }), BigInt(asset.quantity)])),
              datum: output.datum_json,
            });
            if (!decoded) continue;
            const reserveA = Number(decoded.reserveA) / 10 ** row.asset_a_decimals;
            const reserveB = Number(decoded.reserveB) / 10 ** row.asset_b_decimals;
            if (!(reserveA > 0) || !(reserveB > 0)) continue;
            const deltaA = cursor ? reserveA - cursor.reserveAda : null;
            const deltaB = cursor ? reserveB - cursor.reserveAsset : null;
            let event = 'initial';
            let valueAda: number | null = null;
            if (deltaA !== null && deltaB !== null) {
              event = deltaA * deltaB < 0 ? 'swap' : deltaA > 0 && deltaB > 0 ? 'deposit' : deltaA < 0 && deltaB < 0 ? 'withdraw' : 'other';
              const valuations = [
                priceA !== undefined ? Math.abs(deltaA) * priceA : null,
                priceB !== undefined ? Math.abs(deltaB) * priceB : null,
              ].filter((value): value is number => value !== null && Number.isFinite(value));
              valueAda = valuations.length ? valuations.reduce((sum, value) => sum + value, 0) / valuations.length : null;
            }
            if (event === 'swap') swaps += 1;
            pairRows.push([output.tx_out_id, output.tx_hash, output.block_time, reserveA, reserveB, deltaA, deltaB, valueAda, event]);
            cursor = { txOutId: output.tx_out_id, reserveAda: reserveA, reserveAsset: reserveB };
          }
          const insertSql = pairRows.length > 0
            ? `INSERT INTO cardyx.dex_pair_state
                 (pool_id, market_a, market_b, tx_out_id, tx_hash, block_time, reserve_a, reserve_b, delta_a, delta_b, value_ada, event_type)
               SELECT $1, $2, $3, *
               FROM unnest($4::bigint[], $5::text[], $6::timestamptz[], $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[], $11::numeric[], $12::text[])
               ON CONFLICT (pool_id, tx_out_id) DO NOTHING`
            : null;
          const pairValues: unknown[] = [
            row.pool_id, marketA, marketB,
            pairRows.map((value) => value[0]), pairRows.map((value) => value[1]), pairRows.map((value) => value[2]),
            pairRows.map((value) => value[3]), pairRows.map((value) => value[4]), pairRows.map((value) => value[5]),
            pairRows.map((value) => value[6]), pairRows.map((value) => value[7]), pairRows.map((value) => value[8]),
          ];
          await persistPoolStateBatch(pool, row.pool_id, after, insertSql, pairValues);
          scanCursors.set(row.pool_id, after);
          states += pairRows.length;
          if (outputs.rows.length < limits.batchSize) break;
          if (batch === limits.batchesPerPool - 1) caughtUp = false;
          continue;
        }

        const rows: Array<[string, string, Date, number, number, number, number | null, number | null, string]> = [];
        let marketId: string | null = null;
        for (const output of outputs.rows) {
          after = output.tx_out_id;
          const decoded = adapter.decodePool(entry, {
            lovelace: BigInt(output.lovelace),
            assets: new Map(output.assets.map((asset) => [assetKey({ policyId: asset.policy_id, assetName: asset.asset_name, decimals: 0 }), BigInt(asset.quantity)])),
            datum: output.datum_json,
          });
          const price = decoded ? calculateAdaTokenPrice(decoded) : null;
          if (!price) continue;
          marketId = marketIds.get(`${price.policyId}:${price.assetName}`) ?? null;
          const deltaAda = cursor ? price.reserveAda - cursor.reserveAda : null;
          const deltaAsset = cursor ? price.reserveAsset - cursor.reserveAsset : null;
          const event = deltaAda === null || deltaAsset === null ? 'initial' : classify(deltaAda, deltaAsset);
          if (event === 'buy' || event === 'sell') swaps += 1;
          rows.push([output.tx_out_id, output.tx_hash, output.block_time, price.reserveAda, price.reserveAsset, price.priceAda, deltaAda, deltaAsset, event]);
          cursor = { txOutId: output.tx_out_id, reserveAda: price.reserveAda, reserveAsset: price.reserveAsset };
        }

        const insertSql = rows.length > 0
          ? `INSERT INTO cardyx.dex_pool_state
               (pool_id, market_id, tx_out_id, tx_hash, block_time, reserve_ada, reserve_asset, price_ada, delta_ada, delta_asset, event_type)
             SELECT $1, $2, *
             FROM unnest($3::bigint[], $4::text[], $5::timestamptz[], $6::numeric[], $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[], $11::text[])
             ON CONFLICT (pool_id, tx_out_id) DO NOTHING`
          : null;
        const stateValues: unknown[] = [
          row.pool_id, marketId,
          rows.map((value) => value[0]), rows.map((value) => value[1]), rows.map((value) => value[2]),
          rows.map((value) => value[3]), rows.map((value) => value[4]), rows.map((value) => value[5]),
          rows.map((value) => value[6]), rows.map((value) => value[7]), rows.map((value) => value[8]),
        ];
        await persistPoolStateBatch(pool, row.pool_id, after, insertSql, stateValues);
        scanCursors.set(row.pool_id, after);
        states += rows.length;
        if (outputs.rows.length < limits.batchSize) break;
        if (batch === limits.batchesPerPool - 1) caughtUp = false;
      }
      await advancePoolRoundRobin(pool, row.pool_id);
    }

    if (Date.now() - lastRetentionAt > 60 * 60_000) {
      await pool.query(`DELETE FROM cardyx.dex_pool_state WHERE block_time < now() - make_interval(days => $1)`, [RETENTION_DAYS]);
      await pool.query(`DELETE FROM cardyx.dex_pair_state WHERE block_time < now() - make_interval(days => $1)`, [RETENTION_DAYS]);
      lastRetentionAt = Date.now();
    }

    const volume = await pool.query<{ volume: string | null }>(
      `SELECT (
         coalesce((SELECT sum(abs(delta_ada)) FROM cardyx.dex_pool_state
                   WHERE event_type IN ('buy', 'sell') AND block_time >= now() - interval '24 hours'), 0)
         + coalesce((SELECT sum(value_ada) FROM cardyx.dex_pair_state
                     WHERE event_type = 'swap' AND block_time >= now() - interval '24 hours'), 0)
       )::text AS volume`
    );
    localDexVolume24hAda = Number(volume.rows[0]?.volume ?? 0);

    lastRunAt = new Date().toISOString();
    lastRunResult = { pools: registry.rows.length, scannedPools: selectedRows.length, states, swaps, caughtUp };
    lastRunError = null;
    console.log(`✅ CARDYX-Pool-State-Indexer: pools=${registry.rows.length}, scannedPools=${selectedRows.length}, states=${states}, swaps=${swaps}, caughtUp=${caughtUp}`);
    return lastRunResult;
  } finally {
    isRunning = false;
  }
}

export function startPoolStateIndexer(pool: Pool, intervalMs = 60_000): void {
  const run = () => runPoolStateIndexerOnce(pool).catch((error: Error) => {
    lastRunError = error.message;
    console.error('CARDYX-Pool-State-Indexer fehlgeschlagen:', error.message);
  });
  setTimeout(run, 20_000);
  setInterval(run, intervalMs);
}

export function getPoolStateIndexerStatus() {
  return { lastRunAt, lastRunResult, lastRunError, isRunning, localDexVolume24hAda: getLocalDexVolume24hAda(), mode: 'cardyx-pool-state-indexer' };
}
