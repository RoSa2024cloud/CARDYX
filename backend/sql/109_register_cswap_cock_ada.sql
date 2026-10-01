INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'cswap-v1-2a0b08952ab398be63b0811948497b9e830928fb3e0b39b4a70353d0-432d4c503a20414441207820434f434b',
  'cswap', 'v1', o.id, o.address,
  '2a0b08952ab398be63b0811948497b9e830928fb3e0b39b4a70353d0', '63',
  NULL, NULL, 6,
  '49e423161ef818adc475c783571cb479d5f15ad52a01a240eacc0d3b', '434f434b', 0,
  true, now(), now()
FROM public.multi_asset marker
JOIN public.ma_tx_out marker_out ON marker_out.ident = marker.id AND marker_out.quantity = 1
JOIN public.tx_out o ON o.id = marker_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE marker.policy = decode('2a0b08952ab398be63b0811948497b9e830928fb3e0b39b4a70353d0', 'hex')
  AND marker.name = decode('63', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND (d.value->'fields'->0->>'int')::numeric > 0
  AND d.value->'fields'->4->>'bytes' = '49e423161ef818adc475c783571cb479d5f15ad52a01a240eacc0d3b'
  AND d.value->'fields'->5->>'bytes' = '434f434b'
  AND d.value->'fields'->6->>'bytes' = '2a0b08952ab398be63b0811948497b9e830928fb3e0b39b4a70353d0'
  AND d.value->'fields'->7->>'bytes' = '432d4c503a20414441207820434f434b'
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out cock_out
    JOIN public.multi_asset cock ON cock.id = cock_out.ident
    WHERE cock_out.tx_out_id = o.id AND cock_out.quantity > 0
      AND cock.policy = decode('49e423161ef818adc475c783571cb479d5f15ad52a01a240eacc0d3b', 'hex')
      AND cock.name = decode('434f434b', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'cockcardano'
      AND c.policy_id = '49e423161ef818adc475c783571cb479d5f15ad52a01a240eacc0d3b'
      AND c.asset_name = '434f434b'
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