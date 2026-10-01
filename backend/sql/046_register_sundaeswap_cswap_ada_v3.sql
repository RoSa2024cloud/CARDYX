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
  'sundaeswap-v3-404f45cbf186a736e16813d5f895e9ff957801049ad780de1b36862b',
  'sundaeswap',
  'v3',
  355943416,
  'addr1x8srqftqemf0mjlukfszd97ljuxdp44r372txfcr75wrz26rnxqnmtv3hdu2t6chcfhl2zzjh36a87nmd6dwsu3jenqsslnz7e',
  'e0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b',
  '000de140404f45cbf186a736e16813d5f895e9ff957801049ad780de1b36862b',
  NULL,
  NULL,
  6,
  'c863ceaa796d5429b526c336ab45016abd636859f331758e67204e5c',
  '4353574150',
  6,
  false,
  now(),
  now()
)
ON CONFLICT DO NOTHING;