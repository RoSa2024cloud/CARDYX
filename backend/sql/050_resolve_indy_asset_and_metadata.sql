UPDATE cardyx.asset_catalog
SET policy_id = '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
    asset_name = '494e4459',
    ticker = 'INDY',
    display_name = 'Indigo DAO Token',
    decimals = 6,
    category = 'defi',
    official_url = 'https://indigoprotocol.io',
    updated_at = now()
WHERE market_id = 'indigo-dao-governance-token';

INSERT INTO cardyx.asset_metadata (
  policy_id, asset_name, ticker, display_name, description, decimals, source, updated_at
)
VALUES (
  '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
  '494e4459',
  'INDY',
  'Indigo DAO Token',
  'Indigo is an decentralized synthetics protocol for on-chain price exposure to real-world and digital assets',
  6,
  'cardano-token-registry',
  now()
)
ON CONFLICT (policy_id, asset_name) DO UPDATE SET
  ticker = EXCLUDED.ticker,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  decimals = EXCLUDED.decimals,
  source = EXCLUDED.source,
  updated_at = now();
