INSERT INTO cardyx.asset_catalog (
  market_id, policy_id, asset_name, ticker, display_name, decimals, category, official_url, updated_at
)
VALUES (
  'song',
  'f71b4cf652d8edb33a57928b8b8a546a3c954b7ba24db5583ac79b34',
  '534f4e474d41524b4554434150',
  'SONG',
  'SongMarketCap',
  0,
  'other',
  'https://songmarketcap.com/',
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
  'f71b4cf652d8edb33a57928b8b8a546a3c954b7ba24db5583ac79b34',
  '534f4e474d41524b4554434150',
  'SONG',
  'SONG',
  'SongMarketCap community token. Its ADA pool reserve ratio agrees with the published SONG spot price when treated as a zero-decimal asset.',
  0,
  'songmarketcap.com',
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
  'splash-royalty-v1-d8eb52caf3289a2880288b23141ce3d2a7025dcf76f26fd5659add06-de3498de00239a8372e540be094d1c17be04e35c5516094d04c572fcc287f391',
  'splash', 'royalty-v1', o.id, o.address,
  'd8eb52caf3289a2880288b23141ce3d2a7025dcf76f26fd5659add06',
  'de3498de00239a8372e540be094d1c17be04e35c5516094d04c572fcc287f391',
  NULL, NULL, 6,
  'f71b4cf652d8edb33a57928b8b8a546a3c954b7ba24db5583ac79b34', '534f4e474d41524b4554434150', 0,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity = 1
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
JOIN public.multi_asset song
  ON song.policy = decode('f71b4cf652d8edb33a57928b8b8a546a3c954b7ba24db5583ac79b34', 'hex')
 AND song.name = decode('534f4e474d41524b4554434150', 'hex')
JOIN public.ma_tx_out song_out ON song_out.ident = song.id AND song_out.tx_out_id = o.id
WHERE pool_nft.policy = decode('d8eb52caf3289a2880288b23141ce3d2a7025dcf76f26fd5659add06', 'hex')
  AND pool_nft.name = decode('de3498de00239a8372e540be094d1c17be04e35c5516094d04c572fcc287f391', 'hex')
  AND o.address_has_script = true
  AND o.payment_cred = decode('cb684a69e78907a9796b21fc150a758af5f2805e5ed5d5a8ce9f76f1', 'hex')
  AND d.value->'fields'->0->'fields'->0->>'bytes' = 'd8eb52caf3289a2880288b23141ce3d2a7025dcf76f26fd5659add06'
  AND d.value->'fields'->0->'fields'->1->>'bytes' = 'de3498de00239a8372e540be094d1c17be04e35c5516094d04c572fcc287f391'
  AND d.value->'fields'->1->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->2->'fields'->0->>'bytes' = 'f71b4cf652d8edb33a57928b8b8a546a3c954b7ba24db5583ac79b34'
  AND d.value->'fields'->2->'fields'->1->>'bytes' = '534f4e474d41524b4554434150'
  AND (d.value->'fields'->4->>'int')::numeric BETWEEN 1 AND 100000
  AND (d.value->'fields'->5->>'int')::numeric >= 0
  AND (d.value->'fields'->6->>'int')::numeric >= 0
  AND (d.value->'fields'->5->>'int')::numeric + (d.value->'fields'->6->>'int')::numeric <= (d.value->'fields'->4->>'int')::numeric
  AND (d.value->'fields'->7->>'int')::numeric >= 0
  AND (d.value->'fields'->8->>'int')::numeric >= 0
  AND (d.value->'fields'->9->>'int')::numeric >= 0
  AND (d.value->'fields'->10->>'int')::numeric >= 0
  AND o.value::numeric > (d.value->'fields'->7->>'int')::numeric + (d.value->'fields'->9->>'int')::numeric + 500000000
  AND song_out.quantity::numeric > (d.value->'fields'->8->>'int')::numeric + (d.value->'fields'->10->>'int')::numeric
  AND jsonb_array_length(d.value->'fields'->11->'list') > 0
  AND d.value->'fields'->12->>'bytes' IS NOT NULL
  AND d.value->'fields'->13->>'bytes' IS NOT NULL
  AND (d.value->'fields'->14->>'int')::numeric >= 0
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