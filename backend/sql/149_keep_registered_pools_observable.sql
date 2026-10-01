CREATE OR REPLACE VIEW cardyx.dex_pool_utxo AS
SELECT
  r.pool_id,
  r.dex,
  r.version,
  r.pool_address,
  r.asset_a_policy_id,
  r.asset_a_asset_name,
  r.asset_a_decimals,
  r.asset_b_policy_id,
  r.asset_b_asset_name,
  r.asset_b_decimals,
  r.pool_nft_policy_id,
  r.pool_nft_asset_name,
  o.id AS tx_out_id,
  o.value AS lovelace,
  d.value AS datum_json,
  pool_assets.assets
FROM cardyx.dex_pool_registry r
JOIN LATERAL (
  SELECT o.id, o.value, o.inline_datum_id, o.data_hash
  FROM public.multi_asset pool_nft
  JOIN public.ma_tx_out pool_nft_out
    ON pool_nft_out.ident = pool_nft.id
   AND pool_nft_out.quantity > 0
  JOIN public.tx_out o
    ON o.id = pool_nft_out.tx_out_id
   AND o.consumed_by_tx_id IS NULL
  WHERE pool_nft.policy = decode(r.pool_nft_policy_id, 'hex')
    AND pool_nft.name = decode(r.pool_nft_asset_name, 'hex')
    AND o.id = r.tx_out_id
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = o.tx_id AND spent.tx_out_index = o.index
    )
    AND (r.pool_address IS NULL OR o.address = r.pool_address)
  LIMIT 1
) o ON true
LEFT JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
LEFT JOIN LATERAL (
  SELECT coalesce(
    jsonb_agg(jsonb_build_object(
      'policy_id', encode(ma.policy, 'hex'),
      'asset_name', encode(ma.name, 'hex'),
      'quantity', mto.quantity
    )),
    '[]'::jsonb
  ) AS assets
  FROM public.ma_tx_out mto
  JOIN public.multi_asset ma ON ma.id = mto.ident
  WHERE mto.tx_out_id = o.id
) pool_assets ON true
WHERE r.validated_at IS NOT NULL;

GRANT SELECT ON cardyx.dex_pool_utxo TO cardyx_api;