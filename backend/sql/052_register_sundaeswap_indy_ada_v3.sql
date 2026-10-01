INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'sundaeswap-v3-27f51c29cde11887b667d9632533677a82baa305a6ea43993b68909e',
  'sundaeswap',
  'v3',
  355900050,
  'addr1z8srqftqemf0mjlukfszd97ljuxdp44r372txfcr75wrz2auzrlrz2kdd83wzt9u9n9qt2swgvhrmmn96k55nq6yuj4qw992w9',
  'e0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b',
  '000de14027f51c29cde11887b667d9632533677a82baa305a6ea43993b68909e',
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
    ON pool_nft.policy = decode('e0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b', 'hex')
   AND pool_nft.name = decode('000de14027f51c29cde11887b667d9632533677a82baa305a6ea43993b68909e', 'hex')
  JOIN public.ma_tx_out nft_output
    ON nft_output.ident = pool_nft.id
   AND nft_output.tx_out_id = output.id
   AND nft_output.quantity = 1
  WHERE output.id = 355900050
    AND output.address = 'addr1z8srqftqemf0mjlukfszd97ljuxdp44r372txfcr75wrz2auzrlrz2kdd83wzt9u9n9qt2swgvhrmmn96k55nq6yuj4qw992w9'
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = output.tx_id AND spent.tx_out_index = output.index
    )
    AND pool_datum.value->'fields'->0->>'bytes' = '27f51c29cde11887b667d9632533677a82baa305a6ea43993b68909e'
    AND pool_datum.value->'fields'->1->'list'->0->'list'->0->>'bytes' = ''
    AND pool_datum.value->'fields'->1->'list'->0->'list'->1->>'bytes' = ''
    AND pool_datum.value->'fields'->1->'list'->1->'list'->0->>'bytes' = '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0'
    AND pool_datum.value->'fields'->1->'list'->1->'list'->1->>'bytes' = '494e4459'
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
