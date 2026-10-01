CREATE INDEX IF NOT EXISTS tx_out_inline_datum_unspent_idx
  ON public.tx_out (inline_datum_id)
  WHERE inline_datum_id IS NOT NULL AND consumed_by_tx_id IS NULL;