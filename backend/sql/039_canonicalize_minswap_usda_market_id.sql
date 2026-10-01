BEGIN;

UPDATE cardyx.asset_catalog generated
SET logo_url = coalesce(generated.logo_url, curated.logo_url),
    official_url = coalesce(generated.official_url, curated.official_url),
    is_verified = generated.is_verified OR curated.is_verified
FROM cardyx.asset_catalog curated
WHERE generated.market_id = 'asset-fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456-55534441'
  AND curated.market_id = 'anzens-usda'
  AND curated.policy_id IS NULL;

UPDATE cardyx.dex_pool_price_observation
SET market_id = 'anzens-usda'
WHERE market_id = 'asset-fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456-55534441';

UPDATE cardyx.asset_market_snapshot
SET market_id = 'anzens-usda'
WHERE market_id = 'asset-fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456-55534441';

UPDATE cardyx.asset_market_candle
SET market_id = 'anzens-usda'
WHERE market_id = 'asset-fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456-55534441';

UPDATE cardyx.asset_price_snapshot
SET market_id = 'anzens-usda'
WHERE market_id = 'asset-fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456-55534441';

DELETE FROM cardyx.asset_catalog curated
WHERE curated.market_id = 'anzens-usda'
  AND curated.policy_id IS NULL
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog generated
    WHERE generated.market_id = 'asset-fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456-55534441'
  );

UPDATE cardyx.asset_catalog
SET market_id = 'anzens-usda',
    policy_id = 'fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456',
    asset_name = '55534441',
    ticker = 'USDA',
    display_name = 'Anzens USDA',
    category = 'stablecoin',
    decimals = 6,
    updated_at = now()
WHERE market_id = 'asset-fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456-55534441';

UPDATE cardyx.asset_catalog
SET policy_id = 'fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456',
    asset_name = '55534441',
    decimals = 6,
    ticker = 'USDA',
    display_name = 'Anzens USDA',
    category = 'stablecoin',
    updated_at = now()
WHERE market_id = 'anzens-usda';

COMMIT;