WITH candidate AS (
  SELECT output.id AS tx_out_id, output.address
  FROM public.multi_asset token
  JOIN public.ma_tx_out token_output
    ON token_output.ident = token.id
   AND token_output.quantity > 0
  JOIN public.tx_out output
    ON output.id = token_output.tx_out_id
   AND output.consumed_by_tx_id IS NULL
   AND output.address_has_script = true
  JOIN public.ma_tx_out marker_output
    ON marker_output.tx_out_id = output.id
   AND marker_output.quantity = 1
  JOIN public.multi_asset marker
    ON marker.id = marker_output.ident
   AND marker.policy = decode('c285d6d7e61163b7f7a918f28e450e37d55dc684450d87b96750d8db', 'hex')
   AND marker.name = decode('', 'hex')
  JOIN public.datum pool_datum
    ON pool_datum.id = output.inline_datum_id
    OR pool_datum.hash = output.data_hash
  WHERE token.policy = decode('804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f', 'hex')
    AND token.name = decode('56594649', 'hex')
    AND output.value >= 500000000
    AND jsonb_typeof(pool_datum.value->'fields') = 'array'
    AND jsonb_array_length(pool_datum.value->'fields') = 3
    AND (pool_datum.value->'fields'->0->>'int') ~ '^[0-9]+$'
    AND (pool_datum.value->'fields'->0->>'int')::numeric > 0
    AND (pool_datum.value->'fields'->1->>'int') ~ '^[0-9]+$'
    AND (pool_datum.value->'fields'->1->>'int')::numeric >= 0
    AND (pool_datum.value->'fields'->2->>'int') ~ '^[0-9]+$'
    AND (pool_datum.value->'fields'->2->>'int')::numeric >= 0
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = output.tx_id
        AND spent.tx_out_index = output.index
    )
  ORDER BY output.id DESC
  LIMIT 1
)
INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'vyfi-v1-c285d6d7e61163b7f7a918f28e450e37d55dc684450d87b96750d8db-804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f56594649',
  'vyfi',
  'v1',
  tx_out_id,
  address,
  'c285d6d7e61163b7f7a918f28e450e37d55dc684450d87b96750d8db',
  '',
  NULL,
  NULL,
  6,
  '804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f',
  '56594649',
  6,
  true,
  now(),
  now()
FROM candidate
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
    WHERE pool_id = 'vyfi-v1-c285d6d7e61163b7f7a918f28e450e37d55dc684450d87b96750d8db-804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f56594649'
      AND enabled = true
      AND validated_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'No active VyFi V1 VYFI/ADA pool with sufficient liquidity was found.';
  END IF;
END $$;