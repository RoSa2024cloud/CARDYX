CREATE OR REPLACE FUNCTION cardyx.initialize_asset_holder_index(
  requested_policy_id text,
  requested_asset_name text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
DECLARE
  asset_decimals integer;
  snapshot_rows integer;
BEGIN
  SELECT coalesce(max(decimals), 0) INTO asset_decimals
  FROM cardyx.asset_catalog
  WHERE policy_id = requested_policy_id AND asset_name = requested_asset_name;

  DELETE FROM cardyx.asset_holder_balance
  WHERE policy_id = requested_policy_id AND asset_name = requested_asset_name;

  WITH watermark AS MATERIALIZED (
    SELECT coalesce(max(id), 0) AS tx_id FROM public.tx
  ), token AS MATERIALIZED (
    SELECT id FROM public.multi_asset
    WHERE policy = decode(requested_policy_id, 'hex')
      AND name = decode(requested_asset_name, 'hex')
  ), balances AS (
    SELECT output.address,
           output.stake_address_id,
           sum(asset_output.quantity) / power(10::numeric, asset_decimals) AS balance
    FROM watermark
    CROSS JOIN token
    JOIN public.ma_tx_out asset_output ON asset_output.ident = token.id
    JOIN public.tx_out output ON output.id = asset_output.tx_out_id
    WHERE output.tx_id <= watermark.tx_id
      AND NOT EXISTS (
        SELECT 1 FROM public.tx_in spent
        WHERE spent.tx_out_id = output.tx_id
          AND spent.tx_out_index = output.index
          AND spent.tx_in_id <= watermark.tx_id
      )
    GROUP BY output.address, output.stake_address_id
  ), saved_balances AS (
    INSERT INTO cardyx.asset_holder_balance
      (policy_id, asset_name, address, stake_address_id, balance, updated_at)
    SELECT requested_policy_id, requested_asset_name, address, stake_address_id, balance, now()
    FROM balances
    ON CONFLICT (policy_id, asset_name, address) DO UPDATE
    SET stake_address_id = EXCLUDED.stake_address_id,
        balance = EXCLUDED.balance,
        updated_at = EXCLUDED.updated_at
    RETURNING 1
  ), saved_state AS (
    INSERT INTO cardyx.asset_holder_index_state
      (policy_id, asset_name, last_tx_id, status, last_error, updated_at)
    SELECT requested_policy_id, requested_asset_name, watermark.tx_id, 'ready', NULL, now()
    FROM watermark
    CROSS JOIN (SELECT count(*) FROM saved_balances) ensure_balance_write
    ON CONFLICT (policy_id, asset_name) DO UPDATE
    SET last_tx_id = EXCLUDED.last_tx_id,
        status = 'ready',
        last_error = NULL,
        updated_at = EXCLUDED.updated_at
    RETURNING 1
  )
  SELECT count(*) INTO snapshot_rows FROM saved_state;
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
  needs_rebuild boolean;
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
    SELECT output.address, asset_output.quantity AS delta
    FROM public.tx_out output
    JOIN public.ma_tx_out asset_output ON asset_output.tx_out_id = output.id
    JOIN token ON token.id = asset_output.ident
    WHERE output.tx_id > previous_tx_id AND output.tx_id <= current_tx_id
    UNION ALL
    SELECT output.address, -asset_output.quantity AS delta
    FROM public.tx_in spent
    JOIN public.tx_out output
      ON output.tx_id = spent.tx_out_id AND output.index = spent.tx_out_index
    JOIN public.ma_tx_out asset_output ON asset_output.tx_out_id = output.id
    JOIN token ON token.id = asset_output.ident
    WHERE spent.tx_in_id > previous_tx_id AND spent.tx_in_id <= current_tx_id
  ), by_address AS (
    SELECT address, sum(delta) / power(10::numeric, asset_decimals) AS delta
    FROM changes
    GROUP BY address
  )
  SELECT EXISTS (
    SELECT 1
    FROM by_address delta
    LEFT JOIN cardyx.asset_holder_balance balance
      ON balance.policy_id = requested_policy_id
     AND balance.asset_name = requested_asset_name
     AND balance.address = delta.address
    WHERE coalesce(balance.balance, 0) + delta.delta < 0
  ) INTO needs_rebuild;

  IF needs_rebuild THEN
    PERFORM cardyx.initialize_asset_holder_index(requested_policy_id, requested_asset_name);
    RETURN true;
  END IF;

  WITH token AS (
    SELECT id FROM public.multi_asset
    WHERE policy = decode(requested_policy_id, 'hex') AND name = decode(requested_asset_name, 'hex')
  ), touched AS (
    SELECT output.address, output.stake_address_id
    FROM public.tx_out output
    JOIN public.ma_tx_out asset_output ON asset_output.tx_out_id = output.id
    JOIN token ON token.id = asset_output.ident
    WHERE output.tx_id > previous_tx_id AND output.tx_id <= current_tx_id
    UNION
    SELECT output.address, output.stake_address_id
    FROM public.tx_in spent
    JOIN public.tx_out output
      ON output.tx_id = spent.tx_out_id AND output.index = spent.tx_out_index
    JOIN public.ma_tx_out asset_output ON asset_output.tx_out_id = output.id
    JOIN token ON token.id = asset_output.ident
    WHERE spent.tx_in_id > previous_tx_id AND spent.tx_in_id <= current_tx_id
  ), by_address AS (
    SELECT address, max(stake_address_id) AS stake_address_id,
           sum(delta) / power(10::numeric, asset_decimals) AS delta
    FROM (
      SELECT output.address, output.stake_address_id, asset_output.quantity AS delta
      FROM public.tx_out output
      JOIN public.ma_tx_out asset_output ON asset_output.tx_out_id = output.id
      JOIN token ON token.id = asset_output.ident
      WHERE output.tx_id > previous_tx_id AND output.tx_id <= current_tx_id
      UNION ALL
      SELECT output.address, output.stake_address_id, -asset_output.quantity AS delta
      FROM public.tx_in spent
      JOIN public.tx_out output
        ON output.tx_id = spent.tx_out_id AND output.index = spent.tx_out_index
      JOIN public.ma_tx_out asset_output ON asset_output.tx_out_id = output.id
      JOIN token ON token.id = asset_output.ident
      WHERE spent.tx_in_id > previous_tx_id AND spent.tx_in_id <= current_tx_id
    ) changes
    GROUP BY address
  )
  INSERT INTO cardyx.asset_holder_balance (policy_id, asset_name, address, stake_address_id, balance, updated_at)
  SELECT requested_policy_id, requested_asset_name, address, stake_address_id, greatest(delta, 0), now()
  FROM by_address
  WHERE delta <> 0
  ON CONFLICT (policy_id, asset_name, address) DO UPDATE
  SET balance = greatest(cardyx.asset_holder_balance.balance + EXCLUDED.balance, 0),
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
