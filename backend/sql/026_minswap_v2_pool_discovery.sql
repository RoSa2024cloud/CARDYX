CREATE OR REPLACE VIEW cardyx.minswap_v2_pool_candidate AS
WITH msp_asset AS (
  SELECT id
  FROM public.multi_asset
  WHERE policy = decode('f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c', 'hex')
    AND name = decode('4d5350', 'hex')
), pool_utxos AS MATERIALIZED (
  SELECT o.id, o.address, o.value, o.inline_datum_id
  FROM msp_asset marker
  JOIN public.ma_tx_out marker_out
    ON marker_out.ident = marker.id
   AND marker_out.quantity = 1
  JOIN public.tx_out o
    ON o.id = marker_out.tx_out_id
   AND o.consumed_by_tx_id IS NULL
   AND o.address_has_script = true
   AND o.payment_cred = decode('ea07b733d932129c378af627436e7cbc2ef0bf96e0036bb51b3bde6b', 'hex')
  ORDER BY o.id DESC
  LIMIT 100
)
SELECT
  o.id AS tx_out_id,
  o.address,
  o.value AS lovelace,
  d.value AS datum_json,
  pool_assets.assets
FROM pool_utxos o
JOIN public.datum d ON d.id = o.inline_datum_id
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
) pool_assets ON true;

GRANT SELECT ON cardyx.minswap_v2_pool_candidate TO cardyx_api;
