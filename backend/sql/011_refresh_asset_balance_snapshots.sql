SELECT cardyx.refresh_asset_balance(policy_id, asset_name)
FROM cardyx.asset_catalog
WHERE policy_id IS NOT NULL
  AND asset_name IS NOT NULL;