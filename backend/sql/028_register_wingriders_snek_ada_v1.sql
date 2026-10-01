INSERT INTO cardyx.dex_pool_registry (
  pool_id,
  dex,
  version,
  tx_out_id,
  pool_address,
  pool_nft_policy_id,
  pool_nft_asset_name,
  asset_a_policy_id,
  asset_a_asset_name,
  asset_a_decimals,
  asset_b_policy_id,
  asset_b_asset_name,
  asset_b_decimals,
  enabled,
  validated_at,
  updated_at
)
SELECT
  'wingriders-v1-026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a5702ffadbb87144e875749122e0bbb9f535eeaa7f5660c6c4a91bcc4121e477f08d',
  'wingriders',
  'v1',
  355916517,
  'addr1z8nvjzjeydcn4atcd93aac8allvrpjn7pjr2qsweukpnay2lz4g5wy95jwh2l6ca2jyq5xu8aga0fh3jyplef6m0npeslcq0pj',
  '026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570',
  '2ffadbb87144e875749122e0bbb9f535eeaa7f5660c6c4a91bcc4121e477f08d',
  NULL,
  NULL,
  6,
  '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f',
  '534e454b',
  0,
  false,
  now(),
  now()
WHERE EXISTS (
  SELECT 1
  FROM public.tx_out output
  JOIN public.tx transaction ON transaction.id = output.tx_id
  JOIN public.datum pool_datum ON pool_datum.hash = output.data_hash
  JOIN public.multi_asset pool_lp
    ON pool_lp.policy = decode('026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570', 'hex')
   AND pool_lp.name = decode('2ffadbb87144e875749122e0bbb9f535eeaa7f5660c6c4a91bcc4121e477f08d', 'hex')
  JOIN public.ma_tx_out lp_output
    ON lp_output.ident = pool_lp.id
   AND lp_output.tx_out_id = output.id
   AND lp_output.quantity > 0
  WHERE output.id = 355916517
    AND transaction.hash = decode('6984e9112363808734fbf9933b601401c84225656cdaecd015b921b5fa3ea1bb', 'hex')
    AND output.index = 0
    AND output.address = 'addr1z8nvjzjeydcn4atcd93aac8allvrpjn7pjr2qsweukpnay2lz4g5wy95jwh2l6ca2jyq5xu8aga0fh3jyplef6m0npeslcq0pj'
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = output.tx_id AND spent.tx_out_index = output.index
    )
    AND pool_datum.value->'fields'->1->'fields'->0->'fields'->0->'fields'->0->>'bytes' = ''
    AND pool_datum.value->'fields'->1->'fields'->0->'fields'->1->'fields'->0->>'bytes' = '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f'
    AND pool_datum.value->'fields'->1->'fields'->0->'fields'->1->'fields'->1->>'bytes' = '534e454b'
    AND EXISTS (
      SELECT 1 FROM cardyx.asset_catalog token
      WHERE token.policy_id = '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f'
        AND token.asset_name = '534e454b'
    )
)
ON CONFLICT DO NOTHING;