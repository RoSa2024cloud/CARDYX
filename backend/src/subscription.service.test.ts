import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { Pool } from 'pg';
import { Credential, PrivateKey, RewardAddress } from '@emurgo/cardano-serialization-lib-nodejs';
import { CBORValue, COSESign1Builder, EdDSA25519Key, HeaderMap, Headers, Int, Label, ProtectedHeaderMap } from '@emurgo/cardano-message-signing-nodejs';
import { createSubscriptionRouter, normalizeSubscriptionAddress, subscriptionRules, tierForHoldings, validSubscriptionSignature } from './subscription.service';

const privateKey = PrivateKey.generate_ed25519();
const publicKey = privateKey.to_public();
const address = RewardAddress.new(1, Credential.from_keyhash(publicKey.hash())).to_address();

function sign(message: string) {
  const protectedHeaders = HeaderMap.new();
  protectedHeaders.set_algorithm_id(Label.new_int(Int.new_i32(-8)));
  protectedHeaders.set_header(Label.new_text('address'), CBORValue.new_bytes(address.to_bytes()));
  const builder = COSESign1Builder.new(Headers.new(ProtectedHeaderMap.new(protectedHeaders), HeaderMap.new()), Buffer.from(message), false);
  return {
    key: Buffer.from(EdDSA25519Key.new(publicKey.as_bytes()).build().to_bytes()).toString('hex'),
    signature: Buffer.from(builder.build(privateKey.sign(builder.make_data_to_sign().to_bytes()).to_bytes()).to_bytes()).toString('hex'),
  };
}

test('signatures are bound to the exact message and wallet key', () => {
  const proof = sign('CARDYX test challenge');
  assert.equal(validSubscriptionSignature(proof.signature, proof.key, 'CARDYX test challenge', address.to_bech32()), true);
  assert.equal(validSubscriptionSignature(proof.signature, proof.key, 'Different challenge', address.to_bech32()), false);
  const stranger = RewardAddress.new(1, Credential.from_keyhash(PrivateKey.generate_ed25519().to_public().hash())).to_address();
  assert.equal(validSubscriptionSignature(proof.signature, proof.key, 'CARDYX test challenge', stranger.to_bech32()), false);
  assert.equal(validSubscriptionSignature('invalid', proof.key, 'CARDYX test challenge', address.to_bech32()), false);
});

test('only mainnet key addresses are accepted', () => {
  assert.equal(normalizeSubscriptionAddress(address.to_hex()).address, address.to_bech32());
  const testnet = RewardAddress.new(0, Credential.from_keyhash(publicKey.hash())).to_address();
  assert.throws(() => normalizeSubscriptionAddress(testnet.to_bech32()));
  assert.throws(() => normalizeSubscriptionAddress('not-an-address'));
});

test('NFT rules fail closed and highest matching tier wins', () => {
  const policyId = 'ab'.repeat(28);
  const rules = subscriptionRules(JSON.stringify({ BASIC: { policyId }, PRO: { policyId, assetName: '01' }, PREMIUM: { policyId, assetName: '02' } }));
  assert.equal(tierForHoldings({}, [{ policy_id: policyId, asset_name: '02', quantity: '1' }]), 'FREE');
  assert.equal(tierForHoldings(rules, [{ policy_id: policyId, asset_name: '01', quantity: '1' }]), 'PRO');
  assert.equal(tierForHoldings(rules, [{ policy_id: policyId, asset_name: '02', quantity: '1' }]), 'PREMIUM');
  assert.equal(tierForHoldings(rules, [{ policy_id: policyId, asset_name: '02', quantity: '0' }]), 'FREE');
  assert.throws(() => subscriptionRules('{"PREMIUM":{"policyId":"wrong"}}'));
  assert.throws(() => subscriptionRules('{"UNKNOWN":{}}'));
});

test('API challenges are single-use, sessions recheck holdings and logout revokes access', async () => {
  const previous = process.env.CARDYX_SUBSCRIPTION_NFT_POLICIES;
  const policyId = 'cd'.repeat(28);
  process.env.CARDYX_SUBSCRIPTION_NFT_POLICIES = JSON.stringify({ PRO: { policyId, assetName: '01' } });
  let challenge: { address: string; id: string; message: string } | null = null;
  let sessionHash: string | null = null;
  let ownsNft = true;
  let databaseFailure = false;
  const pool = { query: async (sql: string, values: string[] = []) => {
    if (sql.startsWith('INSERT INTO cardyx.subscription_challenge')) { challenge = { address: values[0]!, id: values[1]!, message: values[2]! }; return { rows: [{ id: values[1] }], rowCount: 1 }; }
    if (sql.startsWith('SELECT address, message')) return { rows: challenge?.id === values[0] ? [challenge] : [] };
    if (sql.includes('WITH consumed')) { if (!challenge || challenge.id !== values[0]) return { rows: [], rowCount: 0 }; challenge = null; sessionHash = values[1]!; return { rows: [{ address: address.to_bech32() }], rowCount: 1 }; }
    if (sql.startsWith('SELECT address FROM')) return { rows: sessionHash === values[0] ? [{ address: address.to_bech32() }] : [] };
    if (sql.startsWith('SELECT * FROM cardyx.subscription_nft_holdings')) { if (databaseFailure) throw new Error('Offline'); return { rows: ownsNft ? [{ policy_id: policyId, asset_name: '01', quantity: '1' }] : [] }; }
    if (sql.includes('DELETE FROM cardyx.subscription_session WHERE token_hash')) sessionHash = null;
    return { rows: [], rowCount: 0 };
  } } as unknown as Pool;
  const app = express();
  app.use(express.json());
  app.use('/api/subscription', createSubscriptionRouter(pool));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const listeningAddress = server.address();
  assert.ok(listeningAddress && typeof listeningAddress !== 'string');
  const base = `http://127.0.0.1:${listeningAddress.port}/api/subscription`;
  const post = (path: string, body: unknown) => fetch(`${base}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await (await fetch(`${base}/current`)).json()).data.tier, 'FREE');
    const issued = await (await post('challenge', { address: address.to_bech32() })).json();
    const proof = sign(issued.data.message);
    assert.equal((await post('verify', { id: issued.data.id, ...sign('wrong message') })).status, 401);
    const verified = await post('verify', { id: issued.data.id, ...proof });
    assert.equal(verified.status, 200);
    assert.equal((await verified.json()).data.tier, 'PRO');
    const cookie = verified.headers.get('set-cookie');
    assert.ok(cookie && cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict'));
    const headers = { cookie: cookie.split(';')[0]! };
    assert.equal((await post('verify', { id: issued.data.id, ...proof })).status, 401);
    ownsNft = false;
    assert.equal((await (await fetch(`${base}/current`, { headers })).json()).data.tier, 'FREE');
    databaseFailure = true;
    assert.equal((await fetch(`${base}/current`, { headers })).status, 503);
    databaseFailure = false;
    assert.equal((await fetch(`${base}/logout`, { method: 'POST', headers })).status, 200);
    assert.equal((await (await fetch(`${base}/current`, { headers })).json()).data.authenticated, false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previous === undefined) delete process.env.CARDYX_SUBSCRIPTION_NFT_POLICIES;
    else process.env.CARDYX_SUBSCRIPTION_NFT_POLICIES = previous;
  }
});