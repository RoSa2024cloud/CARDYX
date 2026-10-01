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
  'wingriders-v2-6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737e3b382a85249ef92357e00bd42c088c69c1eac2a736ae2df34dd2b89de11de1a',
  'wingriders',
  'v2',
  355925409,
  'addr1zxhew7fmsup08qvhdnkg8ccra88pw7q5trrncja3dlszhqlhhdq34c6wgm2u5xkg84nqkql6vq6fzm5grzcequr2rmwqwgf0zz',
  '6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737',
  'e3b382a85249ef92357e00bd42c088c69c1eac2a736ae2df34dd2b89de11de1a',
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
  JOIN public.multi_asset pool_lp
    ON pool_lp.policy = decode('6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737', 'hex')
   AND pool_lp.name = decode('e3b382a85249ef92357e00bd42c088c69c1eac2a736ae2df34dd2b89de11de1a', 'hex')
  JOIN public.ma_tx_out lp_output
    ON lp_output.ident = pool_lp.id
   AND lp_output.tx_out_id = output.id
   AND lp_output.quantity > 0
  JOIN public.datum pool_datum ON pool_datum.id = output.inline_datum_id
  WHERE output.id = 355925409
    AND transaction.hash = decode('68b310e8912c2635fa55c6ab203fcf17b601a1e513077fce483d18ce4ecc7f29', 'hex')
    AND output.index = 0
    AND output.address = 'addr1zxhew7fmsup08qvhdnkg8ccra88pw7q5trrncja3dlszhqlhhdq34c6wgm2u5xkg84nqkql6vq6fzm5grzcequr2rmwqwgf0zz'
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = output.tx_id AND spent.tx_out_index = output.index
    )
    AND pool_datum.value->'fields'->3->>'bytes' = '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f'
    AND pool_datum.value->'fields'->4->>'bytes' = '534e454b'
    AND EXISTS (
      SELECT 1 FROM cardyx.asset_catalog token
      WHERE token.policy_id = '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f'
        AND token.asset_name = '534e454b'
    )
)
ON CONFLICT DO NOTHING;