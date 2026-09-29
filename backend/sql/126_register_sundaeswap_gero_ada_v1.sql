INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'sundaeswap-v1-f402',
  'sundaeswap', 'v1', o.id, o.address,
  '0029cb7c88c7567b63d1a512c0ed626aa169688ec980730c0473b913', '7020f402',
  NULL, NULL, 6,
  '10a49b996e2402269af553a8a96fb8eb90d79e9eca79e2b4223057b6', '4745524f', 6,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity = 1
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE pool_nft.policy = decode('0029cb7c88c7567b63d1a512c0ed626aa169688ec980730c0473b913', 'hex')
  AND pool_nft.name = decode('7020f402', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND d.value->'fields'->1->>'bytes' = 'f402'
  AND d.value->'fields'->0->'fields'->0->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->0->'fields'->0->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->0->'fields'->1->'fields'->0->>'bytes' = '10a49b996e2402269af553a8a96fb8eb90d79e9eca79e2b4223057b6'
  AND d.value->'fields'->0->'fields'->1->'fields'->1->>'bytes' = '4745524f'
  AND (d.value->'fields'->2->>'int')::numeric > 0
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out gero_out
    JOIN public.multi_asset gero ON gero.id = gero_out.ident
    WHERE gero_out.tx_out_id = o.id AND gero_out.quantity > 0
      AND gero.policy = decode('10a49b996e2402269af553a8a96fb8eb90d79e9eca79e2b4223057b6', 'hex')
      AND gero.name = decode('4745524f', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'gero'
      AND c.policy_id = '10a49b996e2402269af553a8a96fb8eb90d79e9eca79e2b4223057b6'
      AND c.asset_name = '4745524f'
      AND c.decimals = 6
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.tx_in spent
    WHERE spent.tx_out_id = o.tx_id AND spent.tx_out_index = o.index
  )
ORDER BY o.id DESC
LIMIT 1
ON CONFLICT (pool_id) DO UPDATE SET
  tx_out_id = EXCLUDED.tx_out_id,
  pool_address = EXCLUDED.pool_address,
  asset_a_decimals = EXCLUDED.asset_a_decimals,
  asset_b_policy_id = EXCLUDED.asset_b_policy_id,
  asset_b_asset_name = EXCLUDED.asset_b_asset_name,
  asset_b_decimals = EXCLUDED.asset_b_decimals,
  enabled = EXCLUDED.enabled,
  validated_at = EXCLUDED.validated_at,
  updated_at = EXCLUDED.updated_at;