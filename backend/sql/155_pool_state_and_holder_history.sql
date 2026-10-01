-- Historical pool states per registered DEX pool; consecutive states yield swaps and liquidity events.
CREATE TABLE IF NOT EXISTS cardyx.dex_pool_state (
  pool_id text NOT NULL,
  tx_out_id bigint NOT NULL,
  tx_hash text NOT NULL,
  block_time timestamptz NOT NULL,
  market_id text,
  reserve_ada numeric NOT NULL,
  reserve_asset numeric NOT NULL,
  price_ada numeric NOT NULL,
  delta_ada numeric,
  delta_asset numeric,
  event_type text NOT NULL CHECK (event_type IN ('initial', 'buy', 'sell', 'deposit', 'withdraw', 'other')),
  PRIMARY KEY (pool_id, tx_out_id)
);

CREATE INDEX IF NOT EXISTS dex_pool_state_market_time_idx ON cardyx.dex_pool_state (market_id, block_time DESC);
CREATE INDEX IF NOT EXISTS dex_pool_state_time_idx ON cardyx.dex_pool_state (block_time);

GRANT SELECT, INSERT, DELETE ON cardyx.dex_pool_state TO cardyx_api;

-- First tx_out id created at or after the given time; used as backfill start.
CREATE OR REPLACE FUNCTION cardyx.first_tx_out_id_since(p_since timestamptz)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT min(output.id)
  FROM public.tx_out output
  WHERE output.tx_id = (
    SELECT min(tx.id) FROM public.tx
    WHERE tx.block_id = (SELECT min(block.id) FROM public.block WHERE block.time >= p_since AT TIME ZONE 'UTC')
  );
$$;

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
    SELECT mto.tx_out_id
    FROM public.multi_asset nft
    JOIN public.ma_tx_out mto ON mto.ident = nft.id AND mto.quantity > 0
    WHERE nft.policy = decode(p_pool_nft_policy_id, 'hex')
      AND nft.name = decode(p_pool_nft_asset_name, 'hex')
      AND mto.tx_out_id > p_after_tx_out_id
    ORDER BY mto.tx_out_id ASC
    LIMIT p_limit
  )
  SELECT output.id,
         encode(tx.hash, 'hex'),
         block.time AT TIME ZONE 'UTC',
         output.value,
         coalesce(inline_datum.value, hash_datum.value),
         coalesce(asset_values.value, '[]'::jsonb)
  FROM outputs
  JOIN public.tx_out output ON output.id = outputs.tx_out_id
  JOIN public.tx ON tx.id = output.tx_id
  JOIN public.block ON block.id = tx.block_id
  LEFT JOIN public.datum inline_datum ON inline_datum.id = output.inline_datum_id
  LEFT JOIN public.datum hash_datum ON hash_datum.hash = output.data_hash
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'policy_id', encode(asset.policy, 'hex'),
      'asset_name', encode(asset.name, 'hex'),
      'quantity', asset_output.quantity
    )) AS value
    FROM public.ma_tx_out asset_output
    JOIN public.multi_asset asset ON asset.id = asset_output.ident
    WHERE asset_output.tx_out_id = output.id
  ) asset_values ON true
  WHERE p_pool_address IS NULL OR output.address = p_pool_address
  ORDER BY output.id ASC;
$$;

REVOKE ALL ON FUNCTION cardyx.first_tx_out_id_since(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION cardyx.dex_pool_outputs_after(text, text, text, bigint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.first_tx_out_id_since(timestamptz) TO cardyx_api;
GRANT EXECUTE ON FUNCTION cardyx.dex_pool_outputs_after(text, text, text, bigint, integer) TO cardyx_api;

-- Daily holder statistics derived from cardyx.asset_balance_snapshot.
CREATE TABLE IF NOT EXISTS cardyx.asset_holder_history (
  policy_id text NOT NULL,
  asset_name text NOT NULL,
  day date NOT NULL,
  holder_count bigint NOT NULL,
  utxo_count bigint NOT NULL,
  circulating_quantity numeric NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (policy_id, asset_name, day)
);

GRANT SELECT, INSERT, UPDATE ON cardyx.asset_holder_history TO cardyx_api;
GRANT SELECT ON cardyx.asset_balance_snapshot TO cardyx_api;
