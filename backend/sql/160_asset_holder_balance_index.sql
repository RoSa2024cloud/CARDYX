CREATE TABLE IF NOT EXISTS cardyx.asset_holder_balance (
  policy_id text NOT NULL,
  asset_name text NOT NULL,
  address text NOT NULL,
  stake_address_id bigint,
  balance numeric NOT NULL CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (policy_id, asset_name, address)
);

CREATE INDEX IF NOT EXISTS asset_holder_balance_top_idx
  ON cardyx.asset_holder_balance (policy_id, asset_name, balance DESC);
CREATE INDEX IF NOT EXISTS asset_holder_balance_stake_idx
  ON cardyx.asset_holder_balance (policy_id, asset_name, stake_address_id, balance DESC);

CREATE TABLE IF NOT EXISTS cardyx.asset_holder_index_state (
  policy_id text NOT NULL,
  asset_name text NOT NULL,
  last_tx_id bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'building' CHECK (status IN ('building', 'ready', 'error')),
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (policy_id, asset_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON cardyx.asset_holder_balance TO cardyx_snapshot_owner;
GRANT SELECT, INSERT, UPDATE ON cardyx.asset_holder_index_state TO cardyx_snapshot_owner;
GRANT SELECT ON cardyx.asset_holder_balance, cardyx.asset_holder_index_state TO cardyx_api;

CREATE OR REPLACE FUNCTION cardyx.initialize_asset_holder_index(
  requested_policy_id text,
  requested_asset_name text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
DECLARE
  snapshot_tx_id bigint;
  asset_decimals integer;
BEGIN
  SELECT coalesce(max(id), 0) INTO snapshot_tx_id FROM public.tx;
  SELECT coalesce(max(decimals), 0) INTO asset_decimals
  FROM cardyx.asset_catalog
  WHERE policy_id = requested_policy_id AND asset_name = requested_asset_name;

  DELETE FROM cardyx.asset_holder_balance
  WHERE policy_id = requested_policy_id AND asset_name = requested_asset_name;

  INSERT INTO cardyx.asset_holder_balance (policy_id, asset_name, address, stake_address_id, balance, updated_at)
  SELECT requested_policy_id,
         requested_asset_name,
         output.address,
         output.stake_address_id,
         sum(asset_output.quantity) / power(10::numeric, asset_decimals),
         now()
  FROM public.multi_asset asset
  JOIN public.ma_tx_out asset_output ON asset_output.ident = asset.id
  JOIN public.tx_out output ON output.id = asset_output.tx_out_id
  WHERE asset.policy = decode(requested_policy_id, 'hex')
    AND asset.name = decode(requested_asset_name, 'hex')
    AND output.tx_id <= snapshot_tx_id
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = output.tx_id
        AND spent.tx_out_index = output.index
        AND spent.tx_in_id <= snapshot_tx_id
    )
  GROUP BY output.address, output.stake_address_id;

  INSERT INTO cardyx.asset_holder_index_state (policy_id, asset_name, last_tx_id, status, last_error, updated_at)
  VALUES (requested_policy_id, requested_asset_name, snapshot_tx_id, 'ready', NULL, now())
  ON CONFLICT (policy_id, asset_name) DO UPDATE
  SET last_tx_id = EXCLUDED.last_tx_id,
      status = 'ready',
      last_error = NULL,
      updated_at = now();
END;
$$;

ALTER FUNCTION cardyx.initialize_asset_holder_index(text, text) OWNER TO cardyx_snapshot_owner;
REVOKE ALL ON FUNCTION cardyx.initialize_asset_holder_index(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.initialize_asset_holder_index(text, text) TO cardyx_api;

CREATE OR REPLACE FUNCTION cardyx.refresh_asset_holder_index(
  requested_policy_id text,
  requested_asset_name text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
DECLARE
  previous_tx_id bigint;
  current_tx_id bigint;
  asset_decimals integer;
BEGIN
  SELECT last_tx_id INTO previous_tx_id
  FROM cardyx.asset_holder_index_state
  WHERE policy_id = requested_policy_id AND asset_name = requested_asset_name AND status = 'ready'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT coalesce(max(id), previous_tx_id) INTO current_tx_id FROM public.tx;
  IF current_tx_id <= previous_tx_id THEN RETURN false; END IF;
  SELECT coalesce(max(decimals), 0) INTO asset_decimals
  FROM cardyx.asset_catalog
  WHERE policy_id = requested_policy_id AND asset_name = requested_asset_name;

  WITH token AS (
    SELECT id FROM public.multi_asset
    WHERE policy = decode(requested_policy_id, 'hex') AND name = decode(requested_asset_name, 'hex')
  ), changes AS (
    SELECT output.address, output.stake_address_id, asset_output.quantity AS delta
    FROM token
    JOIN public.ma_tx_out asset_output ON asset_output.ident = token.id
    JOIN public.tx_out output ON output.id = asset_output.tx_out_id
    WHERE output.tx_id > previous_tx_id AND output.tx_id <= current_tx_id
    UNION ALL
    SELECT output.address, output.stake_address_id, -asset_output.quantity AS delta
    FROM public.tx_in spent
    JOIN public.tx_out output
      ON output.tx_id = spent.tx_out_id AND output.index = spent.tx_out_index
    JOIN public.ma_tx_out asset_output ON asset_output.tx_out_id = output.id
    JOIN token ON token.id = asset_output.ident
    WHERE spent.tx_in_id > previous_tx_id AND spent.tx_in_id <= current_tx_id
  ), by_address AS (
    SELECT address, stake_address_id, sum(delta) / power(10::numeric, asset_decimals) AS delta
    FROM changes
    GROUP BY address, stake_address_id
  )
  INSERT INTO cardyx.asset_holder_balance (policy_id, asset_name, address, stake_address_id, balance, updated_at)
  SELECT requested_policy_id, requested_asset_name, address, stake_address_id, delta, now()
  FROM by_address
  WHERE delta <> 0
  ON CONFLICT (policy_id, asset_name, address) DO UPDATE
  SET balance = cardyx.asset_holder_balance.balance + EXCLUDED.balance,
      stake_address_id = EXCLUDED.stake_address_id,
      updated_at = now();

  DELETE FROM cardyx.asset_holder_balance
  WHERE policy_id = requested_policy_id AND asset_name = requested_asset_name AND balance <= 0;

  UPDATE cardyx.asset_holder_index_state
  SET last_tx_id = current_tx_id, last_error = NULL, updated_at = now()
  WHERE policy_id = requested_policy_id AND asset_name = requested_asset_name;
  RETURN true;
END;
$$;

ALTER FUNCTION cardyx.refresh_asset_holder_index(text, text) OWNER TO cardyx_snapshot_owner;
REVOKE ALL ON FUNCTION cardyx.refresh_asset_holder_index(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.refresh_asset_holder_index(text, text) TO cardyx_api;

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
  WITH balances AS (
    SELECT indexed.address,
           indexed.balance,
           indexed.stake_address_id,
           CASE WHEN requested_mode = 'groups' AND stake.hash_raw IS NOT NULL
                THEN 'stake:' || encode(stake.hash_raw, 'hex')
                ELSE 'address:' || indexed.address
           END AS holder_key
    FROM cardyx.asset_holder_balance indexed
    LEFT JOIN public.stake_address stake ON stake.id = indexed.stake_address_id
    WHERE indexed.policy_id = requested_policy_id
      AND indexed.asset_name = requested_asset_name
      AND indexed.balance > 0
  ), grouped AS (
    SELECT balances.holder_key,
           min(balances.address) AS address,
           count(*) AS address_count,
           sum(balances.balance) AS balance
    FROM balances
    GROUP BY balances.holder_key
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
