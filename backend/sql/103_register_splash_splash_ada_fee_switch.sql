INSERT INTO cardyx.asset_catalog (
  market_id, policy_id, asset_name, ticker, display_name, decimals, category, official_url, updated_at
)
VALUES (
  'splash-protocol',
  'ececc92aeaaac1f5b665f567b01baec8bc2771804b4c21716a87a4e3',
  '53504c415348',
  'SPLASH',
  'Splash Protocol',
  6,
  'defi',
  'https://splash.trade',
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
  'ececc92aeaaac1f5b665f567b01baec8bc2771804b4c21716a87a4e3',
  '53504c415348',
  'SPLASH',
  'SPLASH',
  'Governance Token for Splash Protocol - the fully decentralized and open source exchange for efficient on-chain market making.',
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
  'splash-fee-switch-bde0baebb269e9296c9ecdcceeb33fe464361d099b89698470d6b804-53504c4153485f4144415f4e4654',
  'splash', 'fee-switch', o.id, o.address,
  'bde0baebb269e9296c9ecdcceeb33fe464361d099b89698470d6b804',
  '53504c4153485f4144415f4e4654',
  NULL, NULL, 6,
  'ececc92aeaaac1f5b665f567b01baec8bc2771804b4c21716a87a4e3', '53504c415348', 6,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity = 1
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
JOIN public.multi_asset splash
  ON splash.policy = decode('ececc92aeaaac1f5b665f567b01baec8bc2771804b4c21716a87a4e3', 'hex')
 AND splash.name = decode('53504c415348', 'hex')
JOIN public.ma_tx_out splash_out ON splash_out.ident = splash.id AND splash_out.tx_out_id = o.id
WHERE pool_nft.policy = decode('bde0baebb269e9296c9ecdcceeb33fe464361d099b89698470d6b804', 'hex')
  AND pool_nft.name = decode('53504c4153485f4144415f4e4654', 'hex')
  AND o.address_has_script = true
  AND o.payment_cred = decode('9dee0659686c3ab807895c929e3284c11222affd710b09be690f924d', 'hex')
  AND d.value->'fields'->0->'fields'->0->>'bytes' = 'bde0baebb269e9296c9ecdcceeb33fe464361d099b89698470d6b804'
  AND d.value->'fields'->0->'fields'->1->>'bytes' = '53504c4153485f4144415f4e4654'
  AND d.value->'fields'->1->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->2->'fields'->0->>'bytes' = 'ececc92aeaaac1f5b665f567b01baec8bc2771804b4c21716a87a4e3'
  AND d.value->'fields'->2->'fields'->1->>'bytes' = '53504c415348'
  AND (d.value->'fields'->4->>'int')::numeric BETWEEN 1 AND 100000
  AND (d.value->'fields'->5->>'int')::numeric BETWEEN 0 AND (d.value->'fields'->4->>'int')::numeric
  AND (d.value->'fields'->6->>'int')::numeric >= 0
  AND (d.value->'fields'->7->>'int')::numeric >= 0
  AND o.value > (d.value->'fields'->6->>'int')::numeric + 500000000
  AND splash_out.quantity > (d.value->'fields'->7->>'int')::numeric
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out lp_out
    JOIN public.multi_asset lp ON lp.id = lp_out.ident
    WHERE lp_out.tx_out_id = o.id AND lp_out.quantity > 0
      AND lp.policy = decode(d.value->'fields'->3->'fields'->0->>'bytes', 'hex')
      AND lp.name = decode(d.value->'fields'->3->'fields'->1->>'bytes', 'hex')
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