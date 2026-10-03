CREATE TABLE IF NOT EXISTS cardyx.subscription_challenge (
  address text PRIMARY KEY,
  id uuid NOT NULL UNIQUE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS cardyx.subscription_session (
  token_hash text PRIMARY KEY,
  address text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS subscription_session_expiry_idx ON cardyx.subscription_session (expires_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON cardyx.subscription_challenge, cardyx.subscription_session TO cardyx_api;
GRANT SELECT ON public.block, public.multi_asset, public.ma_tx_out, public.tx_out, public.tx_in, public.stake_address TO cardyx_snapshot_owner;

CREATE OR REPLACE FUNCTION cardyx.subscription_nft_holdings(requested_address text, policies text[])
RETURNS TABLE (policy_id text, asset_name text, quantity text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, cardyx, public
AS $$
BEGIN
  IF coalesce((SELECT time FROM public.block ORDER BY id DESC LIMIT 1), 'epoch'::timestamp) <= now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'Chain data is not current';
  END IF;
  RETURN QUERY
    SELECT encode(asset.policy, 'hex'), encode(asset.name, 'hex'), sum(holding.quantity)::text
    FROM public.multi_asset asset
    JOIN public.ma_tx_out holding ON holding.ident = asset.id
    JOIN public.tx_out output ON output.id = holding.tx_out_id
    LEFT JOIN public.stake_address stake ON stake.id = output.stake_address_id
    WHERE asset.policy IN (SELECT decode(policy, 'hex') FROM unnest(policies) policy)
      AND (output.address = requested_address OR stake.view = requested_address)
      AND NOT output.address_has_script
      AND output.consumed_by_tx_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.tx_in spent WHERE spent.tx_out_id = output.tx_id AND spent.tx_out_index = output.index)
    GROUP BY asset.policy, asset.name
    HAVING sum(holding.quantity) > 0;
END;
$$;
ALTER FUNCTION cardyx.subscription_nft_holdings(text, text[]) OWNER TO cardyx_snapshot_owner;
REVOKE ALL ON FUNCTION cardyx.subscription_nft_holdings(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cardyx.subscription_nft_holdings(text, text[]) TO cardyx_api;