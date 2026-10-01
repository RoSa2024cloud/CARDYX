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
WHERE o.consumed_by_tx_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.tx_in i
    WHERE i.tx_out_id = o.tx_id
      AND i.tx_out_index = o.index
  );

CREATE OR REPLACE FUNCTION cardyx.refresh_asset_balance(
  requested_policy_id text,
  requested_asset_name text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO cardyx.asset_balance_snapshot (
    policy_id,
    asset_name,
    holder_count,
    utxo_count,
    circulating_quantity,
    latest_activity,
    refreshed_at
  )
  SELECT
    requested_policy_id,
    requested_asset_name,
    count(DISTINCT o.address),
    count(*),
    coalesce(sum(mto.quantity), 0),
    max(b.time),
    now()
  FROM public.multi_asset ma
  JOIN public.ma_tx_out mto ON mto.ident = ma.id
  JOIN public.tx_out o ON o.id = mto.tx_out_id
  JOIN public.tx t ON t.id = o.tx_id
  JOIN public.block b ON b.id = t.block_id
  WHERE ma.policy = decode(requested_policy_id, 'hex')
    AND ma.name = decode(requested_asset_name, 'hex')
    AND o.consumed_by_tx_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.tx_in i
      WHERE i.tx_out_id = o.tx_id
        AND i.tx_out_index = o.index
    )
  ON CONFLICT (policy_id, asset_name) DO UPDATE SET
    holder_count = EXCLUDED.holder_count,
    utxo_count = EXCLUDED.utxo_count,
    circulating_quantity = EXCLUDED.circulating_quantity,
    latest_activity = EXCLUDED.latest_activity,
    refreshed_at = EXCLUDED.refreshed_at;
END;
$$;