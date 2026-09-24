CREATE TABLE IF NOT EXISTS cardyx.asset_catalog (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  market_id text NOT NULL UNIQUE,
  policy_id text UNIQUE,
  asset_name text,
  ticker text NOT NULL,
  display_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('layer-1', 'defi', 'stablecoin', 'infrastructure', 'gaming', 'ai', 'nft', 'meme', 'rwa', 'other')),
  logo_url text,
  official_url text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO cardyx.asset_catalog (market_id, ticker, display_name, category)
VALUES
  ('cardano', 'ADA', 'Cardano', 'layer-1'),
  ('fetch-ai', 'FET', 'Artificial Superintelligence Alliance', 'ai'),
  ('midnight-3', 'NIGHT', 'Midnight', 'infrastructure'),
  ('snek', 'SNEK', 'Snek', 'meme'),
  ('cicle-xreserve-bridged-usdc-cardano', 'USDCX', 'Circle xReserve Bridged USDC', 'stablecoin'),
  ('world-mobile-token', 'WMTX', 'World Mobile Token', 'infrastructure'),
  ('usdm-2', 'USDM', 'USDM', 'stablecoin'),
  ('iagon', 'IAG', 'Iagon', 'infrastructure'),
  ('strike-2', 'STRIKE', 'Strike', 'defi'),
  ('iusd', 'IUSD', 'Indigo Protocol iUSD', 'stablecoin'),
  ('liqwid-finance', 'LQ', 'Liqwid Finance', 'defi'),
  ('hosky', 'HOSKY', 'Hosky', 'meme'),
  ('anzens-usda', 'USDA', 'Anzens USDA', 'stablecoin'),
  ('minswap', 'MIN', 'Minswap', 'defi'),
  ('infinity-rising', 'RISE', 'Infinity Rising', 'gaming'),
  ('djed', 'DJED', 'Djed', 'stablecoin'),
  ('wanchain-bridged-usdc-cardano', 'USDC', 'Wanchain Bridged USDC', 'stablecoin'),
  ('indigo-dao-governance-token', 'INDY', 'Indigo Protocol', 'defi'),
  ('kinka', 'XNK', 'Kinka', 'rwa'),
  ('book-2', 'STUFF', 'STUFF.io', 'nft'),
  ('flow-lending', 'SURF', 'Surf Lending', 'defi'),
  ('cornucopias', 'COPI', 'Cornucopias', 'gaming'),
  ('singularitynet', 'AGIX', 'SingularityNET', 'ai'),
  ('cockcardano', 'COCK', 'CockCardano', 'meme'),
  ('babysnek', 'BBSNEK', 'BabySNEK', 'meme'),
  ('xerberus', 'XER', 'Xerberus', 'infrastructure'),
  ('wingriders', 'WRT', 'WingRiders', 'defi'),
  ('optim-finance', 'O', 'Optim Finance', 'defi'),
  ('nunet', 'NTX', 'NuNet', 'ai'),
  ('surge-3', 'SURGE', 'Surge', 'defi'),
  ('nikepig', 'NIKEPIG', 'Nikepig', 'meme'),
  ('titan-3', 'TITAN', 'Titan', 'meme'),
  ('charli3', 'C3', 'Charli3', 'ai'),
  ('atlas-2', 'ATLAS', 'Atlas', 'gaming'),
  ('rejuve-ai', 'RJV', 'Rejuve.AI', 'ai'),
  ('charles-the-chad', 'CHAD', 'Charles the Chad', 'meme'),
  ('revuto', 'REVU', 'Revuto', 'defi'),
  ('gold-fgld-finest-tokenized-gold', 'FGLD', 'Gold fGLD', 'rwa'),
  ('talos', 'AGENT', 'AGENT', 'ai'),
  ('nft-maker', '$NMKR', 'NMKR', 'nft'),
  ('cogito-protocol', 'CGV', 'Cogito Finance', 'ai'),
  ('ada-peepos', 'FREN', 'FREN', 'meme'),
  ('crawju', 'CRAWJU', 'CRAWJU', 'meme'),
  ('occamfi', 'OCC', 'OccamFi', 'defi'),
  ('viper-2', 'VIPER', 'VIPER', 'meme')
ON CONFLICT (market_id) DO NOTHING;

CREATE OR REPLACE VIEW cardyx.asset_catalog_public AS
SELECT
  market_id,
  policy_id,
  asset_name,
  ticker,
  display_name,
  category,
  logo_url,
  official_url,
  is_verified,
  updated_at
FROM cardyx.asset_catalog;

GRANT SELECT ON cardyx.asset_catalog_public TO cardyx_api;