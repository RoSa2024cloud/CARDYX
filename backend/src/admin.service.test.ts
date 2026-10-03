import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { Pool } from 'pg';
import { createAdminRouter, hashAdminPassword, verifyAdminPassword } from './admin.service';
import { defaultApplicationSettings, readApplicationConfiguration, saveApplicationConfiguration, validateApplicationSettings, type ApplicationConfiguration } from './application-config.service';
import { requireFeatureAccess, requireSubscription } from './subscription.service';

test('application settings reject unknown fields, invalid policies and access-locking configuration', () => {
  const settings = defaultApplicationSettings();
  assert.deepEqual(validateApplicationSettings(settings), settings);
  assert.throws(() => validateApplicationSettings({ ...settings, password: 'untrusted' }));
  assert.throws(() => validateApplicationSettings({ ...settings, nftPolicies: { PRO: { policyId: 'invalid' } } }));
  const invalidTier = structuredClone(settings);
  invalidTier.features.trading.minimumTier = 'ADMIN' as never;
  assert.throws(() => validateApplicationSettings(invalidTier));
  const inaccessible = structuredClone(settings);
  inaccessible.features.subscriptions.enabled = false;
  assert.throws(() => validateApplicationSettings(inaccessible));
});

test('admin access requires configured credentials, its own session and CSRF validation', async () => {
  const keys = ['CARDYX_ADMIN_USERNAME', 'CARDYX_ADMIN_PASSWORD_HASH', 'ADMIN_ALLOWED_ORIGINS', 'ADMIN_COOKIE_SECURE'] as const;
  const previous = keys.map((key) => process.env[key]);
  const sessions = new Map<string, { username: string; version: string; expires_at: string }>();
  const audit: string[] = [];
  let configuration: ApplicationConfiguration | null = null;
  let databaseFailed = false;
  const pool = { query: async (sql: string, values: string[] = []) => {
    if (databaseFailed) throw new Error('Offline');
    if (sql.startsWith('SELECT revision, settings')) return { rows: configuration ? [configuration] : [] };
    if (sql.startsWith('WITH previous')) {
      if (Number(values[1]) !== (configuration?.revision ?? 0)) return { rows: [] };
      configuration = { revision: (configuration?.revision ?? 0) + 1, settings: validateApplicationSettings(JSON.parse(values[0]!)) };
      audit.push('configuration.updated');
      return { rows: [configuration] };
    }
    if (sql.includes('count(*)')) return { rows: [{ count: String(audit.filter((action) => action === 'login.failed').length) }] };
    if (sql.startsWith('INSERT INTO cardyx.admin_audit')) { audit.push(values[1]!); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO cardyx.admin_session')) { sessions.set(values[0]!, { username: values[1]!, version: values[2]!, expires_at: values[3]! }); return { rows: [] }; }
    if (sql.startsWith('SELECT username')) {
      const session = sessions.get(values[0]!);
      return { rows: session && session.version === values[1] && Date.parse(session.expires_at) > Date.now() ? [session] : [] };
    }
    if (sql.includes('DELETE FROM cardyx.admin_session WHERE token_hash')) sessions.delete(values[0]!);
    return { rows: [] };
  } } as unknown as Pool;
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter(pool, () => ({})));
  app.get('/api/trade/test', requireFeatureAccess(pool, 'trading'), (_req, res) => res.json({ success: true }));
  app.post('/api/trade/test', requireFeatureAccess(pool, 'trading'), (_req, res) => res.json({ success: true }));
  app.post('/api/paid/test', requireSubscription(pool, 'PREMIUM'), (_req, res) => res.json({ success: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/admin`;
  const headers = { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-cardyx-admin-request': '1' };
  const login = (username = 'administrator', password = 'test-password-long-enough') => fetch(`${base}/login`, { method: 'POST', headers, body: JSON.stringify({ username, password }) });
  try {
    delete process.env.CARDYX_ADMIN_USERNAME;
    delete process.env.CARDYX_ADMIN_PASSWORD_HASH;
    process.env.ADMIN_ALLOWED_ORIGINS = headers.origin;
    process.env.ADMIN_COOKIE_SECURE = 'true';
    assert.equal((await login()).status, 503);
    process.env.CARDYX_ADMIN_USERNAME = 'administrator';
    process.env.CARDYX_ADMIN_PASSWORD_HASH = await hashAdminPassword('test-password-long-enough');
    assert.equal(await verifyAdminPassword('administrator', 'test-password-long-enough'), true);
    assert.equal(await verifyAdminPassword('stranger', 'test-password-long-enough'), false);
    assert.equal((await fetch(`${base}/overview`)).status, 401);
    assert.equal((await fetch(`${base}/configuration`)).status, 401);
    assert.equal((await fetch(`${base.replace('/api/admin', '/api/trade/test')}`)).status, 200);
    assert.equal((await fetch(`${base}/overview`, { headers: { cookie: `cardyx_subscription=${'a'.repeat(64)}` } })).status, 401);
    assert.equal((await fetch(`${base}/login`, { method: 'POST', headers: { ...headers, origin: 'https://stranger.invalid' }, body: '{}' })).status, 403);
    assert.equal((await login('administrator', 'wrong-password')).status, 401);
    const loggedIn = await login();
    assert.equal(loggedIn.status, 200);
    const cookie = loggedIn.headers.get('set-cookie');
    assert.ok(cookie && cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict') && cookie.includes('Secure') && cookie.includes('Path=/api;'));
    const session = (await loggedIn.json()).data;
    const authenticatedHeaders = { ...headers, cookie: cookie.split(';')[0]!, 'x-cardyx-admin-csrf': session.csrfToken };
    assert.equal((await fetch(`${base}/overview`, { headers: authenticatedHeaders })).status, 200);
    const migrated = await fetch(`${base}/session`, { headers: authenticatedHeaders });
    assert.ok(migrated.headers.get('set-cookie')?.includes('Path=/api;'));
    const settings = defaultApplicationSettings();
    settings.features.trading.minimumTier = 'PRO';
    const save = (revision: number, requestHeaders = authenticatedHeaders) => fetch(`${base}/configuration`, { method: 'PUT', headers: requestHeaders, body: JSON.stringify({ revision, settings }) });
    assert.equal((await save(0, { ...authenticatedHeaders, 'x-cardyx-admin-csrf': '' })).status, 403);
    assert.equal((await save(0)).status, 200);
    assert.equal((await save(0)).status, 409);
    assert.equal(audit.filter((action) => action === 'configuration.updated').length, 1);
    assert.equal((await fetch(`${base.replace('/api/admin', '/api/trade/test')}`)).status, 403);
    assert.equal((await fetch(`${base.replace('/api/admin', '/api/trade/test')}`, { headers: authenticatedHeaders })).status, 200);
    assert.equal((await fetch(`${base.replace('/api/admin', '/api/trade/test')}`, { method: 'POST', headers: authenticatedHeaders })).status, 200);
    assert.equal((await fetch(`${base.replace('/api/admin', '/api/trade/test')}`, { method: 'POST', headers: { ...authenticatedHeaders, origin: 'https://stranger.invalid' } })).status, 403);
    assert.equal((await fetch(`${base.replace('/api/admin', '/api/paid/test')}`, { method: 'POST', headers: authenticatedHeaders })).status, 200);
    assert.equal((await fetch(`${base.replace('/api/admin', '/api/paid/test')}`, { method: 'POST', headers: { ...authenticatedHeaders, origin: 'https://stranger.invalid' } })).status, 403);
    settings.features.trading.minimumTier = 'FREE';
    settings.features.trading.enabled = false;
    assert.equal((await save(1)).status, 200);
    assert.equal((await fetch(`${base.replace('/api/admin', '/api/trade/test')}`)).status, 403);
    assert.equal((await fetch(`${base.replace('/api/admin', '/api/trade/test')}`, { headers: authenticatedHeaders })).status, 200);
    assert.equal((await fetch(`${base.replace('/api/admin', '/api/trade/test')}`, { headers: { cookie: `cardyx_admin=${'b'.repeat(64)}` } })).status, 403);
    assert.equal((await fetch(`${base}/logout`, { method: 'POST', headers: { ...authenticatedHeaders, 'x-cardyx-admin-csrf': 'invalid' } })).status, 403);
    const originalHash = process.env.CARDYX_ADMIN_PASSWORD_HASH;
    process.env.CARDYX_ADMIN_PASSWORD_HASH = await hashAdminPassword('changed-password-long-enough');
    assert.equal((await fetch(`${base}/overview`, { headers: authenticatedHeaders })).status, 401);
    process.env.CARDYX_ADMIN_PASSWORD_HASH = originalHash;
    databaseFailed = true;
    assert.equal((await fetch(`${base}/overview`, { headers: authenticatedHeaders })).status, 503);
    databaseFailed = false;
    const stored = [...sessions.values()][0]!;
    stored.expires_at = new Date(0).toISOString();
    assert.equal((await fetch(`${base}/overview`, { headers: authenticatedHeaders })).status, 401);
    assert.equal((await fetch(`${base.replace('/api/admin', '/api/trade/test')}`, { headers: authenticatedHeaders })).status, 403);
    stored.expires_at = session.expiresAt;
    assert.equal((await fetch(`${base}/logout`, { method: 'POST', headers: authenticatedHeaders })).status, 200);
    assert.equal((await fetch(`${base}/overview`, { headers: authenticatedHeaders })).status, 401);
    assert.equal((await fetch(`${base.replace('/api/admin', '/api/trade/test')}`, { headers: authenticatedHeaders })).status, 403);
    assert.ok(audit.includes('login.failed') && audit.includes('login.success') && audit.includes('logout'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    keys.forEach((key, index) => { const value = previous[index]; if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  }
});

test('PostgreSQL settings revisions and audit writes are atomic', { skip: process.env.CARDYX_TEST_DATABASE !== 'true' }, async () => {
  const database = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
  const client = await database.connect();
  const transactionPool = { query: client.query.bind(client) } as unknown as Pool;
  try {
    await client.query('BEGIN');
    const original = await readApplicationConfiguration(transactionPool);
    const settings = structuredClone(original.settings);
    settings.terminal.sentiment = !settings.terminal.sentiment;
    const saved = await saveApplicationConfiguration(transactionPool, 'regression-test', original.revision, settings);
    assert.ok(saved);
    assert.equal(saved.revision, original.revision + 1);
    assert.equal(await saveApplicationConfiguration(transactionPool, 'regression-test', original.revision, settings), null);
    const logged = await client.query("SELECT details FROM cardyx.admin_audit WHERE username = 'regression-test' AND action = 'configuration.updated' AND (details->>'revision')::integer = $1 ORDER BY id DESC LIMIT 1", [saved.revision]);
    assert.equal(logged.rows[0]?.details.after.terminal.sentiment, settings.terminal.sentiment);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await database.end();
  }
});