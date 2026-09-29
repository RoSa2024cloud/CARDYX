INSERT INTO cardyx.asset_catalog (
  market_id, policy_id, asset_name, ticker, display_name, decimals, category, official_url, updated_at
)
VALUES (
  'xerberus',
  '6d06570ddd778ec7c0cca09d381eca194e90c8cffa7582879735dbde',
  '584552',
  'XER',
  'Xerberus',
  6,
  'infrastructure',
  'https://www.xerberus.io/',
  now()
)
ON CONFLICT (market_id) DO UPDATE SET
  policy_id = EXCLUDED.policy_id,
  asset_name = EXCLUDED.asset_name,
  ticker = EXCLUDED.ticker,
  display_name = EXCLUDED.display_name,
  decimals = EXCLUDED.decimals,
  category = EXCLUDED.category,
  official_url = EXCLUDED.official_url,
  updated_at = now();

INSERT INTO cardyx.asset_metadata (
  policy_id, asset_name, ticker, display_name, description, decimals, source, updated_at
)
VALUES (
  '6d06570ddd778ec7c0cca09d381eca194e90c8cffa7582879735dbde',
  '584552',
  'XER',
  'Xerberus DAO LLC',
  'Xerberus is a risk and asset management blockchain designed to serve as a Cardano partner chain, with XER as the token to secure the blockchain.',
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

INSERT INTO cardyx.dex_pool_registry (
  pool_id, dex, version, tx_out_id, pool_address,
  pool_nft_policy_id, pool_nft_asset_name,
  asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
  asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
  enabled, validated_at, updated_at
)
SELECT
  'splash-fee-switch-a38c465243e49612ff7c1445a54da34e3650691e5d16d85db2086962-5845525f4144415f4e4654',
  'splash', 'fee-switch', o.id, o.address,
  'a38c465243e49612ff7c1445a54da34e3650691e5d16d85db2086962',
  '5845525f4144415f4e4654',
  NULL, NULL, 6,
  '6d06570ddd778ec7c0cca09d381eca194e90c8cffa7582879735dbde', '584552', 6,
  true, now(), now()
FROM public.multi_asset pool_nft
JOIN public.ma_tx_out nft_out ON nft_out.ident = pool_nft.id AND nft_out.quantity = 1
JOIN public.tx_out o ON o.id = nft_out.tx_out_id AND o.consumed_by_tx_id IS NULL
JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
JOIN public.multi_asset xer
  ON xer.policy = decode('6d06570ddd778ec7c0cca09d381eca194e90c8cffa7582879735dbde', 'hex')
 AND xer.name = decode('584552', 'hex')
JOIN public.ma_tx_out xer_out ON xer_out.ident = xer.id AND xer_out.tx_out_id = o.id
WHERE pool_nft.policy = decode('a38c465243e49612ff7c1445a54da34e3650691e5d16d85db2086962', 'hex')
  AND pool_nft.name = decode('5845525f4144415f4e4654', 'hex')
  AND o.address_has_script = true
  AND d.value->'fields'->0->'fields'->0->>'bytes' = 'a38c465243e49612ff7c1445a54da34e3650691e5d16d85db2086962'
  AND d.value->'fields'->0->'fields'->1->>'bytes' = '5845525f4144415f4e4654'
  AND d.value->'fields'->1->'fields'->0->>'bytes' = ''
  AND d.value->'fields'->1->'fields'->1->>'bytes' = ''
  AND d.value->'fields'->2->'fields'->0->>'bytes' = '6d06570ddd778ec7c0cca09d381eca194e90c8cffa7582879735dbde'
  AND d.value->'fields'->2->'fields'->1->>'bytes' = '584552'
  AND (d.value->'fields'->4->>'int')::numeric BETWEEN 1 AND 100000
  AND (d.value->'fields'->5->>'int')::numeric BETWEEN 0 AND (d.value->'fields'->4->>'int')::numeric
  AND (d.value->'fields'->6->>'int')::numeric >= 0
  AND (d.value->'fields'->7->>'int')::numeric >= 0
  AND o.value::numeric > (d.value->'fields'->6->>'int')::numeric + 500000000
  AND xer_out.quantity::numeric > (d.value->'fields'->7->>'int')::numeric
  AND EXISTS (
    SELECT 1 FROM public.ma_tx_out lp_out
    JOIN public.multi_asset lp ON lp.id = lp_out.ident
    WHERE lp_out.tx_out_id = o.id AND lp_out.quantity > 0
      AND lp.policy = decode(d.value->'fields'->3->'fields'->0->>'bytes', 'hex')
      AND lp.name = decode(d.value->'fields'->3->'fields'->1->>'bytes', 'hex')
  )
  AND EXISTS (
    SELECT 1 FROM cardyx.asset_catalog c
    WHERE c.market_id = 'xerberus'
      AND c.policy_id = '6d06570ddd778ec7c0cca09d381eca194e90c8cffa7582879735dbde'
      AND c.asset_name = '584552'
      AND c.decimals = 6
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.tx_in spent
    WHERE spent.tx_out_id = o.tx_id AND spent.tx_out_index = o.index
  )
ORDER BY o.id DESC
LIMIT 1
ON CONFLICT (pool_id) DO UPDATE SET
  tx_out_id = EXCLUDED.tx_out_id,
  pool_address = EXCLUDED.pool_address,
  asset_a_decimals = EXCLUDED.asset_a_decimals,
  asset_b_policy_id = EXCLUDED.asset_b_policy_id,
  asset_b_asset_name = EXCLUDED.asset_b_asset_name,
  asset_b_decimals = EXCLUDED.asset_b_decimals,
  enabled = EXCLUDED.enabled,
  validated_at = EXCLUDED.validated_at,
  updated_at = EXCLUDED.updated_at;