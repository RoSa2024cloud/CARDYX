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
  'cswap-v1-0868e467c9693a3f4b8d93500ab79a755b9a9def3e38cc675a0808c5-432d4c503a204144412078200014efbfbd10544954414e',
  'cswap',
  'v1',
  355907748,
  'addr1z8ke0c9p89rjfwmuh98jpt8ky74uy5mffjft3zlcld9h7ml3lmln3mwk0y3zsh3gs3dzqlwa9rjzrxawkwm4udw9axhs6fuu6e',
  '0868e467c9693a3f4b8d93500ab79a755b9a9def3e38cc675a0808c5',
  '63',
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