import express from 'express';
import pg from 'pg';
import { updateAndGetTokens } from './token.service';
import { getTopTokens, getTokenChart } from './market.service';
import cors from 'cors';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 4000;

// Datenbankverbindung: Online via DATABASE_URL (z.B. Railway/Neon),
// lokal mit Docker-Compose-Fallback. Secrets niemals im Code!
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://cardyx_admin:secret_local_password@localhost:5432/cardyx_dev?schema=public';

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Managed-Postgres-Anbieter (Railway, Neon, Supabase) verlangen SSL
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
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
initDatabase();

// System-Status Route
app.get('/', (req, res) => {
  res.json({ status: 'online', message: 'CARDYX Backend läuft fehlerfrei mit nativem PG-Treiber!' });
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

app.get('/api/market/top50', async (req, res) => {
  try {
    const market = await getTopTokens();
    res.json({ success: true, data: market });
  } catch (error: any) {
    console.error('Fehler in der Market-Route:', error.message);
    res.status(502).json({ success: false, error: 'Marktdaten aktuell nicht verfügbar' });
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
// WALLET API ENDPUNKTE (NEU FÜR VARIANTE B)
// ===================================================================

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
runTokenUpdate();

// Danach alle 60 Sekunden im Hintergrund wiederholen
setInterval(runTokenUpdate, UPDATE_INTERVAL);


app.listen(PORT, () => {
  console.log(`🚀 CARDYX Backend aktiv auf http://localhost:${PORT}`);
});
