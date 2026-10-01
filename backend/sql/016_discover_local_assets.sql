ALTER TABLE cardyx.asset_catalog
  DROP CONSTRAINT IF EXISTS asset_catalog_policy_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS asset_catalog_policy_asset_idx
  ON cardyx.asset_catalog (policy_id, asset_name)
  WHERE policy_id IS NOT NULL AND asset_name IS NOT NULL;

CREATE TABLE IF NOT EXISTS cardyx.asset_catalog_discovery_state (
  source text PRIMARY KEY,
  latest_tx_id bigint NOT NULL DEFAULT 0,
  backfill_tx_id bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON cardyx.asset_catalog_discovery_state TO cardyx_api;

CREATE TABLE IF NOT EXISTS cardyx.asset_registry_lookup (
  policy_id text NOT NULL,
  asset_name text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  found boolean NOT NULL DEFAULT false,
  PRIMARY KEY (policy_id, asset_name)
);

CREATE INDEX IF NOT EXISTS asset_registry_lookup_checked_idx
  ON cardyx.asset_registry_lookup (checked_at);

GRANT SELECT, INSERT, UPDATE ON cardyx.asset_registry_lookup TO cardyx_api;

CREATE OR REPLACE FUNCTION cardyx.discover_asset_catalog(requested_limit integer DEFAULT 5000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
DECLARE
  batch_size integer := greatest(1, least(coalesce(requested_limit, 5000), 10000));
  newest_cursor bigint;
  history_cursor bigint;
  newest_ids bigint[];
  history_ids bigint[];
  newest_max bigint;
  history_min bigint;
  imported_count integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cardyx.asset_catalog_discovery'));

  INSERT INTO cardyx.asset_catalog_discovery_state (source, latest_tx_id, backfill_tx_id)
  SELECT 'ma_tx_mint', coalesce(max(tx_id), 0), coalesce(max(tx_id), 0)
  FROM public.ma_tx_mint
  ON CONFLICT (source) DO NOTHING;

  SELECT latest_tx_id, backfill_tx_id
  INTO newest_cursor, history_cursor
  FROM cardyx.asset_catalog_discovery_state
  WHERE source = 'ma_tx_mint'
  FOR UPDATE;

  SELECT array_agg(tx_id ORDER BY tx_id), max(tx_id)
  INTO newest_ids, newest_max
  FROM (
    SELECT DISTINCT tx_id
    FROM public.ma_tx_mint
    WHERE tx_id > newest_cursor
    ORDER BY tx_id ASC
    LIMIT batch_size
  ) newest_batch;

  SELECT array_agg(tx_id ORDER BY tx_id DESC), min(tx_id)
  INTO history_ids, history_min
  FROM (
    SELECT DISTINCT tx_id
    FROM public.ma_tx_mint
    WHERE tx_id <= history_cursor
    ORDER BY tx_id DESC
    LIMIT batch_size
  ) history_batch;

  WITH selected_tx AS (
    SELECT unnest(coalesce(newest_ids, ARRAY[]::bigint[])) AS tx_id
    UNION
    SELECT unnest(coalesce(history_ids, ARRAY[]::bigint[])) AS tx_id
  ), minted_assets AS (
    SELECT ma.policy, ma.name, sum(mint.quantity) AS minted_quantity,
           max(ma.fingerprint) AS fingerprint
    FROM selected_tx selected
    JOIN public.ma_tx_mint mint ON mint.tx_id = selected.tx_id AND mint.quantity > 0
    JOIN public.multi_asset ma ON ma.id = mint.ident
    GROUP BY ma.policy, ma.name
    HAVING sum(mint.quantity) > 1
        OR EXISTS (
          SELECT 1
          FROM cardyx.asset_metadata metadata
          WHERE metadata.policy_id = encode(ma.policy, 'hex')
            AND metadata.asset_name = encode(ma.name, 'hex')
            AND coalesce(metadata.decimals, 0) > 0
        )
  )
  INSERT INTO cardyx.asset_catalog (
    market_id, policy_id, asset_name, fingerprint, decimals,
    ticker, display_name, category, is_verified, updated_at
  )
  SELECT
    'asset-' || encode(minted.policy, 'hex') || '-' || encode(minted.name, 'hex'),
    encode(minted.policy, 'hex'),
    encode(minted.name, 'hex'),
    minted.fingerprint,
    metadata.decimals,
    coalesce(nullif(metadata.ticker, ''), 'ASSET'),
    coalesce(nullif(metadata.display_name, ''), 'Cardano Asset ' || right(encode(minted.name, 'hex'), 12)),
    'other',
    false,
    now()
  FROM minted_assets minted
  LEFT JOIN cardyx.asset_metadata metadata
    ON metadata.policy_id = encode(minted.policy, 'hex')
   AND metadata.asset_name = encode(minted.name, 'hex')
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS imported_count = ROW_COUNT;

  UPDATE cardyx.asset_catalog_discovery_state
  SET latest_tx_id = greatest(latest_tx_id, coalesce(newest_max, latest_tx_id)),
      backfill_tx_id = CASE WHEN history_min IS NULL THEN 0 ELSE history_min - 1 END,
      updated_at = now()
  WHERE source = 'ma_tx_mint';

  RETURN imported_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION cardyx.discover_asset_catalog(integer) FROM PUBLIC, cardyx_api;
