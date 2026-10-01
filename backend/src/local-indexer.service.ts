import type { Pool } from 'pg';

interface AssetMetadataRecord {
  policyId: string;
  assetName: string;
  name: string | undefined;
  ticker: string | undefined;
  description: string | undefined;
  imageUrl: string | undefined;
  officialUrl: string | undefined;
  decimals: number | undefined;
  source: 'cardyx-cip25' | 'cardano-token-registry';
}

let lastRunAt: string | null = null;
let lastRunResult: { catalog: number; metadata: number; registry: number; balances: number } | null = null;
let lastRunError: string | null = null;
let runPhase: 'idle' | 'metadata' | 'balances' = 'idle';
let isRunning = false;

function textValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join('').trim() || undefined;
  return undefined;
}

function imageValue(value: unknown): string | undefined {
  const image = textValue(value);
  if (!image) return undefined;
  if (image.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${image.slice(7)}`;
  if (image.startsWith('ar://')) return `https://arweave.net/${image.slice(5)}`;
  return image;
}

function isHex(value: string): boolean {
  return /^[a-f0-9]+$/i.test(value) && value.length > 0;
}

function collectMetadata(value: unknown, policyId?: string, records: AssetMetadataRecord[] = []): AssetMetadataRecord[] {
  if (!value || typeof value !== 'object') return records;
  const entries = Object.entries(value as Record<string, unknown>);

  for (const [key, child] of entries) {
    if (key === '721' && child && typeof child === 'object') {
      collectMetadata(child, undefined, records);
      continue;
    }

    if (policyId && isHex(key) && child && typeof child === 'object') {
      const fields = child as Record<string, unknown>;
      records.push({
        policyId: policyId.toLowerCase(),
        assetName: key.toLowerCase(),
        name: textValue(fields.name),
        ticker: textValue(fields.ticker),
        description: textValue(fields.description),
        imageUrl: imageValue(fields.image),
        officialUrl: textValue(fields.url),
        decimals: fields.decimals == null ? undefined : Number(fields.decimals),
        source: 'cardyx-cip25',
      });
      continue;
    }

    if (isHex(key) && child && typeof child === 'object') {
      collectMetadata(child, key, records);
    }
  }

  return records;
}

function registryValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'value' in value) {
    return (value as { value?: unknown }).value;
  }
  return value;
}

function registryMetadata(json: unknown, policyId: string, assetName: string): AssetMetadataRecord | null {
  if (!json || typeof json !== 'object') return null;
  const payload = json as Record<string, unknown>;
  const expectedSubject = `${policyId}${assetName}`.toLowerCase();
  const subject = textValue(payload.subject)?.toLowerCase();
  if (subject && subject !== expectedSubject) return null;

  const logo = textValue(registryValue(payload.logo));
  const imageUrl = logo
    ? logo.startsWith('data:image/') ? logo : `data:image/png;base64,${logo}`
    : undefined;
  const rawDecimals = registryValue(payload.decimals);
  const parsedDecimals = rawDecimals == null ? undefined : Number(rawDecimals);
  const decimals = parsedDecimals !== undefined && Number.isInteger(parsedDecimals) && parsedDecimals >= 0 && parsedDecimals <= 255
    ? parsedDecimals
    : undefined;

  return {
    policyId,
    assetName,
    name: textValue(registryValue(payload.name)),
    ticker: textValue(registryValue(payload.ticker)),
    description: textValue(registryValue(payload.description)),
    imageUrl,
    officialUrl: textValue(registryValue(payload.url)),
    decimals,
    source: 'cardano-token-registry',
  };
}

