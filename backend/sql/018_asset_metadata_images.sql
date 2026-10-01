ALTER TABLE cardyx.asset_metadata
  ADD COLUMN IF NOT EXISTS image_url text;

GRANT SELECT, INSERT, UPDATE ON cardyx.asset_metadata TO cardyx_api;