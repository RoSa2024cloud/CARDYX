CREATE OR REPLACE FUNCTION cardyx.asset_minting_policy_status(requested_policy_id text)
RETURNS TABLE (policy jsonb, current_slot bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
  SELECT script.json, tip.slot_no
  FROM public.script
  CROSS JOIN LATERAL (
    SELECT block.slot_no
    FROM public.block
    ORDER BY block.id DESC
    LIMIT 1
  ) tip
  WHERE script.hash = decode($1, 'hex')
    AND script.type::text = 'timelock'
    AND script.json IS NOT NULL
  ORDER BY script.id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION cardyx.asset_mint_burn_peak(requested_policy_id text, requested_asset_name text)
RETURNS numeric
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
  ), ordered_events AS (
    SELECT block.block_no, tx.id AS tx_id, events.quantity
    FROM events
    JOIN public.tx ON tx.id = events.tx_id
    JOIN public.block ON block.id = tx.block_id
  ), supply_curve AS (
    SELECT sum(quantity) OVER (ORDER BY block_no, tx_id ROWS UNBOUNDED PRECEDING) AS supply
    FROM ordered_events
  )
  SELECT coalesce(max(supply), 0)
  FROM supply_curve;
$$;

REVOKE ALL ON FUNCTION cardyx.asset_minting_policy_status(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION cardyx.asset_mint_burn_peak(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.asset_minting_policy_status(text) TO cardyx_api;
GRANT EXECUTE ON FUNCTION cardyx.asset_mint_burn_peak(text, text) TO cardyx_api;