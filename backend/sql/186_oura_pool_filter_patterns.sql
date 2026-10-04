CREATE OR REPLACE FUNCTION cardyx.active_dex_pool_oura_patterns()
RETURNS TABLE (pattern text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
  SELECT DISTINCT
         CASE
           WHEN registry.pool_address ~ '^addr1[a-z0-9]+$' THEN registry.pool_address
           ELSE pool_nft.fingerprint
         END AS pattern
  FROM cardyx.dex_pool_registry registry
  LEFT JOIN public.multi_asset pool_nft
    ON pool_nft.policy = decode(registry.pool_nft_policy_id, 'hex')
   AND pool_nft.name = decode(registry.pool_nft_asset_name, 'hex')
  WHERE registry.enabled = true
    AND registry.validated_at IS NOT NULL
  ORDER BY pattern;
$$;

REVOKE ALL ON FUNCTION cardyx.active_dex_pool_oura_patterns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.active_dex_pool_oura_patterns() TO cardyx_api;