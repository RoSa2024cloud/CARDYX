CREATE TABLE IF NOT EXISTS cardyx.asset_metadata (
  policy_id text NOT NULL,
  asset_name text NOT NULL,
  ticker text,
  display_name text,
  description text,
  decimals integer,
  source text NOT NULL DEFAULT 'cardyx-local-metadata-indexer',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (policy_id, asset_name)
);

DROP VIEW IF EXISTS cardyx.asset_catalog_identity_public;

CREATE VIEW cardyx.asset_catalog_identity_public AS
SELECT
  c.market_id,
  c.policy_id,
  c.asset_name,
  c.fingerprint,
  coalesce(c.decimals, m.decimals) AS decimals
FROM cardyx.asset_catalog c
LEFT JOIN cardyx.asset_metadata m
  ON m.policy_id = c.policy_id
 AND m.asset_name = c.asset_name;

GRANT SELECT, INSERT, UPDATE ON cardyx.asset_metadata TO cardyx_api;
GRANT SELECT ON cardyx.asset_catalog_identity_public TO cardyx_api;