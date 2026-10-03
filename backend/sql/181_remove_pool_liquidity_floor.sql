CREATE OR REPLACE FUNCTION cardyx.unregistered_dex_pool_outputs(
  requested_pool_nft_policy_id text,
  requested_asset_identities jsonb,
  requested_limit integer DEFAULT 1000
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
    SELECT marker.name AS marker_name, marker_out.tx_out_id
    FROM public.multi_asset marker
    JOIN public.ma_tx_out marker_out ON marker_out.ident = marker.id AND marker_out.quantity > 0
    JOIN public.tx_out output ON output.id = marker_out.tx_out_id AND output.consumed_by_tx_id IS NULL
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
    ORDER BY marker_out.tx_out_id DESC
    LIMIT greatest(1, least(coalesce(requested_limit, 1000), 5000))
  )
  SELECT encode(candidate.marker_name, 'hex'),
         output.id,
         output.address,
         output.value,
         coalesce(inline_datum.value, hash_datum.value),
         coalesce(asset_values.value, '[]'::jsonb)
  FROM candidate_outputs candidate
  JOIN public.tx_out output ON output.id = candidate.tx_out_id
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
  ORDER BY output.id DESC;
$$;

REVOKE ALL ON FUNCTION cardyx.unregistered_dex_pool_outputs(text, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.unregistered_dex_pool_outputs(text, jsonb, integer) TO cardyx_api;

UPDATE cardyx.dex_pool_registry
SET enabled = true, updated_at = now()
WHERE validated_at IS NOT NULL
  AND enabled = false
  AND pool_id NOT IN (
    'muesliswap-amm-909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f-932e9a73e4d6e03cc872cfd0f13924864774c18eff87729744b348078d29a98b',
    'muesliswap-amm-909133088303c49f3a30f1cc8ed553a73857a29779f6c6561cd8093f-76d5a1581738921e32b3a5facb3e4cc230c010a2204be2864bb45948d27612e6'
  );

CREATE OR REPLACE FUNCTION cardyx.refresh_snek_pool_output()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
  WITH recent AS MATERIALIZED (
    SELECT o.id, o.tx_id, o.index, o.address, o.payment_cred, o.value,
           o.inline_datum_id, r.pool_address, r.asset_b_policy_id, r.asset_b_asset_name
    FROM cardyx.dex_pool_registry r
    JOIN public.multi_asset lp
      ON lp.policy = decode(r.pool_nft_policy_id, 'hex')
     AND lp.name = decode(r.pool_nft_asset_name, 'hex')
    JOIN public.ma_tx_out lp_out ON lp_out.ident = lp.id AND lp_out.quantity > 1
    JOIN public.tx_out o ON o.id = lp_out.tx_out_id
    WHERE r.pool_id = 'minswap-v2-snek-ada'
      AND lp_out.tx_out_id >= r.tx_out_id
    ORDER BY lp_out.tx_out_id DESC
    LIMIT 200
  ), current_pool AS (
    SELECT recent.id
    FROM recent
    JOIN public.datum d ON d.id = recent.inline_datum_id
    WHERE recent.address = recent.pool_address
      AND recent.payment_cred = decode('ea07b733d932129c378af627436e7cbc2ef0bf96e0036bb51b3bde6b', 'hex')
      AND NOT EXISTS (
        SELECT 1 FROM public.tx_in spent
        WHERE spent.tx_out_id = recent.tx_id AND spent.tx_out_index = recent.index
      )
      AND d.value->'fields'->1->'fields'->0->>'bytes' = ''
      AND d.value->'fields'->1->'fields'->1->>'bytes' = ''
      AND d.value->'fields'->2->'fields'->0->>'bytes' = recent.asset_b_policy_id
      AND d.value->'fields'->2->'fields'->1->>'bytes' = recent.asset_b_asset_name
      AND (d.value->'fields'->4->>'int')::numeric > 0
      AND (d.value->'fields'->4->>'int')::numeric <= recent.value
      AND (d.value->'fields'->5->>'int')::numeric > 0
      AND EXISTS (
        SELECT 1 FROM public.ma_tx_out marker_out
        JOIN public.multi_asset marker ON marker.id = marker_out.ident
        WHERE marker_out.tx_out_id = recent.id AND marker_out.quantity = 1
          AND marker.policy = decode('f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c', 'hex')
          AND marker.name = decode('4d5350', 'hex')
      )
      AND EXISTS (
        SELECT 1 FROM public.ma_tx_out token_out
        JOIN public.multi_asset token ON token.id = token_out.ident
        WHERE token_out.tx_out_id = recent.id
          AND token.policy = decode(recent.asset_b_policy_id, 'hex')
          AND token.name = decode(recent.asset_b_asset_name, 'hex')
          AND token_out.quantity >= (d.value->'fields'->5->>'int')::numeric
      )
    ORDER BY recent.id DESC
    LIMIT 1
  ), updated AS (
    UPDATE cardyx.dex_pool_registry r
    SET tx_out_id = current_pool.id, enabled = true, validated_at = now(), updated_at = now()
    FROM current_pool
    WHERE r.pool_id = 'minswap-v2-snek-ada'
      AND NOT EXISTS (
        SELECT 1 FROM cardyx.dex_pool_registry other
        WHERE other.pool_id <> r.pool_id AND other.tx_out_id = current_pool.id
      )
      AND (r.tx_out_id IS DISTINCT FROM current_pool.id OR r.enabled = false)
    RETURNING r.tx_out_id
  ), unavailable AS (
    UPDATE cardyx.dex_pool_registry r
    SET enabled = false, updated_at = now()
    WHERE r.pool_id = 'minswap-v2-snek-ada' AND r.enabled = true
      AND NOT EXISTS (SELECT 1 FROM current_pool)
    RETURNING r.pool_id
  ), stale_price AS (
    DELETE FROM cardyx.dex_pool_price_observation
    WHERE pool_id = 'minswap-v2-snek-ada' AND NOT EXISTS (SELECT 1 FROM current_pool)
    RETURNING market_id
  ), stale_snapshot AS (
    DELETE FROM cardyx.asset_market_snapshot
    WHERE market_id = 'snek' AND source = 'cardyx-local-dex-indexer'
      AND NOT EXISTS (SELECT 1 FROM current_pool)
      AND NOT EXISTS (
        SELECT 1 FROM cardyx.dex_pool_price_observation
        WHERE market_id = 'snek' AND pool_id <> 'minswap-v2-snek-ada'
          AND observed_at >= now() - interval '30 minutes'
      )
    RETURNING market_id
  ), stale_candle AS (
    DELETE FROM cardyx.asset_market_candle
    WHERE market_id = 'snek' AND source = 'cardyx-local-dex-indexer'
      AND NOT EXISTS (SELECT 1 FROM current_pool)
    RETURNING market_id
  )
  SELECT coalesce((SELECT tx_out_id FROM updated), (SELECT id FROM current_pool));
$$;

REVOKE ALL ON FUNCTION cardyx.refresh_snek_pool_output() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.refresh_snek_pool_output() TO cardyx_api;