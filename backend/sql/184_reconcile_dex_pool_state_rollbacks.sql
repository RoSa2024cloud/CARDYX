CREATE OR REPLACE FUNCTION cardyx.reconcile_dex_pool_state_rollbacks()
RETURNS TABLE (pool_states_deleted bigint, pair_states_deleted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
DECLARE
  v_pool_states_deleted bigint;
  v_pair_states_deleted bigint;
BEGIN
  WITH orphaned AS (
    SELECT state.pool_id, min(state.tx_out_id) AS first_orphan
    FROM cardyx.dex_pool_state state
    WHERE state.block_time >= now() - interval '1 hour'
      AND NOT EXISTS (
        SELECT 1 FROM public.tx_out output WHERE output.id = state.tx_out_id
      )
    GROUP BY state.pool_id
  )
  DELETE FROM cardyx.dex_pool_state state
  USING orphaned
  WHERE state.pool_id = orphaned.pool_id
    AND state.tx_out_id >= orphaned.first_orphan;
  GET DIAGNOSTICS v_pool_states_deleted = ROW_COUNT;

  WITH orphaned AS (
    SELECT state.pool_id, min(state.tx_out_id) AS first_orphan
    FROM cardyx.dex_pair_state state
    WHERE state.block_time >= now() - interval '1 hour'
      AND NOT EXISTS (
        SELECT 1 FROM public.tx_out output WHERE output.id = state.tx_out_id
      )
    GROUP BY state.pool_id
  )
  DELETE FROM cardyx.dex_pair_state state
  USING orphaned
  WHERE state.pool_id = orphaned.pool_id
    AND state.tx_out_id >= orphaned.first_orphan;
  GET DIAGNOSTICS v_pair_states_deleted = ROW_COUNT;

  RETURN QUERY SELECT v_pool_states_deleted, v_pair_states_deleted;
END;
$$;

REVOKE ALL ON FUNCTION cardyx.reconcile_dex_pool_state_rollbacks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.reconcile_dex_pool_state_rollbacks() TO cardyx_api;