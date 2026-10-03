import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Address, BaseAddress, EnterpriseAddress, PublicKey, RewardAddress } from '@emurgo/cardano-serialization-lib-nodejs';
import { COSEKey, Int, Label } from '@emurgo/cardano-message-signing-nodejs';
import verifyDataSignature from '@cardano-foundation/cardano-verify-datasignature';
import { Router, type Request, type RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import { readApplicationConfiguration, SUBSCRIPTION_TIERS, validateNftRules, type NftRules, type SubscriptionTier, type FeatureKey } from './application-config.service';
import { adminOriginAllowed, currentAdmin } from './admin.service';

export { SUBSCRIPTION_TIERS, type SubscriptionTier, type NftRule } from './application-config.service';
const cookieName = 'cardyx_subscription';

export function subscriptionRules(value = process.env.CARDYX_SUBSCRIPTION_NFT_POLICIES ?? '{}'): NftRules {
  return validateNftRules(JSON.parse(value));
}

export function normalizeSubscriptionAddress(value: unknown): { address: string; addressHex: string } {
  if (typeof value !== 'string' || value.length > 200) throw new Error('Invalid wallet address');
  const address = /^[a-f0-9]+$/i.test(value) ? Address.from_hex(value) : Address.from_bech32(value);
  if (address.network_id() !== 1) throw new Error('A Cardano mainnet wallet is required');
  const credential = RewardAddress.from_address(address)?.payment_cred()
    ?? BaseAddress.from_address(address)?.payment_cred()
    ?? EnterpriseAddress.from_address(address)?.payment_cred();
  if (!credential?.to_keyhash()) throw new Error('A key-controlled wallet address is required');
  return { address: address.to_bech32(), addressHex: address.to_hex() };
}

export function validSubscriptionSignature(signature: unknown, key: unknown, message: string, address: string): boolean {
  if (typeof signature !== 'string' || typeof key !== 'string' || signature.length > 8192 || key.length > 2048
    || !/^(?:[a-f0-9]{2})+$/i.test(signature) || !/^(?:[a-f0-9]{2})+$/i.test(key)) return false;
  try {
    const parsedAddress = Address.from_bech32(address);
    const credential = RewardAddress.from_address(parsedAddress)?.payment_cred()
      ?? BaseAddress.from_address(parsedAddress)?.payment_cred()
      ?? EnterpriseAddress.from_address(parsedAddress)?.payment_cred();
    const publicKey = COSEKey.from_bytes(Buffer.from(key, 'hex')).header(Label.new_int(Int.new_i32(-2)))?.as_bytes();
    if (!publicKey || PublicKey.from_bytes(publicKey).hash().to_hex() !== credential?.to_keyhash()?.to_hex()) return false;
    return verifyDataSignature(signature, key, message, address);
  } catch { return false; }
}

export function tierForHoldings(rules: NftRules, holdings: { policy_id: string; asset_name: string; quantity: string }[]): SubscriptionTier {
  for (const tier of ['PREMIUM', 'PRO', 'BASIC'] as const) {
    const rule = rules[tier];
    if (rule && holdings.some((asset) => asset.policy_id === rule.policyId && (rule.assetName === null || asset.asset_name === rule.assetName) && BigInt(asset.quantity) > 0n)) return tier;
  }
  return 'FREE';
}

export async function subscriptionForAddress(pool: Pool, address: string) {
  const rules = (await readApplicationConfiguration(pool)).settings.nftPolicies;
  const policies = Object.values(rules).map((rule) => rule.policyId);
  if (!policies.length) return { tier: 'FREE' as SubscriptionTier, address, configured: false, checkedAt: new Date().toISOString() };
  const result = await pool.query<{ policy_id: string; asset_name: string; quantity: string }>(
    'SELECT * FROM cardyx.subscription_nft_holdings($1, $2)', [address, policies]
  );
  return { tier: tierForHoldings(rules, result.rows), address, configured: true, checkedAt: new Date().toISOString() };
}

function sessionToken(req: Request): string | null {
  const token = req.cookies?.[cookieName] as unknown;
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

async function currentSubscription(pool: Pool, req: Request) {
  const token = sessionToken(req);
  if (!token) return { tier: 'FREE' as SubscriptionTier, address: null, authenticated: false };
  const result = await pool.query<{ address: string }>('SELECT address FROM cardyx.subscription_session WHERE token_hash = $1 AND expires_at > now()', [tokenHash(token)]);
  if (!result.rows[0]) return { tier: 'FREE' as SubscriptionTier, address: null, authenticated: false };
  return { ...await subscriptionForAddress(pool, result.rows[0].address), authenticated: true };
}

export function requireSubscription(pool: Pool, tier: SubscriptionTier): RequestHandler {
  return (req, res, next) => cookieParser()(req, res, async () => {
    try {
      if (await currentAdmin(pool, req)) {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !adminOriginAllowed(req)) {
          res.status(403).json({ success: false, error: 'Admin request origin is not allowed.' }); return;
        }
        next(); return;
      }
      const current = await currentSubscription(pool, req);
      if (SUBSCRIPTION_TIERS.indexOf(current.tier) < SUBSCRIPTION_TIERS.indexOf(tier)) { res.status(403).json({ success: false, error: 'Subscription tier required', requiredTier: tier }); return; }
      next();
    } catch { res.status(503).json({ success: false, error: 'Subscription verification unavailable' }); }
  });
}

export function requireFeatureAccess(pool: Pool, feature: FeatureKey): RequestHandler {
  return (req, res, next) => cookieParser()(req, res, async () => {
    try {
      const admin = await currentAdmin(pool, req);
      if (admin) {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !adminOriginAllowed(req)) {
          res.status(403).json({ success: false, error: 'Admin request origin is not allowed.' }); return;
        }
        next(); return;
      }
      const configuration = await readApplicationConfiguration(pool);
      const access = configuration.settings.features[feature];
      if (!access.enabled) { res.status(403).json({ success: false, error: 'Application is disabled.' }); return; }
      const current = await currentSubscription(pool, req);
      if (SUBSCRIPTION_TIERS.indexOf(current.tier) < SUBSCRIPTION_TIERS.indexOf(access.minimumTier)) { res.status(403).json({ success: false, error: 'Subscription tier required.', requiredTier: access.minimumTier }); return; }
      next();
    } catch { res.status(503).json({ success: false, error: 'Application access verification unavailable.' }); }
  });
}

