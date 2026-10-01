INSERT INTO cardyx.dex_pool_registry (
  pool_id,dex,version,tx_out_id,pool_address,
  pool_nft_policy_id,pool_nft_asset_name,
  asset_a_policy_id,asset_a_asset_name,asset_a_decimals,
  asset_b_policy_id,asset_b_asset_name,asset_b_decimals,
  enabled,validated_at,updated_at
)
VALUES (
  'minswap-v1-e4214b7cce62ac6fbba385d164df48e157eae5863521b4b67ca71d86-1592b2534d0ea82053f3a32256fa0532cbc32e30356984ca50262a75db5d1e05',
  'minswap','v1',355976690,
  'addr1z8snz7c4974vzdpxu65ruphl3zjdvtxw8strf2c2tmqnxzv72ufp67p6x5x963ry62xka0szfc0ycchrvw4y4rvkxk0sp4eyac',
  '0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1','1592b2534d0ea82053f3a32256fa0532cbc32e30356984ca50262a75db5d1e05',
  NULL,NULL,6,
  '25c5de5f5b286073c593edfd77b48abc7a48e5a4f3d4cd9d428ff935','55534443',8,
  true,now(),now()
)
ON CONFLICT (pool_id) DO UPDATE SET
  tx_out_id=EXCLUDED.tx_out_id,pool_address=EXCLUDED.pool_address,
  pool_nft_policy_id=EXCLUDED.pool_nft_policy_id,pool_nft_asset_name=EXCLUDED.pool_nft_asset_name,
  asset_a_policy_id=EXCLUDED.asset_a_policy_id,asset_a_asset_name=EXCLUDED.asset_a_asset_name,
  asset_a_decimals=EXCLUDED.asset_a_decimals,asset_b_policy_id=EXCLUDED.asset_b_policy_id,
  asset_b_asset_name=EXCLUDED.asset_b_asset_name,asset_b_decimals=EXCLUDED.asset_b_decimals,
  enabled=EXCLUDED.enabled,validated_at=EXCLUDED.validated_at,updated_at=EXCLUDED.updated_at;
