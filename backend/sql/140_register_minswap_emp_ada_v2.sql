INSERT INTO cardyx.asset_catalog (
  market_id, policy_id, asset_name, ticker, display_name, decimals, category, official_url, updated_at
)
VALUES (
  'empowa',
  '6c8642400e8437f737eb86df0fc8a8437c760f48592b1ba8f5767e81',
  '456d706f7761',
  'EMP',
  'Empowa',
  6,
  'rwa',
  'https://empowa.io',
  now()
)
ON CONFLICT (market_id) DO UPDATE SET
  policy_id = EXCLUDED.policy_id,
  asset_name = EXCLUDED.asset_name,
  ticker = EXCLUDED.ticker,
  display_name = EXCLUDED.display_name,
  decimals = EXCLUDED.decimals,
  category = EXCLUDED.category,
  official_url = EXCLUDED.official_url,
  updated_at = now();

INSERT INTO cardyx.asset_metadata (
  policy_id, asset_name, ticker, display_name, description, decimals, source, updated_at
)
VALUES (
  '6c8642400e8437f737eb86df0fc8a8437c760f48592b1ba8f5767e81',
  '456d706f7761',
  'EMP',
  'Empowa',
  'Empowa is the first RealFi property platform on Cardano that combines emerging technology, sustainable building and decentralised financial inclusion. The Empowa utility token (EMP) allows different parties to participate in the Empowa ecosystem using a common unit of value.',
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
  'minswap-v2-2c49131e78e692b4105f311beca315e6d782fef9d4711675118beee68e22663f',
  'minswap', 'v2', o.id, o.address,
  'f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c',
  '2c49131e78e692b4105f311beca315e6d782fef9d4711675118beee68e22663f',
  NULL, NULL, 6,
  '6c8642400e8437f737eb86df0fc8a8437c760f48592b1ba8f5767e81', '456d706f7761', 6,
  true, now(), now()
FROM public.multi_asset lp
JOIN public.ma_tx_out lp_out ON lp_out.ident = lp.id AND lp_out.quantity > 1
JOIN public.tx_out o ON o.id = lp_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE lp.policy = decode('f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c', 'hex')
  AND lp.name = decode('2c49131e78e692b4105f311beca315e6d782fef9d4711675118beee68e22663f', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND d.value->'fields'->1->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->2->'fields'->0->>'bytes' = '6c8642400e8437f737eb86df0fc8a8437c760f48592b1ba8f5767e81'
  AND d.value->'fields'->2->'fields'->1->>'bytes' = '456d706f7761'
  AND (d.value->'fields'->3->>'int')::numeric > 0
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
    SELECT 1 FROM public.ma_tx_out emp_out
    JOIN public.multi_asset emp ON emp.id = emp_out.ident
    WHERE emp_out.tx_out_id = o.id AND emp_out.quantity >= (d.value->'fields'->5->>'int')::numeric
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