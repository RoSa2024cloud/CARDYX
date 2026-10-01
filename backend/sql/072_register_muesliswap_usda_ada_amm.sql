INSERT INTO cardyx.dex_pool_registry (
  pool_id,dex,version,tx_out_id,pool_address,
  pool_nft_policy_id,pool_nft_asset_name,
  asset_a_policy_id,asset_a_asset_name,asset_a_decimals,
  asset_b_policy_id,asset_b_asset_name,asset_b_decimals,
  enabled,validated_at,updated_at
)
VALUES (
  'muesliswap-amm-909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f-4033fcc124a5633c554da7036fead346637471f869c78396c6198f255a33a0bf',
  'muesliswap','amm',353787797,
  'addr1z9cy2gmar6cpn8yymll93lnd7lw96f27kn2p3eq5d4tjr7xnh3gfhnqcwez2pzmr4tryugrr0uahuk49xqw7dc645chscql0d7',
  '909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f','4033fcc124a5633c554da7036fead346637471f869c78396c6198f255a33a0bf',
  NULL,NULL,6,
  'fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456','55534441',6,
  true,now(),now()
)
ON CONFLICT (pool_id) DO UPDATE SET
  tx_out_id=EXCLUDED.tx_out_id,pool_address=EXCLUDED.pool_address,
  pool_nft_policy_id=EXCLUDED.pool_nft_policy_id,pool_nft_asset_name=EXCLUDED.pool_nft_asset_name,
  asset_a_policy_id=EXCLUDED.asset_a_policy_id,asset_a_asset_name=EXCLUDED.asset_a_asset_name,
  asset_a_decimals=EXCLUDED.asset_a_decimals,asset_b_policy_id=EXCLUDED.asset_b_policy_id,
  asset_b_asset_name=EXCLUDED.asset_b_asset_name,asset_b_decimals=EXCLUDED.asset_b_decimals,
  enabled=EXCLUDED.enabled,validated_at=EXCLUDED.validated_at,updated_at=EXCLUDED.updated_at;
