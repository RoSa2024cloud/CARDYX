-- These indexes support targeted policy/asset lookups from cardyx.asset_utxo.
-- They intentionally avoid a global GROUP BY over the db-sync history.
CREATE INDEX CONCURRENTLY IF NOT EXISTS multi_asset_policy_name_idx
  ON public.multi_asset (policy, name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ma_tx_out_ident_tx_out_idx
  ON public.ma_tx_out (ident, tx_out_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS tx_out_unspent_id_idx
  ON public.tx_out (id)
  WHERE consumed_by_tx_id IS NULL;