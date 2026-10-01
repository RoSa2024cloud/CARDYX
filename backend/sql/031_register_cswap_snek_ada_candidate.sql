INSERT INTO cardyx.dex_pool_registry (
  pool_id,
  dex,
  version,
  pool_nft_policy_id,
  pool_nft_asset_name,
  asset_a_policy_id,
  asset_a_asset_name,
  asset_a_decimals,
  asset_b_policy_id,
  asset_b_asset_name,
  asset_b_decimals,
  enabled,
  validated_at,
  updated_at
)
SELECT
  'cswap-candidate-8e50527b8cc1763348b393dca349bf04385ee12d4568afa0c8a457a9432d4c503a20414441207820534e454b',
  'cswap',
  'unverified',
  '8e50527b8cc1763348b393dca349bf04385ee12d4568afa0c8a457a9',
  '432d4c503a20414441207820534e454b',
  NULL,
  NULL,
  6,
  '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f',
  '534e454b',
  0,
  false,
  NULL,
  now()
WHERE EXISTS (
  SELECT 1
  FROM public.multi_asset lp
  WHERE lp.policy = decode('8e50527b8cc1763348b393dca349bf04385ee12d4568afa0c8a457a9', 'hex')
    AND lp.name = decode('432d4c503a20414441207820534e454b', 'hex')
)
AND EXISTS (
  SELECT 1
  FROM cardyx.asset_catalog token
  WHERE token.policy_id = '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f'
    AND token.asset_name = '534e454b'
)
ON CONFLICT DO NOTHING;
