INSERT INTO cardyx.asset_catalog (
  market_id, policy_id, asset_name, ticker, display_name, decimals, category, official_url, updated_at
)
VALUES (
  'meld',
  '6ac8ef33b510ec004fe11585f7c5a9f0c07f0c23428ab4f29c1d7d10',
  '4d454c44',
  'MELD',
  'MELD',
  6,
  'defi',
  'https://meld.com',
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
  '6ac8ef33b510ec004fe11585f7c5a9f0c07f0c23428ab4f29c1d7d10',
  '4d454c44',
  'MELD',
  'MELD',
  'Deprecated version of the governance token of the MELD protocol.',
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
  'minswap-v1-39d5a91060c49be0b39c1c59b15bee45a7817d05737c5eaa8842f8fbda0c2aee',
  'minswap', 'v1', o.id, o.address,
  '0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1',
  '39d5a91060c49be0b39c1c59b15bee45a7817d05737c5eaa8842f8fbda0c2aee',
  NULL, NULL, 6,
  '6ac8ef33b510ec004fe11585f7c5a9f0c07f0c23428ab4f29c1d7d10', '4d454c44', 6,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity > 0
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE pool_nft.policy = decode('0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1', 'hex')
  AND pool_nft.name = decode('39d5a91060c49be0b39c1c59b15bee45a7817d05737c5eaa8842f8fbda0c2aee', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND d.value->'fields'->0->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->0->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->0->>'bytes' = '6ac8ef33b510ec004fe11585f7c5a9f0c07f0c23428ab4f29c1d7d10'
  AND d.value->'fields'->1->'fields'->1->>'bytes' = '4d454c44'
  AND (d.value->'fields'->2->>'int')::numeric > 0
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out factory_out
    JOIN public.multi_asset factory ON factory.id = factory_out.ident
    WHERE factory_out.tx_out_id = o.id AND factory_out.quantity = 1
      AND factory.policy = decode('13aa2accf2e1561723aa26871e071fdf32c867cff7e7d50ad470d62f', 'hex')
      AND factory.name = decode('4d494e53574150', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out meld_out
    JOIN public.multi_asset meld ON meld.id = meld_out.ident
    WHERE meld_out.tx_out_id = o.id AND meld_out.quantity > 0
      AND meld.policy = decode('6ac8ef33b510ec004fe11585f7c5a9f0c07f0c23428ab4f29c1d7d10', 'hex')
      AND meld.name = decode('4d454c44', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out lp_out
    JOIN public.multi_asset lp ON lp.id = lp_out.ident
    WHERE lp_out.tx_out_id = o.id AND lp_out.quantity > 0
      AND lp.policy = decode('e4214b7cce62ac6fbba385d164df48e157eae5863521b4b67ca71d86', 'hex')
      AND lp.name = decode('39d5a91060c49be0b39c1c59b15bee45a7817d05737c5eaa8842f8fbda0c2aee', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'meld'
      AND c.policy_id = '6ac8ef33b510ec004fe11585f7c5a9f0c07f0c23428ab4f29c1d7d10'
      AND c.asset_name = '4d454c44'
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