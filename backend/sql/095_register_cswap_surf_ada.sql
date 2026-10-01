INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'cswap-v1-f7e8f4ce8c153b99acbcf201e18c67be2cacd4a0d812458d0d5834bc-432d4c503a20414441207820464c4f57',
  'cswap', 'v1', o.id, o.address,
  'f7e8f4ce8c153b99acbcf201e18c67be2cacd4a0d812458d0d5834bc', '63',
  NULL, NULL, 6,
  '2d9db8a89f074aa045eab177f23a3395f62ced8b53499a9e4ad46c80', '464c4f57', 6,
  true, now(), now()
FROM public.multi_asset marker
JOIN public.ma_tx_out marker_out ON marker_out.ident = marker.id AND marker_out.quantity = 1
JOIN public.tx_out o ON o.id = marker_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE marker.policy = decode('f7e8f4ce8c153b99acbcf201e18c67be2cacd4a0d812458d0d5834bc', 'hex')
  AND marker.name = decode('63', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND (d.value->'fields'->0->>'int')::numeric > 0
  AND d.value->'fields'->4->>'bytes' = '2d9db8a89f074aa045eab177f23a3395f62ced8b53499a9e4ad46c80'
  AND d.value->'fields'->5->>'bytes' = '464c4f57'
  AND d.value->'fields'->6->>'bytes' = 'f7e8f4ce8c153b99acbcf201e18c67be2cacd4a0d812458d0d5834bc'
  AND d.value->'fields'->7->>'bytes' = '432d4c503a20414441207820464c4f57'
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out surf_out
    JOIN public.multi_asset surf ON surf.id = surf_out.ident
    WHERE surf_out.tx_out_id = o.id AND surf_out.quantity > 0
      AND surf.policy = decode('2d9db8a89f074aa045eab177f23a3395f62ced8b53499a9e4ad46c80', 'hex')
      AND surf.name = decode('464c4f57', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'flow-lending'
      AND c.policy_id = '2d9db8a89f074aa045eab177f23a3395f62ced8b53499a9e4ad46c80'
      AND c.asset_name = '464c4f57'
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