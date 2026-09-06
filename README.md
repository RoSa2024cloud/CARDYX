<div align="center">

# CARDYX

### Cardano Digital Asset Intelligence

**Professionelle Analytics- und Intelligence-Plattform für das Cardano-Ökosystem.**

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_15-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis_7-DC382D?style=flat-square&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Cardano](https://img.shields.io/badge/Cardano-0033AD?style=flat-square&logo=cardano&logoColor=white)

</div>

---

## Über das Projekt

CARDYX bereitet Cardano-Markt-, DEX-, Wallet- und On-Chain-Daten verständlich auf und erzeugt daraus nutzbare Informationen für Trader, Investoren, Projekte und Entwickler. Der Fokus liegt auf **Daten, Transparenz und Analyse** – nicht auf unbelegten Kauf- oder Verkaufsempfehlungen.

> 🐶 **cDOG — The On-Chain Scout** ist das Maskottchen und die wiedererkennbare Persönlichkeit des CARDYX-Ökosystems. Er begleitet den Nutzer als Market Watcher, Whale Detector, Risk Scanner und Smart-Money-Analyst.

---

## Features

| Bereich | Beschreibung |
| --- | --- |
| **Dashboard** | Zentrale Übersicht: ADA-Kurs, Netzwerkstatistiken, DEX-Volumen, TVL, Trending Tokens, Top Gainer/Loser |
| **Token Explorer** | Analyse-Seiten je Token: Preis, Market Cap, Liquidität, Volumen, Holder-Verteilung, DEX-Paare, Historie |
| **Wallet Explorer** | Adress-Analyse: ADA- & Token-Bestände, NFTs, Transaktionen, Portfolio-Entwicklung, Wallet Tracking |
| **cDOG Intelligence** | Market Watcher, Whale Detector, Risk Scanner (transparenter On-Chain-Score), Smart Money, Alerts |
| **Project Directory** | Projektprofile mit Tokenomics, Team, Audits und optionaler Verifizierung |
| **Developer API** | Geplanter Daten- und Analysezugang für Entwickler, Bots und Research |

---

## Tech-Stack

| Ebene | Technologie |
| --- | --- |
| **Frontend** | Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · lucide-react |
| **Backend** | Node.js · Express 5 · TypeScript · Prisma (Postgres-Provider) |
| **Datenbank** | PostgreSQL 15 · Redis 7 (Cache) |
| **Blockchain** | Cardano Node · eigene Indexer-Komponenten *(in Entwicklung)* |
| **Infrastruktur** | Docker · Docker Compose · Git |

---

## Projektstruktur

```text
CARDYX/
├── frontend/               # Web-Dashboard (Next.js, Port 3000)
│   └── app/
│       └── components/     # MarketTracker, WalletRadar, …
├── backend/                # REST-API (Express, Port 4000)
│   ├── src/
│   │   ├── index.ts        # API-Server & Routen
│   │   └── token.service.ts
│   ├── prisma/             # Schema & Contract
│   └── migrations/         # Datenbank-Migrationen
├── indexer/                # On-Chain-Indexer (geplant)
├── docker-compose.yml      # PostgreSQL + Redis
└── START_GUIDE.txt         # Schnellanleitung für die lokale Entwicklung
```

---

## Voraussetzungen

- **Node.js** ≥ 24 LTS
- **Docker Desktop** (für PostgreSQL & Redis)
- **npm**

---

## Quickstart

### 1. Infrastruktur starten

```bash
docker compose up -d
```

Startet PostgreSQL (`localhost:5432`) und Redis (`localhost:6379`) als Container.
Zum Stoppen: `docker compose down`

### 2. Backend starten

```bash
cd backend
npm install
npm run dev
```

Die API läuft anschließend auf [http://localhost:4000](http://localhost:4000).

### 3. Frontend starten

```bash
cd frontend
npm install
npm run dev
```

Das Dashboard läuft anschließend auf [http://localhost:3000](http://localhost:3000).

---

## API-Übersicht

| Methode | Endpoint | Beschreibung |
| --- | --- | --- |
| `GET` | `/` | System-Status der API |
| `GET` | `/api/tokens` | Live-Token-Daten inkl. ADA-Kurs (USD) |
| `GET` | `/api/wallets` | Alle gespeicherten Wallets |
| `GET` | `/api/v1/test-seed` | Schreibt einen Test-Datensatz (Entwicklung) |

---

## Roadmap

| Phase | Inhalt | Status |
| --- | --- | --- |
| **0 – Foundation** | Repository, Next.js, TypeScript, Docker, PostgreSQL | ✅ Abgeschlossen |
| **1 – Cardano Data Layer** | Cardano Node, Indexer, Blocks, Transactions, Assets | 🔜 Geplant |
| **2 – DEX Data** | Trades, Preise, Liquidität, Trading-Paare, Volumen | 🔜 Geplant |
| **3 – Token Explorer** | Erste vollständige Nutzerfunktion | 🔜 Geplant |
| **4 – Wallet Explorer** | Portfolio- und Wallet-Analytics | 🔜 Geplant |
| **5 – Alerts** | Near-Realtime-Benachrichtigungen | 🔜 Geplant |
| **6 – cDOG Intelligence** | Whale Detector, Risk Scanner, Smart Money | 🔜 Geplant |
| **7 – Premium** | Accounts, Subscriptions, $cDOG Holder Access, API | 🔜 Geplant |
| **8 – Project Directory** | Projektprofile, Verifizierung, Team-Tools | 🔜 Geplant |

---

## Sicherheitsgrundsätze

- Keine Speicherung privater Wallet-Keys – CARDYX fordert **niemals** Seed Phrases oder Private Keys an
- Secrets ausschließlich über Environment Variables
- Datenbank nicht öffentlich erreichbar, API mit Rate Limits
- Getrennte Produktions- und Entwicklungsumgebungen
- Regelmäßige Backups, Monitoring und MFA für Admin-Bereiche

---

## Dokumentation

| Dokument | Inhalt |
| --- | --- |
| [CARDYX MASTERPLAN.md](CARDYX%20MASTERPLAN.md) | Vision, Produktbereiche, Geschäftsmodell, Architektur |
| [START_GUIDE.txt](START_GUIDE.txt) | Lokale Entwicklungsumgebung in 3 Schritten |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Schritt-für-Schritt-Anleitung für den Produktivbetrieb (Vercel + Railway) |
| [backend/README.md](backend/README.md) | API-Server, Scripts & Datenbank |
| [frontend/README.md](frontend/README.md) | Web-Dashboard, Scripts & Komponenten |

---

<div align="center">

**CARDYX** – Professionalität · Transparenz · Community

*„Ich nutze ein professionelles Cardano-Analytics-Tool – und cDOG begleitet mich dabei."*

</div>
