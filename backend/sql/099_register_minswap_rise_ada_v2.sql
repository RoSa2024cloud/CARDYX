UPDATE cardyx.asset_catalog
SET policy_id = '31bdb2d8ed6e2623e121b6db134a1491f4252b9ea87d928eb5290026',
    asset_name = '496e66696e69747920526973696e67',
    ticker = 'RISE',
    display_name = 'Infinity Rising',
    decimals = 6,
    category = 'gaming',
    updated_at = now()
WHERE market_id = 'infinity-rising';

INSERT INTO cardyx.asset_metadata (
  policy_id, asset_name, ticker, display_name, description, decimals, source, updated_at
)
VALUES (
  '31bdb2d8ed6e2623e121b6db134a1491f4252b9ea87d928eb5290026',
  '496e66696e69747920526973696e67',
  'RISE',
  'Infinity Rising Token',
  'Infinity Rising is an open-world sandbox MMO set between floating sky civilizations and Earth below.',
  6,
  'cardano-token-registry',
  now()
)
ON CONFLICT (policy_id, asset_name) DO UPDATE SET
  ticker = EXCLUDED.ticker,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  decimals = EXCLUDED.decimals,
  source = EXCLUDED.source,
  updated_at = now();

INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'minswap-v2-12f550ab6b69859eeb660a8e13e7a0e71773861120346d69fc375a93cfb34b09',
  'minswap', 'v2', o.id, o.address,
  'f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c',
  '12f550ab6b69859eeb660a8e13e7a0e71773861120346d69fc375a93cfb34b09',
  NULL, NULL, 6,
  '31bdb2d8ed6e2623e121b6db134a1491f4252b9ea87d928eb5290026',
  '496e66696e69747920526973696e67', 6,
  true, now(), now()
FROM public.multi_asset lp
JOIN public.ma_tx_out lp_out ON lp_out.ident = lp.id AND lp_out.quantity > 1
JOIN public.tx_out o ON o.id = lp_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id
WHERE lp.policy = decode('f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c', 'hex')
  AND lp.name = decode('12f550ab6b69859eeb660a8e13e7a0e71773861120346d69fc375a93cfb34b09', 'hex')
  AND o.address_has_script = true
  AND o.payment_cred = decode('ea07b733d932129c378af627436e7cbc2ef0bf96e0036bb51b3bde6b', 'hex')
  AND d.value->'fields'->1->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->2->'fields'->0->>'bytes' = '31bdb2d8ed6e2623e121b6db134a1491f4252b9ea87d928eb5290026'
  AND d.value->'fields'->2->'fields'->1->>'bytes' = '496e66696e69747920526973696e67'
  AND (d.value->'fields'->4->>'int')::numeric > 500000000
  AND (d.value->'fields'->4->>'int')::numeric <= o.value
  AND (d.value->'fields'->5->>'int')::numeric > 0
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out marker_out
    JOIN public.multi_asset marker ON marker.id = marker_out.ident
    WHERE marker_out.tx_out_id = o.id AND marker_out.quantity = 1
      AND marker.policy = lp.policy AND marker.name = decode('4d5350', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out token_out
    JOIN public.multi_asset token ON token.id = token_out.ident
    WHERE token_out.tx_out_id = o.id
      AND token.policy = decode('31bdb2d8ed6e2623e121b6db134a1491f4252b9ea87d928eb5290026', 'hex')
      AND token.name = decode('496e66696e69747920526973696e67', 'hex')
      AND token_out.quantity >= (d.value->'fields'->5->>'int')::numeric
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