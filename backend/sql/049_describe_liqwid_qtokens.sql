UPDATE cardyx.asset_catalog
SET display_name = CASE policy_id
      WHEN 'a04ce7a52545e5e33c2867e148898d9e667a69602285f6a1298f9d68' THEN 'Liqwid ADA Receipt Token'
      WHEN 'aebcb6eaba17dea962008a9d693e39a3160b02b5b89b1c83e537c599' THEN 'Liqwid USDC Receipt Token'
    END,
    category = 'defi'
WHERE policy_id IN (
  'a04ce7a52545e5e33c2867e148898d9e667a69602285f6a1298f9d68',
  'aebcb6eaba17dea962008a9d693e39a3160b02b5b89b1c83e537c599'
);