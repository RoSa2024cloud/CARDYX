INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'muesliswap-amm-909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f-a581cffa1a91f180de1de2a5c0f4eaf717af63f14603b6ec726dbf2e5a63c385',
  'muesliswap', 'amm', o.id, o.address,
  '909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f',
  'a581cffa1a91f180de1de2a5c0f4eaf717af63f14603b6ec726dbf2e5a63c385',
  NULL, NULL, 6,
  '804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f', '56594649', 6,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity = 1
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
WHERE pool_nft.policy = decode('909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f', 'hex')
  AND pool_nft.name = decode('a581cffa1a91f180de1de2a5c0f4eaf717af63f14603b6ec726dbf2e5a63c385', 'hex')
  AND o.address_has_script = true
  AND o.value >= 500000000
  AND d.value->'fields'->0->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->0->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->0->>'bytes' = '804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f'
  AND d.value->'fields'->1->'fields'->1->>'bytes' = '56594649'
  AND (d.value->'fields'->2->>'int')::numeric > 0
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out amm_out
    JOIN public.multi_asset amm_marker ON amm_marker.id = amm_out.ident
    WHERE amm_out.tx_out_id = o.id AND amm_out.quantity = 1
      AND amm_marker.policy = decode('de9b756719341e79785aa13c164e7fe68c189ed04d61c9876b2fe53f', 'hex')
      AND amm_marker.name = decode('4d7565736c69537761705f414d4d', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out vyfi_out
    JOIN public.multi_asset vyfi ON vyfi.id = vyfi_out.ident
    WHERE vyfi_out.tx_out_id = o.id AND vyfi_out.quantity > 0
      AND vyfi.policy = decode('804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f', 'hex')
      AND vyfi.name = decode('56594649', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'vyfi-legacy'
      AND c.policy_id = '804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f'
      AND c.asset_name = '56594649'
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