UPDATE cardyx.asset_catalog
SET policy_id = '7507734918533b3b896241b4704f3d4ce805256b01da6fcede430436',
    asset_name = '42616279534e454b',
    ticker = 'BBSNEK',
    display_name = 'BabySNEK',
    decimals = 0,
    category = 'meme',
    official_url = 'https://babysnek.io/',
    updated_at = now()
WHERE market_id = 'babysnek';

INSERT INTO cardyx.asset_metadata (
  policy_id, asset_name, ticker, display_name, description, decimals, source, updated_at
)
VALUES (
  '7507734918533b3b896241b4704f3d4ce805256b01da6fcede430436',
  '42616279534e454b',
  'BBSNEK',
  'BabySNEK',
  'The little SNEK Brother living on Cardano.',
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
  'splash-classic-0aeed91544f0e3d1921234febf11783d9d704ff62d561bba725b468f-42616279534e454b5f4144415f4e4654',
  'splash', 'classic', o.id, o.address,
  '0aeed91544f0e3d1921234febf11783d9d704ff62d561bba725b468f', '42616279534e454b5f4144415f4e4654',
  NULL, NULL, 6,
  '7507734918533b3b896241b4704f3d4ce805256b01da6fcede430436', '42616279534e454b', 0,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity = 1
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
JOIN public.multi_asset bbsnek
  ON bbsnek.policy = decode('7507734918533b3b896241b4704f3d4ce805256b01da6fcede430436', 'hex')
 AND bbsnek.name = decode('42616279534e454b', 'hex')
JOIN public.ma_tx_out bbsnek_out ON bbsnek_out.ident = bbsnek.id AND bbsnek_out.tx_out_id = o.id
WHERE pool_nft.policy = decode('0aeed91544f0e3d1921234febf11783d9d704ff62d561bba725b468f', 'hex')
  AND pool_nft.name = decode('42616279534e454b5f4144415f4e4654', 'hex')
  AND o.address_has_script = true
  AND o.value > 2000000
  AND d.value->'fields'->0->'fields'->0->>'bytes' = '0aeed91544f0e3d1921234febf11783d9d704ff62d561bba725b468f'
  AND d.value->'fields'->0->'fields'->1->>'bytes' = '42616279534e454b5f4144415f4e4654'
  AND d.value->'fields'->1->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->2->'fields'->0->>'bytes' = '7507734918533b3b896241b4704f3d4ce805256b01da6fcede430436'
  AND d.value->'fields'->2->'fields'->1->>'bytes' = '42616279534e454b'
  AND (d.value->'fields'->4->>'int')::numeric BETWEEN 1 AND 1000
  AND (d.value->'fields'->6->>'int')::numeric >= 0
  AND bbsnek_out.quantity > 0
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out lp_out
    JOIN public.multi_asset lp ON lp.id = lp_out.ident
    WHERE lp_out.tx_out_id = o.id AND lp_out.quantity > 0
      AND lp.policy = decode(d.value->'fields'->3->'fields'->0->>'bytes', 'hex')
      AND lp.name = decode(d.value->'fields'->3->'fields'->1->>'bytes', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'babysnek'
      AND c.policy_id = '7507734918533b3b896241b4704f3d4ce805256b01da6fcede430436'
      AND c.asset_name = '42616279534e454b'
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