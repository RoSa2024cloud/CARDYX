INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'wingriders-v1-026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570-225e2b4bf00db1b410756c1211636d780188983bea6539df28b74eca4559d50a',
  'wingriders', 'v1', o.id, o.address,
  '026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570',
  '225e2b4bf00db1b410756c1211636d780188983bea6539df28b74eca4559d50a',
  NULL, NULL, 6,
  '804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f', '56594649', 6,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity > 0
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE pool_nft.policy = decode('026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570', 'hex')
  AND pool_nft.name = decode('225e2b4bf00db1b410756c1211636d780188983bea6539df28b74eca4559d50a', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND d.value->'fields'->1->'fields'->0->'fields'->0->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->0->'fields'->0->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->0->'fields'->1->'fields'->0->>'bytes' = '804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f'
  AND d.value->'fields'->1->'fields'->0->'fields'->1->'fields'->1->>'bytes' = '56594649'
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out marker_out
    JOIN public.multi_asset marker ON marker.id = marker_out.ident
    WHERE marker_out.tx_out_id = o.id AND marker_out.quantity = 1
      AND marker.policy = decode('026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570', 'hex')
      AND marker.name = decode('4c', 'hex')
  )
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