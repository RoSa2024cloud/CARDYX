INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'minswap-v1-face3a0164da55d1627cd6af895a9a0cd4e4edc110632d407494644e3c924937',
  'minswap', 'v1', o.id, o.address,
  '0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1',
  'face3a0164da55d1627cd6af895a9a0cd4e4edc110632d407494644e3c924937',
  NULL, NULL, 6,
  'edfd7a1d77bcb8b884c474bdc92a16002d1fb720e454fa6e99344479', '4e5458', 6,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity = 1
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE pool_nft.policy = decode('0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1', 'hex')
  AND pool_nft.name = decode('face3a0164da55d1627cd6af895a9a0cd4e4edc110632d407494644e3c924937', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND d.value->'fields'->0->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->0->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->0->>'bytes' = 'edfd7a1d77bcb8b884c474bdc92a16002d1fb720e454fa6e99344479'
  AND d.value->'fields'->1->'fields'->1->>'bytes' = '4e5458'
  AND (d.value->'fields'->2->>'int')::numeric > 0
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out factory_out
    JOIN public.multi_asset factory ON factory.id = factory_out.ident
    WHERE factory_out.tx_out_id = o.id AND factory_out.quantity = 1
      AND factory.policy = decode('13aa2accf2e1561723aa26871e071fdf32c867cff7e7d50ad470d62f', 'hex')
      AND factory.name = decode('4d494e53574150', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out ntx_out
    JOIN public.multi_asset ntx ON ntx.id = ntx_out.ident
    WHERE ntx_out.tx_out_id = o.id AND ntx_out.quantity > 0
      AND ntx.policy = decode('edfd7a1d77bcb8b884c474bdc92a16002d1fb720e454fa6e99344479', 'hex')
      AND ntx.name = decode('4e5458', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.policy_id = 'edfd7a1d77bcb8b884c474bdc92a16002d1fb720e454fa6e99344479'
      AND c.asset_name = '4e5458'
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