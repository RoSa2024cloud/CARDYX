export interface PoolStateIndexerLimits {
  poolsPerRun: number;
  batchSize: number;
  batchesPerPool: number;
}

function boundedPositiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function getPoolStateIndexerLimits(environment: NodeJS.ProcessEnv = process.env): PoolStateIndexerLimits {
  return {
    poolsPerRun: boundedPositiveInteger(environment.CARDYX_POOL_STATE_POOLS_PER_RUN, 25, 50),
    batchSize: boundedPositiveInteger(environment.CARDYX_POOL_STATE_BATCH_SIZE, 100, 200),
    batchesPerPool: boundedPositiveInteger(environment.CARDYX_POOL_STATE_BATCHES_PER_POOL, 1, 2),
  };
}

export function selectRoundRobinPoolIds(poolIds: string[], lastPoolId: string | null, limit: number): string[] {
  const sorted = [...new Set(poolIds)].sort();
  if (sorted.length === 0 || limit <= 0) return [];
  const start = lastPoolId === null ? 0 : Math.max(0, sorted.findIndex((poolId) => poolId > lastPoolId));
  const count = Math.min(Math.floor(limit), sorted.length);
  return Array.from({ length: count }, (_, offset) => sorted[(start + offset) % sorted.length]!);
}