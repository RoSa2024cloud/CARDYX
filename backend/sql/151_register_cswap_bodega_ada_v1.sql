INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'cswap-v1-415afd52d8c899ceb59caf4740647b14f4ed82bba222fb4c07751dbf-432d4c503a20414441207820424f44454741',
  'cswap', 'v1', o.id, o.address,
  '415afd52d8c899ceb59caf4740647b14f4ed82bba222fb4c07751dbf', '63',
  NULL, NULL, 6,
  '5deab590a137066fef0e56f06ef1b830f21bc5d544661ba570bdd2ae', '424f44454741', 6,
  true, now(), now()
FROM public.multi_asset marker
JOIN public.ma_tx_out marker_out ON marker_out.ident = marker.id AND marker_out.quantity = 1
JOIN public.tx_out o ON o.id = marker_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE marker.policy = decode('415afd52d8c899ceb59caf4740647b14f4ed82bba222fb4c07751dbf', 'hex')
  AND marker.name = decode('63', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND (d.value->'fields'->0->>'int')::numeric > 0
  AND d.value->'fields'->4->>'bytes' = '5deab590a137066fef0e56f06ef1b830f21bc5d544661ba570bdd2ae'
  AND d.value->'fields'->5->>'bytes' = '424f44454741'
  AND d.value->'fields'->6->>'bytes' = '415afd52d8c899ceb59caf4740647b14f4ed82bba222fb4c07751dbf'
  AND d.value->'fields'->7->>'bytes' = '432d4c503a20414441207820424f44454741'
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out bodega_out
    JOIN public.multi_asset bodega ON bodega.id = bodega_out.ident
    WHERE bodega_out.tx_out_id = o.id AND bodega_out.quantity > 0
      AND bodega.policy = decode('5deab590a137066fef0e56f06ef1b830f21bc5d544661ba570bdd2ae', 'hex')
      AND bodega.name = decode('424f44454741', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'bodega'
      AND c.policy_id = '5deab590a137066fef0e56f06ef1b830f21bc5d544661ba570bdd2ae'
      AND c.asset_name = '424f44454741'
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