INSERT INTO cardyx.dex_pool_registry (
  pool_id,dex,version,tx_out_id,pool_address,
  pool_nft_policy_id,pool_nft_asset_name,
  asset_a_policy_id,asset_a_asset_name,asset_a_decimals,
  asset_b_policy_id,asset_b_asset_name,asset_b_decimals,
  enabled,validated_at,updated_at
)
VALUES (
  'wingriders-v2-c0bccd3384ea1094fcee3cb77d4770647df096517648214fdfaa21ac21c7b7fc',
  'wingriders','v2',355988100,
  'addr1zxhew7fmsup08qvhdnkg8ccra88pw7q5trrncja3dlszhq6d77rk0jjxny493quf2pv32xup2ucx6hp6enfjg8gnjq0qqzlqam',
  '6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737',
  'c0bccd3384ea1094fcee3cb77d4770647df096517648214fdfaa21ac21c7b7fc',
  NULL,NULL,6,
  '8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61',
  '446a65644d6963726f555344',6,
  true,now(),now()
)
ON CONFLICT (pool_id) DO UPDATE SET
  tx_out_id=EXCLUDED.tx_out_id,pool_address=EXCLUDED.pool_address,
  pool_nft_policy_id=EXCLUDED.pool_nft_policy_id,pool_nft_asset_name=EXCLUDED.pool_nft_asset_name,
  asset_a_policy_id=EXCLUDED.asset_a_policy_id,asset_a_asset_name=EXCLUDED.asset_a_asset_name,
  asset_a_decimals=EXCLUDED.asset_a_decimals,asset_b_policy_id=EXCLUDED.asset_b_policy_id,
  asset_b_asset_name=EXCLUDED.asset_b_asset_name,asset_b_decimals=EXCLUDED.asset_b_decimals,
  enabled=EXCLUDED.enabled,validated_at=EXCLUDED.validated_at,updated_at=EXCLUDED.updated_at;
