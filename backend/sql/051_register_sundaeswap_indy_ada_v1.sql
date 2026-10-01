INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'sundaeswap-v1-b003',
  'sundaeswap',
  'v1',
  355900045,
  'addr1w9qzpelu9hn45pefc0xr4ac4kdxeswq7pndul2vuj59u8tqaxdznu',
  '0029cb7c88c7567b63d1a512c0ed626aa169688ec980730c0473b913',
  '7020b003',
  NULL,
  NULL,
  6,
  '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
  '494e4459',
  6,
  true,
  now(),
  now()
WHERE EXISTS (
  SELECT 1
  FROM public.tx_out output
  JOIN public.datum pool_datum
    ON pool_datum.hash = output.data_hash OR pool_datum.id = output.inline_datum_id
  JOIN public.multi_asset pool_nft
    ON pool_nft.policy = decode('0029cb7c88c7567b63d1a512c0ed626aa169688ec980730c0473b913', 'hex')
   AND pool_nft.name = decode('7020b003', 'hex')
  JOIN public.ma_tx_out nft_output
    ON nft_output.ident = pool_nft.id
   AND nft_output.tx_out_id = output.id
   AND nft_output.quantity = 1
  WHERE output.id = 355900045
    AND output.address = 'addr1w9qzpelu9hn45pefc0xr4ac4kdxeswq7pndul2vuj59u8tqaxdznu'
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = output.tx_id AND spent.tx_out_index = output.index
    )
    AND pool_datum.value->'fields'->1->>'bytes' = 'b003'
    AND pool_datum.value->'fields'->0->'fields'->0->'fields'->0->>'bytes' = ''
    AND pool_datum.value->'fields'->0->'fields'->0->'fields'->1->>'bytes' = ''
    AND pool_datum.value->'fields'->0->'fields'->1->'fields'->0->>'bytes' = '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0'
    AND pool_datum.value->'fields'->0->'fields'->1->'fields'->1->>'bytes' = '494e4459'
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
  updated_at = EXCLUDED.updated_at;
