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
  'muesliswap-amm-909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f-0de488cdbd03990f316b5b9746e86595e57dfe1b3dd85a74291e0c04fdafbf6e',
  'muesliswap',
  'amm',
  355847508,
  'addr1z9cy2gmar6cpn8yymll93lnd7lw96f27kn2p3eq5d4tjr7xnh3gfhnqcwez2pzmr4tryugrr0uahuk49xqw7dc645chscql0d7',
  'de9b756719341e79785aa13c164e7fe68c189ed04d61c9876b2fe53f',
  '4d7565736c69537761705f414d4d',
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
  JOIN public.multi_asset amm_marker
    ON amm_marker.policy = decode('de9b756719341e79785aa13c164e7fe68c189ed04d61c9876b2fe53f', 'hex')
   AND amm_marker.name = decode('4d7565736c69537761705f414d4d', 'hex')
  JOIN public.ma_tx_out marker_output
    ON marker_output.ident = amm_marker.id
   AND marker_output.tx_out_id = output.id
   AND marker_output.quantity = 1
  JOIN public.multi_asset lp_asset
    ON lp_asset.policy = decode('909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f', 'hex')
   AND lp_asset.name = decode('0de488cdbd03990f316b5b9746e86595e57dfe1b3dd85a74291e0c04fdafbf6e', 'hex')
  JOIN public.ma_tx_out lp_output
    ON lp_output.ident = lp_asset.id
   AND lp_output.tx_out_id = output.id
   AND lp_output.quantity > 0
  WHERE output.id = 355847508
    AND transaction.hash = decode('9d25f553cab32a2914970cc2546161b9c45981f7aad7901e6295437c2357695f', 'hex')
    AND output.index = 3
    AND output.address = 'addr1z9cy2gmar6cpn8yymll93lnd7lw96f27kn2p3eq5d4tjr7xnh3gfhnqcwez2pzmr4tryugrr0uahuk49xqw7dc645chscql0d7'
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
