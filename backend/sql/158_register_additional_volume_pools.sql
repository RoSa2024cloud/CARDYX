-- Registers additional ADA pools found on-chain for NIGHT, MIN, IAG, WMTX and AGIX.
-- Pool identity (NFT/LP asset, CSwap LP name) is derived from the referenced pool output.
DO $$
DECLARE
  candidate record;
  out_row record;
  nft_name text;
  cswap_lp text;
  pool_key text;
  token_decimals integer;
BEGIN
  FOR candidate IN
    SELECT * FROM (VALUES
      (356356073::bigint, 'minswap',    'v1', '0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1', 'f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc535', '41474958'),
      (356237967::bigint, 'sundaeswap', 'v1', '0029cb7c88c7567b63d1a512c0ed626aa169688ec980730c0473b913', 'f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc535', '41474958'),
      (356099628::bigint, 'wingriders', 'v2', '6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737', 'f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc535', '41474958'),
      (356033161::bigint, 'wingriders', 'v1', '026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570', 'f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc535', '41474958'),
      (356356821::bigint, 'wingriders', 'v2', '6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737', '5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114', '494147'),
      (356355299::bigint, 'sundaeswap', 'v3', 'e0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b', '5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114', '494147'),
      (356264081::bigint, 'wingriders', 'v1', '026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570', '5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114', '494147'),
      (356355160::bigint, 'cswap',      'v1', 'a00d48eff61d8cfd86b5795d0b15015b84a33f139f22e7c8e3005c34', '5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114', '494147'),
      (356358495::bigint, 'sundaeswap', 'v3', 'e0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b', '0691b2fecca1ac4f53cb6dfb00b7013e561d1f34403b957cbb5af1fa', '4e49474854'),
      (356358756::bigint, 'cswap',      'v1', '3bcd70a4e1128f4cd0979a75ca2ca20c2636212c1d0952d6c5fd4cdd', '0691b2fecca1ac4f53cb6dfb00b7013e561d1f34403b957cbb5af1fa', '4e49474854'),
      (356358365::bigint, 'wingriders', 'v2', '6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737', '0691b2fecca1ac4f53cb6dfb00b7013e561d1f34403b957cbb5af1fa', '4e49474854'),
      (356355317::bigint, 'minswap',    'v1', '0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1', '29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6', '4d494e'),
      (356052884::bigint, 'sundaeswap', 'v1', '0029cb7c88c7567b63d1a512c0ed626aa169688ec980730c0473b913', '29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6', '4d494e'),
      (356319303::bigint, 'wingriders', 'v1', '026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570', '29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6', '4d494e'),
      (356354415::bigint, 'sundaeswap', 'v3', 'e0302560ced2fdcbfcb2602697df970cd0d6a38f94b32703f51c312b', 'e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a', '576f726c644d6f62696c65546f6b656e58'),
      (356347124::bigint, 'cswap',      'v1', 'c3c6686be48991209904f9652d9e6ba6e2c946429c5d68d0a3dd5792', 'e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a', '576f726c644d6f62696c65546f6b656e58'),
      (356337536::bigint, 'wingriders', 'v2', '6fdc63a1d71dc2c65502b79baae7fb543185702b12c3c5fb639ed737', 'e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a', '576f726c644d6f62696c65546f6b656e58')
    ) AS c(tx_out_id, dex, version, nft_policy, token_policy, token_name)
  LOOP
    SELECT o.id, o.address, o.value, d.value AS datum INTO out_row
    FROM public.tx_out o
    LEFT JOIN public.datum d ON d.id = o.inline_datum_id OR d.hash = o.data_hash
    WHERE o.id = candidate.tx_out_id
      AND EXISTS (
        SELECT 1 FROM public.ma_tx_out x JOIN public.multi_asset a ON a.id = x.ident
        WHERE x.tx_out_id = o.id AND x.quantity > 0
          AND a.policy = decode(candidate.token_policy, 'hex') AND a.name = decode(candidate.token_name, 'hex'))
    LIMIT 1;
    IF out_row.id IS NULL THEN
      RAISE NOTICE 'skip %: output % not found', candidate.dex, candidate.tx_out_id;
      CONTINUE;
    END IF;

    SELECT coalesce(nullif(m.decimals, 0), c.decimals, 0) INTO token_decimals
    FROM cardyx.asset_catalog c
    LEFT JOIN cardyx.asset_metadata m ON m.policy_id = c.policy_id AND m.asset_name = c.asset_name
    WHERE c.policy_id = candidate.token_policy AND c.asset_name = candidate.token_name
    LIMIT 1;

    -- WingRiders marks pools with '4c'; the pool identity is the LP asset under the same policy.
    SELECT encode(a.name, 'hex') INTO nft_name
    FROM public.ma_tx_out x JOIN public.multi_asset a ON a.id = x.ident
    WHERE x.tx_out_id = out_row.id AND a.policy = decode(candidate.nft_policy, 'hex')
      AND CASE
        WHEN candidate.dex = 'wingriders' THEN encode(a.name, 'hex') <> '4c'
        WHEN candidate.dex = 'sundaeswap' AND candidate.version = 'v1' THEN encode(a.name, 'hex') LIKE '7020%' AND x.quantity = 1
        WHEN candidate.dex = 'sundaeswap' AND candidate.version = 'v3' THEN encode(a.name, 'hex') LIKE '000de140%' AND x.quantity = 1
        WHEN candidate.dex = 'cswap' THEN encode(a.name, 'hex') = '63' AND x.quantity = 1
        ELSE x.quantity = 1
      END
    LIMIT 1;
    IF nft_name IS NULL THEN
      RAISE NOTICE 'skip %: no pool asset under % in output %', candidate.dex, candidate.nft_policy, out_row.id;
      CONTINUE;
    END IF;

    pool_key := CASE
      WHEN candidate.dex = 'sundaeswap' AND candidate.version = 'v1' THEN substr(nft_name, 5)
      WHEN candidate.dex = 'sundaeswap' AND candidate.version = 'v3' THEN substr(nft_name, 9)
      WHEN candidate.dex = 'cswap' THEN candidate.nft_policy || '-' || (out_row.datum->'fields'->7->>'bytes')
      ELSE nft_name
    END;
    IF candidate.dex = 'cswap' AND (out_row.datum->'fields'->4->>'bytes' IS DISTINCT FROM candidate.token_policy
       OR out_row.datum->'fields'->5->>'bytes' IS DISTINCT FROM candidate.token_name
       OR out_row.datum->'fields'->6->>'bytes' IS DISTINCT FROM candidate.nft_policy) THEN
      RAISE NOTICE 'skip cswap %: datum does not match token', out_row.id;
      CONTINUE;
    END IF;

    INSERT INTO cardyx.dex_pool_registry (
      pool_id, dex, version, tx_out_id, pool_address,
      pool_nft_policy_id, pool_nft_asset_name,
      asset_a_policy_id, asset_a_asset_name, asset_a_decimals,
      asset_b_policy_id, asset_b_asset_name, asset_b_decimals,
      enabled, validated_at, updated_at
    ) VALUES (
      candidate.dex || '-' || candidate.version || '-' || pool_key, candidate.dex, candidate.version, out_row.id, out_row.address,
      candidate.nft_policy, nft_name,
      NULL, NULL, 6,
      candidate.token_policy, candidate.token_name, coalesce(token_decimals, 0),
      out_row.value >= 500000000, now(), now()
    )
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'registered %-%-% (% ADA)', candidate.dex, candidate.version, pool_key, round(out_row.value / 1e6);
  END LOOP;
END;
$$;
