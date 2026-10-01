CREATE OR REPLACE VIEW cardyx.dex_inline_datum_candidate AS
SELECT
  o.id AS tx_out_id,
  o.address,
  d.value AS datum_json
FROM public.tx_out o
JOIN public.datum d ON d.id = o.inline_datum_id
WHERE o.inline_datum_id IS NOT NULL
  AND o.consumed_by_tx_id IS NULL
  AND o.address_has_script = true;

GRANT SELECT ON cardyx.dex_inline_datum_candidate TO cardyx_api;