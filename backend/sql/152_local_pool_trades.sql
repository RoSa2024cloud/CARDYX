CREATE OR REPLACE FUNCTION cardyx.local_pool_trades(requested_policy_id text, requested_asset_name text)
RETURNS TABLE (
  tx_hash text,
  occurred_at timestamp without time zone,
  dex text,
  version text,
  side text,
  amount numeric,
  ada_notional numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
  WITH pools AS (
    SELECT pool_id, dex, version, pool_address, pool_nft_policy_id, pool_nft_asset_name,
           CASE WHEN asset_a_policy_id = $1 THEN asset_a_decimals ELSE asset_b_decimals END AS decimals
    FROM cardyx.dex_pool_registry
    WHERE enabled = true
      AND ((asset_a_policy_id = $1 AND asset_a_asset_name = $2 AND asset_b_policy_id IS NULL)
        OR (asset_b_policy_id = $1 AND asset_b_asset_name = $2 AND asset_a_policy_id IS NULL))
  ), transitions AS (
    SELECT pool.dex, pool.version, pool.decimals, old.id AS output_id,
           old.value AS old_ada, successor.value AS new_ada,
           old.quantity AS old_quantity, successor_asset.quantity AS new_quantity,
           encode(tx.hash, 'hex') AS tx_hash, block.time AS occurred_at
    FROM pools pool
    CROSS JOIN LATERAL (
      SELECT output.id, output.tx_id, output.index, output.value, output.address,
             recent.nft_id, asset.id AS asset_id, asset_out.quantity
      FROM (
        SELECT marker.tx_out_id, nft.id AS nft_id
        FROM public.multi_asset nft
        JOIN public.ma_tx_out marker ON marker.ident = nft.id
        WHERE nft.policy = decode(pool.pool_nft_policy_id, 'hex')
          AND nft.name = decode(pool.pool_nft_asset_name, 'hex')
        ORDER BY marker.tx_out_id DESC LIMIT 30
      ) recent
      JOIN public.tx_out output ON output.id = recent.tx_out_id
      JOIN public.multi_asset asset ON asset.policy = decode($1, 'hex') AND asset.name = decode($2, 'hex')
      JOIN public.ma_tx_out asset_out ON asset_out.tx_out_id = output.id AND asset_out.ident = asset.id
      WHERE pool.pool_address IS NULL OR output.address = pool.pool_address
    ) old
    JOIN public.tx_in spent ON spent.tx_out_id = old.tx_id AND spent.tx_out_index = old.index
    JOIN public.tx_out successor ON successor.tx_id = spent.tx_in_id AND successor.address = old.address
    JOIN public.ma_tx_out successor_marker ON successor_marker.tx_out_id = successor.id AND successor_marker.ident = old.nft_id
    JOIN public.ma_tx_out successor_asset ON successor_asset.tx_out_id = successor.id AND successor_asset.ident = old.asset_id
    JOIN public.tx ON tx.id = successor.tx_id
    JOIN public.block block ON block.id = tx.block_id
  )
  SELECT tx_hash, occurred_at, dex, version,
         CASE WHEN new_quantity < old_quantity THEN 'buy' ELSE 'sell' END AS side,
         abs(new_quantity - old_quantity) / power(10::numeric, decimals) AS amount,
         abs(new_ada - old_ada) / 1000000::numeric AS ada_notional
  FROM transitions
  WHERE (new_ada - old_ada) * (new_quantity - old_quantity) < 0
  ORDER BY occurred_at DESC LIMIT 30;
$$;

REVOKE ALL ON FUNCTION cardyx.local_pool_trades(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.local_pool_trades(text, text) TO cardyx_api;