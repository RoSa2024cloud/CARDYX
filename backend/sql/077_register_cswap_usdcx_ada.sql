INSERT INTO cardyx.dex_pool_registry (
  pool_id,dex,version,tx_out_id,pool_address,
  pool_nft_policy_id,pool_nft_asset_name,
  asset_a_policy_id,asset_a_asset_name,asset_a_decimals,
  asset_b_policy_id,asset_b_asset_name,asset_b_decimals,
  enabled,validated_at,updated_at
)
VALUES (
  'cswap-v1-37834c1d8615d6e5d2ec1c631f00d6f352ffd1ef16541204b9717661-432d4c503a204144412078205553444378',
  'cswap','v1',355899677,
  'addr1z8ke0c9p89rjfwmuh98jpt8ky74uy5mffjft3zlcld9h7ml3lmln3mwk0y3zsh3gs3dzqlwa9rjzrxawkwm4udw9axhs6fuu6e',
  '37834c1d8615d6e5d2ec1c631f00d6f352ffd1ef16541204b9717661','63',
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
