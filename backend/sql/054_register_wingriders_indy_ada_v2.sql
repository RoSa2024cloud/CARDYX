INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'wingriders-v2-0cb27089b6ef705a2413237eb67df87f348ae451fa9b4f8a2dd262df3380de87',
  'wingriders',
  'v2',
  355925611,
  'addr1zxhew7fmsup08qvhdnkg8ccra88pw7q5trrncja3dlszhqe8lgvywlrjje5skanlxz2h6dcyp6vzp6yt84aeafq8dsesrwpttn',
  '6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737',
  '0cb27089b6ef705a2413237eb67df87f348ae451fa9b4f8a2dd262df3380de87',
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
    ON pool_nft.policy = decode('6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737', 'hex')
   AND pool_nft.name = decode('0cb27089b6ef705a2413237eb67df87f348ae451fa9b4f8a2dd262df3380de87', 'hex')
  JOIN public.ma_tx_out nft_output
    ON nft_output.ident = pool_nft.id
   AND nft_output.tx_out_id = output.id
   AND nft_output.quantity > 0
  WHERE output.id = 355925611
    AND output.address = 'addr1zxhew7fmsup08qvhdnkg8ccra88pw7q5trrncja3dlszhqe8lgvywlrjje5skanlxz2h6dcyp6vzp6yt84aeafq8dsesrwpttn'
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = output.tx_id AND spent.tx_out_index = output.index
    )
    AND pool_datum.value->'fields'->3->>'bytes' = '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0'
    AND pool_datum.value->'fields'->4->>'bytes' = '494e4459'
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
