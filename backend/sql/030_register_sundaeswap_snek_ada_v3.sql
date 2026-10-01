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
  'sundaeswap-v3-cacb7fd5f5b84bf876d40dc60d4991c72112d78d76132b1fb769e6ad',
  'sundaeswap',
  'v3',
  355926486,
  'addr1z8srqftqemf0mjlukfszd97ljuxdp44r372txfcr75wrz2auzrlrz2kdd83wzt9u9n9qt2swgvhrmmn96k55nq6yuj4qw992w9',
  'e0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b',
  '000de140cacb7fd5f5b84bf876d40dc60d4991c72112d78d76132b1fb769e6ad',
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
  JOIN public.multi_asset pool_auth
    ON pool_auth.policy = decode('e0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b', 'hex')
   AND pool_auth.name = decode('000de140cacb7fd5f5b84bf876d40dc60d4991c72112d78d76132b1fb769e6ad', 'hex')
  JOIN public.ma_tx_out auth_output
    ON auth_output.ident = pool_auth.id
   AND auth_output.tx_out_id = output.id
   AND auth_output.quantity = 1
  WHERE output.id = 355926486
    AND transaction.hash = decode('de529846367b630c3ada31825dfe60474c45f77e65a8727ed47ceede5071ee18', 'hex')
    AND output.index = 0
    AND output.address = 'addr1z8srqftqemf0mjlukfszd97ljuxdp44r372txfcr75wrz2auzrlrz2kdd83wzt9u9n9qt2swgvhrmmn96k55nq6yuj4qw992w9'
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = output.tx_id AND spent.tx_out_index = output.index
    )
    AND pool_datum.value->'fields'->0->>'bytes' = 'cacb7fd5f5b84bf876d40dc60d4991c72112d78d76132b1fb769e6ad'
    AND pool_datum.value->'fields'->1->'list'->0->'list'->0->>'bytes' = ''
    AND pool_datum.value->'fields'->1->'list'->0->'list'->1->>'bytes' = ''
    AND pool_datum.value->'fields'->1->'list'->1->'list'->0->>'bytes' = '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f'
    AND pool_datum.value->'fields'->1->'list'->1->'list'->1->>'bytes' = '534e454b'
    AND EXISTS (
      SELECT 1 FROM cardyx.asset_catalog token
      WHERE token.policy_id = '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f'
        AND token.asset_name = '534e454b'
    )
)
ON CONFLICT DO NOTHING;
