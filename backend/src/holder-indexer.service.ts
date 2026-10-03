import type { Pool } from 'pg';

interface HolderIndexRow {
  policy_id: string;
  asset_name: string;
}

const requestedJobs = new Set<string>();
const requestedQueue: HolderIndexRow[] = [];
const backgroundQueue: HolderIndexRow[] = [];
let initializationRunning = false;
let isRunning = false;
let lastRunAt: string | null = null;
let lastRunError: string | null = null;
let lastRunResult: { indexed: number; failed: number } | null = null;

const keyOf = (policyId: string, assetName: string) => `${policyId}:${assetName}`;

function scheduleInitialization(pool: Pool, policyId: string, assetName: string, background: boolean): void {
  const key = keyOf(policyId, assetName);
  if (requestedJobs.has(key)) return;
  requestedJobs.add(key);
  const job = { policy_id: policyId, asset_name: assetName };
  if (background) backgroundQueue.push(job);
  else requestedQueue.push(job);
  void drainInitializationQueue(pool);
}

async function drainInitializationQueue(pool: Pool): Promise<void> {
  if (initializationRunning) return;
  initializationRunning = true;
  try {
    while (requestedQueue.length || backgroundQueue.length) {
      const job = requestedQueue.shift() ?? backgroundQueue.shift();
      if (!job) continue;
      const key = keyOf(job.policy_id, job.asset_name);
      try {
        await pool.query('SELECT cardyx.enqueue_asset_holder_index($1, $2)', [job.policy_id, job.asset_name]);
        await pool.query('SELECT cardyx.initialize_asset_holder_index($1, $2)', [job.policy_id, job.asset_name]);
        lastRunError = null;
      } catch (error) {
        lastRunError = error instanceof Error ? error.message : String(error);
        console.error(`Holder-Snapshot fehlgeschlagen für ${key}:`, lastRunError);
      } finally {
        requestedJobs.delete(key);
      }
    }
  } finally {
    initializationRunning = false;
  }
}

export function requestHolderIndex(pool: Pool, policyId: string, assetName: string): void {
  scheduleInitialization(pool, policyId, assetName, false);
}

export async function runHolderIndexerOnce(pool: Pool): Promise<{ indexed: number; failed: number }> {
  if (isRunning) return lastRunResult ?? { indexed: 0, failed: 0 };
  isRunning = true;
  let indexed = 0;
  let failed = 0;
  try {
    const pending = await pool.query<HolderIndexRow>(
      `SELECT policy_id, asset_name
       FROM cardyx.asset_holder_index_state
       WHERE status IN ('building', 'error')
       ORDER BY updated_at ASC
      LIMIT 1`
    );
    for (const asset of pending.rows) scheduleInitialization(pool, asset.policy_id, asset.asset_name, true);

    const tracked = await pool.query<HolderIndexRow>(
      `SELECT policy_id, asset_name
       FROM cardyx.asset_holder_index_state
       WHERE status = 'ready'
       ORDER BY updated_at ASC
       LIMIT 100`
    );
    for (const asset of tracked.rows) {
      try {
        const result = await pool.query<{ advanced: boolean }>(
          'SELECT cardyx.refresh_asset_holder_index($1, $2) AS advanced',
          [asset.policy_id, asset.asset_name]
        );
        if (result.rows[0]?.advanced) indexed += 1;
      } catch (error) {
        failed += 1;
        lastRunError = error instanceof Error ? error.message : String(error);
        console.error(`Holder-Delta fehlgeschlagen für ${keyOf(asset.policy_id, asset.asset_name)}:`, lastRunError);
      }
    }
    lastRunAt = new Date().toISOString();
    lastRunResult = { indexed, failed };
    if (!failed) lastRunError = null;
    return lastRunResult;
  } finally {
    isRunning = false;
  }
}

export function startHolderIndexer(pool: Pool, intervalMs = 30_000): void {
  void pool.query('SELECT cardyx.enqueue_popular_holder_indexes($1)', [20])
    .then((result) => console.log(`CARDYX-Holder-Indexer: ${result.rows[0]?.enqueue_popular_holder_indexes ?? 0} populäre Assets zum Vorwärmen vorgemerkt.`))
    .catch((error: Error) => console.error('CARDYX-Holder-Indexer konnte populäre Assets nicht vormerken:', error.message));
  const run = () => runHolderIndexerOnce(pool).catch((error: Error) => {
    lastRunError = error.message;
    console.error('CARDYX-Holder-Indexer fehlgeschlagen:', error.message);
  });
  setTimeout(run, 10_000);
  setInterval(run, intervalMs);
}

export function getHolderIndexStatus() {
  return { lastRunAt, lastRunResult, lastRunError, isRunning, isInitializing: initializationRunning, activeInitializations: requestedJobs.size, mode: 'cardyx-holder-indexer' };
}
