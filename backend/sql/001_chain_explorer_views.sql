CREATE SCHEMA IF NOT EXISTS cardyx AUTHORIZATION cardyx;
REVOKE ALL ON SCHEMA cardyx FROM PUBLIC;

CREATE OR REPLACE VIEW cardyx.transaction_summary AS
SELECT
  encode(t.hash, 'hex') AS tx_hash,
  b.block_no,
  b.slot_no,
  b.time AS block_time,
  t.fee AS fee_lovelace,
  t.out_sum AS output_lovelace,
  t.size AS size_bytes,
  t.valid_contract,
  (SELECT count(*) FROM public.tx_in i WHERE i.tx_in_id = t.id) AS input_count,
  (SELECT count(*) FROM public.tx_out o WHERE o.tx_id = t.id) AS output_count
FROM public.tx t
JOIN public.block b ON b.id = t.block_id;

CREATE OR REPLACE VIEW cardyx.asset_utxo AS
SELECT
  ma.fingerprint,
  encode(ma.policy, 'hex') AS policy_id,
  encode(ma.name, 'hex') AS asset_name,
  o.address,
  mto.quantity,
  b.time AS block_time
FROM public.ma_tx_out mto
JOIN public.multi_asset ma ON ma.id = mto.ident
JOIN public.tx_out o ON o.id = mto.tx_out_id
JOIN public.tx t ON t.id = o.tx_id
JOIN public.block b ON b.id = t.block_id
WHERE o.consumed_by_tx_id IS NULL;

CREATE OR REPLACE VIEW cardyx.address_utxo AS
SELECT
  o.address,
  o.value AS lovelace,
  b.time AS block_time
FROM public.tx_out o
JOIN public.tx t ON t.id = o.tx_id
JOIN public.block b ON b.id = t.block_id
WHERE o.consumed_by_tx_id IS NULL;

GRANT USAGE ON SCHEMA cardyx TO cardyx_api;
GRANT SELECT ON cardyx.chain_status TO cardyx_api;
GRANT SELECT ON cardyx.transaction_summary TO cardyx_api;
GRANT SELECT ON cardyx.asset_utxo TO cardyx_api;
GRANT SELECT ON cardyx.address_utxo TO cardyx_api;