INSERT INTO cardyx.asset_catalog (
  market_id, policy_id, asset_name, ticker, display_name, decimals, category, official_url, updated_at
)
VALUES (
  'revuto',
  '94cbb4fcbcaa2975779f273b263eb3b5f24a9951e446d6dc4c135864',
  '52455655',
  'REVU',
  'Revuto',
  8,
  'defi',
  'https://crypto.revuto.com',
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
  '94cbb4fcbcaa2975779f273b263eb3b5f24a9951e446d6dc4c135864',
  '52455655',
  'REVU',
  'Revuto',
  'Subscribe, control, and pay your subscriptions with Revuto dApp while leveraging subscription charges with REVU (Cardano native token) and DeFi services.',
  8,
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
  'minswap-v2-c4066c1e682023b61f8f3d920e0663ff07d440b19f740896ed7568de36459a1c',
  'minswap', 'v2', o.id, o.address,
  'f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c',
  'c4066c1e682023b61f8f3d920e0663ff07d440b19f740896ed7568de36459a1c',
  NULL, NULL, 6,
  '94cbb4fcbcaa2975779f273b263eb3b5f24a9951e446d6dc4c135864', '52455655', 8,
  true, now(), now()
FROM public.multi_asset lp
JOIN public.ma_tx_out lp_out ON lp_out.ident = lp.id AND lp_out.quantity > 1
JOIN public.tx_out o ON o.id = lp_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE lp.policy = decode('f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c', 'hex')
  AND lp.name = decode('c4066c1e682023b61f8f3d920e0663ff07d440b19f740896ed7568de36459a1c', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND d.value->'fields'->1->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->2->'fields'->0->>'bytes' = '94cbb4fcbcaa2975779f273b263eb3b5f24a9951e446d6dc4c135864'
  AND d.value->'fields'->2->'fields'->1->>'bytes' = '52455655'
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
    SELECT 1 FROM public.ma_tx_out revu_out
    JOIN public.multi_asset revu ON revu.id = revu_out.ident
    WHERE revu_out.tx_out_id = o.id AND revu_out.quantity >= (d.value->'fields'->5->>'int')::numeric
      AND revu.policy = decode('94cbb4fcbcaa2975779f273b263eb3b5f24a9951e446d6dc4c135864', 'hex')
      AND revu.name = decode('52455655', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'revuto'
      AND c.policy_id = '94cbb4fcbcaa2975779f273b263eb3b5f24a9951e446d6dc4c135864'
      AND c.asset_name = '52455655'
      AND c.decimals = 8
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