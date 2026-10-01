INSERT INTO cardyx.dex_pool_registry (
  pool_id,dex,version,tx_out_id,pool_address,
  pool_nft_policy_id,pool_nft_asset_name,
  asset_a_policy_id,asset_a_asset_name,asset_a_decimals,
  asset_b_policy_id,asset_b_asset_name,asset_b_decimals,
  enabled,validated_at,updated_at
)
VALUES (
  'muesliswap-amm-909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f-76d5a1581738921e32b3a5facb3e4cc230c010a2204be2864bb45948d27612e6',
  'muesliswap','amm',355957406,
  'addr1z9qndmhduxjfqvz9rm36p8vsp9vm4l40mx6ndevngkk8srm28uczn6ce6zd5nx2dgr2sza96juq73qz4uhsdxaq74ghs3mz5fw',
  '909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f',
  '76d5a1581738921e32b3a5facb3e4cc230c010a2204be2864bb45948d27612e6',
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
