CREATE TABLE IF NOT EXISTS cardyx.asset_balance_snapshot (
  policy_id text NOT NULL,
  asset_name text NOT NULL,
  holder_count bigint NOT NULL DEFAULT 0,
  utxo_count bigint NOT NULL DEFAULT 0,
  circulating_quantity numeric NOT NULL DEFAULT 0,
  latest_activity timestamptz,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (policy_id, asset_name)
);

DROP VIEW IF EXISTS cardyx.onchain_market;

CREATE VIEW cardyx.onchain_market AS
SELECT
  c.market_id,
  c.policy_id,
  c.asset_name,
  c.ticker,
  c.display_name,
  c.category,
  c.logo_url,
  c.official_url,
  c.is_verified,
  coalesce(s.holder_count, 0) AS holder_count,
  coalesce(s.utxo_count, 0) AS utxo_count,
  coalesce(s.circulating_quantity, 0) AS circulating_quantity,
  s.latest_activity,
  NULL::numeric AS price_ada,
  NULL::numeric AS price_usd,
  'on-chain'::text AS data_source,
  s.refreshed_at
FROM cardyx.asset_catalog_public c
LEFT JOIN cardyx.asset_balance_snapshot s
  ON s.policy_id = c.policy_id
 AND s.asset_name = c.asset_name;

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
  ON CONFLICT (policy_id, asset_name) DO UPDATE SET
    holder_count = EXCLUDED.holder_count,
    utxo_count = EXCLUDED.utxo_count,
    circulating_quantity = EXCLUDED.circulating_quantity,
    latest_activity = EXCLUDED.latest_activity,
    refreshed_at = EXCLUDED.refreshed_at;
END;
$$;

GRANT SELECT ON cardyx.asset_balance_snapshot TO cardyx_api;
GRANT SELECT ON cardyx.onchain_market TO cardyx_api;