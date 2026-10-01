INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'cswap-v1-6c65cce5f0fef7ee8649e7c323ccbb7721a342843ed1760026853ab9-432d4c503a2041444120782042414e4b',
  'cswap', 'v1', o.id, o.address,
  '6c65cce5f0fef7ee8649e7c323ccbb7721a342843ed1760026853ab9', '63',
  NULL, NULL, 6,
  '2b28c81dbba6d67e4b5a997c6be1212cba9d60d33f82444ab8b1f218', '42414e4b', 0,
  true, now(), now()
FROM public.multi_asset marker
JOIN public.ma_tx_out marker_out ON marker_out.ident = marker.id AND marker_out.quantity = 1
JOIN public.tx_out o ON o.id = marker_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE marker.policy = decode('6c65cce5f0fef7ee8649e7c323ccbb7721a342843ed1760026853ab9', 'hex')
  AND marker.name = decode('63', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND (d.value->'fields'->0->>'int')::numeric > 0
  AND d.value->'fields'->4->>'bytes' = '2b28c81dbba6d67e4b5a997c6be1212cba9d60d33f82444ab8b1f218'
  AND d.value->'fields'->5->>'bytes' = '42414e4b'
  AND d.value->'fields'->6->>'bytes' = '6c65cce5f0fef7ee8649e7c323ccbb7721a342843ed1760026853ab9'
  AND d.value->'fields'->7->>'bytes' = '432d4c503a2041444120782042414e4b'
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out bank_out
    JOIN public.multi_asset bank ON bank.id = bank_out.ident
    WHERE bank_out.tx_out_id = o.id AND bank_out.quantity > 0
      AND bank.policy = decode('2b28c81dbba6d67e4b5a997c6be1212cba9d60d33f82444ab8b1f218', 'hex')
      AND bank.name = decode('42414e4b', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'banker-labs'
      AND c.policy_id = '2b28c81dbba6d67e4b5a997c6be1212cba9d60d33f82444ab8b1f218'
      AND c.asset_name = '42414e4b'
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