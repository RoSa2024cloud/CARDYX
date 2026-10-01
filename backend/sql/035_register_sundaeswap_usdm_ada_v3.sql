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
  'sundaeswap-v3-64f35d26b237ad58e099041bc14c687ea7fdc58969d7d5b66e2540ef',
  'sundaeswap',
  'v3',
  355940281,
  'addr1z8srqftqemf0mjlukfszd97ljuxdp44r372txfcr75wrz2auzrlrz2kdd83wzt9u9n9qt2swgvhrmmn96k55nq6yuj4qw992w9',
  'e0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b',
  '000de14064f35d26b237ad58e099041bc14c687ea7fdc58969d7d5b66e2540ef',
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