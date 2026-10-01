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
  'minswap-v1-63f2cbfa5bf8b68828839a2575c8c70f14a32f50ebbfa7c654043269793be896',
  'minswap',
  'v1',
  355925430,
  'addr1z8snz7c4974vzdpxu65ruphl3zjdvtxw8strf2c2tmqnxz2j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq0xmsha',
  '0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1',
  '63f2cbfa5bf8b68828839a2575c8c70f14a32f50ebbfa7c654043269793be896',
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
  JOIN public.multi_asset pool_nft
    ON pool_nft.policy = decode('0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1', 'hex')
   AND pool_nft.name = decode('63f2cbfa5bf8b68828839a2575c8c70f14a32f50ebbfa7c654043269793be896', 'hex')
  JOIN public.ma_tx_out nft_output
    ON nft_output.ident = pool_nft.id
   AND nft_output.tx_out_id = output.id
   AND nft_output.quantity = 1
  WHERE output.id = 355925430
    AND transaction.hash = decode('a1a67167df4b4ede4e430cff4ade310b9f7a4241be61210e205b836bd158ddc2', 'hex')
    AND output.index = 0
    AND output.address = 'addr1z8snz7c4974vzdpxu65ruphl3zjdvtxw8strf2c2tmqnxz2j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq0xmsha'
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = output.tx_id AND spent.tx_out_index = output.index
    )
    AND pool_datum.value->'fields'->0->'fields'->0->>'bytes' = ''
    AND pool_datum.value->'fields'->0->'fields'->1->>'bytes' = ''
    AND pool_datum.value->'fields'->1->'fields'->0->>'bytes' = '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f'
    AND pool_datum.value->'fields'->1->'fields'->1->>'bytes' = '534e454b'
    AND EXISTS (
      SELECT 1 FROM cardyx.asset_catalog token
      WHERE token.policy_id = '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f'
        AND token.asset_name = '534e454b'
    )
)
ON CONFLICT DO NOTHING;