INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'cswap-v1-3b2701c553afb6129a9de800f923014b3a1c797d6fbb3dce3334004e-432d4c503a2041444120782056594649',
  'cswap', 'v1', o.id, o.address,
  '3b2701c553afb6129a9de800f923014b3a1c797d6fbb3dce3334004e', '63',
  NULL, NULL, 6,
  '804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f', '56594649', 6,
  true, now(), now()
FROM public.multi_asset marker
JOIN public.ma_tx_out marker_out ON marker_out.ident = marker.id AND marker_out.quantity = 1
JOIN public.tx_out o ON o.id = marker_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE marker.policy = decode('3b2701c553afb6129a9de800f923014b3a1c797d6fbb3dce3334004e', 'hex')
  AND marker.name = decode('63', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND (d.value->'fields'->0->>'int')::numeric > 0
  AND d.value->'fields'->4->>'bytes' = '804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f'
  AND d.value->'fields'->5->>'bytes' = '56594649'
  AND d.value->'fields'->6->>'bytes' = '3b2701c553afb6129a9de800f923014b3a1c797d6fbb3dce3334004e'
  AND d.value->'fields'->7->>'bytes' = '432d4c503a2041444120782056594649'
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out vyfi_out
    JOIN public.multi_asset vyfi ON vyfi.id = vyfi_out.ident
    WHERE vyfi_out.tx_out_id = o.id AND vyfi_out.quantity > 0
      AND vyfi.policy = decode('804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f', 'hex')
      AND vyfi.name = decode('56594649', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'vyfi-legacy'
      AND c.policy_id = '804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f'
      AND c.asset_name = '56594649'
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