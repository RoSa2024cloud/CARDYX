CREATE TABLE IF NOT EXISTS cardyx.dex_pool_state_indexer_control (
  singleton smallint PRIMARY KEY CHECK (singleton = 1),
  last_pool_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO cardyx.dex_pool_state_indexer_control (singleton, last_pool_id)
VALUES (1, NULL)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS cardyx.dex_pool_state_scan_cursor (
  pool_id text PRIMARY KEY,
  last_tx_out_id bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO cardyx.dex_pool_state_scan_cursor (pool_id, last_tx_out_id)
SELECT pool_id, max(tx_out_id)
FROM (
  SELECT pool_id, tx_out_id FROM cardyx.dex_pool_state
  UNION ALL
  SELECT pool_id, tx_out_id FROM cardyx.dex_pair_state
) states
GROUP BY pool_id
ON CONFLICT (pool_id) DO UPDATE
SET last_tx_out_id = greatest(cardyx.dex_pool_state_scan_cursor.last_tx_out_id, EXCLUDED.last_tx_out_id),
    updated_at = now();

GRANT SELECT, INSERT, UPDATE ON cardyx.dex_pool_state_indexer_control TO cardyx_api;
GRANT SELECT, INSERT, UPDATE ON cardyx.dex_pool_state_scan_cursor TO cardyx_api;

CREATE OR REPLACE FUNCTION cardyx.reconcile_dex_pool_state_scan_cursors()
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
DECLARE
  reset_count bigint;
BEGIN
  UPDATE cardyx.dex_pool_state_scan_cursor cursor_row
  SET last_tx_out_id = greatest(
      coalesce((SELECT max(state.tx_out_id) FROM cardyx.dex_pool_state state JOIN public.tx_out output ON output.id = state.tx_out_id WHERE state.pool_id = cursor_row.pool_id), 0),
      coalesce((SELECT max(state.tx_out_id) FROM cardyx.dex_pair_state state JOIN public.tx_out output ON output.id = state.tx_out_id WHERE state.pool_id = cursor_row.pool_id), 0)
      ),
      updated_at = now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tx_out output WHERE output.id = cursor_row.last_tx_out_id
  );
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$;

REVOKE ALL ON FUNCTION cardyx.reconcile_dex_pool_state_scan_cursors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.reconcile_dex_pool_state_scan_cursors() TO cardyx_api;
