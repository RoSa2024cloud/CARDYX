CREATE INDEX IF NOT EXISTS oura_event_journal_received_idx
  ON cardyx.oura_event_journal (received_at)
  WHERE event_type = 'apply';

CREATE OR REPLACE FUNCTION cardyx.reconcile_oura_event_journal_canonicality()
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
DECLARE
  updated_count bigint;
BEGIN
  UPDATE cardyx.oura_event_journal journal
  SET is_canonical = EXISTS (
    SELECT 1 FROM public.block block
    WHERE block.slot_no = journal.slot
      AND encode(block.hash, 'hex') = journal.block_hash
  )
  WHERE journal.event_type = 'apply'
    AND journal.received_at >= now() - interval '6 hours'
    AND journal.is_canonical IS DISTINCT FROM EXISTS (
      SELECT 1 FROM public.block block
      WHERE block.slot_no = journal.slot
        AND encode(block.hash, 'hex') = journal.block_hash
    );
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION cardyx.reconcile_oura_event_journal_canonicality() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.reconcile_oura_event_journal_canonicality() TO cardyx_api;
