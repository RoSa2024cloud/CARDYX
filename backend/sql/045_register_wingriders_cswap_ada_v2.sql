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
  'wingriders-v2-a46df3898bd39b403e6ccf55fea7d5573b0accd7aa046ae642dc20c1d76f1e7f',
  'wingriders',
  'v2',
  355943385,
  'addr1zxhew7fmsup08qvhdnkg8ccra88pw7q5trrncja3dlszhql7qlnp65039ceage6ryskmf2gtpr0uskxam8jdd6hj3j6setcx78',
  '6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737',
  'a46df3898bd39b403e6ccf55fea7d5573b0accd7aa046ae642dc20c1d76f1e7f',
  NULL,
  NULL,
  6,
  'c863ceaa796d5429b526c336ab45016abd636859f331758e67204e5c',
  '4353574150',
  6,
  false,
  now(),
  now()
)
ON CONFLICT DO NOTHING;