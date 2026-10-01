CREATE TABLE IF NOT EXISTS cardyx.asset_market_snapshot (
  market_id text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  price_ada numeric NOT NULL DEFAULT 0,
  price_usd numeric NOT NULL DEFAULT 0,
  volume_24h_ada numeric NOT NULL DEFAULT 0,
  volume_24h_usd numeric NOT NULL DEFAULT 0,
  market_cap_ada numeric NOT NULL DEFAULT 0,
  market_cap_usd numeric NOT NULL DEFAULT 0,
  fdv_ada numeric NOT NULL DEFAULT 0,
  fdv_usd numeric NOT NULL DEFAULT 0,
  change_24h numeric NOT NULL DEFAULT 0,
  change_7d numeric NOT NULL DEFAULT 0,
  high_24h_usd numeric NOT NULL DEFAULT 0,
  low_24h_usd numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'cardyx-local-market-indexer',
  PRIMARY KEY (market_id, observed_at)
);

CREATE INDEX IF NOT EXISTS asset_market_snapshot_latest_idx
  ON cardyx.asset_market_snapshot (market_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS cardyx.asset_market_candle (
  market_id text NOT NULL,
  timeframe text NOT NULL CHECK (timeframe IN ('7d', '30d')),
  bucket_start timestamptz NOT NULL,
  open numeric NOT NULL DEFAULT 0,
  high numeric NOT NULL DEFAULT 0,
  low numeric NOT NULL DEFAULT 0,
  close numeric NOT NULL DEFAULT 0,
  volume_ada numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'cardyx-local-market-indexer',
  PRIMARY KEY (market_id, timeframe, bucket_start)
);

CREATE INDEX IF NOT EXISTS asset_market_candle_lookup_idx
  ON cardyx.asset_market_candle (market_id, timeframe, bucket_start DESC);

GRANT SELECT, INSERT, UPDATE ON cardyx.asset_market_snapshot TO cardyx_api;
GRANT SELECT, INSERT, UPDATE ON cardyx.asset_market_candle TO cardyx_api;