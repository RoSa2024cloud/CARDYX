DELETE FROM cardyx.asset_catalog
WHERE market_id = 'wanchain-bridged-usdc-cardano'
  AND policy_id IS NULL
  AND asset_name IS NULL;
