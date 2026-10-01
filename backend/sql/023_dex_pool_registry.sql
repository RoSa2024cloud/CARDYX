CREATE TABLE IF NOT EXISTS cardyx.dex_pool_registry (
  pool_id text PRIMARY KEY,
  dex text NOT NULL,
  version text NOT NULL,
  tx_out_id bigint UNIQUE,
  pool_address text,
  pool_nft_policy_id text NOT NULL,
  pool_nft_asset_name text NOT NULL,
  asset_a_policy_id text,
  asset_a_asset_name text,
  asset_a_decimals integer NOT NULL DEFAULT 6,
  asset_b_policy_id text,
  asset_b_asset_name text,
  asset_b_decimals integer NOT NULL DEFAULT 6,
  enabled boolean NOT NULL DEFAULT false,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((asset_a_policy_id IS NULL) = (asset_a_asset_name IS NULL)),
  CHECK ((asset_b_policy_id IS NULL) = (asset_b_asset_name IS NULL))
);

ALTER TABLE cardyx.dex_pool_registry
  ADD COLUMN IF NOT EXISTS pool_address text;

DROP VIEW IF EXISTS cardyx.dex_pool_utxo;

CREATE VIEW cardyx.dex_pool_utxo AS
SELECT
  r.pool_id,
  r.dex,
  r.version,
  r.pool_address,
  r.asset_a_policy_id,
  r.asset_a_asset_name,
  r.asset_a_decimals,
  r.asset_b_policy_id,
  r.asset_b_asset_name,
  r.asset_b_decimals,
  r.pool_nft_policy_id,
  r.pool_nft_asset_name,
  o.id AS tx_out_id,
  o.value AS lovelace,
  d.value AS datum_json,
  pool_assets.assets
FROM cardyx.dex_pool_registry r
JOIN LATERAL (
  SELECT o.id, o.value, o.inline_datum_id, o.data_hash
  FROM public.multi_asset pool_nft
  JOIN public.ma_tx_out pool_nft_out
    ON pool_nft_out.ident = pool_nft.id
    AND pool_nft_out.quantity > 0
  JOIN public.tx_out o
    ON o.id = pool_nft_out.tx_out_id
   AND o.consumed_by_tx_id IS NULL
  WHERE pool_nft.policy = decode(r.pool_nft_policy_id, 'hex')
    AND pool_nft.name = decode(r.pool_nft_asset_name, 'hex')
    AND o.id = r.tx_out_id
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = o.tx_id AND spent.tx_out_index = o.index
    )
    AND (r.pool_address IS NULL OR o.address = r.pool_address)
  LIMIT 1
) o ON true
LEFT JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
LEFT JOIN LATERAL (
  SELECT coalesce(
    jsonb_agg(jsonb_build_object(
      'policy_id', encode(ma.policy, 'hex'),
      'asset_name', encode(ma.name, 'hex'),
      'quantity', mto.quantity
    )),
    '[]'::jsonb
  ) AS assets
  FROM public.ma_tx_out mto
  JOIN public.multi_asset ma ON ma.id = mto.ident
  WHERE mto.tx_out_id = o.id
) pool_assets ON true
WHERE r.enabled = true
;

GRANT SELECT, INSERT, UPDATE ON cardyx.dex_pool_registry TO cardyx_api;
GRANT SELECT ON cardyx.dex_pool_utxo TO cardyx_api;

CREATE OR REPLACE FUNCTION cardyx.find_registered_pool_outputs(
  p_pool_id text,
  p_pool_nft_policy_id text,
  p_pool_nft_asset_name text,
  p_start_tx_out_id bigint,
  p_pool_address text
)
RETURNS TABLE(tx_out_id bigint, lovelace numeric, datum_json jsonb, assets jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
  WITH recent_outputs AS MATERIALIZED (
    SELECT mto.tx_out_id
    FROM public.multi_asset ma
    JOIN public.ma_tx_out mto ON mto.ident = ma.id AND mto.quantity > 0
    WHERE ma.policy = decode(p_pool_nft_policy_id, 'hex')
      AND ma.name = decode(p_pool_nft_asset_name, 'hex')
      AND (p_start_tx_out_id IS NULL OR mto.tx_out_id >= p_start_tx_out_id)
    ORDER BY mto.tx_out_id DESC
    LIMIT 200
  )
  SELECT output.id,
         output.value,
         coalesce(inline_datum.value, hash_datum.value),
         coalesce(assets.value, '[]'::jsonb)
  FROM recent_outputs recent
  JOIN public.tx_out output ON output.id = recent.tx_out_id
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
  ) assets ON true
  WHERE output.consumed_by_tx_id IS NULL
    AND (p_pool_address IS NULL OR output.address = p_pool_address)
    AND NOT EXISTS (
      SELECT 1 FROM public.tx_in spent
      WHERE spent.tx_out_id = output.tx_id AND spent.tx_out_index = output.index
    )
  ORDER BY output.id DESC;
$$;

REVOKE ALL ON FUNCTION cardyx.find_registered_pool_outputs(text, text, text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.find_registered_pool_outputs(text, text, text, bigint, text) TO cardyx_api;

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
      AND (d.value->'fields'->4->>'int')::numeric > 500000000
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
        WHERE other.pool_id <> r.pool_id
          AND other.tx_out_id = current_pool.id
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
