INSERT INTO cardyx.asset_catalog (
  market_id, policy_id, asset_name, ticker, display_name, decimals, category, official_url, updated_at
)
VALUES (
  'nikepig',
  'c881c20e49dbaca3ff6cef365969354150983230c39520b917f5cf7c',
  '4e696b65',
  'NIKEPIG',
  'Nikepig',
  0,
  'meme',
  'https://x.com/NikePig_ADA',
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
  'c881c20e49dbaca3ff6cef365969354150983230c39520b917f5cf7c',
  '4e696b65',
  'NIKEPIG',
  'NikePig',
  'He’s a Good Pig',
  0,
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
  'minswap-v1-a626c993b13400ea4c58003118691d29597543d5f347a243ac5679c832095be1',
  'minswap', 'v1', o.id, o.address,
  '0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1',
  'a626c993b13400ea4c58003118691d29597543d5f347a243ac5679c832095be1',
  NULL, NULL, 6,
  'c881c20e49dbaca3ff6cef365969354150983230c39520b917f5cf7c', '4e696b65', 0,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity = 1
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE pool_nft.policy = decode('0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1', 'hex')
  AND pool_nft.name = decode('a626c993b13400ea4c58003118691d29597543d5f347a243ac5679c832095be1', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND d.value->'fields'->0->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->0->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->0->>'bytes' = 'c881c20e49dbaca3ff6cef365969354150983230c39520b917f5cf7c'
  AND d.value->'fields'->1->'fields'->1->>'bytes' = '4e696b65'
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
      AND token.policy = decode('c881c20e49dbaca3ff6cef365969354150983230c39520b917f5cf7c', 'hex')
      AND token.name = decode('4e696b65', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'nikepig'
      AND c.policy_id = 'c881c20e49dbaca3ff6cef365969354150983230c39520b917f5cf7c'
      AND c.asset_name = '4e696b65'
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