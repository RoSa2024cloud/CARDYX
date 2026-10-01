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
  'wingriders-v2-608055fa2ab77521be62ce2524622cf5f763bcf0cde72a49d7a32115fd13ab7a',
  'wingriders',
  'v2',
  355963688,
  'addr1zxhew7fmsup08qvhdnkg8ccra88pw7q5trrncja3dlszhqlff76j7pv0e6hzrk02jf23m54cu8dtnmacr3gyx0rme7xsx0gxjy',
  '6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737',
  '608055fa2ab77521be62ce2524622cf5f763bcf0cde72a49d7a32115fd13ab7a',
  NULL,
  NULL,
  6,
  '8483844875ce4d61c2aa459240f277d32081ee08fe0ad16899a0f581',
  '0014df10544954414e',
  6,
  false,
  now(),
  now()
)
ON CONFLICT DO NOTHING;