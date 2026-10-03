import type { Pool } from 'pg';

export const SUBSCRIPTION_TIERS = ['FREE', 'BASIC', 'PRO', 'PREMIUM'] as const;
export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number];
export interface NftRule { policyId: string; assetName: string | null }
export type NftRules = Partial<Record<Exclude<SubscriptionTier, 'FREE'>, NftRule>>;
export const FEATURE_DEFAULTS = {
  dashboard: { label: 'Dashboard', enabled: true, minimumTier: 'FREE' },
  trading: { label: 'Trading Terminal', enabled: true, minimumTier: 'FREE' },
  explorer: { label: 'Token Explorer', enabled: true, minimumTier: 'FREE' },
  portfolio: { label: 'Portfoliotracker', enabled: false, minimumTier: 'FREE' },
  watchlist: { label: 'Watchlist', enabled: false, minimumTier: 'FREE' },
  onchain: { label: 'On-Chain Intelligence', enabled: false, minimumTier: 'FREE' },
  analytics: { label: 'Advanced Analytics', enabled: false, minimumTier: 'FREE' },
  staking: { label: 'Staking', enabled: false, minimumTier: 'FREE' },
  launches: { label: 'Token Launches', enabled: false, minimumTier: 'FREE' },
  pools: { label: 'Liquidity Pools', enabled: false, minimumTier: 'FREE' },
  alerts: { label: 'Alerts & Signals', enabled: false, minimumTier: 'FREE' },
  builders: { label: 'Development tools for Builders', enabled: false, minimumTier: 'FREE' },
  community: { label: 'Community', enabled: true, minimumTier: 'FREE' },
  subscriptions: { label: 'Aboverwaltung', enabled: true, minimumTier: 'FREE' },
} satisfies Record<string, { label: string; enabled: boolean; minimumTier: SubscriptionTier }>;
export type FeatureKey = keyof typeof FEATURE_DEFAULTS;
export const TERMINAL_DEFAULTS = { chart: true, activity: true, orderbook: true, sentiment: true };
export interface ApplicationSettings {
  nftPolicies: NftRules;
  features: Record<FeatureKey, { label: string; enabled: boolean; minimumTier: SubscriptionTier }>;
  terminal: typeof TERMINAL_DEFAULTS;
}
export interface ApplicationConfiguration { revision: number; settings: ApplicationSettings }

export function validateNftRules(parsed: unknown): NftRules {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid NFT rules.');
  const rules: NftRules = {};
  for (const [tier, value] of Object.entries(parsed)) {
    if (!['BASIC', 'PRO', 'PREMIUM'].includes(tier) || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid subscription tier.');
    const rule = value as Record<string, unknown>;
    if (Object.keys(rule).some((key) => !['policyId', 'assetName'].includes(key))) throw new Error('Unknown NFT setting.');
    const { policyId, assetName = null } = rule;
    if (typeof policyId !== 'string' || !/^[a-f0-9]{56}$/i.test(policyId)
      || (assetName !== null && (typeof assetName !== 'string' || !/^(?:[a-f0-9]{2}){0,32}$/i.test(assetName)))) throw new Error('Invalid NFT policy ID or hexadecimal asset name.');
    rules[tier as Exclude<SubscriptionTier, 'FREE'>] = { policyId: policyId.toLowerCase(), assetName: typeof assetName === 'string' ? assetName.toLowerCase() : null };
  }
  return rules;
}

export function defaultApplicationSettings(): ApplicationSettings {
  return { nftPolicies: validateNftRules(JSON.parse(process.env.CARDYX_SUBSCRIPTION_NFT_POLICIES ?? '{}')), features: structuredClone(FEATURE_DEFAULTS), terminal: { ...TERMINAL_DEFAULTS } };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid configuration object.');
  return value as Record<string, unknown>;
}

export function validateApplicationSettings(value: unknown): ApplicationSettings {
  const settings = object(value);
  if (Object.keys(settings).length !== 3 || Object.keys(settings).some((key) => !['nftPolicies', 'features', 'terminal'].includes(key))) throw new Error('Unknown application setting.');
  const features = object(settings.features);
  const terminal = object(settings.terminal);
  if (Object.keys(features).length !== Object.keys(FEATURE_DEFAULTS).length || Object.keys(features).some((key) => !(key in FEATURE_DEFAULTS))) throw new Error('Invalid feature selection.');
  if (Object.keys(terminal).length !== Object.keys(TERMINAL_DEFAULTS).length || Object.keys(terminal).some((key) => !(key in TERMINAL_DEFAULTS) || typeof terminal[key] !== 'boolean')) throw new Error('Invalid terminal setting.');
  const validatedFeatures = {} as ApplicationSettings['features'];
  for (const key of Object.keys(FEATURE_DEFAULTS) as FeatureKey[]) {
    const feature = object(features[key]);
    if (Object.keys(feature).length !== 3 || Object.keys(feature).some((name) => !['label', 'enabled', 'minimumTier'].includes(name))
      || typeof feature.label !== 'string' || !feature.label.trim() || feature.label.length > 64 || /[\x00-\x1f\x7f]/.test(feature.label)
      || typeof feature.enabled !== 'boolean' || !SUBSCRIPTION_TIERS.includes(feature.minimumTier as SubscriptionTier)) throw new Error(`Invalid feature: ${key}.`);
    if (['dashboard', 'subscriptions'].includes(key) && (!feature.enabled || feature.minimumTier !== 'FREE')) throw new Error('Dashboard and subscription management must remain accessible.');
    validatedFeatures[key] = { label: feature.label.trim(), enabled: feature.enabled, minimumTier: feature.minimumTier as SubscriptionTier };
  }
  return { nftPolicies: validateNftRules(settings.nftPolicies), features: validatedFeatures, terminal: terminal as ApplicationSettings['terminal'] };
}

export async function readApplicationConfiguration(pool: Pool): Promise<ApplicationConfiguration> {
  const result = await pool.query<{ revision: number; settings: unknown }>("SELECT revision, settings FROM cardyx.application_configuration WHERE key = 'application'");
  const row = result.rows[0];
  return row ? { revision: row.revision, settings: validateApplicationSettings(row.settings) } : { revision: 0, settings: defaultApplicationSettings() };
}

export async function saveApplicationConfiguration(pool: Pool, username: string, revision: number, settings: ApplicationSettings): Promise<ApplicationConfiguration | null> {
  const result = await pool.query<{ revision: number; settings: ApplicationSettings }>(
    `WITH previous AS (SELECT settings FROM cardyx.application_configuration WHERE key = 'application'),
     saved AS (
       INSERT INTO cardyx.application_configuration (key, revision, settings)
       SELECT 'application', 1, $1::jsonb WHERE $2::integer = 0 OR EXISTS (SELECT 1 FROM previous)
       ON CONFLICT (key) DO UPDATE SET settings = EXCLUDED.settings,
         revision = application_configuration.revision + 1, updated_at = now()
       WHERE application_configuration.revision = $2 RETURNING revision, settings
     ), logged AS (
       INSERT INTO cardyx.admin_audit (username, action, details)
       SELECT $3, 'configuration.updated', jsonb_build_object('before', (SELECT settings FROM previous), 'after', saved.settings, 'revision', saved.revision)
       FROM saved RETURNING id
     ) SELECT saved.revision, saved.settings FROM saved, logged`,
    [JSON.stringify(settings), revision, username]
  );
  return result.rows[0] ?? null;
}