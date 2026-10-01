INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'sundaeswap-v1-8301', 'sundaeswap', 'v1', 355815729,
  'addr1w9qzpelu9hn45pefc0xr4ac4kdxeswq7pndul2vuj59u8tqaxdznu',
  '0029cb7c88c7567b63d1a512c0ed626aa169688ec980730c0473b913', '70208301',
  NULL, NULL, 6,
  'da8c30857834c6ae7203935b89278c532b3995245295456f993e1d24', '4c51', 6,
  true, now(), now()
WHERE EXISTS (
  SELECT 1 FROM public.tx_out output
  JOIN public.datum datum ON datum.hash=output.data_hash OR datum.id=output.inline_datum_id
  JOIN public.multi_asset nft ON nft.policy=decode('0029cb7c88c7567b63d1a512c0ed626aa169688ec980730c0473b913','hex') AND nft.name=decode('70208301','hex')
  JOIN public.ma_tx_out nft_output ON nft_output.ident=nft.id AND nft_output.tx_out_id=output.id AND nft_output.quantity=1
  WHERE output.id=355815729
    AND output.address='addr1w9qzpelu9hn45pefc0xr4ac4kdxeswq7pndul2vuj59u8tqaxdznu'
    AND NOT EXISTS (SELECT 1 FROM public.tx_in spent WHERE spent.tx_out_id=output.tx_id AND spent.tx_out_index=output.index)
    AND datum.value->'fields'->1->>'bytes'='8301'
    AND datum.value->'fields'->0->'fields'->1->'fields'->0->>'bytes'='da8c30857834c6ae7203935b89278c532b3995245295456f993e1d24'
    AND datum.value->'fields'->0->'fields'->1->'fields'->1->>'bytes'='4c51'
)
ON CONFLICT (pool_id) DO UPDATE SET
  tx_out_id=EXCLUDED.tx_out_id, pool_address=EXCLUDED.pool_address,
  pool_nft_policy_id=EXCLUDED.pool_nft_policy_id, pool_nft_asset_name=EXCLUDED.pool_nft_asset_name,
  asset_a_policy_id=EXCLUDED.asset_a_policy_id, asset_a_asset_name=EXCLUDED.asset_a_asset_name,
  asset_a_decimals=EXCLUDED.asset_a_decimals, asset_b_policy_id=EXCLUDED.asset_b_policy_id,
  asset_b_asset_name=EXCLUDED.asset_b_asset_name, asset_b_decimals=EXCLUDED.asset_b_decimals,
  enabled=EXCLUDED.enabled, validated_at=EXCLUDED.validated_at, updated_at=EXCLUDED.updated_at;
