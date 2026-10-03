GRANT SELECT ON public.stake_address TO cardyx_snapshot_owner;

CREATE OR REPLACE FUNCTION cardyx.top_asset_holders(
  requested_policy_id text,
  requested_asset_name text,
  requested_mode text DEFAULT 'wallets'
)
RETURNS TABLE (
  holder_key text,
  address text,
  address_count bigint,
  balance numeric,
  share numeric,
  total_holders bigint,
  total_supply numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
  WITH token AS (
    SELECT asset.id, coalesce(catalog.decimals, 0) AS decimals
    FROM public.multi_asset asset
    LEFT JOIN cardyx.asset_catalog catalog
      ON catalog.policy_id = encode(asset.policy, 'hex')
     AND catalog.asset_name = encode(asset.name, 'hex')
    WHERE asset.policy = decode(requested_policy_id, 'hex')
      AND asset.name = decode(requested_asset_name, 'hex')
  ), balances AS (
    SELECT output.address,
           output.stake_address_id,
           sum(asset_output.quantity) / power(10::numeric, token.decimals) AS balance
    FROM token
    JOIN public.ma_tx_out asset_output ON asset_output.ident = token.id
    JOIN public.tx_out output ON output.id = asset_output.tx_out_id
    WHERE output.consumed_by_tx_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tx_in spent
        WHERE spent.tx_out_id = output.tx_id
          AND spent.tx_out_index = output.index
      )
        GROUP BY output.address, output.stake_address_id, token.decimals
  ), identified AS (
    SELECT balances.address,
           balances.balance,
          CASE WHEN requested_mode = 'groups' AND stake.hash_raw IS NOT NULL
                THEN 'stake:' || encode(stake.hash_raw, 'hex')
                ELSE 'address:' || balances.address
           END AS holder_key
    FROM balances
        LEFT JOIN public.stake_address stake ON stake.id = balances.stake_address_id
  ), grouped AS (
    SELECT holder_key,
           min(address) AS address,
           count(*) AS address_count,
           sum(balance) AS balance
    FROM identified
    GROUP BY holder_key
  ), ranked AS (
    SELECT holder_key,
           address,
           address_count,
           balance,
           balance / nullif(sum(balance) OVER (), 0) * 100 AS share,
           count(*) OVER () AS total_holders,
           sum(balance) OVER () AS total_supply
    FROM grouped
  )
  SELECT holder_key, address, address_count, balance, share, total_holders, total_supply
  FROM ranked
  ORDER BY balance DESC, holder_key
  LIMIT 100;
$$;

ALTER FUNCTION cardyx.top_asset_holders(text, text, text) OWNER TO cardyx_snapshot_owner;
REVOKE ALL ON FUNCTION cardyx.top_asset_holders(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.top_asset_holders(text, text, text) TO cardyx_api;
