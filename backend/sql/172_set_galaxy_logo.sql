UPDATE cardyx.asset_catalog
SET logo_url = 'https://assets.cardanoscan.io/images/token-assets/32112f9f72114db8c96d11966a713e2e69ae180eb5d3e10a2404d8b15b15969a.png',
    updated_at = now()
WHERE market_id = 'galaxy'
  AND policy_id = 'bfababb45a49499753eef0e6621bceda9c938cd45d92a2de0341a159'
  AND asset_name = '2447414c415859'
  AND logo_url IS DISTINCT FROM 'https://assets.cardanoscan.io/images/token-assets/32112f9f72114db8c96d11966a713e2e69ae180eb5d3e10a2404d8b15b15969a.png';