UPDATE cardyx.asset_catalog
SET policy_id='8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61',
    asset_name='446a65644d6963726f555344',
    ticker='DJED', display_name='Djed USD', decimals=6,
    category='stablecoin', official_url='https://djed.xyz', updated_at=now()
WHERE market_id='djed';

INSERT INTO cardyx.asset_metadata (
  policy_id,asset_name,ticker,display_name,description,decimals,source,updated_at
) VALUES (
  '8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61',
  '446a65644d6963726f555344','DJED','Djed USD',
  'DJED is an over-collateralized Stablecoin backed by ADA.',6,
  'cardano-token-registry',now()
)
ON CONFLICT (policy_id,asset_name) DO UPDATE SET
  ticker=EXCLUDED.ticker,display_name=EXCLUDED.display_name,
  description=EXCLUDED.description,decimals=EXCLUDED.decimals,
  source=EXCLUDED.source,updated_at=now();
