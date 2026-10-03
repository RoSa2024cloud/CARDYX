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

## Adminverwaltung und NFT-Abos

Die Verwaltungsseite ist unter `/admin` erreichbar; auf der Marketseite liegt der Einstieg im Einstellungsdialog. Die separate API verwendet `/api/admin` und hat keinen Standardbenutzer und kein Standardpasswort.

Vor dem Start die Migrationen [sql/176_subscription_access.sql](sql/176_subscription_access.sql) und [sql/177_admin_management.sql](sql/177_admin_management.sql) transaktional in `cexplorer` anwenden. `INITIALIZE_DATABASE=false` legt diese Tabellen nicht automatisch an.

Für die On-chain-Mint-/Burn-Historie zusätzlich [sql/178_asset_mint_burn_history.sql](sql/178_asset_mint_burn_history.sql) und [sql/179_expired_policy_supply_cap.sql](sql/179_expired_policy_supply_cap.sql) transaktional in `cexplorer` anwenden. [sql/180_guinea_pig_verified_decimals.sql](sql/180_guinea_pig_verified_decimals.sql) ergänzt die auf Cardanoscan bestätigten Dezimalstellen für Guinea Pig. `GET /api/market/supply-history/:id` liefert die signierten `ma_tx_mint`-Events, gemintete und geburnte Rohmengen sowie den Netto-Bestand ausschließlich für Token mit lokalem Preis. Eine Policy-Obergrenze wird nur ausgewiesen, wenn das gespeicherte Native-Script am aktuellen Chain-Slot weitere Mints nachweislich ausschließt. Ohne diesen Nachweis zeigen Max Supply und FDV die aktuelle DB-Sync-Nettoausgabe ausdrücklich als Schätzung; diese Menge wird nicht als verifizierter Cap behandelt.

Für die DEX-Pool-Liquiditätsgrenze und automatische Discovery registrierter Adapter zusätzlich [sql/181_remove_pool_liquidity_floor.sql](sql/181_remove_pool_liquidity_floor.sql) und [sql/182_incremental_dex_pool_discovery.sql](sql/182_incremental_dex_pool_discovery.sql) transaktional in `cexplorer` anwenden. Der DEX-Indexer verarbeitet bekannte Pool-NFT-Policies in begrenzten Cursor-Batches und registriert nur Kandidaten, deren DEX-Adapter Pool-NFT, Datum und Assetpaar validiert. Neue DEX-Versionen oder unbekannte Pool-Datumformate benötigen weiterhin einen eigenen Adapter.

Den aus Cardano DB-Sync validierten VyFi USDA/ADA-Pool registriert [sql/183_register_vyfi_usda_ada_v1.sql](sql/183_register_vyfi_usda_ada_v1.sql) anhand seiner aktuellen Pool-NFT-UTxO und der USDA-Policy-/Asset-ID.

Admin-Zugang direkt in einem interaktiven Terminal einrichten:

```bash
node --import tsx src/admin-setup.ts /path/to/cardyx-api.env https://cardyx.example cardyx-admin
```

Das Programm fragt das Passwort verdeckt ab, speichert nur einen gesalzenen scrypt-Hash und setzt die erlaubte Frontend-Origin. Danach den API-Container neu erstellen. Das Passwort muss 16 bis 256 Zeichen enthalten; Passwortwechsel invalidieren vorhandene Admin-Sitzungen. Niemals Passwoerter als Kommandozeilenargument, im Chat oder im Repository hinterlegen.

Im Produktionscontainer kann das Programm mit `docker run --rm -it --network none --entrypoint node`, dem API-Image und einem Bind-Mount des Secrets-Verzeichnisses ausgefuehrt werden. Verwende die UID/GID des Besitzers der Umgebungsdatei. Auf dem privaten lokalen HTTP-Netz setzt das Programm die Cookie-Secure-Flags explizit auf `false`; vor oeffentlichem Betrieb sind HTTPS und `true` erforderlich.

