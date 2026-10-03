UPDATE cardyx.asset_catalog
SET policy_id = '97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec',
    asset_name = '54616c6f73',
    fingerprint = 'asset18zc956hhnl0rzx6nhuachczhhnlju3ddugdjtl',
    ticker = 'AGENT',
    display_name = 'AGENT',
    decimals = 0,
    category = 'ai',
    official_url = 'https://x.com/agentic_t',
    updated_at = now()
WHERE market_id = 'talos';

WITH candidates AS (
  SELECT output.id AS tx_out_id, output.address
  FROM public.multi_asset pool_nft
  JOIN public.ma_tx_out nft_output
    ON nft_output.ident = pool_nft.id
   AND nft_output.quantity = 1
  JOIN public.tx_out output
    ON output.id = nft_output.tx_out_id
   AND output.consumed_by_tx_id IS NULL
  JOIN public.datum pool_datum
    ON pool_datum.id = output.inline_datum_id
    OR pool_datum.hash = output.data_hash
  JOIN public.multi_asset token
    ON token.policy = decode('97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec', 'hex')
   AND token.name = decode('54616c6f73', 'hex')
  JOIN public.ma_tx_out token_output
    ON token_output.ident = token.id
   AND token_output.tx_out_id = output.id
  WHERE pool_nft.policy = decode('d8eb52caf3289a2880288b23141ce3d2a7025dcf76f26fd5659add06', 'hex')
    AND pool_nft.name = decode('7a1c5a84bbe123614501299e753e76738fc2a33eda54ebb3774aa13b7e679588', 'hex')
    AND output.address_has_script = true
    AND output.payment_cred = decode('cb684a69e78907a9796b21fc150a758af5f2805e5ed5d5a8ce9f76f1', 'hex')
    AND pool_datum.value->'fields'->0->'fields'->0->>'bytes' = 'd8eb52caf3289a2880288b23141ce3d2a7025dcf76f26fd5659add06'
    AND pool_datum.value->'fields'->0->'fields'->1->>'bytes' = '7a1c5a84bbe123614501299e753e76738fc2a33eda54ebb3774aa13b7e679588'
    AND pool_datum.value->'fields'->1->'fields'->0->>'bytes' = ''
    AND pool_datum.value->'fields'->1->'fields'->1->>'bytes' = ''
    AND pool_datum.value->'fields'->2->'fields'->0->>'bytes' = '97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec'
    AND pool_datum.value->'fields'->2->'fields'->1->>'bytes' = '54616c6f73'
    AND (pool_datum.value->'fields'->4->>'int')::numeric BETWEEN 1 AND 100000
    AND (pool_datum.value->'fields'->5->>'int')::numeric BETWEEN 0 AND (pool_datum.value->'fields'->4->>'int')::numeric
    AND (pool_datum.value->'fields'->6->>'int')::numeric >= 0
    AND (pool_datum.value->'fields'->7->>'int')::numeric >= 0
    AND output.value::numeric > (pool_datum.value->'fields'->7->>'int')::numeric + 500000000
    AND token_output.quantity::numeric > (pool_datum.value->'fields'->8->>'int')::numeric + (pool_datum.value->'fields'->10->>'int')::numeric
    AND EXISTS (
      SELECT 1
      FROM public.ma_tx_out lp_output
      JOIN public.multi_asset lp ON lp.id = lp_output.ident
      WHERE lp_output.tx_out_id = output.id
        AND lp_output.quantity > 0
        AND lp.policy = decode(pool_datum.value->'fields'->3->'fields'->0->>'bytes', 'hex')
        AND lp.name = decode(pool_datum.value->'fields'->3->'fields'->1->>'bytes', 'hex')
    )
    AND jsonb_array_length(pool_datum.value->'fields'->11->'list') > 0
    AND pool_datum.value->'fields'->12->>'bytes' IS NOT NULL
    AND pool_datum.value->'fields'->13->>'bytes' IS NOT NULL
    AND (pool_datum.value->'fields'->14->>'int')::numeric >= 0
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
  'splash-royalty-v1-d8eb52caf3289a2880288b23141ce3d2a7025dcf76f26fd5659add06-7a1c5a84bbe123614501299e753e76738fc2a33eda54ebb3774aa13b7e679588',
  'splash',
  'royalty-v1',
  tx_out_id,
  address,
  'd8eb52caf3289a2880288b23141ce3d2a7025dcf76f26fd5659add06',
  '7a1c5a84bbe123614501299e753e76738fc2a33eda54ebb3774aa13b7e679588',
  NULL,
  NULL,
  6,
  '97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec',
  '54616c6f73',
  0,
  true,
  now(),
  now()
FROM candidates
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
    SELECT 1
    FROM cardyx.dex_pool_registry
    WHERE dex = 'splash'
      AND version = 'royalty-v1'
      AND pool_nft_policy_id = 'd8eb52caf3289a2880288b23141ce3d2a7025dcf76f26fd5659add06'
      AND pool_nft_asset_name = '7a1c5a84bbe123614501299e753e76738fc2a33eda54ebb3774aa13b7e679588'
      AND asset_b_policy_id = '97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec'
      AND asset_b_asset_name = '54616c6f73'
      AND enabled = true
  ) THEN
    RAISE EXCEPTION 'No active AGENT/ADA Splash Royalty V1 pool was registered.';
  END IF;
END $$;