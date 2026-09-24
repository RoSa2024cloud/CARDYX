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
LEFT JOIN (
  SELECT
    policy_id,
    asset_name,
    count(DISTINCT address) AS holder_count,
    count(*) AS utxo_count,
    sum(quantity) AS circulating_quantity,
    max(block_time) AS latest_activity
  FROM cardyx.asset_utxo
  GROUP BY policy_id, asset_name
) a ON a.policy_id = c.policy_id AND a.asset_name = c.asset_name;

UPDATE cardyx.asset_catalog
SET policy_id = '27925e5f343eceb211bb3d7a659c6f97488f187ccbdaef01c13a0874',
    asset_name = '534e454b',
    updated_at = now()
WHERE market_id = 'snek';

UPDATE cardyx.asset_catalog
SET policy_id = 'a0028f350aa127283348c66e51a4d29198517bc661d193bbe5d34d51',
    asset_name = '484f534b59',
    updated_at = now()
WHERE market_id = 'hosky';

UPDATE cardyx.asset_catalog
SET policy_id = '29d222ce763455e3d07a9a665ce554f00ac89d2e99a1a83d267170c6',
    asset_name = '4d494e',
    updated_at = now()
WHERE market_id = 'minswap';

GRANT SELECT ON cardyx.onchain_market TO cardyx_api;