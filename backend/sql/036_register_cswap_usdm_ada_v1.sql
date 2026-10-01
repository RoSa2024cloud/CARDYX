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
  'cswap-v1-16c66059d8ed65d35a64b229e34bfcd01899de45379a35c3aa74c7a5-432d4c503a204144412078200014efbfbd105553444d',
  'cswap',
  'v1',
  355941244,
  'addr1z8ke0c9p89rjfwmuh98jpt8ky74uy5mffjft3zlcld9h7ml3lmln3mwk0y3zsh3gs3dzqlwa9rjzrxawkwm4udw9axhs6fuu6e',
  '16c66059d8ed65d35a64b229e34bfcd01899de45379a35c3aa74c7a5',
  '63',
  NULL,
  NULL,
  6,
  'c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad',
  '0014df105553444d',
  6,
  false,
  now(),
  now()
)
ON CONFLICT DO NOTHING;