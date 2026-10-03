import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import { readApplicationConfiguration, saveApplicationConfiguration, validateApplicationSettings } from './application-config.service';

const cookieName = 'cardyx_admin';
const sessionDurationMs = 30 * 60_000;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const secureCookie = () => process.env.ADMIN_COOKIE_SECURE !== 'false';
const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict' as const, secure: secureCookie(), path: '/api' });
const legacyCookieOptions = () => ({ ...cookieOptions(), path: '/api/admin' });

export async function hashAdminPassword(password: string, salt = randomBytes(16).toString('hex')): Promise<string> {
  const key = await new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, result) => error ? reject(error) : resolve(result)));
  return `scrypt$32768$${salt}$${key.toString('hex')}`;
}

export function adminConfigured(): boolean {
  return /^[a-zA-Z0-9_.-]{3,64}$/.test(process.env.CARDYX_ADMIN_USERNAME ?? '')
    && /^scrypt\$32768\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(process.env.CARDYX_ADMIN_PASSWORD_HASH ?? '');
}

export async function verifyAdminPassword(username: unknown, password: unknown): Promise<boolean> {
  if (!adminConfigured() || typeof username !== 'string' || typeof password !== 'string' || username.length > 64 || password.length > 256) return false;
  const expected = process.env.CARDYX_ADMIN_PASSWORD_HASH!;
  const computed = await hashAdminPassword(password, expected.split('$')[2]);
  return timingSafeEqual(Buffer.from(computed), Buffer.from(expected))
    && timingSafeEqual(Buffer.from(digest(username)), Buffer.from(digest(process.env.CARDYX_ADMIN_USERNAME!)));
}

function credentialsVersion() {
  return digest(`${process.env.CARDYX_ADMIN_USERNAME ?? ''}\0${process.env.CARDYX_ADMIN_PASSWORD_HASH ?? ''}`);
}

function requestToken(req: Request): string | null {
  const token: unknown = req.cookies?.[cookieName];
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

const csrfFor = (token: string) => createHmac('sha256', token).update('CARDYX admin CSRF').digest('hex');

export function adminOriginAllowed(req: Request): boolean {
  const origins = (process.env.ADMIN_ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  return origins.includes(req.get('origin') ?? '');
}

export const adminWriteOrigin: RequestHandler = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { next(); return; }
  if (!adminOriginAllowed(req) || req.get('x-cardyx-admin-request') !== '1') {
    res.status(403).json({ success: false, error: 'Admin request origin is not allowed.' }); return;
  }
  next();
};

export async function currentAdmin(pool: Pool, req: Request): Promise<{ username: string; expiresAt: string; csrfToken: string } | null> {
  const token = requestToken(req);
  if (!token || !adminConfigured()) return null;
  const result = await pool.query<{ username: string; expires_at: Date }>(
    'SELECT username, expires_at FROM cardyx.admin_session WHERE token_hash = $1 AND credentials_version = $2 AND expires_at > now()',
    [digest(token), credentialsVersion()]
  );
  const row = result.rows[0];
  return row ? { username: row.username, expiresAt: new Date(row.expires_at).toISOString(), csrfToken: csrfFor(token) } : null;
}

export function requireAdmin(pool: Pool): RequestHandler {
  return (req, res, next) => cookieParser()(req, res, async () => {
    try {
      const admin = await currentAdmin(pool, req);
      if (!admin) { res.status(401).json({ success: false, error: 'Admin login required.' }); return; }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const csrf = req.get('x-cardyx-admin-csrf') ?? '';
        if (!/^[a-f0-9]{64}$/.test(csrf) || !timingSafeEqual(Buffer.from(csrf), Buffer.from(admin.csrfToken))) {
          res.status(403).json({ success: false, error: 'Admin CSRF validation failed.' }); return;
        }
      }
      res.locals.admin = admin;
      next();
    } catch { res.status(503).json({ success: false, error: 'Admin session verification unavailable.' }); }
  });
}

export async function auditAdmin(pool: Pool, username: string, action: string, details: unknown = {}) {
  await pool.query('INSERT INTO cardyx.admin_audit (username, action, details) VALUES ($1, $2, $3::jsonb)', [username, action, JSON.stringify(details)]);
}

