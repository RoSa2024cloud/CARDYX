import express from 'express';
import pg from 'pg';
import { createHash } from 'node:crypto';
import 'dotenv/config';
import { type MarketToken } from './market.service';
import { getWalletAnalysis } from './wallet.service';
import {
  addSwapSignatures,
  buildLimitOrder,
  buildSwap,
  cancelDexhunterOrder,
  createDcaOrder,
  dexhunterConfigured,
  getDexhunterCandles,
  getDexhunterOrderBook,
  estimateLimitOrder,
  estimateSwap,
  getDcaOrders,
  searchDexhunterTokens,
} from './dexhunter.service';
import { getLocalIndexerStatus, runLocalIndexerOnce, startLocalIndexer } from './local-indexer.service';
import { getDexIndexerStatus, getLocalAdaUsd, runDexIndexerOnce, startDexIndexer } from './dex-indexer.service';
import { getPoolStateIndexerStatus, startPoolStateIndexer } from './pool-state-indexer.service';
import { getCardanoMarketSummary } from './market-summary.service';
import cors from 'cors';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 4000;
const initializeDatabase = process.env.INITIALIZE_DATABASE !== 'false';
const CARDYX_MARKET_SOURCE = process.env.CARDYX_MARKET_SOURCE ?? 'cardyx-local';
const CARDYX_TRADE_PROVIDER = process.env.CARDYX_TRADE_PROVIDER ?? (dexhunterConfigured() ? 'dexhunter' : 'none');
const CONFIGURED_ADA_USD = Number(process.env.CARDYX_ADA_USD ?? 0.35);
const adaUsd = () => getLocalAdaUsd()?.priceUsd ?? (Number.isFinite(CONFIGURED_ADA_USD) ? CONFIGURED_ADA_USD : 0.35);

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function convertBits(data: Uint8Array, fromBits: number, toBits: number): number[] {
  let accumulator = 0;
  let bits = 0;
  const output: number[] = [];
  const maxValue = (1 << toBits) - 1;

  for (const value of data) {
    accumulator = (accumulator << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      output.push((accumulator >> bits) & maxValue);
    }
  }

  if (bits > 0) output.push((accumulator << (toBits - bits)) & maxValue);
  return output;
}

function bech32Polymod(values: number[]): number {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let bit = 0; bit < 5; bit++) {
      if ((top >>> bit) & 1) checksum ^= generators[bit] ?? 0;
    }
  }
  return checksum >>> 0;
}

function cardanoAssetFingerprint(policyId: string | null, assetName: string | null): string | null {
  if (!policyId || !assetName || !/^[a-f0-9]+$/i.test(policyId + assetName)) return null;
  const digest = createHash('blake2b512').update(Buffer.from(policyId + assetName, 'hex')).digest().subarray(0, 20);
  const prefix = 'asset';
  const words = convertBits(digest, 8, 5);
  const prefixWords = Array.from(prefix).map((character) => character.charCodeAt(0) >> 5);
  const prefixRemainder = Array.from(prefix).map((character) => character.charCodeAt(0) & 31);
  const checksum = bech32Polymod([...prefixWords, 0, ...prefixRemainder, ...words, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksumWords = Array.from({ length: 6 }, (_, index) => (checksum >>> (5 * (5 - index))) & 31);
  return `${prefix}1${[...words, ...checksumWords].map((word) => BECH32_CHARSET[word]).join('')}`;
}

// Datenbankverbindung: Online via DATABASE_URL (z.B. Railway/Neon),
// lokal mit Docker-Compose-Fallback. Secrets niemals im Code!
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://cardyx_admin:secret_local_password@localhost:5432/cardyx_dev?schema=public';

const databaseHost = new URL(DATABASE_URL).hostname;
const useDatabaseSsl = !['localhost', '127.0.0.1', '::1', 'postgres'].includes(databaseHost);

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Managed-Postgres-Anbieter (Railway, Neon, Supabase) verlangen SSL
  ssl: useDatabaseSsl ? { rejectUnauthorized: false } : false,
});

app.use(express.json());

// CORS: Online nur die Frontend-Domain erlauben, lokal alles offen.
const ALLOWED_ORIGINS = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((o) => o.trim())
  : '*';
app.use(
  cors(
    ALLOWED_ORIGINS === '*'
      ? {}
      : {
          origin: (origin, callback) => {
            // Server-zu-Server (kein Origin) und erlaubte Domains durchlassen
            if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
            callback(new Error(`CORS blockiert: ${origin}`));
          },
        }
  )
);

