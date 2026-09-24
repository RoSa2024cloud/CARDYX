import express from 'express';
import pg from 'pg';
import 'dotenv/config';
import { updateAndGetTokens } from './token.service';
import { getTokenById, getTopTokens, getTokenChart } from './market.service';
import { getWalletAnalysis } from './wallet.service';
import { addSwapSignatures, buildSwap, dexhunterConfigured, estimateSwap, searchDexhunterTokens } from './dexhunter.service';
import cors from 'cors';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 4000;
const initializeDatabase = process.env.INITIALIZE_DATABASE !== 'false';
const runBackgroundTokenUpdate = process.env.RUN_BACKGROUND_TOKEN_UPDATE !== 'false';

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

// System-Status Route
app.get('/', (req, res) => {
  res.json({ status: 'online', message: 'CARDYX Backend läuft fehlerfrei mit nativem PG-Treiber!' });
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

    res.json({ success: true, data: status });
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

// Echte Live-Daten für das CARDYX-Dashboard bereitstellen
// backend/src/index.ts

app.get('/api/tokens', async (req, res) => {
  try {
    // 1. Zünde den Service direkt, um die frisch berechneten Token abzugreifen
    const tokenData = await updateAndGetTokens();
    
    // 2. Schicke die Live-Daten direkt an dein Next.js Frontend
    res.json({ 
      success: true, 
      data: {
        adaPriceUsd: tokenData.adaPriceUsd,
        tokens: tokenData.tokens // Das liefert nun garantiert SNEK, HOSKY und MIN!
      }
    });
  } catch (error: any) {
    console.error("Fehler in der Token-Route:", error.message);
    res.status(500).json({ success: false, error: 'Fehler beim Laden der Token-Daten' });
  }
});


// ===================================================================
// MARKET API: Top 50 Cardano-Ökosystem-Token (Live via CoinGecko)
// ===================================================================

async function enrichMarketWithCatalog(market: Awaited<ReturnType<typeof getTopTokens>>) {
  try {
    const catalog = await pool.query<{
      market_id: string;
      category: string;
      is_verified: boolean;
    }>('SELECT market_id, category, is_verified FROM cardyx.asset_catalog_public');
    const catalogByMarketId = new Map(catalog.rows.map((entry) => [entry.market_id, entry]));

    return {
      ...market,
      tokens: market.tokens.map((token) => {
        const catalogEntry = catalogByMarketId.get(token.id);
        return {
          ...token,
          category: catalogEntry?.category ?? 'other',
          catalogVerified: catalogEntry?.is_verified ?? false,
        };
      }),
    };
  } catch (error: any) {
    console.warn('CARDYX-Asset-Katalog nicht verfügbar, liefere Marktfeed ohne Kategorisierung:', error.message);
    return {
      ...market,
      tokens: market.tokens.map((token) => ({ ...token, category: 'other', catalogVerified: false })),
    };
  }
}

app.get('/api/market/top200', async (_req, res) => {
  try {
    const market = await enrichMarketWithCatalog(await getTopTokens());
    res.json({ success: true, data: market });
  } catch (error: any) {
    console.error('Fehler in der Market-Route:', error.message);
    res.status(502).json({ success: false, error: 'Marktdaten aktuell nicht verfügbar' });
  }
});

// Kompatibilitaet fuer bestehende Clients, die die fruehere Top-50-Route nutzen.
app.get('/api/market/top50', async (_req, res) => {
  try {
    const market = await enrichMarketWithCatalog(await getTopTokens());
    res.json({ success: true, data: { ...market, total: Math.min(market.total, 50), tokens: market.tokens.slice(0, 50) } });
  } catch (error: any) {
    console.error('Fehler in der Market-Route:', error.message);
    res.status(502).json({ success: false, error: 'Marktdaten aktuell nicht verfügbar' });
  }
});

// Einzelner Token für die dedizierte CARDYX-Analyse-Seite
app.get('/api/market/token/:id', async (req, res) => {
  try {
    const detail = await getTokenById(req.params.id);
    if (!detail) {
      return res.status(404).json({ success: false, error: 'Token nicht in den CARDYX Top 50 gefunden' });
    }
    res.json({ success: true, data: detail });
  } catch (error: any) {
    console.error(`Fehler in der Token-Route (${req.params.id}):`, error.message);
    res.status(502).json({ success: false, error: 'Token-Daten aktuell nicht verfügbar' });
  }
});

// OHLC-Chartdaten eines einzelnen Tokens (7 oder 30 Tage)
app.get('/api/market/chart/:id', async (req, res) => {
  const { id } = req.params;
  const days = req.query.days === '30' ? '30' : '7';

  try {
    const candles = await getTokenChart(id, days);
    res.json({ success: true, data: { id, days, candles } });
  } catch (error: any) {
    console.error(`Fehler in der Chart-Route (${id}):`, error.message);
    res.status(502).json({ success: false, error: 'Chartdaten aktuell nicht verfügbar' });
  }
});

// ===================================================================
// DEXHUNTER PARTNER API: Quote -> Build -> Wallet signiert -> Witness
// ===================================================================

app.get('/api/trade/status', (req, res) => {
  res.json({ success: true, data: { configured: dexhunterConfigured() } });
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

app.post('/api/trade/estimate', async (req, res) => {
  try {
    const quote = await estimateSwap(req.body);
    res.json({ success: true, data: quote });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message ?? 'Quote nicht verfügbar' });
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

// ===================================================================
// AUTOMATISCHER TAKTGEBER (INTERVAL-UPDATE)
// ===================================================================

const UPDATE_INTERVAL = 60000; 

async function runTokenUpdate() {
  try {
    console.log('🔄 cDOG Taktgeber: Starte Kurs-Abgleich...');
    // Zündet die Schleife in der token.service.ts
    const updatedData = await updateAndGetTokens(); 
    console.log(`✅ cDOG Taktgeber: Preise erfolgreich aktualisiert!`);
  } catch (error: any) {
    console.error('⚠️ cDOG Taktgeber: Fehler beim Update:', error.message);
  }
}

// Sofort beim Starten des Backends einmal ausführen!
if (runBackgroundTokenUpdate) {
  runTokenUpdate();
  setInterval(runTokenUpdate, UPDATE_INTERVAL);
}


app.listen(PORT, () => {
  console.log(`🚀 CARDYX Backend aktiv auf http://localhost:${PORT}`);
});
