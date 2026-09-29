INSERT INTO cardyx.asset_catalog (
  market_id, policy_id, asset_name, ticker, display_name, decimals, category, official_url, updated_at
)
VALUES (
  'pulse',
  '2da97f55d49be13dabc8450a2eabab0412f3075a03f7519d32d46925',
  '0014df1050554c5345',
  'PULSE',
  'PULSE',
  6,
  'defi',
  'https://pulsecardano.org',
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
  '2da97f55d49be13dabc8450a2eabab0412f3075a03f7519d32d46925',
  '0014df1050554c5345',
  'PULSE',
  'PULSE',
  'PULSE Token',
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
  'minswap-v2-0c931d4690bc1c779e1ad3fbe20ebcf8888bee0a5b26b7a5042d106da6d974f1',
  'minswap', 'v2', o.id, o.address,
  'f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c',
  '0c931d4690bc1c779e1ad3fbe20ebcf8888bee0a5b26b7a5042d106da6d974f1',
  NULL, NULL, 6,
  '2da97f55d49be13dabc8450a2eabab0412f3075a03f7519d32d46925', '0014df1050554c5345', 6,
  true, now(), now()
FROM public.multi_asset lp
JOIN public.ma_tx_out lp_out ON lp_out.ident = lp.id AND lp_out.quantity > 1
JOIN public.tx_out o ON o.id = lp_out.tx_out_id AND o.consumed_by_tx_id IS NULL
WHERE lp.policy = decode('f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c', 'hex')
  AND lp.name = decode('0c931d4690bc1c779e1ad3fbe20ebcf8888bee0a5b26b7a5042d106da6d974f1', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out marker_out
    JOIN public.multi_asset marker ON marker.id = marker_out.ident
    WHERE marker_out.tx_out_id = o.id AND marker_out.quantity = 1
      AND marker.policy = decode('f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c', 'hex')
      AND marker.name = decode('4d5350', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out pulse_out
    JOIN public.multi_asset pulse ON pulse.id = pulse_out.ident
    WHERE pulse_out.tx_out_id = o.id AND pulse_out.quantity > 0
      AND pulse.policy = decode('2da97f55d49be13dabc8450a2eabab0412f3075a03f7519d32d46925', 'hex')
      AND pulse.name = decode('0014df1050554c5345', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'pulse'
      AND c.policy_id = '2da97f55d49be13dabc8450a2eabab0412f3075a03f7519d32d46925'
      AND c.asset_name = '0014df1050554c5345'
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