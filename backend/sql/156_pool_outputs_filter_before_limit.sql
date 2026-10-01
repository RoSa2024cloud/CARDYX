-- Apply the pool address filter before LIMIT so a batch is only short when the pool is caught up.
CREATE OR REPLACE FUNCTION cardyx.dex_pool_outputs_after(
  p_pool_nft_policy_id text,
  p_pool_nft_asset_name text,
  p_pool_address text,
  p_after_tx_out_id bigint,
  p_limit integer
)
RETURNS TABLE(tx_out_id bigint, tx_hash text, block_time timestamptz, lovelace numeric, datum_json jsonb, assets jsonb)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH outputs AS MATERIALIZED (
    SELECT output.id, output.tx_id, output.value, output.inline_datum_id, output.data_hash
    FROM public.multi_asset nft
    JOIN public.ma_tx_out mto ON mto.ident = nft.id AND mto.quantity > 0
    JOIN public.tx_out output ON output.id = mto.tx_out_id
    WHERE nft.policy = decode(p_pool_nft_policy_id, 'hex')
      AND nft.name = decode(p_pool_nft_asset_name, 'hex')
      AND mto.tx_out_id > p_after_tx_out_id
      AND (p_pool_address IS NULL OR output.address = p_pool_address)
    ORDER BY mto.tx_out_id ASC
    LIMIT p_limit
  )
  SELECT outputs.id,
         encode(tx.hash, 'hex'),
         block.time AT TIME ZONE 'UTC',
         outputs.value,
         coalesce(inline_datum.value, hash_datum.value),
         coalesce(asset_values.value, '[]'::jsonb)
  FROM outputs
  JOIN public.tx ON tx.id = outputs.tx_id
  JOIN public.block ON block.id = tx.block_id
  LEFT JOIN public.datum inline_datum ON inline_datum.id = outputs.inline_datum_id
  LEFT JOIN public.datum hash_datum ON hash_datum.hash = outputs.data_hash
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'policy_id', encode(asset.policy, 'hex'),
      'asset_name', encode(asset.name, 'hex'),
      'quantity', asset_output.quantity
    )) AS value
    FROM public.ma_tx_out asset_output
    JOIN public.multi_asset asset ON asset.id = asset_output.ident
    WHERE asset_output.tx_out_id = outputs.id
  ) asset_values ON true
  ORDER BY outputs.id ASC;
$$;
