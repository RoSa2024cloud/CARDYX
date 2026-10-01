UPDATE cardyx.asset_catalog
SET policy_id = '2d9db8a89f074aa045eab177f23a3395f62ced8b53499a9e4ad46c80',
    asset_name = '464c4f57',
    ticker = 'SURF',
    display_name = 'Surf Lending',
    decimals = 6,
    category = 'defi',
    official_url = 'https://surflending.org/',
    updated_at = now()
WHERE market_id = 'flow-lending';

INSERT INTO cardyx.asset_metadata (
  policy_id, asset_name, ticker, display_name, description, decimals, source, updated_at
)
VALUES (
  '2d9db8a89f074aa045eab177f23a3395f62ced8b53499a9e4ad46c80',
  '464c4f57',
  'SURF',
  'SURF',
  'SURF Token',
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
  'minswap-v2-b623827076d8b01e7529a77d9f0a9c2fb863dc9aa36416a4ebb12f9d0a6e7f15',
  'minswap', 'v2', o.id, o.address,
  'f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c',
  'b623827076d8b01e7529a77d9f0a9c2fb863dc9aa36416a4ebb12f9d0a6e7f15',
  NULL, NULL, 6,
  '2d9db8a89f074aa045eab177f23a3395f62ced8b53499a9e4ad46c80', '464c4f57', 6,
  true, now(), now()
FROM public.multi_asset lp
JOIN public.ma_tx_out lp_out ON lp_out.ident = lp.id AND lp_out.quantity > 1
JOIN public.tx_out o ON o.id = lp_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id
WHERE lp.policy = decode('f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c', 'hex')
  AND lp.name = decode('b623827076d8b01e7529a77d9f0a9c2fb863dc9aa36416a4ebb12f9d0a6e7f15', 'hex')
  AND o.address_has_script = true
  AND o.payment_cred = decode('ea07b733d932129c378af627436e7cbc2ef0bf96e0036bb51b3bde6b', 'hex')
  AND d.value->'fields'->1->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->2->'fields'->0->>'bytes' = '2d9db8a89f074aa045eab177f23a3395f62ced8b53499a9e4ad46c80'
  AND d.value->'fields'->2->'fields'->1->>'bytes' = '464c4f57'
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
      AND token.policy = decode('2d9db8a89f074aa045eab177f23a3395f62ced8b53499a9e4ad46c80', 'hex')
      AND token.name = decode('464c4f57', 'hex')
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