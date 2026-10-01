CREATE TABLE IF NOT EXISTS cardyx.dex_pool_price_observation (
  pool_id text NOT NULL,
  market_id text NOT NULL,
  policy_id text,
  asset_name text,
  reserve_ada numeric NOT NULL DEFAULT 0,
  reserve_asset numeric NOT NULL DEFAULT 0,
  price_ada numeric NOT NULL DEFAULT 0,
  observed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'cardyx-local-pool-indexer',
  PRIMARY KEY (pool_id, market_id)
);

CREATE INDEX IF NOT EXISTS dex_pool_price_observation_market_idx
  ON cardyx.dex_pool_price_observation (market_id, observed_at DESC);

GRANT SELECT, INSERT, UPDATE ON cardyx.dex_pool_price_observation TO cardyx_api;