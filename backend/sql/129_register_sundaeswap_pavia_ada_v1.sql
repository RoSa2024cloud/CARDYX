INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'sundaeswap-v1-09',
  'sundaeswap', 'v1', o.id, o.address,
  '0029cb7c88c7567b63d1a512c0ed626aa169688ec980730c0473b913', '702009',
  NULL, NULL, 6,
  '884892bcdc360bcef87d6b3f806e7f9cd5ac30d999d49970e7a903ae', '5041564941', 0,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity = 1
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE pool_nft.policy = decode('0029cb7c88c7567b63d1a512c0ed626aa169688ec980730c0473b913', 'hex')
  AND pool_nft.name = decode('702009', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND d.value->'fields'->1->>'bytes' = '09'
  AND d.value->'fields'->0->'fields'->0->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->0->'fields'->0->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->0->'fields'->1->'fields'->0->>'bytes' = '884892bcdc360bcef87d6b3f806e7f9cd5ac30d999d49970e7a903ae'
  AND d.value->'fields'->0->'fields'->1->'fields'->1->>'bytes' = '5041564941'
  AND (d.value->'fields'->2->>'int')::numeric > 0
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out pavia_out
    JOIN public.multi_asset pavia ON pavia.id = pavia_out.ident
    WHERE pavia_out.tx_out_id = o.id AND pavia_out.quantity > 0
      AND pavia.policy = decode('884892bcdc360bcef87d6b3f806e7f9cd5ac30d999d49970e7a903ae', 'hex')
      AND pavia.name = decode('5041564941', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'pavia'
      AND c.policy_id = '884892bcdc360bcef87d6b3f806e7f9cd5ac30d999d49970e7a903ae'
      AND c.asset_name = '5041564941'
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