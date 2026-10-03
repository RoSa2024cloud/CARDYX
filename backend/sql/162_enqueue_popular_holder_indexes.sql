CREATE OR REPLACE FUNCTION cardyx.enqueue_popular_holder_indexes(requested_limit integer DEFAULT 20)
RETURNS integer
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, cardyx
AS $$
  WITH candidates AS (
    SELECT DISTINCT catalog.policy_id, catalog.asset_name,
           coalesce(snapshot.holder_count, 0) AS holder_count
    FROM cardyx.asset_catalog catalog
    JOIN cardyx.asset_balance_snapshot snapshot
      ON snapshot.policy_id = catalog.policy_id
     AND snapshot.asset_name = catalog.asset_name
    LEFT JOIN cardyx.asset_holder_index_state state
      ON state.policy_id = catalog.policy_id
     AND state.asset_name = catalog.asset_name
    WHERE catalog.policy_id ~ '^[0-9a-fA-F]{56}$'
      AND catalog.asset_name ~ '^([0-9a-fA-F]{2})*$'
      AND state.policy_id IS NULL
      AND snapshot.holder_count > 0
    ORDER BY coalesce(snapshot.holder_count, 0) DESC
    LIMIT greatest(1, least(requested_limit, 50))
  ), queued AS (
    INSERT INTO cardyx.asset_holder_index_state (policy_id, asset_name, status, updated_at)
    SELECT policy_id, asset_name, 'building', now()
    FROM candidates
    ON CONFLICT (policy_id, asset_name) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer FROM queued;
$$;

ALTER FUNCTION cardyx.enqueue_popular_holder_indexes(integer) OWNER TO cardyx_snapshot_owner;
REVOKE ALL ON FUNCTION cardyx.enqueue_popular_holder_indexes(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.enqueue_popular_holder_indexes(integer) TO cardyx_api;
