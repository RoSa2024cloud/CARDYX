INSERT INTO cardyx.asset_catalog (
  market_id, policy_id, asset_name, ticker, display_name, decimals, category, official_url, updated_at
)
VALUES (
  'fluidtokens',
  '577f0b1342f8f8f4aed3388b80a8535812950c7a892495c0ecdf0f1e',
  '0014df10464c4454',
  'FLDT',
  'FluidTokens',
  6,
  'defi',
  'https://fluidtokens.com',
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
  '577f0b1342f8f8f4aed3388b80a8535812950c7a892495c0ecdf0f1e',
  '0014df10464c4454',
  'FLDT',
  'FLDT',
  'The official token of FluidTokens, a leading DeFi ecosystem fueled by innovation and community backing.',
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
  'minswap-v1-bbfe2d3033ea40ed27733fc1ec30b8994d59cf28eed9268746ab41619960cae6',
  'minswap', 'v1', o.id, o.address,
  '0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1',
  'bbfe2d3033ea40ed27733fc1ec30b8994d59cf28eed9268746ab41619960cae6',
  NULL, NULL, 6,
  '577f0b1342f8f8f4aed3388b80a8535812950c7a892495c0ecdf0f1e', '0014df10464c4454', 6,
  true, now(), now()
FROM public.multi_asset nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = nft.id AND nft_out.quantity = 1
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.hash = o.data_hash
WHERE nft.policy = decode('0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1', 'hex')
  AND nft.name = decode('bbfe2d3033ea40ed27733fc1ec30b8994d59cf28eed9268746ab41619960cae6', 'hex')
  AND o.address_has_script = true
  AND o.value > 500000000
  AND d.value->'fields'->0->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->0->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->0->>'bytes' = '577f0b1342f8f8f4aed3388b80a8535812950c7a892495c0ecdf0f1e'
  AND d.value->'fields'->1->'fields'->1->>'bytes' = '0014df10464c4454'
  AND (d.value->'fields'->2->>'int')::numeric > 0
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out factory_out
    JOIN public.multi_asset factory ON factory.id = factory_out.ident
    WHERE factory_out.tx_out_id = o.id AND factory_out.quantity = 1
      AND factory.policy = decode('13aa2accf2e1561723aa26871e071fdf32c867cff7e7d50ad470d62f', 'hex')
      AND factory.name = decode('4d494e53574150', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out token_out
    JOIN public.multi_asset token ON token.id = token_out.ident
    WHERE token_out.tx_out_id = o.id AND token_out.quantity > 0
      AND token.policy = decode('577f0b1342f8f8f4aed3388b80a8535812950c7a892495c0ecdf0f1e', 'hex')
      AND token.name = decode('0014df10464c4454', 'hex')
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