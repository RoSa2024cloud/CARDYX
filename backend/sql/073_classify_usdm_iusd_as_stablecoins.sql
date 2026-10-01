UPDATE cardyx.asset_catalog
SET category = 'stablecoin', updated_at = now()
WHERE ticker IN ('USDM', 'IUSD');

UPDATE cardyx.asset_catalog
SET category = 'stablecoin', updated_at = now()
WHERE lower(ticker) IN ('usdm', 'iusd')
	AND display_name IN ('USDM', 'iUSD');
