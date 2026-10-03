UPDATE cardyx.asset_catalog
SET decimals = 0,
    updated_at = now()
WHERE policy_id = 'ffc3c757828597afb0a063c67581e009f0bba6ccb5c46ff35d3e3c5c'
  AND asset_name = '4775696e656120506967'
  AND decimals IS DISTINCT FROM 0;