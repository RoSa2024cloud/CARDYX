INSERT INTO cardyx.asset_catalog (
  market_id, policy_id, asset_name, ticker, display_name, decimals, category, official_url, updated_at
)
VALUES (
  'btn',
  '016be5325fd988fea98ad422fcfd53e5352cacfced5c106a932a35a4',
  '42544e',
  'BTN',
  'BTN',
  6,
  'defi',
  'https://butane.dev',
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
  '016be5325fd988fea98ad422fcfd53e5352cacfced5c106a932a35a4',
  '42544e',
  'BTN',
  'BTN',
  'BTN is the native token of Butane, an advanced synthetics protocol.',
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
  'sundaeswap-v3-8e76c60dd3cbccdf8af264e560686078f05345d96d90c4af19c6c4f6',
  'sundaeswap', 'v3', o.id, o.address,
  'e0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b',
  '000de1408e76c60dd3cbccdf8af264e560686078f05345d96d90c4af19c6c4f6',
  NULL, NULL, 6,
  '016be5325fd988fea98ad422fcfd53e5352cacfced5c106a932a35a4', '42544e', 6,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity = 1
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE pool_nft.policy = decode('e0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b', 'hex')
  AND pool_nft.name = decode('000de1408e76c60dd3cbccdf8af264e560686078f05345d96d90c4af19c6c4f6', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND d.value->'fields'->0->>'bytes' = '8e76c60dd3cbccdf8af264e560686078f05345d96d90c4af19c6c4f6'
  AND d.value->'fields'->1->'list'->0->'list'->0->>'bytes' = ''
  AND d.value->'fields'->1->'list'->0->'list'->1->>'bytes' = ''
  AND d.value->'fields'->1->'list'->1->'list'->0->>'bytes' = '016be5325fd988fea98ad422fcfd53e5352cacfced5c106a932a35a4'
  AND d.value->'fields'->1->'list'->1->'list'->1->>'bytes' = '42544e'
  AND (d.value->'fields'->2->>'int')::numeric > 0
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out btn_out
    JOIN public.multi_asset btn ON btn.id = btn_out.ident
    WHERE btn_out.tx_out_id = o.id AND btn_out.quantity > 0
      AND btn.policy = decode('016be5325fd988fea98ad422fcfd53e5352cacfced5c106a932a35a4', 'hex')
      AND btn.name = decode('42544e', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'btn'
      AND c.policy_id = '016be5325fd988fea98ad422fcfd53e5352cacfced5c106a932a35a4'
      AND c.asset_name = '42544e'
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