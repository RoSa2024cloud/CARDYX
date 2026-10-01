DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cardyx_snapshot_owner') THEN
		CREATE ROLE cardyx_snapshot_owner NOLOGIN;
	END IF;
END;
$$;

GRANT USAGE ON SCHEMA cardyx, public TO cardyx_snapshot_owner;
GRANT CREATE ON SCHEMA cardyx TO cardyx_snapshot_owner;
GRANT SELECT ON public.multi_asset, public.ma_tx_out, public.tx_out, public.tx, public.block, public.tx_in
	TO cardyx_snapshot_owner;
GRANT SELECT ON cardyx.asset_catalog TO cardyx_snapshot_owner;
GRANT SELECT, INSERT, UPDATE ON cardyx.asset_balance_snapshot TO cardyx_snapshot_owner;

CREATE OR REPLACE FUNCTION cardyx.refresh_asset_balance(
	requested_policy_id text,
	requested_asset_name text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
BEGIN
	INSERT INTO cardyx.asset_balance_snapshot (
		policy_id, asset_name, holder_count, utxo_count,
		circulating_quantity, latest_activity, refreshed_at
	)
	SELECT
		requested_policy_id,
		requested_asset_name,
		count(DISTINCT output.address),
		count(*),
		coalesce(sum(asset_output.quantity), 0),
		max(block.time),
		now()
	FROM public.multi_asset asset
	JOIN public.ma_tx_out asset_output ON asset_output.ident = asset.id
	JOIN public.tx_out output ON output.id = asset_output.tx_out_id
	JOIN public.tx transaction ON transaction.id = output.tx_id
	JOIN public.block block ON block.id = transaction.block_id
	WHERE asset.policy = decode(requested_policy_id, 'hex')
		AND asset.name = decode(requested_asset_name, 'hex')
		AND output.consumed_by_tx_id IS NULL
		AND NOT EXISTS (
			SELECT 1 FROM public.tx_in spent
			WHERE spent.tx_out_id = output.tx_id
				AND spent.tx_out_index = output.index
		)
	ON CONFLICT (policy_id, asset_name) DO UPDATE SET
		holder_count = EXCLUDED.holder_count,
		utxo_count = EXCLUDED.utxo_count,
		circulating_quantity = EXCLUDED.circulating_quantity,
		latest_activity = EXCLUDED.latest_activity,
		refreshed_at = EXCLUDED.refreshed_at;
END;
$$;

ALTER FUNCTION cardyx.refresh_asset_balance(text, text) OWNER TO cardyx_snapshot_owner;
REVOKE INSERT, UPDATE ON cardyx.asset_balance_snapshot FROM cardyx_api;
REVOKE EXECUTE ON FUNCTION cardyx.refresh_asset_balance(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.refresh_asset_balance(text, text) TO cardyx_api;

CREATE OR REPLACE FUNCTION cardyx.refresh_asset_balances()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
DECLARE
	refreshed_count bigint;
BEGIN
	WITH tracked_assets AS MATERIALIZED (
		SELECT DISTINCT policy_id, asset_name,
			decode(policy_id, 'hex') AS policy,
			decode(asset_name, 'hex') AS name
		FROM cardyx.asset_catalog
		WHERE policy_id ~ '^[0-9a-fA-F]{56}$'
			AND asset_name ~ '^([0-9a-fA-F]{2})*$'
	), balances AS (
		SELECT tracked.policy_id,
			tracked.asset_name,
			count(DISTINCT output.address) AS holder_count,
			count(*) AS utxo_count,
			coalesce(sum(asset_output.quantity), 0) AS circulating_quantity,
			max(block.time) AS latest_activity
		FROM tracked_assets tracked
		JOIN public.multi_asset asset
			ON asset.policy = tracked.policy AND asset.name = tracked.name
		JOIN public.ma_tx_out asset_output ON asset_output.ident = asset.id
		JOIN public.tx_out output ON output.id = asset_output.tx_out_id
		JOIN public.tx transaction ON transaction.id = output.tx_id
		JOIN public.block block ON block.id = transaction.block_id
		WHERE output.consumed_by_tx_id IS NULL
			AND NOT EXISTS (
				SELECT 1 FROM public.tx_in spent
				WHERE spent.tx_out_id = output.tx_id
					AND spent.tx_out_index = output.index
			)
		GROUP BY tracked.policy_id, tracked.asset_name
	)
	INSERT INTO cardyx.asset_balance_snapshot (
		policy_id, asset_name, holder_count, utxo_count,
		circulating_quantity, latest_activity, refreshed_at
	)
	SELECT tracked.policy_id,
		tracked.asset_name,
		coalesce(balances.holder_count, 0),
		coalesce(balances.utxo_count, 0),
		coalesce(balances.circulating_quantity, 0),
		balances.latest_activity,
		now()
	FROM tracked_assets tracked
	LEFT JOIN balances USING (policy_id, asset_name)
	ON CONFLICT (policy_id, asset_name) DO UPDATE SET
		holder_count = EXCLUDED.holder_count,
		utxo_count = EXCLUDED.utxo_count,
		circulating_quantity = EXCLUDED.circulating_quantity,
		latest_activity = EXCLUDED.latest_activity,
		refreshed_at = EXCLUDED.refreshed_at;

	GET DIAGNOSTICS refreshed_count = ROW_COUNT;
	RETURN refreshed_count;
END;
$$;

ALTER FUNCTION cardyx.refresh_asset_balances() OWNER TO cardyx_snapshot_owner;
REVOKE EXECUTE ON FUNCTION cardyx.refresh_asset_balances() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.refresh_asset_balances() TO cardyx_api;
