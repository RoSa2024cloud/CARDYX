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
  'muesliswap-amm-909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f-d3c94acf86c65c2942a2ccd5a8c9fcecfb502a5b6c1ae8ad3ad9c2bd659e44ea',
  'muesliswap',
  'amm',
  355830586,
  'addr1z9cy2gmar6cpn8yymll93lnd7lw96f27kn2p3eq5d4tjr7xnh3gfhnqcwez2pzmr4tryugrr0uahuk49xqw7dc645chscql0d7',
  '909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f',
  'd3c94acf86c65c2942a2ccd5a8c9fcecfb502a5b6c1ae8ad3ad9c2bd659e44ea',
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