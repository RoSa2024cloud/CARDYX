CREATE TABLE IF NOT EXISTS cardyx.dex_pool_discovery_state (
  dex text NOT NULL,
  version text NOT NULL,
  pool_nft_policy_id text NOT NULL,
  last_tx_out_id bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dex, version, pool_nft_policy_id)
);

GRANT SELECT, INSERT, UPDATE ON cardyx.dex_pool_discovery_state TO cardyx_api;

CREATE OR REPLACE FUNCTION cardyx.unregistered_dex_pool_outputs_since(
  requested_pool_nft_policy_id text,
  requested_asset_identities jsonb,
  requested_after_tx_out_id bigint,
  requested_limit integer DEFAULT 100
)
RETURNS TABLE (
  pool_nft_asset_name text,
  tx_out_id bigint,
  address text,
  lovelace numeric,
  datum_json jsonb,
  assets jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
  WITH eligible_assets AS MATERIALIZED (
    SELECT decode(identity->>'policyId', 'hex') AS policy,
           decode(identity->>'assetName', 'hex') AS name
    FROM jsonb_array_elements(coalesce(requested_asset_identities, '[]'::jsonb)) AS identities(identity)
    WHERE identity->>'policyId' ~ '^[a-f0-9]{56}$'
      AND identity->>'assetName' ~ '^(?:[a-f0-9]{2})*$'
  ), candidate_outputs AS MATERIALIZED (
      SELECT marker.name AS marker_name,
             output.id AS tx_out_id,
             output.address,
             output.value AS lovelace,
             coalesce(inline_datum.value, hash_datum.value) AS datum_json
      FROM public.multi_asset marker
      JOIN public.ma_tx_out marker_out
        ON marker_out.ident = marker.id
       AND marker_out.quantity > 0
       AND marker_out.tx_out_id > coalesce(requested_after_tx_out_id, 0)
      JOIN public.tx_out output
        ON output.id = marker_out.tx_out_id
       AND output.consumed_by_tx_id IS NULL
      LEFT JOIN public.datum inline_datum ON inline_datum.id = output.inline_datum_id
      LEFT JOIN public.datum hash_datum ON hash_datum.hash = output.data_hash
      WHERE marker.policy = decode(requested_pool_nft_policy_id, 'hex')
        AND NOT EXISTS (
          SELECT 1 FROM public.tx_in spent
          WHERE spent.tx_out_id = output.tx_id AND spent.tx_out_index = output.index
        )
        AND NOT EXISTS (
          SELECT 1 FROM cardyx.dex_pool_registry registered
          WHERE registered.tx_out_id = output.id
        )
        AND EXISTS (
          SELECT 1
          FROM public.ma_tx_out target_out
          JOIN public.multi_asset target ON target.id = target_out.ident
          JOIN eligible_assets eligible ON eligible.policy = target.policy AND eligible.name = target.name
          WHERE target_out.tx_out_id = output.id AND target_out.quantity > 0
        )
      ORDER BY output.id ASC
    LIMIT greatest(1, least(coalesce(requested_limit, 100), 500))
  )
  SELECT encode(candidate.marker_name, 'hex'),
         candidate.tx_out_id,
         candidate.address,
         candidate.lovelace,
         candidate.datum_json,
         coalesce(asset_values.value, '[]'::jsonb)
  FROM candidate_outputs candidate
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'policy_id', encode(asset.policy, 'hex'),
      'asset_name', encode(asset.name, 'hex'),
      'quantity', asset_output.quantity
    )) AS value
    FROM public.ma_tx_out asset_output
    JOIN public.multi_asset asset ON asset.id = asset_output.ident
    WHERE asset_output.tx_out_id = candidate.tx_out_id
  ) asset_values ON true
  ORDER BY candidate.tx_out_id ASC;
$$;

CREATE OR REPLACE FUNCTION cardyx.dex_pool_discovery_tip()
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(max(output.id), 0)::bigint FROM public.tx_out output;
$$;

REVOKE ALL ON FUNCTION cardyx.unregistered_dex_pool_outputs_since(text, jsonb, bigint, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION cardyx.dex_pool_discovery_tip() FROM PUBLIC;
REVOKE ALL ON FUNCTION cardyx.unregistered_dex_pool_outputs(text, jsonb, integer) FROM cardyx_api;
GRANT EXECUTE ON FUNCTION cardyx.unregistered_dex_pool_outputs_since(text, jsonb, bigint, integer) TO cardyx_api;
GRANT EXECUTE ON FUNCTION cardyx.dex_pool_discovery_tip() TO cardyx_api;
