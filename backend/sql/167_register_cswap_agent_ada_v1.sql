INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'cswap-v1-9a7bd045d5e30327546978105c8090e9081417cca350ef768741b6ff-432d4c503a2041444120782054616c6f73',
  'cswap',
  'v1',
  output.id,
  output.address,
  '9a7bd045d5e30327546978105c8090e9081417cca350ef768741b6ff',
  '63',
  NULL,
  NULL,
  6,
  '97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec',
  '54616c6f73',
  0,
  true,
  now(),
  now()
FROM public.multi_asset marker
JOIN public.ma_tx_out marker_output
  ON marker_output.ident = marker.id
 AND marker_output.quantity = 1
JOIN public.tx_out output
  ON output.id = marker_output.tx_out_id
 AND output.consumed_by_tx_id IS NULL
JOIN public.datum pool_datum
  ON pool_datum.id = output.inline_datum_id
  OR pool_datum.hash = output.data_hash
WHERE marker.policy = decode('9a7bd045d5e30327546978105c8090e9081417cca350ef768741b6ff', 'hex')
  AND marker.name = decode('63', 'hex')
  AND output.address_has_script = true
  AND output.value >= 500000000
  AND (pool_datum.value->'fields'->0->>'int')::numeric > 0
  AND pool_datum.value->'fields'->4->>'bytes' = '97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec'
  AND pool_datum.value->'fields'->5->>'bytes' = '54616c6f73'
  AND pool_datum.value->'fields'->6->>'bytes' = '9a7bd045d5e30327546978105c8090e9081417cca350ef768741b6ff'
  AND pool_datum.value->'fields'->7->>'bytes' = '432d4c503a2041444120782054616c6f73'
  AND EXISTS (
    SELECT 1
    FROM public.ma_tx_out token_output
    JOIN public.multi_asset token ON token.id = token_output.ident
    WHERE token_output.tx_out_id = output.id
      AND token_output.quantity > 0
      AND token.policy = decode('97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec', 'hex')
      AND token.name = decode('54616c6f73', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog token
    WHERE token.market_id = 'talos'
      AND token.policy_id = '97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec'
      AND token.asset_name = '54616c6f73'
      AND token.decimals = 0
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.tx_in spent
    WHERE spent.tx_out_id = output.tx_id
      AND spent.tx_out_index = output.index
  )
ON CONFLICT (pool_id) DO UPDATE SET
  tx_out_id = EXCLUDED.tx_out_id,
  pool_address = EXCLUDED.pool_address,
  pool_nft_policy_id = EXCLUDED.pool_nft_policy_id,
  pool_nft_asset_name = EXCLUDED.pool_nft_asset_name,
  asset_a_policy_id = EXCLUDED.asset_a_policy_id,
  asset_a_asset_name = EXCLUDED.asset_a_asset_name,
  asset_a_decimals = EXCLUDED.asset_a_decimals,
  asset_b_policy_id = EXCLUDED.asset_b_policy_id,
  asset_b_asset_name = EXCLUDED.asset_b_asset_name,
  asset_b_decimals = EXCLUDED.asset_b_decimals,
  enabled = EXCLUDED.enabled,
  validated_at = EXCLUDED.validated_at,
  updated_at = now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cardyx.dex_pool_registry
    WHERE pool_id = 'cswap-v1-9a7bd045d5e30327546978105c8090e9081417cca350ef768741b6ff-432d4c503a2041444120782054616c6f73'
      AND enabled = true
      AND validated_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'The verified CSwap V1 AGENT/ADA pool was not registered; migration rolled back.';
  END IF;
END $$;