DELETE FROM cardyx.asset_catalog
WHERE market_id IN ('usdm-2', 'iusd')
  AND policy_id IS NULL
  AND asset_name IS NULL;

INSERT INTO cardyx.asset_catalog (
  market_id, policy_id, asset_name, ticker, display_name, category,
  is_verified, logo_url, updated_at
)
SELECT
  source.market_id,
  source.policy_id,
  source.asset_name,
  source.ticker,
  source.display_name,
  source.category,
  false,
  metadata.image_url,
  now()
FROM (VALUES
  ('usdm-2', 'c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad', '0014df105553444d', 'USDM', 'USDM', 'stablecoin'),
  ('iusd', 'f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b69880', '69555344', 'iUSD', 'iUSD', 'stablecoin')
) AS source(market_id, policy_id, asset_name, ticker, display_name, category)
LEFT JOIN cardyx.asset_metadata metadata
  ON metadata.policy_id = source.policy_id
 AND metadata.asset_name = source.asset_name
ON CONFLICT (market_id) DO UPDATE SET
  policy_id = EXCLUDED.policy_id,
  asset_name = EXCLUDED.asset_name,
  ticker = EXCLUDED.ticker,
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  logo_url = COALESCE(EXCLUDED.logo_url, cardyx.asset_catalog.logo_url),
  updated_at = now();
