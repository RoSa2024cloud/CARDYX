CREATE OR REPLACE FUNCTION cardyx.oura_confirmed_pool_trades(
  requested_policy_id text,
  requested_asset_name text
)
RETURNS TABLE (
  tx_hash text,
  occurred_at timestamp without time zone,
  dex text,
  version text,
  side text,
  amount numeric,
  ada_notional numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
  WITH observed_transactions AS MATERIALIZED (
    SELECT DISTINCT decode(journal.record->>'hash', 'base64') AS tx_hash
    FROM cardyx.oura_event_journal journal
    WHERE journal.event_type = 'apply'
      AND journal.is_canonical = true
      AND journal.received_at >= now() - interval '6 hours'
      AND journal.record->>'hash' ~ '^[A-Za-z0-9+/]{43}=$'
  )
  SELECT DISTINCT trade.tx_hash,
         trade.occurred_at,
         trade.dex,
         trade.version,
         trade.side,
         trade.amount,
         trade.ada_notional
  FROM cardyx.local_pool_trades(requested_policy_id, requested_asset_name) trade
  JOIN observed_transactions observed
    ON observed.tx_hash = decode(trade.tx_hash, 'hex')
  ORDER BY trade.occurred_at DESC
  LIMIT 30;
$$;

REVOKE ALL ON FUNCTION cardyx.oura_confirmed_pool_trades(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.oura_confirmed_pool_trades(text, text) TO cardyx_api;
