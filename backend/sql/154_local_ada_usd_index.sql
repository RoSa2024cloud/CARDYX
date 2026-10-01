CREATE TABLE IF NOT EXISTS cardyx.ada_usd_observation (
  observed_at timestamptz PRIMARY KEY DEFAULT now(),
  price_usd numeric NOT NULL CHECK (price_usd > 0),
  pool_count integer NOT NULL,
  reserve_ada numeric NOT NULL,
  source text NOT NULL DEFAULT 'cardyx-local-stable-pools'
);

GRANT SELECT, INSERT ON cardyx.ada_usd_observation TO cardyx_api;
