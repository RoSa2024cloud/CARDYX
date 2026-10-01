INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'wingriders-v1-026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a5706263e0101384dace4d7a8dadf0e6d45c8d43c8872604118ee82e3f2212934917',
  'wingriders', 'v1', 355971136,
  'addr1z8nvjzjeydcn4atcd93aac8allvrpjn7pjr2qsweukpnayg4pn8uxr87tguqw8jkn6p233rk7k683ppl2mspr8appw9q640ms8',
  '026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570',
  '6263e0101384dace4d7a8dadf0e6d45c8d43c8872604118ee82e3f2212934917',
  NULL, NULL, 6,
  'da8c30857834c6ae7203935b89278c532b3995245295456f993e1d24', '4c51', 6,
  true, now(), now()
ON CONFLICT (pool_id) DO UPDATE SET
  tx_out_id=EXCLUDED.tx_out_id, pool_address=EXCLUDED.pool_address,
  pool_nft_policy_id=EXCLUDED.pool_nft_policy_id, pool_nft_asset_name=EXCLUDED.pool_nft_asset_name,
  asset_a_policy_id=EXCLUDED.asset_a_policy_id, asset_a_asset_name=EXCLUDED.asset_a_asset_name,
  asset_a_decimals=EXCLUDED.asset_a_decimals, asset_b_policy_id=EXCLUDED.asset_b_policy_id,
  asset_b_asset_name=EXCLUDED.asset_b_asset_name, asset_b_decimals=EXCLUDED.asset_b_decimals,
  enabled=EXCLUDED.enabled, validated_at=EXCLUDED.validated_at, updated_at=EXCLUDED.updated_at;
