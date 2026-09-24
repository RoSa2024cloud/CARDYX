CREATE OR REPLACE VIEW cardyx.onchain_market AS
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
  coalesce(a.holder_count, 0) AS holder_count,
  coalesce(a.utxo_count, 0) AS utxo_count,
  coalesce(a.circulating_quantity, 0) AS circulating_quantity,
  a.latest_activity,
  NULL::numeric AS price_ada,
  NULL::numeric AS price_usd,
  'on-chain'::text AS data_source
FROM cardyx.asset_catalog_public c
LEFT JOIN LATERAL (
  SELECT
    count(DISTINCT o.address) AS holder_count,
    count(*) AS utxo_count,
    sum(mto.quantity) AS circulating_quantity,
    max(b.time) AS latest_activity
  FROM public.multi_asset ma
  JOIN public.ma_tx_out mto ON mto.ident = ma.id
  JOIN public.tx_out o ON o.id = mto.tx_out_id
  JOIN public.tx t ON t.id = o.tx_id
  JOIN public.block b ON b.id = t.block_id
  WHERE c.policy_id IS NOT NULL
    AND c.asset_name IS NOT NULL
    AND ma.policy = decode(c.policy_id, 'hex')
    AND ma.name = decode(c.asset_name, 'hex')
    AND o.consumed_by_tx_id IS NULL
) a ON true;

GRANT SELECT ON cardyx.onchain_market TO cardyx_api;