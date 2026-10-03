WITH origin AS (
  SELECT output.id
  FROM public.tx transaction
  JOIN public.tx_out output ON output.tx_id = transaction.id
  JOIN public.ma_tx_out marker_output ON marker_output.tx_out_id = output.id AND marker_output.quantity = 1
  JOIN public.multi_asset marker ON marker.id = marker_output.ident
  JOIN public.ma_tx_out usda_output ON usda_output.tx_out_id = output.id AND usda_output.quantity > 0
  JOIN public.multi_asset usda ON usda.id = usda_output.ident
  WHERE transaction.hash = decode('fdcb8e017938b4cdd11dada05cb77474beb7ef6b63041fac4595593936f28590', 'hex')
    AND marker.policy = decode('f7f9777979a2a96777823f149e6696954f43967fc56cfc7095a33f98', 'hex')
    AND marker.name = decode('', 'hex')
    AND usda.policy = decode('fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456', 'hex')
    AND usda.name = decode('55534441', 'hex')
), current_pool AS (
  SELECT output.id AS tx_out_id, output.address, output.value,
         coalesce(inline_datum.value, hash_datum.value) AS datum_json
  FROM public.multi_asset marker
  JOIN public.ma_tx_out marker_output ON marker_output.ident = marker.id AND marker_output.quantity = 1
  JOIN public.tx_out output ON output.id = marker_output.tx_out_id
  LEFT JOIN public.datum inline_datum ON inline_datum.id = output.inline_datum_id
  LEFT JOIN public.datum hash_datum ON hash_datum.hash = output.data_hash
  WHERE marker.policy = decode('f7f9777979a2a96777823f149e6696954f43967fc56cfc7095a33f98', 'hex')
    AND marker.name = decode('', 'hex')
    AND output.consumed_by_tx_id IS NULL
    AND output.address_has_script = true
    AND output.value > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = output.tx_id AND spent.tx_out_index = output.index
    )
    AND EXISTS (
      SELECT 1 FROM public.ma_tx_out usda_output
      JOIN public.multi_asset usda ON usda.id = usda_output.ident
      WHERE usda_output.tx_out_id = output.id
        AND usda_output.quantity > 0
        AND usda.policy = decode('fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456', 'hex')
        AND usda.name = decode('55534441', 'hex')
    )
    AND jsonb_typeof(coalesce(inline_datum.value, hash_datum.value)->'fields') = 'array'
    AND jsonb_array_length(coalesce(inline_datum.value, hash_datum.value)->'fields') = 3
    AND ((coalesce(inline_datum.value, hash_datum.value)->'fields'->0->>'int') ~ '^[0-9]+$')
    AND ((coalesce(inline_datum.value, hash_datum.value)->'fields'->0->>'int')::numeric > 0)
    AND ((coalesce(inline_datum.value, hash_datum.value)->'fields'->1->>'int') ~ '^[0-9]+$')
    AND ((coalesce(inline_datum.value, hash_datum.value)->'fields'->1->>'int')::numeric >= 0)
    AND ((coalesce(inline_datum.value, hash_datum.value)->'fields'->2->>'int') ~ '^[0-9]+$')
    AND ((coalesce(inline_datum.value, hash_datum.value)->'fields'->2->>'int')::numeric >= 0)
    AND EXISTS (SELECT 1 FROM origin)
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
  'vyfi-v1-f7f9777979a2a96777823f149e6696954f43967fc56cfc7095a33f98-fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae45655534441',
  'vyfi', 'v1', current_pool.tx_out_id, current_pool.address,
  'f7f9777979a2a96777823f149e6696954f43967fc56cfc7095a33f98', '',
  NULL, NULL, 6,
  'fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456', '55534441', 6,
  true, now(), now()
FROM current_pool
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
    WHERE pool_id = 'vyfi-v1-f7f9777979a2a96777823f149e6696954f43967fc56cfc7095a33f98-fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae45655534441'
      AND enabled = true
      AND validated_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'The current VyFi V1 USDA/ADA pool was not validated and registered.';
  END IF;
END $$;
