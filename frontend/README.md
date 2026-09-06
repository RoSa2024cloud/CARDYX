# CARDYX Frontend

Web-Dashboard der CARDYX-Plattform – Cardano Digital Asset Intelligence.

Das Dashboard visualisiert Cardano-Markt-, Token- und Wallet-Daten aus der [CARDYX API](../backend) und ist die zentrale Benutzeroberfläche der Plattform.

## Tech-Stack

| Komponente | Technologie |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| UI | React 19 · Tailwind CSS 4 · lucide-react |
| Sprache | TypeScript |

## Voraussetzungen

Für Live-Daten muss das Backend inklusive Datenbank laufen (siehe [README im Projektroot](../README.md)):

```bash
docker compose up -d   # PostgreSQL & Redis
cd ../backend && npm run dev
```

## Entwicklung

```bash
npm install
npm run dev
```

Das Dashboard läuft anschließend auf [http://localhost:3000](http://localhost:3000) und aktualisiert sich bei Dateiänderungen automatisch.

## Scripts

| Script | Beschreibung |
| --- | --- |
| `npm run dev` | Startet den Entwicklungsserver |
| `npm run build` | Erstellt den Produktions-Build |
| `npm run start` | Startet den Produktions-Build |
| `npm run lint` | Führt ESLint aus |

## Projektstruktur

```text
frontend/
├── app/
│   ├── layout.tsx          # Root-Layout
│   ├── page.tsx            # Dashboard-Startseite
│   ├── globals.css         # Globale Styles (Tailwind)
│   └── components/
│       ├── MarketTracker.tsx   # Markt- & Token-Übersicht
│       └── WalletRadar.tsx     # Wallet-Analyse
└── public/                 # Statische Assets
```
