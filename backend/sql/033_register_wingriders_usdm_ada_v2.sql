INSERT INTO cardyx.dex_pool_registry (
  pool_id,
  dex,
  version,
  tx_out_id,
  pool_address,
  pool_nft_policy_id,
  pool_nft_asset_name,
  asset_a_policy_id,
  asset_a_asset_name,
  asset_a_decimals,
  asset_b_policy_id,
  asset_b_asset_name,
  asset_b_decimals,
  enabled,
  validated_at,
  updated_at
)
VALUES (
  'wingriders-v2-93237c26780971289912e3fc907bd7b2cc1ca33ff248616e13299a1219be3ed0',
  'wingriders',
  'v2',
  355939424,
  'addr1zxhew7fmsup08qvhdnkg8ccra88pw7q5trrncja3dlszhqlm3e807762pklheldndtjhrk0qxzzfh9vhc9kkc706xglsv8s5nq',
  '6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737',
  '93237c26780971289912e3fc907bd7b2cc1ca33ff248616e13299a1219be3ed0',
  NULL,
  NULL,
  6,
  'c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad',
  '0014df105553444d',
  6,
  false,
  now(),
  now()
)
ON CONFLICT DO NOTHING;