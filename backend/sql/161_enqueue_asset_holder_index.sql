CREATE OR REPLACE FUNCTION cardyx.enqueue_asset_holder_index(
  requested_policy_id text,
  requested_asset_name text
) RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, cardyx
AS $$
  INSERT INTO cardyx.asset_holder_index_state (policy_id, asset_name, status, last_error, updated_at)
  VALUES (requested_policy_id, requested_asset_name, 'building', NULL, now())
  ON CONFLICT (policy_id, asset_name) DO UPDATE
  SET status = CASE WHEN cardyx.asset_holder_index_state.status = 'ready' THEN 'ready' ELSE 'building' END,
      last_error = NULL,
      updated_at = now();
$$;

ALTER FUNCTION cardyx.enqueue_asset_holder_index(text, text) OWNER TO cardyx_snapshot_owner;
REVOKE ALL ON FUNCTION cardyx.enqueue_asset_holder_index(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.enqueue_asset_holder_index(text, text) TO cardyx_api;
GRANT SELECT ON cardyx.asset_holder_index_state TO cardyx_api;
