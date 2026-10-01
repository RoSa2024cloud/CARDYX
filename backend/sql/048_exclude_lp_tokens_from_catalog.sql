-- LP / pool receipt token policies must never appear as tradeable catalog tokens.
CREATE TABLE IF NOT EXISTS cardyx.asset_catalog_excluded_policy (
  policy_id text PRIMARY KEY,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO cardyx.asset_catalog_excluded_policy (policy_id, reason) VALUES
  ('e4214b7cce62ac6fbba385d164df48e157eae5863521b4b67ca71d86', 'Minswap V1 LP'),
  ('f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c', 'Minswap V2 LP'),
  ('5b042cf53c0b2ce4f30a9e743b4871ad8c6dcdf1d845133395f55a8e', 'Minswap stable LP'),
  ('2c07095028169d7ab4376611abef750623c8f955597a38cd15248640', 'Minswap stable LP'),
  ('31f92531ac9f1af3079701fab7c66ce997eb07988277ee5b9d640301', 'Minswap stable LP'),
  ('026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570', 'WingRiders V1 LP'),
  ('980e8c567670d34d4ec13a0c3b6de6199f260ae5dc9dc9e867bc5c93', 'WingRiders stable LP'),
  ('6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737', 'WingRiders V2 LP / pool NFT'),
  ('e0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b', 'SundaeSwap V3 LP / pool NFT'),
  ('af3d70acf4bd5b3abb319a7d75c89fb3e56eafcdd46b2e9b57a2557f', 'MuesliSwap LP'),
  ('2dbe1daa1522e5640331909fbe7458e082fe22cbc047e3c7575fcc8b', 'Liqwid LPS0 deposit receipt'),
  ('fcd2d1b8a86cd6dda70553f17e67ba36f8ab0090b5ffbbfa8b2bb8d1', 'Liqwid LPM0 deposit receipt')
ON CONFLICT (policy_id) DO NOTHING;

DELETE FROM cardyx.asset_catalog catalog
USING cardyx.asset_catalog_excluded_policy excluded
WHERE catalog.policy_id = excluded.policy_id;

CREATE OR REPLACE FUNCTION cardyx.skip_excluded_catalog_policy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM cardyx.asset_catalog_excluded_policy WHERE policy_id = NEW.policy_id) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS asset_catalog_skip_excluded_policy ON cardyx.asset_catalog;
CREATE TRIGGER asset_catalog_skip_excluded_policy
BEFORE INSERT ON cardyx.asset_catalog
FOR EACH ROW EXECUTE FUNCTION cardyx.skip_excluded_catalog_policy();
