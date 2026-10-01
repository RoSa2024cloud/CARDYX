GRANT SELECT, UPDATE ON cardyx.asset_catalog TO cardyx_api;

ALTER FUNCTION cardyx.refresh_asset_balance(text, text)
  SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cardyx.refresh_asset_balance(text, text) TO cardyx_api;