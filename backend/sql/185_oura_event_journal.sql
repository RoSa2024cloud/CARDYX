CREATE TABLE IF NOT EXISTS cardyx.oura_event_journal (
  event_id text PRIMARY KEY CHECK (event_id ~ '^[a-f0-9]{64}$'),
  event_type text NOT NULL CHECK (event_type IN ('apply', 'undo', 'reset')),
  slot bigint,
  block_hash text CHECK (block_hash IS NULL OR block_hash ~ '^[a-f0-9]{64}$'),
  record jsonb,
  is_canonical boolean NOT NULL DEFAULT false,
  received_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((slot IS NULL) = (block_hash IS NULL)),
  CHECK ((event_type = 'reset') = (record IS NULL))
);

CREATE INDEX IF NOT EXISTS oura_event_journal_canonical_slot_idx
  ON cardyx.oura_event_journal (slot DESC)
  WHERE event_type = 'apply' AND is_canonical = true;

GRANT SELECT, INSERT, UPDATE ON cardyx.oura_event_journal TO cardyx_api;