// Diese Funktion prüft beim Starten des Backends, ob die Tabelle existiert, und legt sie bei Bedarf an
async function initDatabase() {
  try {
    // 1. Bestehende Token-Tabelle prüfen/anlegen
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Token" (
        "id" TEXT PRIMARY KEY,
        "policyId" TEXT UNIQUE NOT NULL,
        "assetName" TEXT NOT NULL,
        "ticker" TEXT,
        "priceAda" DOUBLE PRECISION DEFAULT 0.0,
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        "createdAt" TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. NEU FÜR VARIANTE B: Wallet-Tabelle prüfen/anlegen
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Wallet" (
        "id" TEXT PRIMARY KEY,
        "address" TEXT UNIQUE NOT NULL,      -- Die lange Cardano-Adresse (addr1...)
        "stakeAddress" TEXT,                 -- Der Staking-Key (stake1...) für Pool-Analysen
        "label" TEXT,                        -- Custom Name (z.B. "Smart Money", "SNEK Whale")
        "lastChecked" TIMESTAMP DEFAULT NOW(),
        "createdAt" TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cardyx.community_message (
        id bigserial PRIMARY KEY,
        channel text NOT NULL DEFAULT 'general',
        author_name text NOT NULL,
        body text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (char_length(author_name) BETWEEN 2 AND 32),
        CHECK (char_length(body) BETWEEN 1 AND 1000)
      );
      CREATE INDEX IF NOT EXISTS community_message_channel_created_idx
        ON cardyx.community_message (channel, created_at DESC);
      GRANT SELECT, INSERT ON cardyx.community_message TO cardyx_api;
      GRANT USAGE, SELECT ON SEQUENCE cardyx.community_message_id_seq TO cardyx_api;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cardyx.asset_price_snapshot (
        market_id text PRIMARY KEY,
        policy_id text,
        asset_name text,
        price_ada numeric NOT NULL DEFAULT 0,
        price_usd numeric NOT NULL DEFAULT 0,
        source text NOT NULL DEFAULT 'cardyx-local',
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS asset_price_snapshot_policy_name_idx
      ON cardyx.asset_price_snapshot (policy_id, asset_name);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cardyx.dex_pool_price_observation (
        pool_id text NOT NULL,
        market_id text NOT NULL,
        policy_id text,
        asset_name text,
        reserve_ada numeric NOT NULL DEFAULT 0,
        reserve_asset numeric NOT NULL DEFAULT 0,
        price_ada numeric NOT NULL DEFAULT 0,
        observed_at timestamptz NOT NULL DEFAULT now(),
        source text NOT NULL DEFAULT 'cardyx-local-pool-indexer',
        PRIMARY KEY (pool_id, market_id)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS dex_pool_price_observation_market_idx
      ON cardyx.dex_pool_price_observation (market_id, observed_at DESC);
    `);

    await pool.query(`
      GRANT SELECT, INSERT, UPDATE ON cardyx.dex_pool_price_observation TO cardyx_api;
    `);

    await pool.query(`
      ALTER TABLE cardyx.asset_catalog
        ADD COLUMN IF NOT EXISTS fingerprint text,
        ADD COLUMN IF NOT EXISTS decimals integer;
    `);

    await pool.query(`
      UPDATE cardyx.asset_catalog c
      SET fingerprint = ma.fingerprint,
          updated_at = now()
      FROM public.multi_asset ma
      WHERE c.policy_id IS NOT NULL
        AND c.asset_name IS NOT NULL
        AND encode(ma.policy, 'hex') = c.policy_id
        AND encode(ma.name, 'hex') = c.asset_name
        AND c.fingerprint IS DISTINCT FROM ma.fingerprint;
    `);

    await pool.query(`
      CREATE OR REPLACE VIEW cardyx.asset_catalog_identity_public AS
      SELECT market_id, policy_id, asset_name, fingerprint, decimals
      FROM cardyx.asset_catalog;
    `);

    await pool.query(`
      GRANT SELECT ON cardyx.asset_catalog_identity_public TO cardyx_api;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cardyx.asset_metadata (
        policy_id text NOT NULL,
        asset_name text NOT NULL,
        ticker text,
        display_name text,
        description text,
        decimals integer,
        image_url text,
        source text NOT NULL DEFAULT 'cardyx-local-metadata-indexer',
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (policy_id, asset_name)
      );
    `);

    await pool.query(`
      GRANT SELECT, INSERT, UPDATE ON cardyx.asset_metadata TO cardyx_api;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cardyx.asset_market_snapshot (
        market_id text NOT NULL,
        observed_at timestamptz NOT NULL DEFAULT now(),
        price_ada numeric NOT NULL DEFAULT 0,
        price_usd numeric NOT NULL DEFAULT 0,
        volume_24h_ada numeric NOT NULL DEFAULT 0,
        volume_24h_usd numeric NOT NULL DEFAULT 0,
        market_cap_ada numeric NOT NULL DEFAULT 0,
        market_cap_usd numeric NOT NULL DEFAULT 0,
        fdv_ada numeric NOT NULL DEFAULT 0,
        fdv_usd numeric NOT NULL DEFAULT 0,
        change_24h numeric NOT NULL DEFAULT 0,
        change_7d numeric NOT NULL DEFAULT 0,
        high_24h_usd numeric NOT NULL DEFAULT 0,
        low_24h_usd numeric NOT NULL DEFAULT 0,
        source text NOT NULL DEFAULT 'cardyx-local-market-indexer',
        PRIMARY KEY (market_id, observed_at)
      );
      CREATE TABLE IF NOT EXISTS cardyx.asset_market_candle (
        market_id text NOT NULL,
        timeframe text NOT NULL,
        bucket_start timestamptz NOT NULL,
        open numeric NOT NULL DEFAULT 0,
        high numeric NOT NULL DEFAULT 0,
        low numeric NOT NULL DEFAULT 0,
        close numeric NOT NULL DEFAULT 0,
        volume_ada numeric NOT NULL DEFAULT 0,
        source text NOT NULL DEFAULT 'cardyx-local-market-indexer',
        PRIMARY KEY (market_id, timeframe, bucket_start)
      );
      GRANT SELECT, INSERT, UPDATE ON cardyx.asset_market_snapshot TO cardyx_api;
      GRANT SELECT, INSERT, UPDATE ON cardyx.asset_market_candle TO cardyx_api;
    `);

    // Löscht einmalig den blockierenden Test-Eintrag aus der Datenbank
    await pool.query('DELETE FROM "Token" WHERE id = \'test-snek-id\';');

    console.log('✅ PostgreSQL-Tabellen-Validierung erfolgreich! (Token & Wallet bereit)');
  } catch (err: any) {
    console.error('❌ Fehler bei der Tabellen-Initialisierung:', err.message);
  }
}
if (initializeDatabase) {
  initDatabase();
}

if (process.env.RUN_LOCAL_INDEXER !== 'false') {
  startLocalIndexer(pool);
}

if (process.env.RUN_DEX_INDEXER !== 'false') {
  startDexIndexer(pool);
}

if (process.env.RUN_POOL_STATE_INDEXER !== 'false') {
  startPoolStateIndexer(pool);
}

// System-Status Route
app.get('/', (req, res) => {
  res.json({ status: 'online', message: 'CARDYX Backend läuft fehlerfrei mit nativem PG-Treiber!' });
});

app.get('/api/community/messages', async (req, res) => {
  const channel = typeof req.query.channel === 'string' && /^[a-z0-9-]{1,32}$/.test(req.query.channel)
    ? req.query.channel
    : 'general';
  try {
    const result = await pool.query(
      `SELECT id, channel, author_name, body, created_at
       FROM cardyx.community_message
       WHERE channel = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [channel]
    );
    res.json({ success: true, data: result.rows.reverse(), source: 'cardyx-community' });
  } catch (error: any) {
    console.error('Fehler beim Lesen des CARDYX-Community-Chats:', error.message);
    res.status(503).json({ success: false, error: 'Community-Chat ist aktuell nicht verfügbar.' });
  }
});