export function createSubscriptionRouter(pool: Pool) {
  const router = Router();
  router.use(cookieParser());
  router.use(['/challenge', '/verify'], rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }));
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/plans', async (_req, res) => {
    try {
      const rules = (await readApplicationConfiguration(pool)).settings.nftPolicies;
      res.json({ success: true, data: SUBSCRIPTION_TIERS.map((tier) => ({ tier, logo: `/subscriptions/${tier.toLowerCase()}.jpeg`, nft: tier === 'FREE' ? null : rules[tier] ?? null, configured: tier === 'FREE' || !!rules[tier] })) });
    } catch { res.status(503).json({ success: false, error: 'Subscription configuration unavailable' }); }
  });
  router.get('/current', async (req, res) => {
    try { res.json({ success: true, data: await currentSubscription(pool, req) }); }
    catch { res.status(503).json({ success: false, error: 'Subscription verification unavailable' }); }
  });
  router.post('/challenge', async (req, res) => {
    let identity: ReturnType<typeof normalizeSubscriptionAddress>;
    try { identity = normalizeSubscriptionAddress(req.body?.address); }
    catch { res.status(400).json({ success: false, error: 'Valid Cardano mainnet address required' }); return; }
    try {
      const id = randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
      const message = `CARDYX NFT subscription verification\nNetwork: Cardano Mainnet\nAddress: ${identity.address}\nChallenge: ${id}\nNonce: ${randomBytes(32).toString('hex')}\nExpires: ${expiresAt}\nNo transaction or asset transfer is authorized.`;
      await pool.query('DELETE FROM cardyx.subscription_challenge WHERE expires_at < now()');
      await pool.query('DELETE FROM cardyx.subscription_session WHERE expires_at < now()');
      const result = await pool.query(
        `INSERT INTO cardyx.subscription_challenge (address, id, message, expires_at)
         VALUES ($1, $2, $3, $4) ON CONFLICT (address) DO UPDATE SET id = EXCLUDED.id, message = EXCLUDED.message, expires_at = EXCLUDED.expires_at, created_at = now()
         WHERE subscription_challenge.created_at < now() - interval '30 seconds' RETURNING id`,
        [identity.address, id, message, expiresAt]
      );
      if (!result.rowCount) { res.status(429).json({ success: false, error: 'Please wait before requesting another challenge' }); return; }
      res.json({ success: true, data: { id, ...identity, message, payload: Buffer.from(message, 'utf8').toString('hex'), expiresAt } });
    } catch { res.status(503).json({ success: false, error: 'Subscription challenge unavailable' }); }
  });
  router.post('/verify', async (req, res) => {
    if (typeof req.body?.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(req.body.id)) { res.status(400).json({ success: false, error: 'Invalid challenge' }); return; }
    try {
      const challenge = await pool.query<{ address: string; message: string }>(
        'SELECT address, message FROM cardyx.subscription_challenge WHERE id = $1 AND expires_at > now()', [req.body.id]
      );
      const row = challenge.rows[0];
      if (!row || !validSubscriptionSignature(req.body.signature, req.body.key, row.message, row.address)) { res.status(401).json({ success: false, error: 'Wallet signature could not be verified' }); return; }
      const token = randomBytes(32).toString('hex');
      const inserted = await pool.query(
        `WITH consumed AS (DELETE FROM cardyx.subscription_challenge WHERE id = $1 AND expires_at > now() RETURNING address)
         INSERT INTO cardyx.subscription_session (token_hash, address, expires_at) SELECT $2, address, now() + interval '1 hour' FROM consumed RETURNING address`,
        [req.body.id, tokenHash(token)]
      );
      if (!inserted.rowCount) { res.status(401).json({ success: false, error: 'Challenge already used or expired' }); return; }
      res.cookie(cookieName, token, { httpOnly: true, sameSite: 'strict', secure: process.env.SUBSCRIPTION_COOKIE_SECURE !== 'false', maxAge: 60 * 60_000, path: '/api' });
      res.json({ success: true, data: { ...await subscriptionForAddress(pool, row.address), authenticated: true } });
    } catch { res.status(503).json({ success: false, error: 'Subscription verification unavailable' }); }
  });
  router.post('/logout', async (req, res) => {
    try {
      const token = sessionToken(req);
      if (token) await pool.query('DELETE FROM cardyx.subscription_session WHERE token_hash = $1', [tokenHash(token)]);
      res.clearCookie(cookieName, { path: '/api', httpOnly: true, sameSite: 'strict', secure: process.env.SUBSCRIPTION_COOKIE_SECURE !== 'false' });
      res.json({ success: true });
    } catch { res.status(503).json({ success: false, error: 'Logout unavailable' }); }
  });
  return router;
}