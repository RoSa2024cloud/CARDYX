INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'wingriders-v1-026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a5709b65707373c4cec488b16151a64d7102dbae16857c500652b5c513650b8d604e',
  'wingriders',
  'v1',
  355943858,
  'addr1z8nvjzjeydcn4atcd93aac8allvrpjn7pjr2qsweukpnayv4uuuctkmfnszaeqv30txrfxxzssrdsd20vv6afc8pgxfszanerm',
  '026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570',
  '9b65707373c4cec488b16151a64d7102dbae16857c500652b5c513650b8d604e',
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
  JOIN public.multi_asset pool_lp
    ON pool_lp.policy = decode('026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570', 'hex')
   AND pool_lp.name = decode('9b65707373c4cec488b16151a64d7102dbae16857c500652b5c513650b8d604e', 'hex')
  JOIN public.ma_tx_out lp_output
    ON lp_output.ident = pool_lp.id
   AND lp_output.tx_out_id = output.id
   AND lp_output.quantity > 0
  WHERE output.id = 355943858
    AND output.address = 'addr1z8nvjzjeydcn4atcd93aac8allvrpjn7pjr2qsweukpnayv4uuuctkmfnszaeqv30txrfxxzssrdsd20vv6afc8pgxfszanerm'
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = output.tx_id AND spent.tx_out_index = output.index
    )
    AND pool_datum.value->'fields'->1->'fields'->0->'fields'->0->'fields'->0->>'bytes' = ''
    AND pool_datum.value->'fields'->1->'fields'->0->'fields'->0->'fields'->1->>'bytes' = ''
    AND pool_datum.value->'fields'->1->'fields'->0->'fields'->1->'fields'->0->>'bytes' = '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0'
    AND pool_datum.value->'fields'->1->'fields'->0->'fields'->1->'fields'->1->>'bytes' = '494e4459'
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
