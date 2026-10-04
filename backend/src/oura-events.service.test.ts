import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { Pool } from 'pg';
import { authorizeOuraRequest, createOuraEventsRouter, parseOuraChainEvent, parseOuraWebhookEvent, persistOuraChainEvent } from './oura-events.service';

const token = 'a'.repeat(64);
const point = { slot: 42, hash: 'b'.repeat(64) };

test('Oura events validate apply, undo, and origin reset envelopes', () => {
  assert.deepEqual(parseOuraChainEvent({ event: 'apply', point, record: { body: {} } }), { event: 'apply', point, record: { body: {} } });
  assert.deepEqual(parseOuraChainEvent({ event: 'undo', point, record: { body: {} } }), { event: 'undo', point, record: { body: {} } });
  assert.deepEqual(parseOuraChainEvent({ event: 'reset', point: null, record: null }), { event: 'reset', point: null, record: null });
  assert.equal(parseOuraChainEvent({ event: 'apply', point: null, record: {} }), null);
  assert.equal(parseOuraChainEvent({ event: 'undo', point: { slot: -1, hash: point.hash }, record: {} }), null);
  assert.equal(parseOuraChainEvent({ event: 'reset', point, record: {} }), null);
});

test('Oura webhook authorization uses a fixed-size bearer token comparison', () => {
  const request = { get: (name: string) => name === 'authorization' ? `Bearer ${token}` : undefined } as never;
  assert.equal(authorizeOuraRequest(request, token), true);
  assert.equal(authorizeOuraRequest({ get: () => `Bearer ${'b'.repeat(64)}` } as never, token), false);
  assert.equal(authorizeOuraRequest({ get: () => token } as never, token), false);
});

test('Oura v2 webhook uses action and point headers with a record-only JSON body', () => {
  const record = { inputs: [], outputs: [] };
  assert.deepEqual(parseOuraWebhookEvent('apply', `${point.slot},${point.hash}`, record), { event: 'apply', point, record });
  assert.deepEqual(parseOuraWebhookEvent('undo', `${point.slot},${point.hash}`, record), { event: 'undo', point, record });
  assert.equal(parseOuraWebhookEvent('apply', 'origin', record), null);
  assert.equal(parseOuraWebhookEvent('apply', `${point.slot},bad-hash`, record), null);
  assert.equal(parseOuraWebhookEvent('unknown', `${point.slot},${point.hash}`, record), null);
});

test('Oura apply is stored transactionally and retries remain idempotent by event id', async () => {
  const statements: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => { statements.push({ sql, values }); return { rows: [], rowCount: 1 }; },
    release: () => undefined,
  };
  const pool = { connect: async () => client } as unknown as Pool;
  const event = { event: 'apply' as const, point, record: { body: { outputs: [] } } };

  await persistOuraChainEvent(pool, event);
  await persistOuraChainEvent(pool, event);

  assert.deepEqual(statements.map((entry) => entry.sql), ['BEGIN', expectInsert, expectReconcile, 'COMMIT', 'BEGIN', expectInsert, expectReconcile, 'COMMIT']);
  assert.deepEqual(statements[1]?.values, statements[5]?.values);
  assert.match(statements[1]?.sql ?? '', /ON CONFLICT \(event_id\) DO UPDATE/);
});

const expectInsert = `INSERT INTO cardyx.oura_event_journal
         (event_id, event_type, slot, block_hash, record, is_canonical)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (event_id) DO UPDATE
       SET is_canonical = EXCLUDED.is_canonical, received_at = now()`;
const expectReconcile = 'SELECT cardyx.reconcile_oura_event_journal_canonicality()';

test('Oura undo marks the affected block non-canonical before journaling the undo', async () => {
  const statements: string[] = [];
  const client = {
    query: async (sql: string) => { statements.push(sql); return { rows: [], rowCount: 1 }; },
    release: () => undefined,
  };
  const pool = { connect: async () => client } as unknown as Pool;
  await persistOuraChainEvent(pool, { event: 'undo', point, record: { body: {} } });
  assert.equal(statements[0], 'BEGIN');
  assert.match(statements[1] ?? '', /SET is_canonical = false/);
  assert.match(statements[2] ?? '', /INSERT INTO cardyx\.oura_event_journal/);
  assert.equal(statements[3], expectReconcile);
  assert.equal(statements[4], 'COMMIT');
});

test('Oura webhook rejects unauthorized events and accepts valid event envelopes', async () => {
  const calls: string[] = [];
  const client = {
    query: async (sql: string) => { calls.push(sql); return { rows: [], rowCount: 1 }; },
    release: () => undefined,
  };
  const pool = { connect: async () => client } as unknown as Pool;
  const app = express();
  app.use('/api/internal/oura/events', express.json({ limit: '2mb' }), createOuraEventsRouter(pool, () => token));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const endpoint = `http://127.0.0.1:${address.port}/api/internal/oura/events`;

  try {
    const body = JSON.stringify({ inputs: [], outputs: [] });
    const eventHeaders = { 'content-type': 'application/json', 'x-oura-chainsync-action': 'apply', 'x-oura-chainsync-point': `${point.slot},${point.hash}` };
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { ...eventHeaders, authorization: `Bearer ${'b'.repeat(64)}` }, body })).status, 401);
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { ...eventHeaders, authorization: `Bearer ${token}` }, body })).status, 200);
    assert.ok(calls.includes('COMMIT'));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});