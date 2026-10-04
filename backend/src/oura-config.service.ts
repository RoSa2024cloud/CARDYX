export interface OuraConfigOptions {
  poolPatterns: string[];
  webhookToken: string;
  nodePeer?: string;
  redisUrl?: string;
  webhookUrl?: string;
}

const validPoolPattern = /^(?:addr1[a-z0-9]{20,}|asset1[a-z0-9]{20,})$/;

export function renderOuraConfig(options: OuraConfigOptions): string {
  if (!/^[a-f0-9]{64}$/i.test(options.webhookToken)) throw new Error('Oura webhook token must be a 32-byte hex value.');

  const poolPatterns = [...new Set(options.poolPatterns)].sort();
  if (poolPatterns.length === 0) throw new Error('Oura filter requires at least one active pool pattern.');
  if (poolPatterns.some((pattern) => !validPoolPattern.test(pattern))) {
    throw new Error('Oura filter contains an invalid address or asset fingerprint.');
  }

  const patternList = poolPatterns.map((pattern) => `  ${JSON.stringify(pattern)}`).join(',\n');
  return [
    '[source]',
    'type = "N2N"',
    `peers = [${JSON.stringify(options.nodePeer ?? 'cardyx-cardano-node:3001')}]`,
    '',
    '[intersect]',
    'type = "Tip"',
    '',
    '[[filters]]',
    'type = "SplitBlock"',
    '',
    '[[filters]]',
    'type = "ParseCbor"',
    '',
    '[[filters]]',
    'type = "Select"',
    'skip_uncertain = true',
    '',
    '[filters.predicate]',
    'any = [',
    patternList,
    ']',
    '',
    '[[filters]]',
    'type = "IntoJson"',
    '',
    '[cursor]',
    'type = "Redis"',
    'key = "cardyx:oura:mainnet:pool-events"',
    `url = ${JSON.stringify(options.redisUrl ?? 'redis://cardyx-redis:6379')}`,
    'flush_interval = 1',
    '',
    '[sink]',
    'type = "WebHook"',
    `url = ${JSON.stringify(options.webhookUrl ?? 'http://cardyx-api:4000/api/internal/oura/events')}`,
    `authorization = ${JSON.stringify(`Bearer ${options.webhookToken}`)}`,
    'timeout = 30000',
    '',
    '[retries]',
    'max_retries = 100',
    'backoff_unit_sec = 1',
    'backoff_factor = 2',
    'max_backoff_sec = 60',
    'dismissible = false',
    '',
    '[metrics]',
    'address = "0.0.0.0:9186"',
    '',
  ].join('\n');
}