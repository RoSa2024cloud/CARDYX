INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'splash-royalty-v1-7b5dee4d7c3d06882cd52d659b4822f4366ba402053d0e691f1e1ed4-48554e545f4144415f4e4654',
  'splash', 'royalty-v1', o.id, o.address,
  '7b5dee4d7c3d06882cd52d659b4822f4366ba402053d0e691f1e1ed4',
  '48554e545f4144415f4e4654',
  NULL, NULL, 6,
  '95a427e384527065f2f8946f5e86320d0117839a5e98ea2c0b55fb00', '48554e54', 6,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity = 1
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
JOIN public.multi_asset hunt
  ON hunt.policy = decode('95a427e384527065f2f8946f5e86320d0117839a5e98ea2c0b55fb00', 'hex')
 AND hunt.name = decode('48554e54', 'hex')
JOIN public.ma_tx_out hunt_out ON hunt_out.ident = hunt.id AND hunt_out.tx_out_id = o.id
WHERE pool_nft.policy = decode('7b5dee4d7c3d06882cd52d659b4822f4366ba402053d0e691f1e1ed4', 'hex')
  AND pool_nft.name = decode('48554e545f4144415f4e4654', 'hex')
  AND o.address_has_script = true
  AND d.value->'fields'->0->'fields'->0->>'bytes' = '7b5dee4d7c3d06882cd52d659b4822f4366ba402053d0e691f1e1ed4'
  AND d.value->'fields'->0->'fields'->1->>'bytes' = '48554e545f4144415f4e4654'
  AND d.value->'fields'->1->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->2->'fields'->0->>'bytes' = '95a427e384527065f2f8946f5e86320d0117839a5e98ea2c0b55fb00'
  AND d.value->'fields'->2->'fields'->1->>'bytes' = '48554e54'
  AND (d.value->'fields'->4->>'int')::numeric BETWEEN 1 AND 100000
  AND (d.value->'fields'->5->>'int')::numeric >= 0
  AND (d.value->'fields'->6->>'int')::numeric >= 0
  AND (d.value->'fields'->5->>'int')::numeric + (d.value->'fields'->6->>'int')::numeric <= (d.value->'fields'->4->>'int')::numeric
  AND (d.value->'fields'->7->>'int')::numeric >= 0
  AND (d.value->'fields'->8->>'int')::numeric >= 0
  AND (d.value->'fields'->9->>'int')::numeric >= 0
  AND (d.value->'fields'->10->>'int')::numeric >= 0
  AND o.value::numeric > (d.value->'fields'->7->>'int')::numeric + (d.value->'fields'->9->>'int')::numeric + 500000000
  AND hunt_out.quantity::numeric > (d.value->'fields'->8->>'int')::numeric + (d.value->'fields'->10->>'int')::numeric
  AND jsonb_array_length(d.value->'fields'->11->'list') > 0
  AND d.value->'fields'->12->>'bytes' IS NOT NULL
  AND d.value->'fields'->13->>'bytes' IS NOT NULL
  AND (d.value->'fields'->14->>'int')::numeric >= 0
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out lp_out
    JOIN public.multi_asset lp ON lp.id = lp_out.ident
    WHERE lp_out.tx_out_id = o.id AND lp_out.quantity > 0
      AND lp.policy = decode(d.value->'fields'->3->'fields'->0->>'bytes', 'hex')
      AND lp.name = decode(d.value->'fields'->3->'fields'->1->>'bytes', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'dexhunter'
      AND c.policy_id = '95a427e384527065f2f8946f5e86320d0117839a5e98ea2c0b55fb00'
      AND c.asset_name = '48554e54'
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