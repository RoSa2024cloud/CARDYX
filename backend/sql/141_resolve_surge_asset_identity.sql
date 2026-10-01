INSERT INTO cardyx.asset_metadata (
  policy_id, asset_name, ticker, display_name, description, decimals, source, updated_at
)
VALUES (
  'e992ef75f2367e6ecd93716ae88eba0d005dd91fd3a21f650b6496b5',
  '5355524745',
  'SURGE',
  'SURGE',
  'SURGE is the native utility token of the Surge ecosystem on Cardano.',
  6,
  'cardano-token-registry',
  now()
)
ON CONFLICT (policy_id, asset_name) DO UPDATE SET
  ticker = EXCLUDED.ticker,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  decimals = EXCLUDED.decimals,
  source = EXCLUDED.source,
  updated_at = now();

UPDATE cardyx.asset_catalog
SET policy_id = 'e992ef75f2367e6ecd93716ae88eba0d005dd91fd3a21f650b6496b5',
    asset_name = '5355524745',
    ticker = 'SURGE',
    display_name = 'SURGE',
    decimals = 6,
    official_url = 'https://surgecardano.com',
    updated_at = now()
WHERE market_id = 'surge-3';

UPDATE cardyx.dex_pool_registry
SET asset_b_policy_id = 'e992ef75f2367e6ecd93716ae88eba0d005dd91fd3a21f650b6496b5',
    asset_b_asset_name = '5355524745',
    asset_b_decimals = 6,
    updated_at = now()
WHERE asset_b_policy_id = 'e992ef75f2367e6ecd93716ae88eba0d005dd91fd3a21f650b6496b5'
  AND asset_b_asset_name = '5355524745';