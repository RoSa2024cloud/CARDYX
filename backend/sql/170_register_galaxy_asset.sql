INSERT INTO cardyx.asset_catalog (
  market_id, policy_id, asset_name, fingerprint, ticker, display_name,
  decimals, category, official_url, updated_at
)
VALUES (
  'galaxy',
  'bfababb45a49499753eef0e6621bceda9c938cd45d92a2de0341a159',
  '2447414c415859',
  'asset1r8s3ujmj6yuqkn8t5wsst4xw9dtjrylh5rrvgq',
  'GALAXY',
  'GALAXY',
  6,
  'defi',
  'https://galaxyswap.io/',
  now()
)
ON CONFLICT (market_id) DO UPDATE SET
  policy_id = EXCLUDED.policy_id,
  asset_name = EXCLUDED.asset_name,
  fingerprint = EXCLUDED.fingerprint,
  ticker = EXCLUDED.ticker,
  display_name = EXCLUDED.display_name,
  decimals = EXCLUDED.decimals,
  category = EXCLUDED.category,
  official_url = EXCLUDED.official_url,
  updated_at = now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cardyx.dex_pool_registry
    WHERE pool_id = 'minswap-v2-b3208f051bc257413c1b81156f1d9876f274bab2f01e84492fa91d612426df97'
      AND dex = 'minswap'
      AND version = 'v2'
      AND enabled = true
  ) THEN
    RAISE EXCEPTION 'The discovered GALAXY Minswap V2 pool is missing or disabled.';
  END IF;
END $$;