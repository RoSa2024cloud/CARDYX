CREATE INDEX IF NOT EXISTS tx_out_unspent_address_md5_idx
  ON public.tx_out (md5(address))
  WHERE consumed_by_tx_id IS NULL;