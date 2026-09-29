INSERT INTO cardyx.asset_catalog (
  market_id, policy_id, asset_name, ticker, display_name, decimals, category, official_url, updated_at
)
VALUES (
  'wingriders',
  'c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d5073',
  '57696e67526964657273',
  'WRT',
  'WingRiders',
  6,
  'defi',
  'https://www.wingriders.com',
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
  'c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d5073',
  '57696e67526964657273',
  'WRT',
  'WingRiders Governance Token',
  'WingRiders is a decentralized exchange protocol on Cardano. WRT provides access to DAO voting and other DEX-related functions.',
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
  'wingriders-v1-026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570-dec347c549f618e80d97682b5b4c6985256503bbb3f3955831f5679cdb8de72f',
  'wingriders', 'v1', o.id, o.address,
  '026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570',
  'dec347c549f618e80d97682b5b4c6985256503bbb3f3955831f5679cdb8de72f',
  NULL, NULL, 6,
  'c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d5073', '57696e67526964657273', 6,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity > 0
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE pool_nft.policy = decode('026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570', 'hex')
  AND pool_nft.name = decode('dec347c549f618e80d97682b5b4c6985256503bbb3f3955831f5679cdb8de72f', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND d.value->'fields'->0->>'bytes' = '86ae9eebd8b97944a45201e4aec1330a72291af2d071644bba015959'
  AND d.value->'fields'->1->'fields'->0->'fields'->0->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->0->'fields'->0->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->0->'fields'->1->'fields'->0->>'bytes' = 'c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d5073'
  AND d.value->'fields'->1->'fields'->0->'fields'->1->'fields'->1->>'bytes' = '57696e67526964657273'
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out marker_out
    JOIN public.multi_asset marker ON marker.id = marker_out.ident
    WHERE marker_out.tx_out_id = o.id AND marker_out.quantity = 1
      AND marker.policy = decode('026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570', 'hex')
      AND marker.name = decode('4c', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out wrt_out
    JOIN public.multi_asset wrt ON wrt.id = wrt_out.ident
    WHERE wrt_out.tx_out_id = o.id AND wrt_out.quantity > 0
      AND wrt.policy = decode('c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d5073', 'hex')
      AND wrt.name = decode('57696e67526964657273', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'wingriders'
      AND c.policy_id = 'c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d5073'
      AND c.asset_name = '57696e67526964657273'
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