app.post('/api/community/messages', async (req, res) => {
  const channel = typeof req.body?.channel === 'string' && /^[a-z0-9-]{1,32}$/.test(req.body.channel)
    ? req.body.channel
    : 'general';
  const authorName = typeof req.body?.authorName === 'string' ? req.body.authorName.trim() : '';
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (authorName.length < 2 || authorName.length > 32 || body.length < 1 || body.length > 1000) {
    return res.status(400).json({ success: false, error: 'Name oder Nachricht ist ungültig.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO cardyx.community_message (channel, author_name, body)
       VALUES ($1, $2, $3)
       RETURNING id, channel, author_name, body, created_at`,
      [channel, authorName, body]
    );
    res.status(201).json({ success: true, data: result.rows[0], source: 'cardyx-community' });
  } catch (error: any) {
    console.error('Fehler beim Schreiben in den CARDYX-Community-Chat:', error.message);
    res.status(503).json({ success: false, error: 'Nachricht konnte nicht gesendet werden.' });
  }
});

// Eigener Chain-Status aus der kontrollierten CARDYX-Datenschicht.
app.get('/api/chain/status', async (_req, res) => {
  try {
    const result = await pool.query<{
      block_no: number | null;
      slot_no: number | null;
      block_time: string;
      block_hash: string;
    }>('SELECT block_no, slot_no, block_time, block_hash FROM cardyx.chain_status');

    const status = result.rows[0];
    if (!status) {
      return res.status(503).json({ success: false, error: 'Die CARDYX-Chain-Daten sind noch nicht bereit.' });
    }

    // Mainnet Shelley constants: slot 4492800 started at unix 1596059091, 1 s slots, 432000-slot epochs.
    const slot = Number(status.slot_no ?? 0);
    const shelleySlot = Math.max(0, slot - 4_492_800);
    const wallClockSlot = 4_492_800 + Math.floor(Date.now() / 1000) - 1_596_059_091;
    const rawBlockTime: unknown = status.block_time;
    const blockTime = rawBlockTime instanceof Date
      ? rawBlockTime
      : new Date(`${String(rawBlockTime).replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(String(rawBlockTime)) ? '' : 'Z'}`);
    res.json({
      success: true,
      data: {
        ...status,
        epoch: 208 + Math.floor(shelleySlot / 432_000),
        slot_in_epoch: shelleySlot % 432_000,
        slots_to_epoch_end: 432_000 - (shelleySlot % 432_000),
        lag_seconds: Number.isFinite(blockTime.getTime()) ? Math.max(0, Math.round((Date.now() - blockTime.getTime()) / 1000)) : null,
        db_sync_progress: slot > 0 ? Math.min(100, (slot / wallClockSlot) * 100) : null,
      },
    });
  } catch (error: any) {
    console.error('Fehler beim Lesen des CARDYX-Chain-Status:', error.message);
    res.status(503).json({ success: false, error: 'Die CARDYX-Chain-Daten sind aktuell nicht verfügbar.' });
  }
});

app.get('/api/chain/transactions/:hash', async (req, res) => {
  const hash = req.params.hash.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return res.status(400).json({ success: false, error: 'Der Transaktionshash muss 64 hexadezimale Zeichen enthalten.' });
  }

  try {
    const result = await pool.query('SELECT * FROM cardyx.transaction_summary WHERE tx_hash = $1', [hash]);
    const transaction = result.rows[0];
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaktion nicht gefunden.' });
    }
    res.json({ success: true, data: transaction });
  } catch (error: any) {
    console.error('Fehler bei der CARDYX-Transaktionssuche:', error.message);
    res.status(503).json({ success: false, error: 'Die CARDYX-Chain-Daten sind aktuell nicht verfügbar.' });
  }
});

app.get('/api/chain/assets/:fingerprint', async (req, res) => {
  const fingerprint = req.params.fingerprint.toLowerCase();
  if (!/^asset1[0-9a-z]{20,}$/.test(fingerprint)) {
    return res.status(400).json({ success: false, error: 'Der Asset-Fingerprint ist ungültig.' });
  }

  try {
    const result = await pool.query(
      `SELECT fingerprint, policy_id, asset_name,
              count(*) AS utxo_count,
              count(DISTINCT address) AS holder_count,
              coalesce(sum(quantity), 0) AS circulating_quantity,
              max(block_time) AS latest_activity
       FROM cardyx.asset_utxo
       WHERE fingerprint = $1
       GROUP BY fingerprint, policy_id, asset_name`,
      [fingerprint]
    );
    const asset = result.rows[0];
    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset nicht gefunden oder nicht mehr in einer UTxO vorhanden.' });
    }
    res.json({ success: true, data: asset });
  } catch (error: any) {
    console.error('Fehler beim CARDYX-Asset-Lookup:', error.message);
    res.status(503).json({ success: false, error: 'Die CARDYX-Chain-Daten sind aktuell nicht verfügbar.' });
  }
});

app.get('/api/chain/addresses/:address', async (req, res) => {
  const address = req.params.address;
  if (!/^addr(_test)?1[0-9a-z]{20,}$/.test(address)) {
    return res.status(400).json({ success: false, error: 'Die Cardano-Adresse ist ungültig.' });
  }

  try {
    const [summaryResult, assetResult] = await Promise.all([
      pool.query(
        `SELECT address, count(*) AS utxo_count, coalesce(sum(lovelace), 0) AS lovelace_balance,
                max(block_time) AS latest_activity
         FROM cardyx.address_utxo
         WHERE address = $1
         GROUP BY address`,
        [address]
      ),
      pool.query(
        `SELECT count(DISTINCT fingerprint) AS asset_count
         FROM cardyx.asset_utxo
         WHERE address = $1`,
        [address]
      ),
    ]);
    const summary = summaryResult.rows[0];
    if (!summary) {
      return res.status(404).json({ success: false, error: 'Adresse hat keine aktuell unverbauten UTxOs.' });
    }
    res.json({ success: true, data: { ...summary, asset_count: assetResult.rows[0].asset_count } });
  } catch (error: any) {
    console.error('Fehler bei der CARDYX-Adresszusammenfassung:', error.message);
    res.status(503).json({ success: false, error: 'Die CARDYX-Chain-Daten sind aktuell nicht verfügbar.' });
  }
});

const ASSET_CATEGORIES = ['layer-1', 'defi', 'stablecoin', 'infrastructure', 'gaming', 'ai', 'nft', 'meme', 'rwa', 'other'] as const;

app.get('/api/catalog/categories', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT category, count(*) AS asset_count
       FROM cardyx.asset_catalog_public
       GROUP BY category
       ORDER BY category`
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('Fehler beim Lesen der CARDYX-Kategorien:', error.message);
    res.status(503).json({ success: false, error: 'Der CARDYX-Asset-Katalog ist aktuell nicht verfügbar.' });
  }
});

app.get('/api/catalog/assets', async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  if (category && !ASSET_CATEGORIES.includes(category as (typeof ASSET_CATEGORIES)[number])) {
    return res.status(400).json({ success: false, error: 'Die angeforderte Kategorie ist ungültig.' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM cardyx.asset_catalog_public
       WHERE ($1::text IS NULL OR category = $1)
       ORDER BY display_name`,
      [category ?? null]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('Fehler beim Lesen des CARDYX-Asset-Katalogs:', error.message);
    res.status(503).json({ success: false, error: 'Der CARDYX-Asset-Katalog ist aktuell nicht verfügbar.' });
  }
});

app.get('/api/market/onchain', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM cardyx.onchain_market
       ORDER BY holder_count DESC, circulating_quantity DESC, display_name`
    );
    res.json({
      success: true,
      data: {
        source: 'cardyx-chain',
        pricing: 'not-indexed',
        updatedAt: new Date().toISOString(),
        total: result.rows.length,
        tokens: result.rows,
      },
    });
  } catch (error: any) {
    console.error('Fehler beim Lesen des CARDYX-On-Chain-Marktfeeds:', error.message);
    res.status(503).json({ success: false, error: 'Der CARDYX-On-Chain-Marktfeed ist aktuell nicht verfügbar.' });
  }
});

// TEST-ROUTE: Schreibt den Test-Token live in deine Docker-Datenbank
app.get('/api/v1/test-seed', async (req, res) => {
  try {
    const queryText = `
      INSERT INTO "Token" (id, "policyId", "assetName", ticker, "priceAda", "updatedAt", "createdAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT ("policyId") DO UPDATE 
      SET "priceAda" = $5
      RETURNING *;
    `;
    
    const values = [
      'test-snek-id', 
      '279fcd83bffe3d59b20b22479e0bf0366a7b74f009b0b4b2efc00000', 
      'Snek', 
      'SNEK', 
      0.0014
    ];

    const result = await pool.query(queryText, values);

    res.json({ 
      success: true, 
      message: 'Verbindung absolut perfekt! Tabelle automatisch repariert und Token gespeichert!', 
      data: result.rows 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ===================================================================
// MARKET API: Top 50 Cardano-Ökosystem-Token (Live via CoinGecko)
// ===================================================================

async function getLocalMarketFeed() {
  try {
    const result = await pool.query(
      `SELECT
         c.market_id,
         c.policy_id,
         c.asset_name,
         meta.fingerprint,
         meta.decimals,
         CASE WHEN c.policy_id IN (
           'a04ce7a52545e5e33c2867e148898d9e667a69602285f6a1298f9d68',
           'aebcb6eaba17dea962008a9d693e39a3160b02b5b89b1c83e537c599'
         ) THEN 'Liqwid' ELSE NULL END AS protocol,
         c.ticker,
         c.display_name,
         c.category,
         c.logo_url,
         token_metadata.description AS description,
         c.official_url,
         c.is_verified,
         c.holder_count,
         c.utxo_count,
         c.circulating_quantity,
         c.latest_activity,
         c.refreshed_at,
         COALESCE(p.price_ada, c.price_ada, 0) AS price_ada,
         COALESCE(p.price_usd, c.price_usd, 0) AS price_usd,
         p.updated_at AS price_updated_at,
         p.source AS price_source,
         COALESCE(m.price_ada, 0) AS market_price_ada,
         COALESCE(m.price_usd, 0) AS market_price_usd,
         m.source AS market_price_source,
         m.observed_at AS market_price_observed_at,
         COALESCE(pool_sources.active_pools, '[]'::jsonb) AS active_pools,
         COALESCE(m.volume_24h_ada, 0) AS volume_24h_ada,
         COALESCE(m.volume_24h_usd, 0) AS volume_24h_usd,
         COALESCE(m.market_cap_ada, 0) AS market_cap_ada,
         COALESCE(m.market_cap_usd, 0) AS market_cap_usd,
         COALESCE(m.fdv_ada, 0) AS fdv_ada,
         COALESCE(m.fdv_usd, 0) AS fdv_usd,
         COALESCE(m.change_24h, 0) AS change_24h,
         COALESCE(m.change_7d, 0) AS change_7d,
         COALESCE(m.high_24h_usd, 0) AS high_24h_usd,
         COALESCE(m.low_24h_usd, 0) AS low_24h_usd,
         COALESCE(ch.sparkline_7d, ARRAY[]::numeric[]) AS sparkline_7d,
         COALESCE(liquidity.liquidity_ada, 0) AS liquidity_ada,
         holders.holders_1d_ago,
         holders.holders_7d_ago
       FROM cardyx.onchain_market c
      LEFT JOIN cardyx.asset_catalog_identity_public meta ON meta.market_id = c.market_id
      LEFT JOIN cardyx.asset_metadata token_metadata
        ON token_metadata.policy_id = c.policy_id AND token_metadata.asset_name = c.asset_name
       LEFT JOIN cardyx.asset_price_snapshot p
         ON p.market_id = c.market_id
        OR (p.policy_id IS NOT NULL AND c.policy_id IS NOT NULL AND p.policy_id = c.policy_id AND p.asset_name = c.asset_name)
       LEFT JOIN LATERAL (
         SELECT *
         FROM cardyx.asset_market_snapshot
         WHERE market_id = c.market_id
         ORDER BY observed_at DESC
         LIMIT 1
       ) m ON true
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(
           jsonb_build_object(
             'dex', COALESCE(registry.dex, 'unknown'),
             'version', COALESCE(registry.version, 'unknown'),
             'poolId', recent.pool_id
           ) ORDER BY recent.pool_id
         ) AS active_pools
         FROM (
           SELECT DISTINCT ON (observation.pool_id) observation.pool_id
           FROM cardyx.dex_pool_price_observation observation
           WHERE observation.market_id = c.market_id
             AND observation.observed_at >= now() - interval '30 minutes'
           ORDER BY observation.pool_id, observation.observed_at DESC
         ) recent
         LEFT JOIN cardyx.dex_pool_registry registry ON registry.pool_id = recent.pool_id
       ) pool_sources ON true
       LEFT JOIN LATERAL (
         SELECT array_agg(close ORDER BY bucket_start) AS sparkline_7d
         FROM cardyx.asset_market_candle
         WHERE market_id = c.market_id
           AND timeframe = '7d'
           AND bucket_start >= now() - interval '7 days'
       ) ch ON true
       LEFT JOIN LATERAL (
         SELECT 2 * sum(latest.reserve_ada) AS liquidity_ada
         FROM (
           SELECT DISTINCT ON (observation.pool_id) observation.reserve_ada
           FROM cardyx.dex_pool_price_observation observation
           JOIN cardyx.dex_pool_registry registry ON registry.pool_id = observation.pool_id
           WHERE observation.market_id = c.market_id
             AND registry.enabled = true
             AND observation.observed_at >= now() - interval '30 minutes'
           ORDER BY observation.pool_id, observation.observed_at DESC
         ) latest
       ) liquidity ON true
       LEFT JOIN LATERAL (
         SELECT max(history.holder_count) FILTER (WHERE history.day = (now() AT TIME ZONE 'UTC')::date - 1) AS holders_1d_ago,
                max(history.holder_count) FILTER (WHERE history.day = (now() AT TIME ZONE 'UTC')::date - 7) AS holders_7d_ago
         FROM cardyx.asset_holder_history history
         WHERE history.policy_id = c.policy_id AND history.asset_name = c.asset_name
           AND history.day >= (now() AT TIME ZONE 'UTC')::date - 7
       ) holders ON true
       ORDER BY c.holder_count DESC NULLS LAST, c.circulating_quantity DESC NULLS LAST, c.display_name ASC
      LIMIT 5000`
    );

    if (!result.rows.length) return null;

    let tokens = result.rows.map((row: any) => {
      const priceAda = Number(row.price_ada ?? 0);
      const rawUsd = Number(row.price_usd ?? 0);
      const priceUsd = rawUsd > 0 ? rawUsd : priceAda > 0 ? priceAda * adaUsd() : 0;
      return {
        id: String(row.market_id ?? row.policy_id ?? row.ticker ?? ''),
        ticker: String(row.ticker ?? '').toUpperCase(),
        name: String(row.display_name ?? row.ticker ?? 'Unknown Asset'),
        protocol: typeof row.protocol === 'string' ? row.protocol : null,
        description: typeof row.description === 'string' ? row.description : null,
        activePools: Array.isArray(row.active_pools)
          ? row.active_pools.map((source: any) => ({
              dex: String(source.dex ?? 'unknown'),
              version: String(source.version ?? 'unknown'),
              poolId: String(source.poolId ?? ''),
            }))
          : [],
        image: typeof row.logo_url === 'string' ? row.logo_url : null,
        policyId: typeof row.policy_id === 'string' ? row.policy_id : null,
        priceUsd: Number(row.market_price_usd || priceUsd),
        priceAda: Number(row.market_price_ada || priceAda),
        localPoolPriceAda: row.market_price_source === 'cardyx-local-dex-indexer'
          && row.market_price_observed_at
          && Date.now() - new Date(row.market_price_observed_at).getTime() < 30 * 60_000
          ? Number(row.market_price_ada) : 0,
        change24h: Number(row.change_24h ?? 0),
        change7d: Number(row.change_7d ?? 0),
        volume24hUsd: Number(row.volume_24h_usd ?? 0),
        marketCapUsd: Number(row.market_cap_usd ?? 0),
        fdvUsd: Number(row.fdv_usd ?? 0),
        volume24hAda: Number(row.volume_24h_ada ?? 0),
        marketCapAda: Number(row.market_cap_ada ?? 0),
        fdvAda: Number(row.fdv_ada ?? 0),
        marketCapRank: null,
        circulatingSupply: Number(row.circulating_quantity ?? 0),
        totalSupply: null,
        maxSupply: null,
        athUsd: 0,
        athChangePct: 0,
        athDate: null,
        atlUsd: 0,
        atlChangePct: 0,
        atlDate: null,
        high24hUsd: Number(row.high_24h_usd ?? 0),
        low24hUsd: Number(row.low_24h_usd ?? 0),
        sparkline7d: (row.sparkline_7d ?? []).map(Number),
        liquidityAda: Number(row.liquidity_ada ?? 0),
        holderChange24h: row.holders_1d_ago == null ? null : Number(row.holder_count ?? 0) - Number(row.holders_1d_ago),
        holderChange7d: row.holders_7d_ago == null ? null : Number(row.holder_count ?? 0) - Number(row.holders_7d_ago),
        category: row.category ?? 'other',
        catalogVerified: Boolean(row.is_verified),
        assetName: row.asset_name ?? null,
        fingerprint: row.fingerprint ?? cardanoAssetFingerprint(row.policy_id ?? null, row.asset_name ?? null),
        decimals: row.decimals == null ? null : Number(row.decimals),
        holderCount: Number(row.holder_count ?? 0),
        utxoCount: Number(row.utxo_count ?? 0),
        circulatingQuantity: Number(row.circulating_quantity ?? 0),
        latestActivity: row.latest_activity ?? null,
        snapshotRefreshedAt: row.refreshed_at ?? null,
        source: priceAda > 0 || rawUsd > 0 ? 'cardyx-local' : 'external-display-fallback',
      };
    });

    return {
      source: 'cardyx-local',
      pricing: tokens.some((token) => token.priceUsd > 0 || token.priceAda > 0) ? 'local-price-index' : 'not-indexed',
      adaPriceUsd: adaUsd(),
      total: tokens.length,
      updatedAt: new Date().toISOString(),
      tokens,
    };
  } catch (error: any) {
    console.warn('CARDYX-Local-Marktfeed nicht verfügbar:', error.message);
    return null;
  }
}

async function getLocalTokenById(id: string) {
  try {
    const result = await pool.query(
      `SELECT
         c.market_id,
         c.policy_id,
         c.asset_name,
         meta.fingerprint,
         meta.decimals,
         c.ticker,
         c.display_name,
         c.category,
         c.logo_url,
         c.official_url,
         c.is_verified,
         c.holder_count,
         c.utxo_count,
         c.circulating_quantity,
         c.latest_activity,
         c.refreshed_at,
         COALESCE(p.price_ada, c.price_ada, 0) AS price_ada,
         COALESCE(p.price_usd, c.price_usd, 0) AS price_usd,
         p.updated_at AS price_updated_at,
         p.source AS price_source,
         m.price_ada AS market_price_ada,
         m.source AS market_price_source,
         m.observed_at AS market_price_observed_at,
         c.data_source AS data_source
       FROM cardyx.onchain_market c
      LEFT JOIN cardyx.asset_catalog_identity_public meta ON meta.market_id = c.market_id
       LEFT JOIN cardyx.asset_price_snapshot p
         ON p.market_id = c.market_id
        OR (p.policy_id IS NOT NULL AND c.policy_id IS NOT NULL AND p.policy_id = c.policy_id AND p.asset_name = c.asset_name)
       LEFT JOIN LATERAL (
         SELECT price_ada, source, observed_at
         FROM cardyx.asset_market_snapshot
         WHERE market_id = c.market_id
         ORDER BY observed_at DESC
         LIMIT 1
       ) m ON true
       WHERE c.market_id = $1
          OR c.policy_id = $1
          OR c.ticker = $1
       ORDER BY c.holder_count DESC NULLS LAST
       LIMIT 1`,
      [id]
    );

    const row = result.rows[0];
    if (!row) return null;

    const priceAda = Number(row.price_ada ?? 0);
    const rawUsd = Number(row.price_usd ?? 0);
    const priceUsd = rawUsd > 0 ? rawUsd : priceAda > 0 ? priceAda * adaUsd() : 0;
    const localPoolPriceAda = row.market_price_source === 'cardyx-local-dex-indexer'
      && row.market_price_observed_at
      && Date.now() - new Date(row.market_price_observed_at).getTime() < 30 * 60_000
      ? Number(row.market_price_ada) : 0;

    const token = {
      id: String(row.market_id ?? row.policy_id ?? row.ticker ?? id),
      ticker: String(row.ticker ?? '').toUpperCase(),
      name: String(row.display_name ?? row.ticker ?? 'Unknown Asset'),
      image: typeof row.logo_url === 'string' ? row.logo_url : null,
      policyId: typeof row.policy_id === 'string' ? row.policy_id : null,
      priceUsd: localPoolPriceAda > 0 ? localPoolPriceAda * adaUsd() : priceUsd,
      priceAda: localPoolPriceAda > 0 ? localPoolPriceAda : priceAda,
      localPoolPriceAda,
      change24h: 0,
      change7d: 0,
      volume24hUsd: 0,
      marketCapUsd: 0,
      fdvUsd: 0,
      volume24hAda: 0,
      marketCapAda: 0,
      fdvAda: 0,
      marketCapRank: null,
      circulatingSupply: Number(row.circulating_quantity ?? 0),
      totalSupply: null,
      maxSupply: null,
      athUsd: 0,
      athChangePct: 0,
      athDate: null,
      atlUsd: 0,
      atlChangePct: 0,
      atlDate: null,
      high24hUsd: 0,
      low24hUsd: 0,
      sparkline7d: [],
      category: row.category ?? 'other',
      catalogVerified: Boolean(row.is_verified),
      assetName: row.asset_name ?? null,
      fingerprint: row.fingerprint ?? cardanoAssetFingerprint(row.policy_id ?? null, row.asset_name ?? null),
      decimals: row.decimals == null ? null : Number(row.decimals),
      holderCount: Number(row.holder_count ?? 0),
      utxoCount: Number(row.utxo_count ?? 0),
      circulatingQuantity: Number(row.circulating_quantity ?? 0),
      latestActivity: row.latest_activity ?? null,
      snapshotRefreshedAt: row.refreshed_at ?? null,
      source: row.price_source ?? row.data_source ?? 'cardyx-local',
      pricing: localPoolPriceAda > 0 || priceAda > 0 || priceUsd > 0 ? 'local-price-index' : 'not-indexed',
    };

    return { token, adaPriceUsd: adaUsd() };
  } catch (error: any) {
    console.warn(`CARDYX-Local-Tokenfeed für ${id} nicht verfügbar:`, error.message);
    return null;
  }
}

function localCatalogToken(token: MarketToken, adaPriceUsd: number) {
  const localPoolPriceAda = Number((token as MarketToken & { localPoolPriceAda?: number }).localPoolPriceAda ?? 0);
  const localPriceAda = localPoolPriceAda > 0 ? localPoolPriceAda : token.priceAda;
  const priceUsd = token.priceUsd > 0
    ? token.priceUsd
    : localPriceAda > 0 && adaPriceUsd > 0 ? localPriceAda * adaPriceUsd : 0;
  return {
    ...token,
    priceUsd,
    source: 'cardyx-local-catalog',
    pricing: localPriceAda > 0 ? 'local-price-index' : priceUsd > 0 ? 'ada-usd-conversion' : 'not-indexed',
  };
}

async function getProgressiveMarketFeed(): Promise<any> {
  const local = await getLocalMarketFeed();
  if (!local) throw new Error('Lokaler Marktfeed nicht verfügbar');
  const tokens = local.tokens
    .filter((token: MarketToken) =>
      token.ticker !== 'ASSET'
      && !token.name.startsWith('Cardano Asset ')
      && (token.priceAda > 0 || token.priceUsd > 0)
    )
    .map((token: MarketToken) => ({ ...token, source: 'cardyx-local-catalog', pricing: token.priceAda > 0 || token.priceUsd > 0 ? 'local-price-index' : 'not-indexed' }));
  return {
    ...local,
    source: 'cardyx-local-catalog',
    pricing: 'local-price-index',
    total: tokens.length,
    tokens,
  };
}

app.get('/api/market/top200', async (_req, res) => {
  try {
    res.json({ success: true, data: await getProgressiveMarketFeed() });
  } catch (error: any) {
    console.error('Fehler in der Market-Route:', error.message);
    res.status(502).json({ success: false, error: 'Marktdaten aktuell nicht verfügbar' });
  }
});

app.get('/api/market/catalog', async (_req, res) => {
  try {
    const market = await getLocalMarketFeed();
    if (!market) return res.status(503).json({ success: false, error: 'Der lokale Tokenkatalog ist aktuell nicht verfügbar.' });
    const marketSummary = await getCardanoMarketSummary().catch(() => null);
    const summaryAdaPriceUsd = marketSummary?.adaPriceUsd ?? 0;
    const adaPriceUsd = summaryAdaPriceUsd > 0
      ? summaryAdaPriceUsd
      : market.adaPriceUsd;
    const tokens = market.tokens.map((token: MarketToken) => localCatalogToken(token, adaPriceUsd));
    res.json({
      success: true,
      data: {
        ...market,
        adaPriceUsd,
        source: 'cardyx-local-catalog',
        usdConversionSource: marketSummary?.sources.adaPrice ?? 'configured-ada-usd',
        pricing: tokens.some((token: MarketToken) => token.priceAda > 0 || token.priceUsd > 0) ? 'local-price-index' : 'not-indexed',
        total: tokens.length,
        tokens,
      },
    });
  } catch (error: any) {
    console.error('Fehler beim Lesen des lokalen Tokenkatalogs:', error.message);
    res.status(503).json({ success: false, error: 'Der lokale Tokenkatalog ist aktuell nicht verfügbar.' });
  }
});

app.get('/api/market/summary', async (_req, res) => {
  try {
    res.json({ success: true, data: await getCardanoMarketSummary() });
  } catch (error: any) {
    res.status(502).json({ success: false, error: 'Cardano market summary is currently unavailable.' });
  }
});

// Kompatibilitaet fuer bestehende Clients, die die fruehere Top-50-Route nutzen.
app.get('/api/market/top50', async (_req, res) => {
  try {
    const market = await getProgressiveMarketFeed();
    res.json({ success: true, data: { ...market, total: Math.min(market.total, 50), tokens: market.tokens.slice(0, 50) } });
  } catch (error: any) {
    console.error('Fehler in der Market-Route:', error.message);
    res.status(502).json({ success: false, error: 'Marktdaten aktuell nicht verfügbar' });
  }
});

// Einzelner Token für die dedizierte CARDYX-Analyse-Seite
app.get('/api/market/token/:id', async (req, res) => {
  try {
    const market = await getLocalMarketFeed();
    if (!market) return res.status(503).json({ success: false, error: 'Lokale Tokendaten nicht verfügbar.' });
    const localToken = market.tokens.find((token: MarketToken) =>
      token.id === req.params.id || token.policyId === req.params.id || token.ticker === req.params.id
    );
    if (localToken) return res.json({ success: true, data: {
      token: localCatalogToken(localToken, market.adaPriceUsd),
      adaPriceUsd: market.adaPriceUsd,
    } });
    res.status(404).json({ success: false, error: 'Token nicht verfügbar.' });
  } catch (error: any) {
    console.error(`Fehler in der Token-Route (${req.params.id}):`, error.message);
    res.status(502).json({ success: false, error: 'Token-Daten aktuell nicht verfügbar' });
  }
});

async function upsertLocalPriceSnapshots(payload: any[]): Promise<number> {
  const rows = Array.isArray(payload) ? payload : [];
  const counts = await Promise.all(
    rows.map(async (row: any) => {
      const marketId = String(row.market_id ?? row.marketId ?? row.id ?? '').trim();
      const policyId = typeof row.policy_id === 'string' ? row.policy_id.trim() : typeof row.policyId === 'string' ? row.policyId.trim() : null;
      const assetName = typeof row.asset_name === 'string' ? row.asset_name.trim() : typeof row.assetName === 'string' ? row.assetName.trim() : null;
      const priceAda = Number(row.price_ada ?? row.priceAda ?? 0);
      const priceUsd = Number(row.price_usd ?? row.priceUsd ?? 0);
      const source = String(row.source ?? 'cardyx-local').trim() || 'cardyx-local';

      if (!marketId && !(policyId && assetName)) {
        return 0;
      }

      const marketKey = marketId || policyId || assetName || `${Date.now()}`;

      await pool.query(
        `INSERT INTO cardyx.asset_price_snapshot (market_id, policy_id, asset_name, price_ada, price_usd, source, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (market_id)
         DO UPDATE SET
           policy_id = EXCLUDED.policy_id,
           asset_name = EXCLUDED.asset_name,
           price_ada = EXCLUDED.price_ada,
           price_usd = EXCLUDED.price_usd,
           source = EXCLUDED.source,
           updated_at = now()`,
        [marketKey, policyId, assetName, priceAda, priceUsd, source]
      );

      return 1;
    })
  );

  return counts.reduce<number>((sum, value) => sum + value, 0);
}

async function upsertDexPoolObservations(payload: any[]): Promise<number> {
  const rows = Array.isArray(payload) ? payload : [];
  let updated = 0;

  for (const row of rows) {
    const poolId = String(row.pool_id ?? row.poolId ?? '').trim();
    const marketId = String(row.market_id ?? row.marketId ?? '').trim();
    const priceAda = Number(row.price_ada ?? row.priceAda ?? 0);
    const reserveAda = Number(row.reserve_ada ?? row.reserveAda ?? 0);
    const reserveAsset = Number(row.reserve_asset ?? row.reserveAsset ?? 0);

    if (!poolId || !marketId || !Number.isFinite(priceAda) || priceAda <= 0) continue;

    await pool.query(
      `INSERT INTO cardyx.dex_pool_price_observation
         (pool_id, market_id, policy_id, asset_name, reserve_ada, reserve_asset, price_ada, observed_at, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()), $9)
       ON CONFLICT (pool_id, market_id)
       DO UPDATE SET
         policy_id = EXCLUDED.policy_id,
         asset_name = EXCLUDED.asset_name,
         reserve_ada = EXCLUDED.reserve_ada,
         reserve_asset = EXCLUDED.reserve_asset,
         price_ada = EXCLUDED.price_ada,
         observed_at = EXCLUDED.observed_at,
         source = EXCLUDED.source`,
      [
        poolId,
        marketId,
        row.policy_id ?? row.policyId ?? null,
        row.asset_name ?? row.assetName ?? null,
        reserveAda,
        reserveAsset,
        priceAda,
        row.observed_at ?? row.observedAt ?? null,
        String(row.source ?? 'cardyx-local-pool-indexer'),
      ]
    );
    updated += 1;
  }

  if (updated > 0) {
    await pool.query(
      `INSERT INTO cardyx.asset_price_snapshot
         (market_id, policy_id, asset_name, price_ada, price_usd, source, updated_at)
       SELECT o.market_id,
              max(o.policy_id) FILTER (WHERE o.policy_id IS NOT NULL),
              max(o.asset_name) FILTER (WHERE o.asset_name IS NOT NULL),
              avg(o.price_ada),
              0,
              'cardyx-local-pool-indexer',
              now()
       FROM cardyx.dex_pool_price_observation o
       WHERE o.observed_at >= now() - interval '30 minutes'
       GROUP BY o.market_id
       ON CONFLICT (market_id)
       DO UPDATE SET
         policy_id = EXCLUDED.policy_id,
         asset_name = EXCLUDED.asset_name,
         price_ada = EXCLUDED.price_ada,
         price_usd = 0,
         source = EXCLUDED.source,
         updated_at = now()`
    );
  }

  return updated;
}

app.post('/api/market/prices', async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body?.prices ?? [req.body ?? {}];
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ success: false, error: 'Preisdatensätze fehlen.' });
    }

    const updated = await upsertLocalPriceSnapshots(payload);
    res.json({ success: true, data: { updated } });
  } catch (error: any) {
    console.error('Fehler beim Speichern lokaler Preisdaten:', error.message);
    res.status(500).json({ success: false, error: 'Preisindex konnte nicht aktualisiert werden.' });
  }
});

app.post('/api/market/assets/metadata', async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body?.metadata ?? [];
    let updated = 0;

    for (const row of payload) {
      const policyId = String(row.policy_id ?? row.policyId ?? '').trim();
      const assetName = String(row.asset_name ?? row.assetName ?? '').trim();
      if (!policyId || !assetName) continue;

      await pool.query(
        `INSERT INTO cardyx.asset_metadata
           (policy_id, asset_name, ticker, display_name, description, decimals, source, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (policy_id, asset_name)
         DO UPDATE SET
           ticker = EXCLUDED.ticker,
           display_name = EXCLUDED.display_name,
           description = EXCLUDED.description,
           decimals = EXCLUDED.decimals,
           source = EXCLUDED.source,
           updated_at = now()`,
        [
          policyId,
          assetName,
          row.ticker ?? null,
          row.display_name ?? row.displayName ?? null,
          row.description ?? null,
          row.decimals == null ? null : Number(row.decimals),
          String(row.source ?? 'cardyx-local-metadata-indexer'),
        ]
      );
      updated += 1;
    }

    res.json({ success: true, data: { updated, source: 'cardyx-local-metadata-indexer' } });
  } catch (error: any) {
    console.error('Fehler beim Import lokaler Asset-Metadaten:', error.message);
    res.status(500).json({ success: false, error: 'Asset-Metadaten konnten nicht importiert werden.' });
  }
});

