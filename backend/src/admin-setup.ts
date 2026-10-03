import { readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { hashAdminPassword } from './admin.service';

async function main() {
  const [filePath, originValue, username = 'cardyx-admin'] = process.argv.slice(2);
  if (!filePath || !originValue || !/^[a-zA-Z0-9_.-]{3,64}$/.test(username)) throw new Error('Usage: admin-setup.ts ENV_FILE FRONTEND_ORIGIN [USERNAME]');
  if (!process.stdin.isTTY) throw new Error('Run this setup in an interactive terminal. Do not pipe passwords.');
  const origin = new URL(originValue);
  const localHost = origin.hostname === 'localhost' || origin.hostname === '127.0.0.1' || /^192\.168\./.test(origin.hostname) || /^10\./.test(origin.hostname) || /^172\.(?:1[6-9]|2[0-9]|3[01])\./.test(origin.hostname);
  if ((origin.protocol !== 'https:' && !(origin.protocol === 'http:' && localHost)) || originValue !== origin.origin) throw new Error('Use an HTTPS origin, or HTTP on the private local network only.');
  const existing = readFileSync(filePath, 'utf8');
  let muted = false;
  const output = new Writable({ write(chunk, _encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } });
  const terminal = createInterface({ input: process.stdin, output, terminal: true });
  const secret = (prompt: string) => new Promise<string>((resolve) => {
    muted = false;
    terminal.question(prompt, (answer) => { muted = false; process.stdout.write('\n'); resolve(answer); });
    muted = true;
  });
  try {
    process.stdout.write(`Admin username: ${username}\nOrigin: ${origin.origin}\n`);
    const password = await secret('Admin password (at least 16 characters): ');
    if (password.length < 16 || password.length > 256) throw new Error('Password must contain 16 to 256 characters.');
    const confirmation = await secret('Confirm admin password: ');
    if (password !== confirmation) throw new Error('Passwords do not match. No settings were changed.');
    const values = {
      CARDYX_ADMIN_USERNAME: username,
      CARDYX_ADMIN_PASSWORD_HASH: await hashAdminPassword(password),
      ADMIN_ALLOWED_ORIGINS: origin.origin,
      ADMIN_COOKIE_SECURE: origin.protocol === 'https:' ? 'true' : 'false',
      SUBSCRIPTION_COOKIE_SECURE: origin.protocol === 'https:' ? 'true' : 'false',
    };
    const keys = Object.keys(values);
    if (readFileSync(filePath, 'utf8') !== existing) throw new Error('Environment file changed during setup. Please retry; no settings were overwritten.');
    const retained = existing.split(/\r?\n/).filter((line) => !keys.some((key) => new RegExp(`^\\s*${key}\\s*=`).test(line)));
    const updated = `${retained.join('\n').trimEnd()}\n${Object.entries(values).map(([key, value]) => `${key}='${value}'`).join('\n')}\n`;
    const temporary = `${filePath}.admin-${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, updated, { mode: 0o600, flag: 'wx' });
      renameSync(temporary, filePath);
    } finally { rmSync(temporary, { force: true }); }
    process.stdout.write('Admin credentials saved. Restart the API container to activate them.\n');
    if (origin.protocol === 'http:') process.stdout.write('Private-network HTTP mode only. Enable HTTPS before exposing this login publicly.\n');
  } finally { muted = false; terminal.close(); }
}

void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Admin setup failed.'); process.exitCode = 1; });