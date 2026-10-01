UPDATE cardyx.asset_catalog
SET policy_id = (
      SELECT encode(ma.policy, 'hex')
      FROM public.multi_asset ma
      WHERE encode(ma.name, 'hex') = '484f534b59'
      ORDER BY ma.id
      LIMIT 1
    ),
    asset_name = '484f534b59',
    updated_at = now()
WHERE market_id = 'hosky';

UPDATE cardyx.asset_catalog
SET policy_id = (
      SELECT encode(ma.policy, 'hex')
      FROM public.multi_asset ma
      WHERE encode(ma.name, 'hex') = '4d494e'
      ORDER BY ma.id
      LIMIT 1
    ),
    asset_name = '4d494e',
    updated_at = now()
WHERE market_id = 'minswap';

UPDATE cardyx.asset_catalog
SET policy_id = '0691b2fecca1ac4f53cb6dfb00b7013e561d1f34403b957cbb5af1fa',
    asset_name = '4e49474854',
    updated_at = now()
WHERE market_id = 'midnight-3';

UPDATE cardyx.asset_catalog
SET policy_id = 'eb7a93ebc321647673490810f618b548d7c24aa64d30ae342dba7076',
    asset_name = '0014df10415343454e44',
    updated_at = now()
WHERE market_id = 'ascend';

UPDATE cardyx.asset_catalog
SET policy_id = 'fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456',
    asset_name = '55534441',
    updated_at = now()
WHERE market_id = 'anzens-usda';

UPDATE cardyx.asset_catalog
SET policy_id = 'f13ac4d66b3ee19a6aa0f2a22298737bd907cc95121662fc971b5275',
    asset_name = '535452494b45',
    updated_at = now()
WHERE market_id = 'strike-2';

UPDATE cardyx.asset_catalog
SET policy_id = '9ff9a1b456f074e03be90631e1a5f9b6ed08eacabd0e7f95a11ffff1',
    asset_name = '0014df1041544c4153',
    decimals = 6,
    updated_at = now()
WHERE market_id = 'atlas-2';

UPDATE cardyx.asset_catalog
SET policy_id = '8483844875ce4d61c2aa459240f277d32081ee08fe0ad16899a0f581',
    asset_name = '0014df10544954414e',
    decimals = 6,
    updated_at = now()
WHERE market_id = 'titan-3';