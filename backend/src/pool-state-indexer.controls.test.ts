import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPoolStateIndexerLimits, selectRoundRobinPoolIds } from './pool-state-indexer.controls';

test('pool-state work limits default low and clamp configured maxima', () => {
  assert.deepEqual(getPoolStateIndexerLimits({}), { poolsPerRun: 25, batchSize: 100, batchesPerPool: 1 });
  assert.deepEqual(getPoolStateIndexerLimits({
    CARDYX_POOL_STATE_POOLS_PER_RUN: '5000',
    CARDYX_POOL_STATE_BATCH_SIZE: '900',
    CARDYX_POOL_STATE_BATCHES_PER_POOL: '9',
  }), { poolsPerRun: 50, batchSize: 200, batchesPerPool: 2 });
  assert.deepEqual(getPoolStateIndexerLimits({ CARDYX_POOL_STATE_BATCH_SIZE: '-1' }), { poolsPerRun: 25, batchSize: 100, batchesPerPool: 1 });
});

test('pool selection rotates fairly, wraps, deduplicates and includes newly registered IDs', () => {
  const pools = ['pool-b', 'pool-a', 'pool-c', 'pool-b'];
  assert.deepEqual(selectRoundRobinPoolIds(pools, null, 2), ['pool-a', 'pool-b']);
  assert.deepEqual(selectRoundRobinPoolIds([...pools, 'pool-d'], 'pool-b', 2), ['pool-c', 'pool-d']);
  assert.deepEqual(selectRoundRobinPoolIds(pools, 'pool-c', 2), ['pool-a', 'pool-b']);
  assert.deepEqual(selectRoundRobinPoolIds([], 'pool-a', 2), []);
});