app.post('/api/market/snapshots', async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body?.snapshots ?? [];
    let updated = 0;

    for (const row of payload) {
      const marketId = String(row.market_id ?? row.marketId ?? '').trim();
      if (!marketId) continue;
      await pool.query(
        `INSERT INTO cardyx.asset_market_snapshot (
           market_id, observed_at, price_ada, price_usd, volume_24h_ada, volume_24h_usd,
           market_cap_ada, market_cap_usd, fdv_ada, fdv_usd, change_24h, change_7d,
           high_24h_usd, low_24h_usd, source
         ) VALUES ($1, COALESCE($2::timestamptz, now()), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (market_id, observed_at)
         DO UPDATE SET
           price_ada = EXCLUDED.price_ada,
           price_usd = EXCLUDED.price_usd,
           volume_24h_ada = EXCLUDED.volume_24h_ada,
           volume_24h_usd = EXCLUDED.volume_24h_usd,
           market_cap_ada = EXCLUDED.market_cap_ada,
           market_cap_usd = EXCLUDED.market_cap_usd,
           fdv_ada = EXCLUDED.fdv_ada,
           fdv_usd = EXCLUDED.fdv_usd,
           change_24h = EXCLUDED.change_24h,
           change_7d = EXCLUDED.change_7d,
           high_24h_usd = EXCLUDED.high_24h_usd,
           low_24h_usd = EXCLUDED.low_24h_usd,
           source = EXCLUDED.source`,
        [
          marketId,
          row.observed_at ?? row.observedAt ?? null,
          Number(row.price_ada ?? row.priceAda ?? 0),
          Number(row.price_usd ?? row.priceUsd ?? 0),
          Number(row.volume_24h_ada ?? row.volume24hAda ?? 0),
          Number(row.volume_24h_usd ?? row.volume24hUsd ?? 0),
          Number(row.market_cap_ada ?? row.marketCapAda ?? 0),
          Number(row.market_cap_usd ?? row.marketCapUsd ?? 0),
          Number(row.fdv_ada ?? row.fdvAda ?? 0),
          Number(row.fdv_usd ?? row.fdvUsd ?? 0),
          Number(row.change_24h ?? row.change24h ?? 0),
          Number(row.change_7d ?? row.change7d ?? 0),
          Number(row.high_24h_usd ?? row.high24hUsd ?? 0),
          Number(row.low_24h_usd ?? row.low24hUsd ?? 0),
          String(row.source ?? 'cardyx-local-market-indexer'),
        ]
      );
      updated += 1;
    }

    res.json({ success: true, data: { updated, source: 'cardyx-local-market-indexer' } });
  } catch (error: any) {
    console.error('Fehler beim Import lokaler Marktsnapshots:', error.message);
    res.status(500).json({ success: false, error: 'Marktsnapshots konnten nicht importiert werden.' });
  }
});

