# CARDYX – Deployment-Anleitung (Produktion)

So stellst du CARDYX online. Gesamtdauer: ca. 15–20 Minuten.

---

## Architektur

| Komponente | Anbieter (Empfehlung) | Kosten |
| --- | --- | --- |
| **Frontend** (Next.js) | Vercel | kostenlos |
| **Backend** (Express-API) | Railway oder Render | ~5 €/Monat (Starter kostenlos möglich) |
| **PostgreSQL** | Railway / Neon | kostenlos (Starter) |
| **Redis** | Upstash | kostenlos (Serverless) |

---

## Schritt 1: Datenbank online (Neon – 3 Minuten)

1. Auf [neon.tech](https://neon.tech) registrieren → Projekt `cardyx` anlegen
2. Connection String kopieren (sieht so aus):
   ```
   postgresql://user:pass@ep-xyz.eu-central-1.aws.neon.tech/cardyx?sslmode=require
   ```

## Schritt 2: Backend deployen (Railway – 5 Minuten)

1. Auf [railway.app](https://railway.app) mit GitHub anmelden → **New Project → Deploy from GitHub Repo** → `CARDYX` wählen
2. **Root Directory** auf `backend` stellen (Settings → Build)
3. Unter **Variables** diese Umgebungsvariablen setzen:
   ```
   DATABASE_URL = <dein Neon Connection String>
   FRONTEND_URL = https://deine-app.vercel.app   (kommt aus Schritt 3)
   PORT = 4000
   ```
4. Railway vergibt eine öffentliche URL, z.B. `https://cardyx-backend.up.railway.app`
   → Test: `https://cardyx-backend.up.railway.app/api/market/top50` sollte JSON liefern

## Schritt 3: Frontend deployen (Vercel – 5 Minuten)

1. Auf [vercel.com](https://vercel.com) mit GitHub anmelden → **Add New → Project** → `CARDYX` importieren
2. **Root Directory**: `frontend`
3. **Environment Variable** setzen:
   ```
   NEXT_PUBLIC_API_URL = https://cardyx-backend.up.railway.app
   ```
4. Deploy klicken → du bekommst `https://cardyx.vercel.app` (oder eigene Domain)

## Schritt 4: URLs verheiraten

1. Die finale Vercel-URL in Railway als `FRONTEND_URL` eintragen (CORS!)
2. Redeploy auslösen – fertig. 🎉

---

## Wichtig

- **Niemals** `frontend/.env.local` oder Secrets committen – alles läuft über die Env-Variablen der Plattformen.
- Wallet-Connect (CIP-30) funktioniert online sofort (reine Browser-API, HTTPS sei Dank).
- CoinGecko-Calls laufen serverseitig über das Backend – keine CORS-Probleme.
- Der Cardano Node / Indexer (Phase 1/2) gehört später auf einen eigenen Server (siehe MASTERPLAN §12).

## Troubleshooting

| Problem | Lösung |
| --- | --- |
| Frontend zeigt „Verbindung fehlgeschlagen" | `NEXT_PUBLIC_API_URL` prüfen + Vercel Redeploy |
| CORS-Fehler in der Browser-Konsole | `FRONTEND_URL` im Backend exakt auf die Vercel-URL setzen (mit `https://`, ohne Slash am Ende) |
| Backend startet nicht | Railway-Logs prüfen: `DATABASE_URL` korrekt? SSL aktiv? |
| CoinGecko 429 (Rate-Limit) | Normal bei vielen gleichzeitigen Chart-Calls; 60s-Cache fängt das meiste ab. Optional: kostenloser Demo-API-Key |
