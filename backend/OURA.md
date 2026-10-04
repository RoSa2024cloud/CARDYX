# CARDYX Oura Trade Projection

## Data Flow

- Oura v2.2 follows the Cardano mainnet node over the internal `cardyx-node` network.
- A generated `Select` filter tracks validated pool addresses and pool NFT fingerprints from `cardyx.dex_pool_registry`. Shelley pools use their address; Byron pools use the NFT fingerprint.
- Oura persists its chain cursor in Redis and sends matching transaction records to the authenticated internal API endpoint `/api/internal/oura/events`.
- The API writes events idempotently to `cardyx.oura_event_journal`.
- `cardyx.oura_confirmed_pool_trades` joins Oura-observed transaction hashes to the existing db-sync validated trade decoder. Trades are exposed only when the observation is canonical and db-sync confirms the pool transition.
- The trade UI polls every five seconds and reports the active source. The pool-state indexer is independently switchable and now resumes through bounded Round-Robin batches rather than an unbounded full scan.

Oura v2.2's WebHook sends the transaction record as its JSON body and chain action/point in `x-oura-chainsync-action` and `x-oura-chainsync-point` headers. The API canonicalizer checks stored slot/hash pairs against db-sync every five seconds. Redis and the journal make retries safe; an event is not considered final until db-sync sees its block hash.

## Migrations

Apply these SQL files in numeric order to `cexplorer` before deploying the API image:

- `sql/184_reconcile_dex_pool_state_rollbacks.sql`
- `sql/185_oura_event_journal.sql`
- `sql/186_oura_pool_filter_patterns.sql`
- `sql/187_oura_event_canonicality.sql`
- `sql/188_oura_confirmed_pool_trades.sql`
- `sql/189_deduplicate_oura_confirmed_pool_trades.sql`
- `sql/190_controlled_pool_state_backfill.sql`

The filter function returns Shelley addresses where available and exact pool NFT fingerprints otherwise. Only enabled, validated registry entries are selected, so newly registered pools enter the next filter refresh without a hard-coded address list.

## Secrets And Runtime

`CARDYX_OURA_WEBHOOK_TOKEN` is a random 32-byte hex value stored only in `/srv/cardyx/secrets/cardyx-api.env` with mode `0600`. Never place it in Git, generated TOML tracked by Git, or logs. The generated `/srv/cardyx/compose/oura/daemon.toml` is root-owned mode `0400` and mounted read-only.

Oura runs as a read-only container with all Linux capabilities dropped, `no-new-privileges`, no published host ports, and no Docker socket. Its only networks are `cardyx-node` and `cardyx-internal`. API authentication and PostgreSQL persistence remain internal.

The host script `scripts/refresh-oura-filters.sh` regenerates the config from the live registry. A `cardyx` user crontab runs it every five minutes under `flock`; Oura is recreated only when the config hash changes. The Redis cursor survives those restarts. The script uses the production Compose stack and does not recreate the API.

## Validation

- Oura `v2.2.0` parses mixed Shelley address and asset fingerprint patterns.
- API event tests cover authenticated header parsing, idempotent delivery, undo/reset handling, and rejected invalid envelopes.
- PGlite integration tests cover migrations, replay, canonicality, rollback, and the projected trade filter.
- The production SNEK route was checked against the live endpoint; exact duplicate trade rows are removed by migration 189.

Pool State uses a persistent Round-Robin cursor with a maximum of 25 pools, 100 outputs per pool and one batch per cycle. Its `caughtUp` status remains false until all validated pools have been scanned. `RUN_BALANCE_REFRESH=false` leaves existing balance snapshots and daily holder-history writes intact while skipping only their full db-sync recomputation. The production resume overlay applies those settings; the Local Indexer continues metadata work without triggering the expensive balance scan.

The event journal currently retains raw filtered events indefinitely; add bounded retention or partitioning once its observed growth rate is known. The projection only needs a six-hour canonicality window, but historical data may still be useful for audits.
