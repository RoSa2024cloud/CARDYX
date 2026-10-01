INSERT INTO cardyx.dex_pool_registry (
  pool_id,dex,version,tx_out_id,pool_address,
  pool_nft_policy_id,pool_nft_asset_name,
  asset_a_policy_id,asset_a_asset_name,asset_a_decimals,
  asset_b_policy_id,asset_b_asset_name,asset_b_decimals,
  enabled,validated_at,updated_at
)
VALUES (
  'wingriders-v1-a939812d08cfb6066e17d2914a7272c6b8c0197acdf68157d02c73649cc3efc0',
  'wingriders','v1',355987361,
  'addr1z8nvjzjeydcn4atcd93aac8allvrpjn7pjr2qsweukpnayvrzwt47mccrc8akjdnwat82r82man0g3s2m9czqdja6mfsqmv4gp',
  '026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570',
  'a939812d08cfb6066e17d2914a7272c6b8c0197acdf68157d02c73649cc3efc0',
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
