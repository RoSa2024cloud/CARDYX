UPDATE cardyx.asset_catalog
SET policy_id = 'da8c30857834c6ae7203935b89278c532b3995245295456f993e1d24',
    asset_name = '4c51',
    ticker = 'LQ',
    display_name = 'Liqwid DAO Token',
    decimals = 6,
    category = 'defi',
    official_url = 'https://liqwid.finance',
    updated_at = now()
WHERE market_id = 'liqwid-finance';

INSERT INTO cardyx.asset_metadata (
  policy_id, asset_name, ticker, display_name, description, decimals, source, updated_at
)
VALUES (
  'da8c30857834c6ae7203935b89278c532b3995245295456f993e1d24',
  '4c51',
  'LQ',
  'Liqwid DAO Token',
  'Algorithmic, non-custodial liquidity protocol for lending and borrowing on Cardano.',
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

UPDATE cardyx.dex_pool_registry
SET asset_a_policy_id = NULL,
  asset_a_asset_name = NULL,
  asset_a_decimals = 6,
  asset_b_policy_id = 'da8c30857834c6ae7203935b89278c532b3995245295456f993e1d24',
  asset_b_asset_name = '4c51',
  asset_b_decimals = 6,
  updated_at = now()
WHERE pool_id = 'minswap-v2-6263e0101384dace4d7a8dadf0e6d45c8d43c8872604118ee82e3f2212934917';
