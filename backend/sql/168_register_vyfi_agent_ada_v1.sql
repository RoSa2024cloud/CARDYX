INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'vyfi-v1-fe87ca564b467aa6de634aad76368ae6219fd4342b5a2da8a3ded881-97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec54616c6f73',
  'vyfi',
  'v1',
  output.id,
  output.address,
  'fe87ca564b467aa6de634aad76368ae6219fd4342b5a2da8a3ded881',
  '',
  NULL,
  NULL,
  6,
  '97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec',
  '54616c6f73',
  0,
  true,
  now(),
  now()
FROM public.tx transaction
JOIN public.tx_out output ON output.tx_id = transaction.id
JOIN public.datum pool_datum
  ON pool_datum.id = output.inline_datum_id
  OR pool_datum.hash = output.data_hash
JOIN public.multi_asset pool_nft
  ON pool_nft.policy = decode('fe87ca564b467aa6de634aad76368ae6219fd4342b5a2da8a3ded881', 'hex')
 AND pool_nft.name = decode('', 'hex')
JOIN public.ma_tx_out nft_output
  ON nft_output.ident = pool_nft.id
 AND nft_output.tx_out_id = output.id
 AND nft_output.quantity = 1
WHERE transaction.hash = decode('0942bfcb24c26db358a1ff52500938b54114addc7d4809a367ef600a66a65e4d', 'hex')
  AND output.index = 0
  AND output.consumed_by_tx_id IS NULL
  AND output.address_has_script = true
  AND output.value >= 500000000
  AND jsonb_typeof(pool_datum.value->'fields') = 'array'
  AND jsonb_array_length(pool_datum.value->'fields') = 3
  AND (pool_datum.value->'fields'->0->>'int') ~ '^[0-9]+$'
  AND (pool_datum.value->'fields'->0->>'int')::numeric > 0
  AND (pool_datum.value->'fields'->1->>'int') ~ '^[0-9]+$'
  AND (pool_datum.value->'fields'->1->>'int')::numeric >= 0
  AND (pool_datum.value->'fields'->2->>'int') ~ '^[0-9]+$'
  AND (pool_datum.value->'fields'->2->>'int')::numeric >= 0
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
    WHERE pool_id = 'vyfi-v1-fe87ca564b467aa6de634aad76368ae6219fd4342b5a2da8a3ded881-97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec54616c6f73'
      AND enabled = true
      AND validated_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'The verified VyFi V1 AGENT/ADA pool was not registered.';
  END IF;
END $$;