import type { Pool } from 'pg';
import { getTokenSocialSnapshot, type SocialBuzzAsset, type SocialBuzzSnapshot } from './social-buzz.service';

const refreshIntervalMs = 15 * 60 * 1000;
const preloadLimit = 20;
const requestQueue = new Map<string, SocialBuzzAsset>();

let isRunning = false;
let lastRunAt: string | null = null;
let lastRunResult: { refreshed: number; failed: number } | null = null;
let lastRunError: string | null = null;
let workerPool: Pool | null = null;

async function saveSnapshot(pool: Pool, asset: SocialBuzzAsset, snapshot: SocialBuzzSnapshot): Promise<void> {
  await pool.query(
    `INSERT INTO cardyx.token_social_sentiment_snapshot
       (market_id, sentiment, posts_24h, interactions_24h, trend, sources, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))
     ON CONFLICT (market_id) DO UPDATE SET
       sentiment = EXCLUDED.sentiment,
       posts_24h = EXCLUDED.posts_24h,
       interactions_24h = EXCLUDED.interactions_24h,
       trend = EXCLUDED.trend,
       sources = EXCLUDED.sources,
       updated_at = EXCLUDED.updated_at`,
    [asset.marketId, snapshot.sentiment, snapshot.posts24h, snapshot.interactions24h, snapshot.trend, snapshot.sources, snapshot.updatedAt]
  );
}

async function prioritizedAssets(pool: Pool): Promise<SocialBuzzAsset[]> {
  const result = await pool.query<{ market_id: string; ticker: string; display_name: string }>(
    `SELECT catalog.market_id, catalog.ticker, catalog.display_name
     FROM cardyx.asset_catalog catalog
     JOIN LATERAL (
       SELECT sum(latest.reserve_ada) AS liquidity_ada
       FROM (
         SELECT DISTINCT ON (observation.pool_id)
                observation.pool_id, observation.reserve_ada
         FROM cardyx.dex_pool_price_observation observation
         JOIN cardyx.dex_pool_registry registry USING (pool_id)
         WHERE observation.market_id = catalog.market_id
           AND registry.enabled = true
           AND observation.observed_at >= now() - interval '30 minutes'
         ORDER BY observation.pool_id, observation.observed_at DESC
       ) latest
     ) liquidity ON true
     WHERE catalog.policy_id IS NOT NULL
       AND catalog.asset_name IS NOT NULL
       AND catalog.ticker NOT IN ('ADA', 'ASSET')
       AND coalesce(liquidity.liquidity_ada, 0) >= 25
     ORDER BY liquidity.liquidity_ada DESC, catalog.market_id
     LIMIT $1`,
    [preloadLimit]
  );
  return result.rows.map((row) => ({ marketId: row.market_id, ticker: row.ticker, name: row.display_name }));
}

export async function runTokenSentimentIndexerOnce(pool: Pool): Promise<{ refreshed: number; failed: number }> {
  if (isRunning) return lastRunResult ?? { refreshed: 0, failed: 0 };
  isRunning = true;
  let refreshed = 0;
  let failed = 0;
  try {
    const assets = new Map<string, SocialBuzzAsset>(requestQueue);
    requestQueue.clear();
    for (const asset of await prioritizedAssets(pool)) assets.set(asset.marketId, asset);

    for (const asset of assets.values()) {
      try {
        const snapshot = await getTokenSocialSnapshot(asset);
        if (!snapshot) {
          failed += 1;
          continue;
        }
        await saveSnapshot(pool, asset, snapshot);
        refreshed += 1;
      } catch (error) {
        failed += 1;
        lastRunError = error instanceof Error ? error.message : String(error);
      }
    }

    lastRunAt = new Date().toISOString();
    lastRunResult = { refreshed, failed };
    if (failed === 0) lastRunError = null;
    console.log(`CARDYX Token Sentiment Indexer: refreshed=${refreshed}, failed=${failed}`);
    return lastRunResult;
  } catch (error) {
    lastRunError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    isRunning = false;
  }
}

export async function requestTokenSentimentRefresh(pool: Pool, marketId: string): Promise<boolean> {
  const result = await pool.query<{ market_id: string; ticker: string; display_name: string }>(
    `SELECT market_id, ticker, display_name
     FROM cardyx.asset_catalog
     WHERE market_id = $1 AND policy_id IS NOT NULL AND asset_name IS NOT NULL
     LIMIT 1`,
    [marketId]
  );
  const row = result.rows[0];
  if (!row) return false;

  requestQueue.set(row.market_id, { marketId: row.market_id, ticker: row.ticker, name: row.display_name });
  if (workerPool && !isRunning) {
    void runTokenSentimentIndexerOnce(workerPool).catch((error: Error) => {
      lastRunError = error.message;
      console.error('CARDYX Token Sentiment Indexer failed:', error.message);
    });
  }
  return true;
}

export function startTokenSentimentIndexer(pool: Pool, intervalMs = refreshIntervalMs): void {
  workerPool = pool;
  const run = () => runTokenSentimentIndexerOnce(pool).catch((error: Error) => {
    lastRunError = error.message;
    console.error('CARDYX Token Sentiment Indexer failed:', error.message);
  });
  setTimeout(run, 5_000);
  setInterval(run, intervalMs);
}

export function getTokenSentimentIndexerStatus() {
  return { lastRunAt, lastRunResult, lastRunError, isRunning, queued: requestQueue.size, source: 'cardyx-token-social-sentiment', refreshIntervalMs };
}