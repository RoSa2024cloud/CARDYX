INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'cswap-v1-75fc97a278e8cffaf9ab3d39091ad8adad75def27dd37ab292dbbc17-432d4c503a20414441207820494e4459',
  'cswap',
  'v1',
  355180824,
  'addr1z8ke0c9p89rjfwmuh98jpt8ky74uy5mffjft3zlcld9h7ml3lmln3mwk0y3zsh3gs3dzqlwa9rjzrxawkwm4udw9axhs6fuu6e',
  '75fc97a278e8cffaf9ab3d39091ad8adad75def27dd37ab292dbbc17',
  '63',
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
    ON pool_nft.policy = decode('75fc97a278e8cffaf9ab3d39091ad8adad75def27dd37ab292dbbc17', 'hex')
   AND pool_nft.name = decode('63', 'hex')
  JOIN public.ma_tx_out nft_output
    ON nft_output.ident = pool_nft.id
   AND nft_output.tx_out_id = output.id
   AND nft_output.quantity = 1
  WHERE output.id = 355180824
    AND output.address = 'addr1z8ke0c9p89rjfwmuh98jpt8ky74uy5mffjft3zlcld9h7ml3lmln3mwk0y3zsh3gs3dzqlwa9rjzrxawkwm4udw9axhs6fuu6e'
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = output.tx_id AND spent.tx_out_index = output.index
    )
    AND (pool_datum.value->'fields'->0->>'int')::numeric > 0
    AND pool_datum.value->'fields'->4->>'bytes' = '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0'
    AND pool_datum.value->'fields'->5->>'bytes' = '494e4459'
    AND pool_datum.value->'fields'->6->>'bytes' = '75fc97a278e8cffaf9ab3d39091ad8adad75def27dd37ab292dbbc17'
    AND pool_datum.value->'fields'->7->>'bytes' = '432d4c503a20414441207820494e4459'
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
