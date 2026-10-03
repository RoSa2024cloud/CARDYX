UPDATE cardyx.asset_catalog
SET logo_url = 'https://assets.cardanoscan.io/images/token-assets/2151639b3478b40e5e3ddfbc5d34c3385f7c5d1634992e4b99350c982b4d4c21.png',
    updated_at = now()
WHERE policy_id = '97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec'
  AND asset_name = '54616c6f73'
  AND logo_url IS DISTINCT FROM 'https://assets.cardanoscan.io/images/token-assets/2151639b3478b40e5e3ddfbc5d34c3385f7c5d1634992e4b99350c982b4d4c21.png';