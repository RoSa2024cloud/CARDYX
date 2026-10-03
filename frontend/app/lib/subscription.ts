export const SUBSCRIPTION_TIERS = ['FREE', 'BASIC', 'PRO', 'PREMIUM'] as const;
export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number];

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  logo: string;
  configured: boolean;
  nft: { policyId: string; assetName: string | null } | null;
}

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = SUBSCRIPTION_TIERS.map((tier) => ({
  tier, logo: `/subscriptions/${tier.toLowerCase()}.jpeg`, configured: tier === 'FREE', nft: null,
}));

export function hasSubscriptionTier(current: SubscriptionTier, minimum: SubscriptionTier) {
  return SUBSCRIPTION_TIERS.indexOf(current) >= SUBSCRIPTION_TIERS.indexOf(minimum);
}

export async function subscriptionRequest<Data>(path: string, body?: unknown): Promise<Data> {
  const response = await fetch(`/api/subscription/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json.error ?? 'Subscription API unavailable');
  return json.data as Data;
}