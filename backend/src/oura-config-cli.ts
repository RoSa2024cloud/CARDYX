import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import pg from 'pg';
import { renderOuraConfig } from './oura-config.service';

const { Pool } = pg;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const webhookToken = process.env.CARDYX_OURA_WEBHOOK_TOKEN;
  const outputPath = process.env.OURA_CONFIG_PATH ?? '/run/oura/daemon.toml';
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  if (!webhookToken) throw new Error('CARDYX_OURA_WEBHOOK_TOKEN is required.');

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query<{ pattern: string | null }>(
      'SELECT pattern FROM cardyx.active_dex_pool_oura_patterns()'
    );
    const config = renderOuraConfig({
      poolPatterns: result.rows.map((row) => row.pattern ?? ''),
      webhookToken,
    });

    await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
    await chmod(dirname(outputPath), 0o700);
    try {
      if (await readFile(outputPath, 'utf8') === config) {
        console.log(`Oura filter unchanged (${result.rows.length} pool addresses).`);
        return;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    const temporaryPath = `${outputPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, config, { encoding: 'utf8', mode: 0o600 });
    await chmod(temporaryPath, 0o400);
    await rename(temporaryPath, outputPath);
    await chmod(outputPath, 0o400);
    console.log(`Oura filter updated (${result.rows.length} pool addresses).`);
  } finally {
    await pool.end();
  }
}

main().catch((error: Error) => {
  console.error(`Oura config generation failed: ${error.message}`);
  process.exitCode = 1;
});