| Methode | Endpoint | Zugriff |
| --- | --- | --- |
| GET | `/api/admin/session` | Sitzungsstatus, keine Zugangsdaten |
| POST | `/api/admin/login` | Erlaubte Origin, Passwort und Anfragelimit |
| POST | `/api/admin/logout` | Admin-Sitzung und CSRF-Token |
| GET / PUT | `/api/admin/configuration` | Admin-Sitzung; Schreibzugriff mit CSRF und Revision |
| GET | `/api/admin/overview` | Datenbank- und Indexerstatus, keine Shell-Aktionen |
| GET | `/api/admin/audit` | Letzte 100 Adminereignisse |
| GET | `/api/application/configuration` | Oeffentliche Anzeige- und Abostufenregeln |

Sitzungen sind 30 Minuten gueltig, liegen gehasht in PostgreSQL und verwenden HTTP-only/SameSite-Strict-Cookies. Alle Admin-Schreibzugriffe pruefen Origin und CSRF. Loginfehler werden ohne Passwort/Token protokolliert und sowohl kurzfristig als auch datenbankseitig begrenzt. Konfigurationsaenderungen und ihre Vorher-/Nachher-Werte werden atomar protokolliert. Veraltete Revisionen erhalten HTTP 409.

Die gespeicherten NFT-Regeln ersetzen nach dem ersten Speichern `CARDYX_SUBSCRIPTION_NFT_POLICIES`. BASIC/PRO/PREMIUM werden nur nach signiertem Wallet-Nachweis und serverseitigem NFT-Bestandscheck vergeben. Adminrechte sind davon getrennt. `/api/trade` prueft die konfigurierte Trading-Mindeststufe serverseitig; neue kostenpflichtige APIs muessen ebenfalls `requireFeatureAccess` verwenden. Gemeinsame oeffentliche Chain-/Marktdaten bleiben oeffentlich. Sidebarregeln sind kein Ersatz fuer API-Autorisierung. Geplante Anwendungen werden durch das Aktivieren einer Regel nicht implementiert.

Tests:

```bash
node --import tsx --test src/admin.service.test.ts src/subscription.service.test.ts
```

Mit `CARDYX_TEST_DATABASE=true` und `DATABASE_URL` prueft derselbe Test zusaetzlich echte PostgreSQL-Speicherrechte, Konflikte und Audit-Schreibzugriffe in einer abschliessend zurueckgerollten Transaktion.

Ein serverseitig bestaetigter Admin erhaelt Zugriff auf vorhandene Terminal-Bereiche und umgeht die konfigurierten Abo-/Feature-Sperren. Admin-Schreibzugriffe sind weiterhin auf die erlaubte Origin beschraenkt; Konfigurationsaenderungen benoetigen zusaetzlich CSRF. Der Admin-Cookie gilt unter `/api`; gueltige aeltere `/api/admin`-Cookies werden beim Sitzungscheck migriert und bei Abmeldung beide Pfade geloescht. ADMIN ist eine Rolle, keine NFT-Abostufe. Nach Abmeldung oder Ablauf gilt wieder die tatsaechliche NFT-Abostufe (ohne Nachweis FREE). Geplante Sidebar-Anwendungen oeffnen fuer Admins ihre hervorgehobene Konfigurationszeile, nicht eine vorgetaeuschte fertige Anwendung.

## Versorgung lokaler DEX-Tokens

Supply-Anreicherung wird nur fuer registrierte Assets mit frischem `cardyx-local-dex-indexer`-Preis, Policy-ID und Asset-Name geplant. Minswap-Metriken werden gegen die exakte Tokenidentitaet geprueft und mit hoechstens acht parallelen Hintergrundanfragen geladen. Positive Supply-Antworten bleiben fuenf Minuten, leere/negative Antworten eine Minute im Prozesscache. Der Katalog wartet nicht auf externe Antworten: Er liefert sofort die lokale On-Chain-Schaetzung; bestaetigte Umlauf- und Gesamtversorgung erscheinen nach dem naechsten Katalog-Refresh.

Market Cap verwendet eine positive, verifizierte Umlaufmenge. Fehlt diese, wird Preis × aktuelle unspent On-Chain-Menge sichtbar als `Market cap · estimate` markiert; sie wird nicht als bestaetigte Umlaufmenge ausgegeben. FDV basiert auf einer explizit gemeldeten Maximalversorgung, sonst auf gemeldeter Gesamtversorgung und zuletzt auf normalisierter On-Chain-Menge. Eine unbekannte Maximalversorgung bleibt `—`. Rohmengen werden als Integer/BigInt normalisiert; ohne bekannte Dezimalstellen wird keine On-Chain-Menge erfunden.
