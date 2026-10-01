# CARDYX – Minswap V2 DEX-Indexer: Analyse und nächste Schritte

## 1. Aktueller Systemstatus

Der CARDYX-Server und die grundlegende Datenpipeline funktionieren bereits:

- Cardano Node: **aktiv, Sync 100 %**
- cardano-db-sync: **läuft ohne Neustarts/Fehler**
- PostgreSQL: **accepting connections**
- Redis: **healthy**
- CARDYX API: **läuft**
- CARDYX Frontend: **läuft**
- Metadata-/On-Chain-Indexer: **funktioniert**
- Asset-Identitäten und On-Chain-Daten: **funktionieren**
- 200 Assets: **funktionieren**
- Aktuell erfasste Balances: ca. 203
- DEX-Indexer: **läuft technisch**, erkennt aber aktuell:
  - `pools: 0`
  - `markets: 0`

Damit liegt das Problem **nicht** bei Node, db-sync, PostgreSQL oder Redis.

Der offene Punkt befindet sich ausschließlich in der **Pool-Erkennung und Dekodierung des Minswap-V2-Adapters**.

---

## 2. Was aktuell falsch bzw. zu ungenau ist

Der derzeitige Minswap-Indexer versucht aus beliebigen Einträgen aus

```text
cardyx.dex_inline_datum_candidate
```

anhand einer groben Struktur zu erraten, ob es sich um einen Minswap-Pool handelt.

Der aktuelle Ansatz prüft sinngemäß:

```text
Datum vorhanden
↓
mindestens 5 Felder
↓
einige Bytes sehen nach Asset-Klasse aus
↓
mindestens 2 größere Integer vorhanden
↓
=> möglicherweise Pool
```

Das ist für einen produktiven DEX-Indexer nicht ausreichend.

### Problematische Logik

Der aktuelle Code verwendet beispielsweise:

```ts
const fields = root.constructor === 0 ? root.fields ?? [] : [];

if (fields.length < 5) continue;
```

Danach:

```ts
const assetClasses = fields
  .slice(0, 3)
  .map(assetClassFrom)
  ...
```

und:

```ts
const reserves = fields
  .map(intFrom)
  .filter((value) => value !== null && value > 1000);
```

Damit werden die Positionen der Felder nicht entsprechend dem tatsächlichen Minswap-V2-Datum interpretiert.

Noch problematischer:

```ts
const reserveAda = reserves[0];
const reserveAsset = reserves[1];
```

Hier wird einfach angenommen, dass die ersten beiden gefundenen Integer die ADA- und Token-Reserven darstellen.

Das ist keine zuverlässige Pool-Erkennung.

---

# 3. Ziel: echter Minswap-V2-Pool-Decoder

CARDYX sollte nicht mehr versuchen, einen Pool anhand von Vermutungen zu erkennen.

Stattdessen soll jeder Kandidat vollständig dekodiert und anschließend validiert werden.

Die gewünschte Pipeline:

```text
Cardano Node
      │
      ▼
cardano-db-sync
      │
      ▼
PostgreSQL
      │
      ▼
DEX-Kandidaten / Inline-Datum
      │
      ▼
Minswap V2 Decoder
      │
      ├── Asset A
      ├── Asset B
      ├── Reserve A
      ├── Reserve B
      ├── Total Liquidity
      └── weitere Pool-Parameter
      │
      ▼
Minswap V2 Pool Validation
      │
      ▼
gültiger Pool
      │
      ▼
CARDYX Price Engine
      │
      ├── Preis
      ├── Liquidität
      ├── Volumen
      └── historische Preiswerte
      │
      ▼
CARDYX API
      │
      ▼
CARDYX Frontend / Token Explorer
```

---

# 4. Pool-Datum korrekt dekodieren

Der Decoder sollte eine klar definierte Struktur zurückgeben.

Beispielsweise:

```ts
type MinswapV2Pool = {
  poolId: string;

  assetA: {
    policyId: string;
    assetName: string;
  };

  assetB: {
    policyId: string;
    assetName: string;
  };

  reserveA: bigint;
  reserveB: bigint;

  totalLiquidity: bigint;

  feeNumerator?: bigint;
  feeDenominator?: bigint;
};
```

Die tatsächliche Feldreihenfolge muss anhand des realen Minswap-V2-Datums bzw. der offiziellen Validator-/SDK-Struktur implementiert werden.

**Keine Annahmen anhand von Feldpositionen treffen, ohne das Datum-Schema zu verifizieren.**

---

# 5. Pool-Validierung

Ein erkannter Kandidat darf erst als Pool gespeichert werden, wenn die relevanten Daten zusammenpassen.

Mindestens folgende Prüfungen sollen durchgeführt werden:

### Asset-Prüfung

```text
Asset A aus Datum
=
Asset A im Pool-UTxO

Asset B aus Datum
=
Asset B im Pool-UTxO
```

### Reserve-Prüfung

```text
Reserve A aus Datum
=
tatsächliche Menge von Asset A im UTxO

Reserve B aus Datum
=
tatsächliche Menge von Asset B im UTxO
```