app.post('/api/market/candles', async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body?.candles ?? [];
    let updated = 0;

    for (const row of payload) {
      const marketId = String(row.market_id ?? row.marketId ?? '').trim();
      const timeframe = row.timeframe === '30d' ? '30d' : '7d';
      if (!marketId || !row.bucket_start && !row.bucketStart) continue;
      await pool.query(
        `INSERT INTO cardyx.asset_market_candle
           (market_id, timeframe, bucket_start, open, high, low, close, volume_ada, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (market_id, timeframe, bucket_start)
         DO UPDATE SET open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
                       close = EXCLUDED.close, volume_ada = EXCLUDED.volume_ada, source = EXCLUDED.source`,
        [
          marketId,
          timeframe,
          row.bucket_start ?? row.bucketStart,
          Number(row.open ?? 0),
          Number(row.high ?? 0),
          Number(row.low ?? 0),
          Number(row.close ?? 0),
          Number(row.volume_ada ?? row.volumeAda ?? 0),
          String(row.source ?? 'cardyx-local-market-indexer'),
        ]
      );
      updated += 1;
    }

    res.json({ success: true, data: { updated, source: 'cardyx-local-market-indexer' } });
  } catch (error: any) {
    console.error('Fehler beim Import lokaler Marktcandles:', error.message);
    res.status(500).json({ success: false, error: 'Marktcandles konnten nicht importiert werden.' });
  }
});

