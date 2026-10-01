DELETE FROM cardyx.asset_catalog
WHERE market_id = 'cicle-xreserve-bridged-usdc-cardano'
  AND policy_id IS NULL
  AND asset_name IS NULL;

UPDATE cardyx.asset_catalog
SET category = 'stablecoin',
    updated_at = now()
WHERE policy_id = '1f3aec8bfe7ea4fe14c5f121e2a92e301afe414147860d557cac7e34'
  AND asset_name = '5553444378';
