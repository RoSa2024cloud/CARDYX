INSERT INTO cardyx.dex_pool_registry (
  pool_id,dex,version,tx_out_id,pool_address,
  pool_nft_policy_id,pool_nft_asset_name,
  asset_a_policy_id,asset_a_asset_name,asset_a_decimals,
  asset_b_policy_id,asset_b_asset_name,asset_b_decimals,
  enabled,validated_at,updated_at
)
VALUES (
  'sundaeswap-v1-f803','sundaeswap','v1',355565067,
  'addr1w9qzpelu9hn45pefc0xr4ac4kdxeswq7pndul2vuj59u8tqaxdznu',
  '0029cb7c88c7567b63d1a512c0ed626aa169688ec980730c0473b913','7020f803',
  NULL,NULL,6,
  '8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61','446a65644d6963726f555344',6,
  true,now(),now()
)
ON CONFLICT (pool_id) DO UPDATE SET
  tx_out_id=EXCLUDED.tx_out_id,pool_address=EXCLUDED.pool_address,
  pool_nft_policy_id=EXCLUDED.pool_nft_policy_id,pool_nft_asset_name=EXCLUDED.pool_nft_asset_name,
  asset_a_policy_id=EXCLUDED.asset_a_policy_id,asset_a_asset_name=EXCLUDED.asset_a_asset_name,
  asset_a_decimals=EXCLUDED.asset_a_decimals,asset_b_policy_id=EXCLUDED.asset_b_policy_id,
  asset_b_asset_name=EXCLUDED.asset_b_asset_name,asset_b_decimals=EXCLUDED.asset_b_decimals,
  enabled=EXCLUDED.enabled,validated_at=EXCLUDED.validated_at,updated_at=EXCLUDED.updated_at;
