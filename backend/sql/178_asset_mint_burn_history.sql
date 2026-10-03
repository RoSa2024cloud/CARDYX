CREATE OR REPLACE FUNCTION cardyx.asset_mint_burn_totals(requested_policy_id text, requested_asset_name text)
RETURNS TABLE (
  minted_quantity numeric,
  burned_quantity numeric,
  net_quantity numeric,
  event_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
  WITH events AS (
    SELECT mint.tx_id, sum(mint.quantity)::numeric AS quantity
    FROM public.multi_asset asset
    JOIN public.ma_tx_mint mint ON mint.ident = asset.id
    WHERE asset.policy = decode($1, 'hex')
      AND asset.name = decode($2, 'hex')
    GROUP BY mint.tx_id
    HAVING sum(mint.quantity) <> 0
  )
  SELECT
    coalesce(sum(quantity) FILTER (WHERE quantity > 0), 0),
    coalesce(sum(-quantity) FILTER (WHERE quantity < 0), 0),
    coalesce(sum(quantity), 0),
    count(*)::bigint
  FROM events;
$$;

CREATE OR REPLACE FUNCTION cardyx.asset_mint_burn_history(
  requested_policy_id text,
  requested_asset_name text,
  requested_limit integer DEFAULT 25,
  requested_offset integer DEFAULT 0
)
RETURNS TABLE (
  tx_hash text,
  block_no bigint,
  slot_no bigint,
  occurred_at timestamp without time zone,
  quantity numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
  WITH events AS (
    SELECT mint.tx_id, sum(mint.quantity)::numeric AS quantity
    FROM public.multi_asset asset
    JOIN public.ma_tx_mint mint ON mint.ident = asset.id
    WHERE asset.policy = decode($1, 'hex')
      AND asset.name = decode($2, 'hex')
    GROUP BY mint.tx_id
    HAVING sum(mint.quantity) <> 0
  )
  SELECT encode(tx.hash, 'hex'), block.block_no, block.slot_no, block.time, events.quantity
  FROM events
  JOIN public.tx ON tx.id = events.tx_id
  JOIN public.block ON block.id = tx.block_id
  ORDER BY block.block_no DESC, tx.id DESC
  LIMIT greatest(1, least(coalesce(requested_limit, 25), 100))
  OFFSET greatest(coalesce(requested_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION cardyx.asset_mint_burn_totals(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION cardyx.asset_mint_burn_history(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.asset_mint_burn_totals(text, text) TO cardyx_api;
GRANT EXECUTE ON FUNCTION cardyx.asset_mint_burn_history(text, text, integer, integer) TO cardyx_api;