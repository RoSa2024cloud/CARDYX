CREATE OR REPLACE VIEW cardyx.tx_metadata_index AS
SELECT id, json
FROM public.tx_metadata
WHERE json IS NOT NULL;

GRANT SELECT ON cardyx.tx_metadata_index TO cardyx_api;

CREATE OR REPLACE FUNCTION cardyx.asset_mint_metadata(requested_policy_id text, requested_asset_name text)
RETURNS SETOF jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
	WITH mint_transactions AS MATERIALIZED (
		SELECT mint.tx_id
		FROM public.multi_asset asset
		JOIN public.ma_tx_mint mint ON mint.ident = asset.id
		WHERE asset.policy = decode(requested_policy_id, 'hex')
			AND asset.name = decode(requested_asset_name, 'hex')
			AND mint.quantity > 0
		LIMIT 20
	)
	SELECT metadata.json
	FROM mint_transactions mint
	JOIN public.tx_metadata metadata ON metadata.tx_id = mint.tx_id
	WHERE metadata.key = 721 AND metadata.json IS NOT NULL
	LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION cardyx.asset_mint_metadata(text, text) TO cardyx_api;

CREATE OR REPLACE FUNCTION cardyx.native_asset_fingerprint(requested_policy_id text, requested_asset_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
	SELECT fingerprint
	FROM public.multi_asset
	WHERE policy = decode(requested_policy_id, 'hex')
		AND name = decode(requested_asset_name, 'hex')
	LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION cardyx.native_asset_fingerprint(text, text) TO cardyx_api;

DROP FUNCTION IF EXISTS cardyx.insert_curated_asset(text, text, text, text, text, text, text, integer);