INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'muesliswap-amm-909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f-831c818e6269f6ac349c253aaf0fb4f8c66198a19e76755e10a89584616bbced',
  'muesliswap', 'amm', o.id, o.address,
  '909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f',
  '831c818e6269f6ac349c253aaf0fb4f8c66198a19e76755e10a89584616bbced',
  NULL, NULL, 6,
  '6c8642400e8437f737eb86df0fc8a8437c760f48592b1ba8f5767e81', '456d706f7761', 6,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity = 1
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE pool_nft.policy = decode('909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f', 'hex')
  AND pool_nft.name = decode('831c818e6269f6ac349c253aaf0fb4f8c66198a19e76755e10a89584616bbced', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND d.value->'fields'->0->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->0->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->0->>'bytes' = '6c8642400e8437f737eb86df0fc8a8437c760f48592b1ba8f5767e81'
  AND d.value->'fields'->1->'fields'->1->>'bytes' = '456d706f7761'
  AND (d.value->'fields'->2->>'int')::numeric > 0
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out amm_out
    JOIN public.multi_asset amm_marker ON amm_marker.id = amm_out.ident
    WHERE amm_out.tx_out_id = o.id AND amm_out.quantity = 1
      AND amm_marker.policy = decode('de9b756719341e79785aa13c164e7fe68c189ed04d61c9876b2fe53f', 'hex')
      AND amm_marker.name = decode('4d7565736c69537761705f414d4d', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out emp_out
    JOIN public.multi_asset emp ON emp.id = emp_out.ident
    WHERE emp_out.tx_out_id = o.id AND emp_out.quantity > 0
      AND emp.policy = decode('6c8642400e8437f737eb86df0fc8a8437c760f48592b1ba8f5767e81', 'hex')
      AND emp.name = decode('456d706f7761', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'empowa'
      AND c.policy_id = '6c8642400e8437f737eb86df0fc8a8437c760f48592b1ba8f5767e81'
      AND c.asset_name = '456d706f7761'
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