app.get('/api/system/providers', (_req, res) => {
  res.json({
    success: true,
    data: {
      market: {
        source: CARDYX_MARKET_SOURCE,
        price_index: 'cardyx-local',
        price_refresh: 'pool-indexer',
      },
      trade: {
        provider: CARDYX_TRADE_PROVIDER,
        configured: dexhunterConfigured(),
      },
    },
  });
});

app.get('/api/indexer/local/status', (_req, res) => {
  res.json({ success: true, data: getLocalIndexerStatus() });
});

app.post('/api/indexer/local/run', async (_req, res) => {
  try {
    const result = await runLocalIndexerOnce(pool);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message ?? 'Lokaler Indexer fehlgeschlagen.' });
  }
});

app.get('/api/indexer/dex/status', (_req, res) => {
  res.json({ success: true, data: getDexIndexerStatus() });
});

app.get('/api/indexer/pool-state/status', (_req, res) => {
  res.json({ success: true, data: getPoolStateIndexerStatus() });
});

app.post('/api/indexer/dex/run', async (_req, res) => {
  try {
    const result = await runDexIndexerOnce(pool);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message ?? 'DEX-Indexer fehlgeschlagen.' });
  }
});

app.get('/api/market/dex/index/status', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS total_rows,
              MIN(updated_at) AS oldest_update,
              MAX(updated_at) AS newest_update
       FROM cardyx.asset_price_snapshot`
    );

    res.json({
      success: true,
      data: {
        configured: true,
        source: 'cardyx-local-pool-indexer',
        ...result.rows[0],
      },
    });
  } catch (error: any) {
    console.error('Fehler beim Lesen des lokalen DEX-Indexstatus:', error.message);
    res.status(503).json({ success: false, error: 'Lokaler DEX-Preisindex derzeit nicht verfügbar.' });
  }
});

app.post('/api/market/dex/pools/observations', async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body?.observations ?? [];
    if (!payload.length) {
      return res.status(400).json({ success: false, error: 'Pool-Beobachtungen fehlen.' });
    }

    const updated = await upsertDexPoolObservations(payload);
    res.json({ success: true, data: { updated, source: 'cardyx-local-pool-indexer' } });
  } catch (error: any) {
    console.error('Fehler beim Import lokaler DEX-Pool-Daten:', error.message);
    res.status(500).json({ success: false, error: 'DEX-Pool-Daten konnten nicht importiert werden.' });
  }
});

app.post('/api/market/dex/index/refresh', async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body?.entries ?? [];

    if (Array.isArray(payload) && payload.length > 0) {
      const updated = await upsertLocalPriceSnapshots(
        payload.map((row: any) => ({
          ...row,
          source: row.source ?? 'cardyx-local-dex-index',
        }))
      );

      return res.json({ success: true, data: { updated, source: 'cardyx-local-dex-index' } });
    }

    res.json({
      success: true,
      data: {
        updated: 0,
        source: 'cardyx-local-pool-indexer',
        message: 'Preisaktualisierung erfolgt über /api/market/dex/pools/observations.',
      },
    });
  } catch (error: any) {
    console.error('Fehler beim Aktualisieren des lokalen DEX-Preisindex:', error.message);
    res.status(500).json({ success: false, error: 'DEX-Preisindex konnte nicht aktualisiert werden.' });
  }
});

// OHLC-Chartdaten eines einzelnen Tokens (7 oder 30 Tage)
app.get('/api/market/chart/:id', async (req, res) => {
  const { id } = req.params;
  const days = req.query.days === '30' ? '30' : '7';

  try {
    const result = await pool.query(
      `SELECT extract(epoch FROM bucket_start) * 1000 AS time,
              open, high, low, close, volume_ada
       FROM cardyx.asset_market_candle
        WHERE market_id = $1 AND timeframe = $2 AND source = 'cardyx-local-dex-indexer'
       ORDER BY bucket_start ASC`,
      [id, days === '30' ? '30d' : '7d']
    );
    const localCandles = result.rows.map((row: any) => ({
      time: Number(row.time),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume_ada ?? 0),
    }));
    res.json({ success: true, data: { id, days, candles: localCandles, source: 'cardyx-local', currency: 'ADA' } });
  } catch (error: any) {
    console.error(`Fehler in der Chart-Route (${id}):`, error.message);
    res.status(502).json({ success: false, error: 'Chartdaten aktuell nicht verfügbar' });
  }
});

const localTradeCache = new Map<string, { expiresAt: number; trades: unknown[] }>();

app.get('/api/market/trades/:id', async (req, res) => {
  try {
    const cached = localTradeCache.get(req.params.id);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ success: true, data: { trades: cached.trades, source: 'cardyx-local-dex-indexer' } });
    }
    const market = await getLocalMarketFeed();
    const token = market?.tokens.find((entry: MarketToken) => entry.id === req.params.id);
    if (!token?.policyId || !token.assetName) return res.status(404).json({ success: false, error: 'Token nicht im lokalen Katalog.' });
    if (!token.activePools?.length) return res.json({ success: true, data: { trades: [], source: 'cardyx-local-dex-indexer' } });

    const indexed = await pool.query(
      `SELECT state.tx_hash, state.block_time AS occurred_at, registry.dex, registry.version,
              state.event_type AS side, abs(state.delta_asset) AS amount, abs(state.delta_ada) AS ada_notional
       FROM cardyx.dex_pool_state state
       JOIN cardyx.dex_pool_registry registry ON registry.pool_id = state.pool_id
       WHERE state.market_id = $1 AND state.event_type IN ('buy', 'sell')
       ORDER BY state.block_time DESC, state.tx_out_id DESC
       LIMIT 50`,
      [token.id]
    );
    if (indexed.rows.length > 0) {
      if (localTradeCache.size >= 100) localTradeCache.clear();
      localTradeCache.set(req.params.id, { expiresAt: Date.now() + 30_000, trades: indexed.rows });
      return res.json({ success: true, data: { trades: indexed.rows, source: 'cardyx-pool-state-indexer' } });
    }

    const result = await pool.query({
      text: 'SELECT * FROM cardyx.local_pool_trades($1, $2)',
      values: [token.policyId, token.assetName],
    });
    if (localTradeCache.size >= 100) localTradeCache.clear();
    localTradeCache.set(req.params.id, { expiresAt: Date.now() + 60_000, trades: result.rows });
    res.json({ success: true, data: { trades: result.rows, source: 'cardyx-local-dex-indexer' } });
  } catch (error: any) {
    console.error(`Lokale Trades für ${req.params.id} nicht verfügbar:`, error.message);
    res.status(503).json({ success: false, error: 'Lokale Trade-Historie nicht verfügbar.' });
  }
});

// ===================================================================
// DEXHUNTER PARTNER API: Quote -> Build -> Wallet signiert -> Witness
// ===================================================================

app.get('/api/trade/status', (req, res) => {
  res.json({
    success: true,
    data: {
      provider: CARDYX_TRADE_PROVIDER,
      configured: dexhunterConfigured(),
      note: 'Trade-Provider ist separat zur lokalen CARDYX-Marktquelle.',
    },
  });
});

app.get('/api/trade/tokens', async (req, res) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query : '';
    const tokens = await searchDexhunterTokens(query);
    res.json({ success: true, data: tokens });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message ?? 'Tokenkatalog nicht verfügbar' });
  }
});

app.get('/api/trade/orderbook/:tokenId', async (req, res) => {
  try {
    const orderbook = await getDexhunterOrderBook(req.params.tokenId);
    res.json({ success: true, data: orderbook, source: 'dexhunter-limit-orders' });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message ?? 'DexHunter-Orderbook nicht verfügbar' });
  }
});

app.get('/api/trade/chart/:tokenId', async (req, res) => {
  try {
    const period = String(req.query.period ?? '5min') as Parameters<typeof getDexhunterCandles>[1];
    const from = Number(req.query.from);
    const to = Number(req.query.to);
    const candles = await getDexhunterCandles(req.params.tokenId, period, from, to);
    res.json({ success: true, data: candles, source: 'dexhunter-trading-chart' });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message ?? 'Chartdaten nicht verfügbar' });
  }
});

app.post('/api/trade/estimate', async (req, res) => {
  try {
    const quote = await estimateSwap(req.body);
    res.json({ success: true, data: quote });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message ?? 'Quote nicht verfügbar' });
  }
});

app.post('/api/trade/limit/estimate', async (req, res) => {
  try {
    const quote = await estimateLimitOrder(req.body);
    res.json({ success: true, data: quote });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message ?? 'Limit-Quote nicht verfügbar' });
  }
});

app.post('/api/trade/build', async (req, res) => {
  try {
    const { buyer_address, ...swap } = req.body ?? {};
    const built = await buildSwap(String(buyer_address ?? ''), swap);
    res.json({ success: true, data: built });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message ?? 'Transaktion konnte nicht erstellt werden' });
  }
});

app.post('/api/trade/limit/build', async (req, res) => {
  try {
    const { buyer_address, ...order } = req.body ?? {};
    const built = await buildLimitOrder(String(buyer_address ?? ''), order);
    res.json({ success: true, data: built });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message ?? 'Limitorder konnte nicht erstellt werden' });
  }
});

app.post('/api/trade/dca/create', async (req, res) => {
  try {
    const order = await createDcaOrder(req.body);
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message ?? 'DCA-Order konnte nicht erstellt werden' });
  }
});

app.get('/api/trade/dca/:address', async (req, res) => {
  try {
    const orders = await getDcaOrders(req.params.address);
    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message ?? 'DCA-Orders sind aktuell nicht verfügbar' });
  }
});

app.post('/api/trade/cancel', async (req, res) => {
  try {
    const built = await cancelDexhunterOrder(String(req.body?.order_id ?? ''), String(req.body?.address ?? ''));
    res.json({ success: true, data: built });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message ?? 'Order-Storno konnte nicht erstellt werden' });
  }
});

app.post('/api/trade/sign', async (req, res) => {
  try {
    const signed = await addSwapSignatures(req.body?.txCbor, req.body?.signatures);
    res.json({ success: true, data: signed });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message ?? 'Signatur konnte nicht verarbeitet werden' });
  }
});

// ===================================================================
// WALLET API ENDPUNKTE (NEU FÜR VARIANTE B)
// ===================================================================

// Öffentliche, read-only Wallet-Analyse (Koios; 60 Sekunden gecached)
app.get('/api/wallets/:address/analysis', async (req, res) => {
  try {
    const analysis = await getWalletAnalysis(req.params.address);
    res.json({ success: true, data: analysis });
  } catch (error: any) {
    const isValidationError = error.message?.startsWith('Bitte eine gültige');
    console.error(`Fehler in der Wallet-Analyse (${req.params.address}):`, error.message);
    res.status(isValidationError ? 400 : 502).json({ success: false, error: error.message ?? 'Wallet-Daten aktuell nicht verfügbar' });
  }
});

// 1. Alle gespeicherten Wallets abrufen
app.get('/api/wallets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Wallet" ORDER BY "createdAt" DESC');
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Eine neue Wallet registrieren oder updaten (mit Label)
app.post('/api/wallets', async (req, res) => {
  const { address, stakeAddress, label } = req.body;

  if (!address) {
    return res.status(400).json({ success: false, error: 'Wallet-Adresse fehlt!' });
  }

  try {
    const sqlQuery = `
      INSERT INTO "Wallet" (id, address, "stakeAddress", label, "lastChecked", "createdAt")
      VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
      ON CONFLICT (address) 
      DO UPDATE SET label = EXCLUDED.label, "lastChecked" = NOW()
      RETURNING *;
    `;

    const values = [address, stakeAddress || null, label || 'Unlabeled Wallet'];
    const result = await pool.query(sqlQuery, values);

    res.json({ success: true, data: result.rows[0], message: 'Wallet erfolgreich gespeichert!' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 CARDYX Backend aktiv auf http://localhost:${PORT}`);
});
