CREATE TABLE IF NOT EXISTS cardyx.asset_price_snapshot (
  market_id text PRIMARY KEY,
  policy_id text,
  asset_name text,
  price_ada numeric NOT NULL DEFAULT 0,
  price_usd numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'cardyx-local',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asset_price_snapshot_policy_name_idx
  ON cardyx.asset_price_snapshot (policy_id, asset_name);

-- Optional: project-local price metadata should join into the cardyx.onchain_market feed.
-- The app itself maps the values into a local market feed at runtime when data is present.
GRANT SELECT, INSERT, UPDATE ON cardyx.asset_price_snapshot TO cardyx_api;
