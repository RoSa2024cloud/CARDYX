INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'cswap-v1-030fcb8ab83cb4d5f0dd06beafd8d87506adfa99e89640a195ecd421-432d4c503a2041444120782050414c4d0a',
  'cswap', 'v1', o.id, o.address,
  '030fcb8ab83cb4d5f0dd06beafd8d87506adfa99e89640a195ecd421', '63',
  NULL, NULL, 6,
  'b7c5cd554f3e83c8aa0900a0c9053284a5348244d23d0406c28eaf4d', '50414c4d0a', 6,
  true, now(), now()
FROM public.multi_asset marker
JOIN public.ma_tx_out marker_out ON marker_out.ident = marker.id AND marker_out.quantity = 1
JOIN public.tx_out o ON o.id = marker_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE marker.policy = decode('030fcb8ab83cb4d5f0dd06beafd8d87506adfa99e89640a195ecd421', 'hex')
  AND marker.name = decode('63', 'hex')
  AND o.address_has_script = true
  AND o.value >= 2000000
  AND (d.value->'fields'->0->>'int')::numeric > 0
  AND d.value->'fields'->4->>'bytes' = 'b7c5cd554f3e83c8aa0900a0c9053284a5348244d23d0406c28eaf4d'
  AND d.value->'fields'->5->>'bytes' = '50414c4d0a'
  AND d.value->'fields'->6->>'bytes' = '030fcb8ab83cb4d5f0dd06beafd8d87506adfa99e89640a195ecd421'
  AND d.value->'fields'->7->>'bytes' = '432d4c503a2041444120782050414c4d0a'
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out palm_out
    JOIN public.multi_asset palm ON palm.id = palm_out.ident
    WHERE palm_out.tx_out_id = o.id AND palm_out.quantity > 0
      AND palm.policy = decode('b7c5cd554f3e83c8aa0900a0c9053284a5348244d23d0406c28eaf4d', 'hex')
      AND palm.name = decode('50414c4d0a', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'palm'
      AND c.policy_id = 'b7c5cd554f3e83c8aa0900a0c9053284a5348244d23d0406c28eaf4d'
      AND c.asset_name = '50414c4d0a'
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