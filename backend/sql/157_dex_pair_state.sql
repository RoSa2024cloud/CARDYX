-- Historical states of DEX pools without an ADA side (e.g. NIGHT/USDM); swaps are valued in ADA via local prices.
CREATE TABLE IF NOT EXISTS cardyx.dex_pair_state (
  pool_id text NOT NULL,
  tx_out_id bigint NOT NULL,
  tx_hash text NOT NULL,
  block_time timestamptz NOT NULL,
  market_a text,
  market_b text,
  reserve_a numeric NOT NULL,
  reserve_b numeric NOT NULL,
  delta_a numeric,
  delta_b numeric,
  value_ada numeric,
  event_type text NOT NULL CHECK (event_type IN ('initial', 'swap', 'deposit', 'withdraw', 'other')),
  PRIMARY KEY (pool_id, tx_out_id)
);

CREATE INDEX IF NOT EXISTS dex_pair_state_market_a_time_idx ON cardyx.dex_pair_state (market_a, block_time DESC);
CREATE INDEX IF NOT EXISTS dex_pair_state_market_b_time_idx ON cardyx.dex_pair_state (market_b, block_time DESC);
CREATE INDEX IF NOT EXISTS dex_pair_state_time_idx ON cardyx.dex_pair_state (block_time);

GRANT SELECT, INSERT, DELETE ON cardyx.dex_pair_state TO cardyx_api;
