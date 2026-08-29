import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 4000;

const pool = new Pool({
  connectionString: "postgresql://cardyx_admin:secret_local_password@localhost:5432/cardyx_dev?schema=public"
});

app.use(express.json());

// Diese Funktion prüft beim Starten des Backends, ob die Tabelle existiert, und legt sie bei Bedarf an
async function initDatabase() {
  try {
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
    console.log('✅ PostgreSQL-Tabellen-Validierung erfolgreich!');
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

app.listen(PORT, () => {
  console.log(`🚀 CARDYX Backend aktiv auf http://localhost:${PORT}`);
});
