INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
VALUES (
  'cswap-v1-94f29ef62b5e06d3512802ad433ed01ce6cfc96661692f663e96de9c-432d4c503a204144412078204c51',
  'cswap', 'v1', 355655880,
  'addr1z8ke0c9p89rjfwmuh98jpt8ky74uy5mffjft3zlcld9h7ml3lmln3mwk0y3zsh3gs3dzqlwa9rjzrxawkwm4udw9axhs6fuu6e',
  '94f29ef62b5e06d3512802ad433ed01ce6cfc96661692f663e96de9c', '63',
  NULL, NULL, 6,
  'da8c30857834c6ae7203935b89278c532b3995245295456f993e1d24', '4c51', 6,
  true, now(), now()
)
ON CONFLICT (pool_id) DO UPDATE SET
  tx_out_id=EXCLUDED.tx_out_id,
  pool_address=EXCLUDED.pool_address,
  pool_nft_policy_id=EXCLUDED.pool_nft_policy_id,
  pool_nft_asset_name=EXCLUDED.pool_nft_asset_name,
  asset_a_policy_id=EXCLUDED.asset_a_policy_id,
  asset_a_asset_name=EXCLUDED.asset_a_asset_name,
  asset_a_decimals=EXCLUDED.asset_a_decimals,
  asset_b_policy_id=EXCLUDED.asset_b_policy_id,
  asset_b_asset_name=EXCLUDED.asset_b_asset_name,
  asset_b_decimals=EXCLUDED.asset_b_decimals,
  enabled=EXCLUDED.enabled,
  validated_at=EXCLUDED.validated_at,
  updated_at=EXCLUDED.updated_at;
