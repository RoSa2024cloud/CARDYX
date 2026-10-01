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
  'sundaeswap-v3-e20b2a2ada3297878401938f077edfa329fa5706f0a046d15477650c',
  'sundaeswap',
  'v3',
  355966107,
  'addr1x8srqftqemf0mjlukfszd97ljuxdp44r372txfcr75wrz26rnxqnmtv3hdu2t6chcfhl2zzjh36a87nmd6dwsu3jenqsslnz7e',
  'e0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b',
  '000de140e20b2a2ada3297878401938f077edfa329fa5706f0a046d15477650c',
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