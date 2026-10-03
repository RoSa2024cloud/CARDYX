ALTER TABLE cardyx.asset_catalog
  ADD COLUMN IF NOT EXISTS fingerprint text,
  ADD COLUMN IF NOT EXISTS decimals integer;

CREATE INDEX IF NOT EXISTS asset_catalog_fingerprint_idx
  ON cardyx.asset_catalog (fingerprint);

UPDATE cardyx.asset_catalog c
SET fingerprint = ma.fingerprint,
    updated_at = now()
FROM public.multi_asset ma
WHERE c.policy_id IS NOT NULL
  AND c.asset_name IS NOT NULL
  AND encode(ma.policy, 'hex') = c.policy_id
  AND encode(ma.name, 'hex') = c.asset_name
  AND c.fingerprint IS DISTINCT FROM ma.fingerprint;

CREATE OR REPLACE VIEW cardyx.asset_catalog_identity_public AS
SELECT
  market_id,
  policy_id,
  asset_name,
  fingerprint,
  decimals,
  ticker,
  display_name,
  category,
  logo_url,
  official_url,
  is_verified,
  updated_at
FROM cardyx.asset_catalog;

GRANT SELECT ON cardyx.asset_catalog_identity_public TO cardyx_api;