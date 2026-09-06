# CARDYX Backend

REST-API der CARDYX-Plattform – Cardano Digital Asset Intelligence.

Der API-Server stellt Token-, Markt- und Wallet-Daten für das [CARDYX Dashboard](../frontend) bereit und bildet die Schnittstelle zwischen PostgreSQL-Datenbank und Frontend.

## Tech-Stack

| Komponente | Technologie |
| --- | --- |
| Runtime | Node.js ≥ 24 LTS |
| Framework | Express 5 |
| Sprache | TypeScript (via tsx) |
| Datenbank | PostgreSQL 15 (nativer `pg`-Treiber, Prisma Postgres-Provider) |

## Voraussetzungen

Die Datenbank-Infrastruktur wird über Docker Compose im Projektroot gestartet:

```bash
docker compose up -d
```

## Entwicklung

```bash
npm install
npm run dev
```

Der Server läuft anschließend auf [http://localhost:4000](http://localhost:4000) und lädt bei Dateiänderungen automatisch neu (`tsx watch`).

## Scripts

| Script | Beschreibung |
| --- | --- |
| `npm run dev` | Startet den API-Server im Watch-Modus |
| `npm run contract:emit` | Emittiert Contract-Artefakte nach Änderungen am Prisma-Contract |

## API-Endpunkte

| Methode | Endpoint | Beschreibung |
| --- | --- | --- |
| `GET` | `/` | System-Status der API |
| `GET` | `/api/tokens` | Live-Token-Daten inkl. ADA-Kurs (USD) |
| `GET` | `/api/wallets` | Alle gespeicherten Wallets |
| `GET` | `/api/v1/test-seed` | Schreibt einen Test-Datensatz (Entwicklung) |

## Projektstruktur

```text
backend/
├── src/
│   ├── index.ts            # API-Server, Routen & Tabellen-Validierung
│   └── token.service.ts    # Token-Aggregation & Persistenz
├── prisma/                 # Schema, Contract & Datenbank-Client
├── migrations/             # Datenbank-Migrationen
└── prisma.config.ts        # Prisma-Konfiguration
```

## Prisma Next

Das Prisma-Next-Setup liegt in [prisma/schema.prisma](prisma/schema.prisma), [prisma.config.ts](prisma.config.ts) und [prisma/db.ts](prisma/db.ts). Provider-spezifische Referenz: [prisma-next.md](prisma-next.md).
