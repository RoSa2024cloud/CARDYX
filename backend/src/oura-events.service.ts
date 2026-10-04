import { createHash, timingSafeEqual } from 'node:crypto';
import { Router, type Request } from 'express';
import type { Pool } from 'pg';

export interface OuraChainPoint {
  slot: number;
  hash: string;
}

export interface OuraChainEvent {
  event: 'apply' | 'undo' | 'reset';
  point: OuraChainPoint | null;
  record: Record<string, unknown> | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function describeOuraEventShape(value: unknown): string {
  if (!isRecord(value)) return `body=${Array.isArray(value) ? 'array' : typeof value}`;
  const point = isRecord(value.point) ? value.point : null;
  const record = isRecord(value.record) ? value.record : null;
  return JSON.stringify({
    keys: Object.keys(value).slice(0, 16),
    eventType: typeof value.event === 'string' ? value.event : typeof value.event,
    pointType: value.point === null ? 'null' : typeof value.point,
    slotType: point ? typeof point.slot : null,
    hashType: point ? typeof point.hash : null,
    hashLength: point && typeof point.hash === 'string' ? point.hash.length : null,
    recordType: value.record === null ? 'null' : typeof value.record,
    recordKeys: record ? Object.keys(record).slice(0, 12) : null,
  });
}

export function parseOuraChainEvent(value: unknown): OuraChainEvent | null {
  if (!isRecord(value) || !['apply', 'undo', 'reset'].includes(String(value.event))) return null;

  let point: OuraChainPoint | null = null;
  if (value.point !== null) {
    if (!isRecord(value.point)
      || !Number.isSafeInteger(value.point.slot)
      || Number(value.point.slot) < 0
      || typeof value.point.hash !== 'string'
      || !/^[a-f0-9]{64}$/i.test(value.point.hash)) return null;
    point = { slot: Number(value.point.slot), hash: value.point.hash.toLowerCase() };
  } else if (value.event !== 'reset') {
    return null;
  }

  if (value.event !== 'reset' && !isRecord(value.record)) return null;
  if (value.event === 'reset' && value.record != null) return null;

  return {
    event: value.event as OuraChainEvent['event'],
    point,
    record: isRecord(value.record) ? value.record : null,
  };
}

export function parseOuraWebhookEvent(action: string | undefined, pointHeader: string | undefined, record: unknown): OuraChainEvent | null {
  if (!action || !['apply', 'undo', 'reset'].includes(action)) return null;
  if (action === 'reset' && pointHeader === 'origin') return { event: 'reset', point: null, record: null };
  const pointMatch = /^(\d+),([a-f0-9]{64})$/i.exec(pointHeader ?? '');
  if (!pointMatch || !isRecord(record)) return null;
  const slot = Number(pointMatch[1]);
  if (!Number.isSafeInteger(slot) || slot < 0) return null;
  return {
    event: action as OuraChainEvent['event'],
    point: { slot, hash: pointMatch[2]!.toLowerCase() },
    record,
  };
}

export function authorizeOuraRequest(request: Request, token: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(token)) return false;
  const authorization = request.get('authorization') ?? '';
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization);
  if (!match) return false;
  const expected = Buffer.from(token, 'hex');
  const supplied = Buffer.from(match[1]!, 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export async function persistOuraChainEvent(pool: Pool, event: OuraChainEvent): Promise<void> {
  const eventId = createHash('sha256').update(JSON.stringify(event)).digest('hex');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    if (event.event === 'undo' && event.point) {
      await client.query(
        `UPDATE cardyx.oura_event_journal
         SET is_canonical = false
         WHERE event_type = 'apply' AND is_canonical = true AND slot = $1 AND block_hash = $2`,
        [event.point.slot, event.point.hash]
      );
    } else if (event.event === 'reset') {
      if (event.point) {
        await client.query(
          `UPDATE cardyx.oura_event_journal
           SET is_canonical = false
           WHERE event_type = 'apply' AND is_canonical = true
             AND (slot > $1 OR (slot = $1 AND block_hash <> $2))`,
          [event.point.slot, event.point.hash]
        );
      } else {
        await client.query(
          `UPDATE cardyx.oura_event_journal
           SET is_canonical = false
           WHERE event_type = 'apply' AND is_canonical = true`
        );
      }
    }

    await client.query(
      `INSERT INTO cardyx.oura_event_journal
         (event_id, event_type, slot, block_hash, record, is_canonical)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (event_id) DO UPDATE
       SET is_canonical = EXCLUDED.is_canonical, received_at = now()`,
      [
        eventId,
        event.event,
        event.point?.slot ?? null,
        event.point?.hash ?? null,
        event.record === null ? null : JSON.stringify(event.record),
        false,
      ]
    );
    await client.query('SELECT cardyx.reconcile_oura_event_journal_canonicality()');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

let canonicalityCheckRunning = false;

export function startOuraJournalCanonicalizer(pool: Pool, intervalMs = 5_000): void {
  const reconcile = async () => {
    if (canonicalityCheckRunning) return;
    canonicalityCheckRunning = true;
    try {
      await pool.query('SELECT cardyx.reconcile_oura_event_journal_canonicality()');
    } catch (error) {
      console.error('Oura canonicality reconciliation failed:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      canonicalityCheckRunning = false;
    }
  };

  void reconcile();
  const timer = setInterval(() => void reconcile(), intervalMs);
  timer.unref();
}

export function createOuraEventsRouter(pool: Pool, getToken = () => process.env.CARDYX_OURA_WEBHOOK_TOKEN ?? '') {
  const router = Router();
  router.post('/', async (request, response) => {
    const token = getToken();
    if (!token) return response.status(503).json({ success: false, error: 'Oura event sink is not configured.' });
    if (!authorizeOuraRequest(request, token)) return response.status(401).json({ success: false, error: 'Unauthorized.' });

    const webhookAction = request.get('x-oura-chainsync-action');
    const webhookPoint = request.get('x-oura-chainsync-point');
    const event = webhookAction || webhookPoint
      ? parseOuraWebhookEvent(webhookAction, webhookPoint, request.body)
      : parseOuraChainEvent(request.body);
    if (!event) {
      console.warn('Oura event rejected due to invalid envelope:', describeOuraEventShape(request.body));
      return response.status(400).json({ success: false, error: 'Invalid chain event.' });
    }

    try {
      await persistOuraChainEvent(pool, event);
      return response.status(200).json({ success: true });
    } catch (error) {
      console.error('Oura event persistence failed:', error instanceof Error ? error.message : 'Unknown error');
      return response.status(503).json({ success: false, error: 'Event persistence unavailable.' });
    }
  });
  return router;
}