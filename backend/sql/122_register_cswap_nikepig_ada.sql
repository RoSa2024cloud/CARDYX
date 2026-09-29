INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'cswap-v1-1372dcec56364a1890704d25010fa46a9fde65d47e027176c359c147-432d4c503a204144412078204e696b65',
  'cswap', 'v1', o.id, o.address,
  '1372dcec56364a1890704d25010fa46a9fde65d47e027176c359c147', '63',
  NULL, NULL, 6,
  'c881c20e49dbaca3ff6cef365969354150983230c39520b917f5cf7c', '4e696b65', 0,
  true, now(), now()
FROM public.multi_asset marker
JOIN public.ma_tx_out marker_out ON marker_out.ident = marker.id AND marker_out.quantity = 1
JOIN public.tx_out o ON o.id = marker_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE marker.policy = decode('1372dcec56364a1890704d25010fa46a9fde65d47e027176c359c147', 'hex')
  AND marker.name = decode('63', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND (d.value->'fields'->0->>'int')::numeric > 0
  AND d.value->'fields'->4->>'bytes' = 'c881c20e49dbaca3ff6cef365969354150983230c39520b917f5cf7c'
  AND d.value->'fields'->5->>'bytes' = '4e696b65'
  AND d.value->'fields'->6->>'bytes' = '1372dcec56364a1890704d25010fa46a9fde65d47e027176c359c147'
  AND d.value->'fields'->7->>'bytes' = '432d4c503a204144412078204e696b65'
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out nikepig_out
    JOIN public.multi_asset nikepig ON nikepig.id = nikepig_out.ident
    WHERE nikepig_out.tx_out_id = o.id AND nikepig_out.quantity > 0
      AND nikepig.policy = decode('c881c20e49dbaca3ff6cef365969354150983230c39520b917f5cf7c', 'hex')
      AND nikepig.name = decode('4e696b65', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'nikepig'
      AND c.policy_id = 'c881c20e49dbaca3ff6cef365969354150983230c39520b917f5cf7c'
      AND c.asset_name = '4e696b65'
      AND c.decimals = 0
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