INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'cswap-v1-e4eb1f1277d8d4a909263871fccf040728e49bb95db9e29a178bbb77-432d4c503a2041444120782042616279534e454b',
  'cswap', 'v1', o.id, o.address,
  'e4eb1f1277d8d4a909263871fccf040728e49bb95db9e29a178bbb77', '63',
  NULL, NULL, 6,
  '7507734918533b3b896241b4704f3d4ce805256b01da6fcede430436', '42616279534e454b', 0,
  true, now(), now()
FROM public.multi_asset marker
JOIN public.ma_tx_out marker_out ON marker_out.ident = marker.id AND marker_out.quantity = 1
JOIN public.tx_out o ON o.id = marker_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE marker.policy = decode('e4eb1f1277d8d4a909263871fccf040728e49bb95db9e29a178bbb77', 'hex')
  AND marker.name = decode('63', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND (d.value->'fields'->0->>'int')::numeric > 0
  AND d.value->'fields'->4->>'bytes' = '7507734918533b3b896241b4704f3d4ce805256b01da6fcede430436'
  AND d.value->'fields'->5->>'bytes' = '42616279534e454b'
  AND d.value->'fields'->6->>'bytes' = 'e4eb1f1277d8d4a909263871fccf040728e49bb95db9e29a178bbb77'
  AND d.value->'fields'->7->>'bytes' = '432d4c503a2041444120782042616279534e454b'
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out bbsnek_out
    JOIN public.multi_asset bbsnek ON bbsnek.id = bbsnek_out.ident
    WHERE bbsnek_out.tx_out_id = o.id AND bbsnek_out.quantity > 0
      AND bbsnek.policy = decode('7507734918533b3b896241b4704f3d4ce805256b01da6fcede430436', 'hex')
      AND bbsnek.name = decode('42616279534e454b', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'babysnek'
      AND c.policy_id = '7507734918533b3b896241b4704f3d4ce805256b01da6fcede430436'
      AND c.asset_name = '42616279534e454b'
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