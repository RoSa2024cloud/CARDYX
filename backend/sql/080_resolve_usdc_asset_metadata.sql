UPDATE cardyx.asset_catalog
SET ticker='USDC',display_name='USDC',decimals=8,category='stablecoin',official_url='https://www.wanchain.org/',updated_at=now()
WHERE policy_id='25c5de5f5b286073c593edfd77b48abc7a48e5a4f3d4cd9d428ff935' AND asset_name='55534443';

INSERT INTO cardyx.asset_metadata (policy_id,asset_name,ticker,display_name,description,decimals,source,updated_at)
VALUES ('25c5de5f5b286073c593edfd77b48abc7a48e5a4f3d4cd9d428ff935','55534443','USDC','USDC','The Mapping token of USDC by WanChain.',8,'cardano-token-registry',now())
ON CONFLICT (policy_id,asset_name) DO UPDATE SET
 ticker=EXCLUDED.ticker,display_name=EXCLUDED.display_name,description=EXCLUDED.description,decimals=EXCLUDED.decimals,source=EXCLUDED.source,updated_at=now();
