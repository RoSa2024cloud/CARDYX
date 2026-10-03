import type { SubscriptionTier } from './subscription';

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
export const IMPLEMENTED_FEATURES: FeatureKey[] = ['dashboard', 'trading', 'explorer', 'community', 'subscriptions'];
export interface ApplicationSettings {
  nftPolicies: Partial<Record<Exclude<SubscriptionTier, 'FREE'>, { policyId: string; assetName: string | null }>>;
  features: Record<FeatureKey, { label: string; enabled: boolean; minimumTier: SubscriptionTier }>;
  terminal: typeof TERMINAL_DEFAULTS;
}
export interface ApplicationConfiguration { revision: number; settings: ApplicationSettings }
export interface PublicConfiguration {
  revision: number;
  features: ApplicationSettings['features'];
  terminal: ApplicationSettings['terminal'];
}

export interface AdminSession {
  authenticated: boolean;
  configured?: boolean;
  username?: string;
  csrfToken?: string;
  expiresAt?: string;
}
export class AdminApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function adminRequest<Data>(path: string, options: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown; csrfToken?: string } = {}): Promise<Data> {
  const response = await fetch(`/api/admin/${path}`, {
    method: options.method ?? 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-cardyx-admin-request': '1', ...(options.csrfToken ? { 'x-cardyx-admin-csrf': options.csrfToken } : {}) },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const json = await response.json();
  if (!response.ok || !json.success) throw new AdminApiError(json.error ?? 'Admin API unavailable.', response.status);
  return json.data as Data;
}