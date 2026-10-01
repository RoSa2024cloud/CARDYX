INSERT INTO cardyx.dex_pool_registry (
  pool_id,dex,version,tx_out_id,pool_address,
  pool_nft_policy_id,pool_nft_asset_name,
  asset_a_policy_id,asset_a_asset_name,asset_a_decimals,
  asset_b_policy_id,asset_b_asset_name,asset_b_decimals,
  enabled,validated_at,updated_at
)
VALUES (
  'minswap-v2-4c414a51eac26e5f913a91265c2882e013e1d74dab9a5fe2f875f7df7c9bb4c1',
  'minswap','v2',355988796,
  'addr1z84q0denmyep98ph3tmzwsmw0j7zau9ljmsqx6a4rvaau66j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq777e2a',
  'f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c','4c414a51eac26e5f913a91265c2882e013e1d74dab9a5fe2f875f7df7c9bb4c1',
  NULL,NULL,6,
  '1f3aec8bfe7ea4fe14c5f121e2a92e301afe414147860d557cac7e34','5553444378',6,
  true,now(),now()
)
ON CONFLICT (pool_id) DO UPDATE SET
  tx_out_id=EXCLUDED.tx_out_id,pool_address=EXCLUDED.pool_address,
  pool_nft_policy_id=EXCLUDED.pool_nft_policy_id,pool_nft_asset_name=EXCLUDED.pool_nft_asset_name,
  asset_a_policy_id=EXCLUDED.asset_a_policy_id,asset_a_asset_name=EXCLUDED.asset_a_asset_name,
  asset_a_decimals=EXCLUDED.asset_a_decimals,asset_b_policy_id=EXCLUDED.asset_b_policy_id,
  asset_b_asset_name=EXCLUDED.asset_b_asset_name,asset_b_decimals=EXCLUDED.asset_b_decimals,
  enabled=EXCLUDED.enabled,validated_at=EXCLUDED.validated_at,updated_at=EXCLUDED.updated_at;