### Liquidity-Prüfung

Die im Pool-Datum angegebene Liquidität muss mit dem tatsächlichen Pool-Zustand konsistent sein.

Die genauen Regeln müssen anhand der aktuellen Minswap-V2-Validatorlogik implementiert werden.

---

# 6. Pool-NFT / Pool-Identität

Ein Pool sollte zusätzlich über seine tatsächliche Minswap-Pool-Identität geprüft werden.

Nicht einfach:

```text
tx_out_id = Pool
```

annehmen.

Stattdessen soll CARDYX – soweit aus dem Minswap-V2-Protokoll möglich – prüfen:

```text
Pool-UTxO
+
Pool-NFT
+
Datum
+
Asset-Paare
+
Reserven
```

Erst danach wird der Pool als:

```text
VALID_MINSWAP_V2_POOL
```

klassifiziert.

---

# 7. ADA ist ein Sonderfall

ADA ist kein normales Native Asset mit Policy-ID und Asset-Name.

CARDYX muss ADA entsprechend als:

```text
policyId = ""
assetName = ""
```

bzw. nach der internen CARDYX-Asset-Repräsentation behandeln.

Nicht davon ausgehen, dass jedes Asset eine Policy-ID besitzt.

---

# 8. Token-Decimals berücksichtigen

Die Preisberechnung darf nicht einfach lauten:

```ts
price = reserveAda / reserveAsset;
```

Die tatsächlichen Token-Decimals müssen berücksichtigt werden.

Beispiel:

```text
ADA:
6 Decimals

Token:
6 / 8 / 9 / ... Decimals
```

Daher:

```text
humanReserveA = rawReserveA / 10^decimalsA
humanReserveB = rawReserveB / 10^decimalsB
```

und erst danach:

```text
price = humanReserveADA / humanReserveTOKEN
```

Die genaue Richtung der Preisberechnung muss anhand von Asset A/B bestimmt werden.

---

# 9. Preisberechnung

Für einen gültigen ADA/Token-Pool:

```text
ADA Reserve
────────────── = Token-Preis in ADA
Token Reserve
```

Bei Token/Token-Pools muss CARDYX zunächst eine Referenzroute herstellen, beispielsweise:

```text
TOKEN A
   ↓
ADA
   ↓
TOKEN B
```

oder über einen anderen ausreichend liquiden Referenzmarkt.

Dies sollte später Bestandteil einer eigenen CARDYX Price Engine werden.

---

# 10. CARDYX Price Engine

Nach erfolgreicher Pool-Erkennung sollte der DEX-Indexer nicht direkt das Frontend bedienen.

Stattdessen:

```text
Minswap Pool
      ↓
Pool State
      ↓
Price Observation
      ↓
Price Engine
      ↓
Market Snapshot
      ↓
API
      ↓
Frontend
```

Die Datenbanktabellen:

```text
cardyx.dex_pool_price_observation
cardyx.asset_market_snapshot
```

können dafür weiterverwendet bzw. erweitert werden.

---

# 11. Keine Seed-/Fallback-Preise für echte Marktanzeige

Seed- oder Fallback-Daten dürfen nicht als echte Marktpreise dargestellt werden.

Für CARDYX gilt:

```text
Echter On-Chain-Marktpreis
        ↓
nur wenn Pool validiert
```

Falls kein gültiger Pool vorhanden ist:

```text
price = NULL
```

oder im Frontend:

```text
Market price unavailable
```

statt eines erfundenen oder geschätzten Wertes.

Das verhindert, dass CARDYX scheinbar echte Preise anzeigt, die technisch nicht verifiziert wurden.

---

# 12. Debugging: zuerst echte Kandidaten untersuchen

Bevor der Decoder komplett umgebaut wird, soll die tatsächliche Datenstruktur in PostgreSQL untersucht werden.

Abfrage:

```sql
SELECT tx_out_id, datum_json
FROM cardyx.dex_inline_datum_candidate
LIMIT 5;
```

Für besser lesbares JSON:

```sql
SELECT
    tx_out_id,
    jsonb_pretty(datum_json)
FROM cardyx.dex_inline_datum_candidate
LIMIT 2;
```

Diese Ausgabe ist wichtig, weil damit festgestellt werden kann:

```text
Welche Datum-Struktur kommt tatsächlich aus db-sync?
Welche Constructor-Werte gibt es?
Welche Felder sind vorhanden?
Wo stehen Asset A/B?
Wo stehen Reserve A/B?
```

**Erst danach sollte die finale Decoder-Implementierung festgelegt werden.**

---

# 13. Empfohlene Code-Struktur

Der aktuelle Monolith sollte langfristig in klar getrennte Funktionen zerlegt werden:

```ts
decodeMinswapV2Pool(...)
```

Verantwortung:

```text
Raw Datum
↓
MinswapV2Pool
```

Dann:

```ts
validateMinswapV2Pool(...)
```

Verantwortung:

```text
MinswapV2Pool
+
UTxO Value
↓
valid / invalid
```

