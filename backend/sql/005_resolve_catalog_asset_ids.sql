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