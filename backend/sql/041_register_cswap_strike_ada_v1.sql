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
  'cswap-v1-83911d2a8db0a1c307f025c873359a3f2f0c580d5572e3c01f846f6f-432d4c503a20414441207820535452494b45',
  'cswap',
  'v1',
  355946929,
  'addr1z8ke0c9p89rjfwmuh98jpt8ky74uy5mffjft3zlcld9h7ml3lmln3mwk0y3zsh3gs3dzqlwa9rjzrxawkwm4udw9axhs6fuu6e',
  '83911d2a8db0a1c307f025c873359a3f2f0c580d5572e3c01f846f6f',
  '63',
  NULL,
  NULL,
  6,
  'f13ac4d66b3ee19a6aa0f2a22298737bd907cc95121662fc971b5275',
  '535452494b45',
  6,
  false,
  now(),
  now()
)
ON CONFLICT DO NOTHING;