Dann:

```ts
calculatePoolPrice(...)
```

Verantwortung:

```text
valid Pool
+
Decimals
↓
normalisierter Preis
```

Dann:

```ts
savePoolObservation(...)
```

Verantwortung:

```text
Pool State
↓
PostgreSQL
```

Und schließlich:

```ts
aggregateMarket(...)
```

Verantwortung:

```text
mehrere Pools
↓
CARDYX Market Snapshot
```

---

# 14. Gewünschtes Ergebnis

Nach der Reparatur soll der Indexer beispielsweise melden:

```text
CARDYX DEX Indexer

Minswap V2 candidates: 1842
Valid Minswap V2 pools: 327
Rejected candidates: 1515

Markets: 286
Price observations: 327
```

Die genaue Anzahl hängt natürlich von der tatsächlich synchronisierten Blockchain und der Implementierung ab.

Wichtig ist:

```text
pools > 0
markets > 0
```

und die Werte müssen aus **real validierten On-Chain-Pools** stammen.

---

# 15. Erweiterung auf weitere DEX

Minswap sollte nur der erste Adapter sein.

Zielarchitektur:

```text
                 CARDYX DEX ENGINE
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
   Minswap V2      SundaeSwap       weitere DEX
   Adapter         Adapter          Adapter
        │               │                │
        └───────────────┼────────────────┘
                        ▼
                 Pool Validation
                        │
                        ▼
                  Price Engine
                        │
                        ▼
                Liquidity Engine
                        │
                        ▼
                 Market Snapshot
```

Dadurch wird CARDYX nicht von einem einzigen DEX abhängig.

---

# 16. Grundsatz für CARDYX

Die Architektur soll langfristig folgende Priorität haben:

```text
1. Eigener Cardano Node
2. Eigener db-sync
3. Eigene PostgreSQL-Daten
4. Eigene DEX-Indexer
5. Eigene Pool-Validierung
6. Eigene Price Engine
7. Eigene Market-/Chart-Daten
8. CARDYX API
9. CARDYX Frontend
```

Externe APIs können später als zusätzliche Vergleichs- oder Fallback-Quellen dienen.

Sie sollen aber nicht die Grundlage der lokalen CARDYX-Marktdaten sein, wenn die benötigten Informationen zuverlässig aus der Cardano-Blockchain selbst ermittelt werden können.

---

# 17. Aktueller nächster Schritt

**NICHT:**

- Cardano Node ändern
- PostgreSQL neu installieren
- db-sync neu installieren
- Redis ändern
- Frontend umbauen

**SONDERN:**

### Schritt 1

Echte Daten aus:

```sql
cardyx.dex_inline_datum_candidate
```

anzeigen.

### Schritt 2

Reale Minswap-V2-Datum-Struktur identifizieren.

### Schritt 3

`decodeMinswapV2Pool()` implementieren.

### Schritt 4

Pool anhand von Datum + UTxO + Pool-Identität validieren.

### Schritt 5

Decimals korrekt berücksichtigen.

### Schritt 6

Preisberechnung implementieren.

### Schritt 7

`cardyx.dex_pool_price_observation` befüllen.

### Schritt 8

`cardyx.asset_market_snapshot` erzeugen.

### Schritt 9

CARDYX Frontend mit echten lokalen Preisen versorgen.

---

# 18. Aktueller Status

```text
CARDYX Infrastructure       ✅
Cardano Node                ✅
Node Sync                   ✅ 100 %
db-sync                     ✅
PostgreSQL                  ✅
Redis                       ✅
API                         ✅
Frontend                    ✅
On-Chain Indexer            ✅
Metadata Indexer            ✅
Asset Catalog               ✅
DEX Indexer Framework       ✅

Minswap V2 Decoder          ⚠️ offen
Pool Validation             ⚠️ offen
Pool Detection              ❌ aktuell 0
Price Engine                ⚠️ wartet auf Pools
Volume Engine               ⚠️ wartet auf Trades
Charts                      ⚠️ warten auf Price History
```

## Wichtigste Erkenntnis

**CARDYX ist nicht an einem Server-/Node-Problem gescheitert.**

Die Infrastruktur und die On-Chain-Datenversorgung funktionieren.

Der aktuelle Engpass ist die fachlich korrekte Interpretation und Validierung der Minswap-V2-Pool-Daten.

Der nächste technische Schritt ist deshalb die Untersuchung der tatsächlichen Inhalte von:

```text
cardyx.dex_inline_datum_candidate
```

und darauf basierend die Implementierung eines echten Minswap-V2-Decoders und Validators.

---

## Ziel

Am Ende soll CARDYX nicht einfach einen externen Preis anzeigen, sondern selbst nachvollziehbar ermitteln können:

```text
Pool
→ Assets
→ Reserven
→ Liquidität
→ Trades
→ Preis
→ Volumen
→ historische Daten
→ Chart
```

aus der eigenen Cardano-Infrastruktur.

Das ist die Grundlage für einen echten lokalen CARDYX-DEX-/Market-Indexer.