async function fetchRegistryMetadata(policyId: string, assetName: string): Promise<AssetMetadataRecord | null> {
  const subject = `${policyId}${assetName}`.toLowerCase();
  const response = await fetch(`https://tokens.cardano.org/metadata/${encodeURIComponent(subject)}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(6_000),
  });
  if (response.status === 404 || response.status === 204) return null;
  if (!response.ok) throw new Error(`Cardano token registry HTTP ${response.status}`);
  const body = await response.text();
  if (!body.trim()) return null;
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error('Cardano token registry returned invalid JSON.');
  }
  return registryMetadata(json, policyId.toLowerCase(), assetName.toLowerCase());
}

async function saveMetadataRecord(pool: Pool, record: AssetMetadataRecord): Promise<void> {
  await pool.query(
    `INSERT INTO cardyx.asset_metadata
       (policy_id, asset_name, ticker, display_name, description, decimals, image_url, source, updated_at)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, now()
     WHERE EXISTS (
       SELECT 1 FROM cardyx.asset_catalog
       WHERE policy_id = $1 AND asset_name = $2
     )
     ON CONFLICT (policy_id, asset_name)
     DO UPDATE SET
       ticker = CASE WHEN EXCLUDED.source = 'cardano-token-registry'
                     THEN COALESCE(cardyx.asset_metadata.ticker, EXCLUDED.ticker)
                     ELSE COALESCE(EXCLUDED.ticker, cardyx.asset_metadata.ticker) END,
       display_name = CASE WHEN EXCLUDED.source = 'cardano-token-registry'
                           THEN COALESCE(cardyx.asset_metadata.display_name, EXCLUDED.display_name)
                           ELSE COALESCE(EXCLUDED.display_name, cardyx.asset_metadata.display_name) END,
       description = CASE WHEN EXCLUDED.source = 'cardano-token-registry'
                          THEN COALESCE(cardyx.asset_metadata.description, EXCLUDED.description)
                          ELSE COALESCE(EXCLUDED.description, cardyx.asset_metadata.description) END,
       decimals = CASE WHEN EXCLUDED.source = 'cardano-token-registry'
                       THEN COALESCE(cardyx.asset_metadata.decimals, EXCLUDED.decimals)
                       ELSE COALESCE(EXCLUDED.decimals, cardyx.asset_metadata.decimals) END,
       image_url = CASE WHEN EXCLUDED.source = 'cardano-token-registry'
                        THEN COALESCE(cardyx.asset_metadata.image_url, EXCLUDED.image_url)
                        ELSE COALESCE(EXCLUDED.image_url, cardyx.asset_metadata.image_url) END,
       source = CASE WHEN EXCLUDED.source = 'cardyx-cip25' THEN EXCLUDED.source
                     ELSE COALESCE(cardyx.asset_metadata.source, EXCLUDED.source) END,
       updated_at = now()`,
    [record.policyId, record.assetName, record.ticker ?? null, record.name ?? null, record.description ?? null,
      record.decimals ?? null, record.imageUrl ?? null, record.source]
  );

  await pool.query(
    `UPDATE cardyx.asset_catalog
     SET ticker = CASE WHEN ticker = 'ASSET' THEN COALESCE($3, ticker) ELSE ticker END,
         display_name = CASE WHEN display_name LIKE 'Cardano Asset %' THEN COALESCE($4, display_name) ELSE display_name END,
         logo_url = COALESCE(logo_url, $5),
         official_url = COALESCE(official_url, $6),
         decimals = COALESCE(decimals, $7),
         updated_at = now()
     WHERE policy_id = $1 AND asset_name = $2`,
    [record.policyId, record.assetName, record.ticker ?? null, record.name ?? null, record.imageUrl ?? null,
      record.officialUrl ?? null, record.decimals ?? null]
  );
}

async function enrichFromTokenRegistry(pool: Pool, batchSize = 100): Promise<number> {
  const candidates = await pool.query<{ policy_id: string; asset_name: string }>(
    `SELECT catalog.policy_id, catalog.asset_name
     FROM cardyx.asset_catalog catalog
     LEFT JOIN cardyx.asset_metadata metadata
       ON metadata.policy_id = catalog.policy_id AND metadata.asset_name = catalog.asset_name
     LEFT JOIN cardyx.asset_registry_lookup checked
       ON checked.policy_id = catalog.policy_id AND checked.asset_name = catalog.asset_name
     WHERE catalog.policy_id IS NOT NULL
       AND catalog.asset_name IS NOT NULL
       AND (catalog.ticker = 'ASSET'
         OR catalog.display_name LIKE 'Cardano Asset %'
         OR catalog.logo_url IS NULL
         OR COALESCE(catalog.decimals, metadata.decimals) IS NULL)
       AND (checked.checked_at IS NULL OR checked.checked_at < now() - interval '30 days')
     ORDER BY catalog.created_at DESC, catalog.id DESC
     LIMIT $1`,
    [batchSize]
  );

  let candidateIndex = 0;
  let imported = 0;
  const workerCount = Math.min(4, candidates.rows.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (candidateIndex < candidates.rows.length) {
      const candidate = candidates.rows[candidateIndex++];
      if (!candidate) continue;
      try {
        const record = await fetchRegistryMetadata(candidate.policy_id, candidate.asset_name);
        await pool.query(
          `INSERT INTO cardyx.asset_registry_lookup (policy_id, asset_name, checked_at, found)
           VALUES ($1, $2, now(), $3)
           ON CONFLICT (policy_id, asset_name) DO UPDATE
           SET checked_at = now(), found = EXCLUDED.found`,
          [candidate.policy_id, candidate.asset_name, record !== null]
        );
        if (record) {
          await saveMetadataRecord(pool, record);
          imported += 1;
        }
      } catch (error) {
        console.warn(`Cardano Token Registry lookup failed for ${candidate.policy_id}:${candidate.asset_name}: ${(error as Error).message}`);
      }
    }
  }));
  return imported;
}

export async function runLocalIndexerOnce(pool: Pool): Promise<{ catalog: number; metadata: number; registry: number; balances: number }> {
  if (isRunning) return lastRunResult ?? { catalog: 0, metadata: 0, registry: 0, balances: 0 };
  isRunning = true;
  runPhase = 'metadata';
  try {
    const catalog = 0;

    const metadataRows = await pool.query<{ json: unknown }>(
      `SELECT json
     FROM cardyx.tx_metadata_index
     WHERE json IS NOT NULL
     ORDER BY id DESC
     LIMIT 5000`
    );

    const records = new Map<string, AssetMetadataRecord>();
    for (const row of metadataRows.rows) {
      for (const record of collectMetadata(row.json)) {
        const key = `${record.policyId}:${record.assetName}`;
        if (!records.has(key)) records.set(key, record);
      }
    }

    for (const record of records.values()) {
      await saveMetadataRecord(pool, record);
    }

    const registry = await enrichFromTokenRegistry(pool, 100);

    runPhase = 'balances';
    const balanceResult = await pool.query<{ refreshed: string }>(
      'SELECT cardyx.refresh_asset_balances()::text AS refreshed'
    );
    const balances = Number(balanceResult.rows[0]?.refreshed ?? 0);
    await pool.query(
      `INSERT INTO cardyx.asset_holder_history (policy_id, asset_name, day, holder_count, utxo_count, circulating_quantity, recorded_at)
       SELECT policy_id, asset_name, (now() AT TIME ZONE 'UTC')::date, holder_count, utxo_count, circulating_quantity, now()
       FROM cardyx.asset_balance_snapshot
       ON CONFLICT (policy_id, asset_name, day) DO UPDATE SET
         holder_count = EXCLUDED.holder_count,
         utxo_count = EXCLUDED.utxo_count,
         circulating_quantity = EXCLUDED.circulating_quantity,
         recorded_at = EXCLUDED.recorded_at`
    ).catch((error: Error) => console.warn('Holder-Historie konnte nicht gespeichert werden:', error.message));

    lastRunAt = new Date().toISOString();
    lastRunResult = { catalog, metadata: records.size, registry, balances };
    lastRunError = null;
    console.log(`✅ CARDYX-Local-Indexer abgeschlossen: catalog=${catalog}, metadata=${records.size}, registry=${registry}, balances=${balances}`);
    return lastRunResult;
  } catch (error) {
    lastRunError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    runPhase = 'idle';
    isRunning = false;
  }
}

export function startLocalIndexer(pool: Pool, intervalMs = 15 * 60 * 1000): void {
  const run = () => runLocalIndexerOnce(pool).catch((error: Error) => {
    lastRunError = error.message;
    runPhase = 'idle';
    console.error('CARDYX-Local-Indexer fehlgeschlagen:', error.message);
  });

  setTimeout(run, 2_000);
  setInterval(run, intervalMs);
}

export function getLocalIndexerStatus() {
  return { lastRunAt, lastRunResult, lastRunError, isRunning, runPhase, mode: 'cardyx-local' };
}
