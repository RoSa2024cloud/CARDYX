INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'wingriders-v2-6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737-e650ce568d1dc1ebfb9bfbd8c06982f3ea95a9959ddaefc783edd95134d2b3eb',
  'wingriders', 'v2', o.id, o.address,
  '6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737',
  'e650ce568d1dc1ebfb9bfbd8c06982f3ea95a9959ddaefc783edd95134d2b3eb',
  NULL, NULL, 6,
  'c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d5073', '57696e67526964657273', 6,
  true, now(), now()
FROM public.multi_asset pool_asset
JOIN public.ma_tx_out pool_asset_out ON pool_asset_out.ident = pool_asset.id AND pool_asset_out.quantity > 0
JOIN public.tx_out o ON o.id = pool_asset_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE pool_asset.policy = decode('6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737', 'hex')
  AND pool_asset.name = decode('e650ce568d1dc1ebfb9bfbd8c06982f3ea95a9959ddaefc783edd95134d2b3eb', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND d.value->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->2->>'bytes' = ''
  AND d.value->'fields'->3->>'bytes' = 'c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d5073'
  AND d.value->'fields'->4->>'bytes' = '57696e67526964657273'
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out marker_out
    JOIN public.multi_asset marker ON marker.id = marker_out.ident
    WHERE marker_out.tx_out_id = o.id AND marker_out.quantity = 1
      AND marker.policy = decode('6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737', 'hex')
      AND marker.name = decode('4c', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out wrt_out
    JOIN public.multi_asset wrt ON wrt.id = wrt_out.ident
    WHERE wrt_out.tx_out_id = o.id AND wrt_out.quantity > 0
      AND wrt.policy = decode('c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d5073', 'hex')
      AND wrt.name = decode('57696e67526964657273', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'wingriders'
      AND c.policy_id = 'c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d5073'
      AND c.asset_name = '57696e67526964657273'
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