export function createAdminRouter(pool: Pool, overview: () => unknown) {
  const router = Router();
  router.use(cookieParser());
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(adminWriteOrigin);
  router.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }), async (req, res) => {
    if (!adminConfigured()) { res.status(503).json({ success: false, error: 'Admin login has not been configured on the server.' }); return; }
    try {
      const failures = await pool.query<{ count: string }>("SELECT count(*)::text FROM cardyx.admin_audit WHERE action = 'login.failed' AND created_at > now() - interval '15 minutes'");
      if (Number(failures.rows[0]?.count ?? 0) >= 10) { res.status(429).json({ success: false, error: 'Too many login attempts. Please try again later.' }); return; }
      if (!await verifyAdminPassword(req.body?.username, req.body?.password)) {
        await auditAdmin(pool, 'anonymous', 'login.failed');
        res.status(401).json({ success: false, error: 'Invalid username or password.' }); return;
      }
      const username = process.env.CARDYX_ADMIN_USERNAME!;
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + sessionDurationMs).toISOString();
      await pool.query('DELETE FROM cardyx.admin_session WHERE expires_at < now()');
      await auditAdmin(pool, username, 'login.success');
      await pool.query('INSERT INTO cardyx.admin_session (token_hash, username, credentials_version, expires_at) VALUES ($1, $2, $3, $4)', [digest(token), username, credentialsVersion(), expiresAt]);
      res.cookie(cookieName, token, { ...cookieOptions(), maxAge: sessionDurationMs });
      res.clearCookie(cookieName, legacyCookieOptions());
      res.json({ success: true, data: { authenticated: true, username, expiresAt, csrfToken: csrfFor(token) } });
    } catch { res.status(503).json({ success: false, error: 'Admin login unavailable.' }); }
  });
  router.get('/session', async (req, res) => {
    try {
      const session = await currentAdmin(pool, req);
      const token = requestToken(req);
      if (session && token) res.cookie(cookieName, token, { ...cookieOptions(), maxAge: Math.max(0, Date.parse(session.expiresAt) - Date.now()) });
      res.clearCookie(cookieName, legacyCookieOptions());
      res.json({ success: true, data: { configured: adminConfigured(), authenticated: !!session, ...session } });
    }
    catch { res.status(503).json({ success: false, error: 'Admin session unavailable.' }); }
  });
  router.use(requireAdmin(pool));
  router.get('/configuration', async (_req, res) => {
    try { res.json({ success: true, data: await readApplicationConfiguration(pool) }); }
    catch { res.status(503).json({ success: false, error: 'Application configuration unavailable.' }); }
  });
  router.put('/configuration', async (req, res) => {
    let settings: ReturnType<typeof validateApplicationSettings>;
    try {
      if (!Number.isInteger(req.body?.revision) || req.body.revision < 0) throw new Error('Invalid configuration revision.');
      settings = validateApplicationSettings(req.body.settings);
    } catch (error) { res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Invalid settings.' }); return; }
    try {
      const saved = await saveApplicationConfiguration(pool, res.locals.admin.username, req.body.revision, settings);
      if (!saved) { res.status(409).json({ success: false, error: 'Configuration changed. Reload before saving.' }); return; }
      res.json({ success: true, data: saved });
    } catch { res.status(503).json({ success: false, error: 'Configuration could not be saved.' }); }
  });
  router.post('/logout', async (req, res) => {
    try {
      await auditAdmin(pool, res.locals.admin.username, 'logout');
      await pool.query('DELETE FROM cardyx.admin_session WHERE token_hash = $1', [digest(requestToken(req)!)]);
      res.clearCookie(cookieName, cookieOptions());
      res.clearCookie(cookieName, legacyCookieOptions());
      res.json({ success: true, data: null });
    } catch { res.status(503).json({ success: false, error: 'Admin logout unavailable.' }); }
  });
  router.get('/overview', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ success: true, data: { database: 'online', checkedAt: new Date().toISOString(), indexers: overview() } });
    } catch { res.status(503).json({ success: false, error: 'System status unavailable.' }); }
  });
  router.get('/audit', async (_req, res) => {
    try {
      const result = await pool.query('SELECT id::text, username, action, details, created_at FROM cardyx.admin_audit ORDER BY id DESC LIMIT 100');
      res.json({ success: true, data: result.rows });
    } catch { res.status(503).json({ success: false, error: 'Admin audit unavailable.' }); }
  });
  return router;
}