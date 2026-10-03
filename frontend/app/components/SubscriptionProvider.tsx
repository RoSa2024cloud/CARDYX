'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useWallet } from './WalletProvider';
import { normalizeAddress, type Cip30Api } from '../lib/cip30';
import { DEFAULT_SUBSCRIPTION_PLANS, SUBSCRIPTION_TIERS, hasSubscriptionTier, subscriptionRequest, type SubscriptionPlan, type SubscriptionTier } from '../lib/subscription';

interface VerifiedSubscription {
  tier: SubscriptionTier;
  address: string | null;
  authenticated: boolean;
  checkedAt?: string;
}

interface SubscriptionContextValue {
  tier: SubscriptionTier;
  plans: SubscriptionPlan[];
  authenticated: boolean;
  identity: string | null;
  checkedAt: string | null;
  verifying: boolean;
  error: string | null;
  verify: () => Promise<void>;
  logout: () => Promise<void>;
  canAccess: (minimum: SubscriptionTier) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

async function walletIdentity(api: Cip30Api, fallback: string) {
  const rewards = await api.getRewardAddresses?.().catch(() => []) ?? [];
  return normalizeAddress(rewards[0] ?? fallback);
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [plans, setPlans] = useState(DEFAULT_SUBSCRIPTION_PLANS);
  const [session, setSession] = useState<(VerifiedSubscription & { walletAddress: string }) | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestWallet = useRef(wallet.address);
  const previousWallet = useRef<string | null>(null);

  useEffect(() => { latestWallet.current = wallet.address; }, [wallet.address]);

  useEffect(() => {
    let active = true;
    subscriptionRequest<SubscriptionPlan[]>('plans')
      .then((data) => { if (active) setPlans(data); })
      .catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : 'Subscription API unavailable'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let resetSession = previousWallet.current !== null && previousWallet.current !== wallet.address;
    previousWallet.current = wallet.address;
    const address = wallet.address;
    const api = wallet.api;
    const refresh = async () => {
      try {
        if (resetSession) { resetSession = false; await subscriptionRequest('logout', {}); }
        if (!address || !api) return;
        const identity = await walletIdentity(api, address);
        const current = await subscriptionRequest<VerifiedSubscription>('current');
        if (current.authenticated && current.address !== identity) {
          await subscriptionRequest('logout', {});
          if (active) setSession(null);
          return;
        }
        if (active) {
          setSession({ ...current, tier: SUBSCRIPTION_TIERS.includes(current.tier) ? current.tier : 'FREE', walletAddress: address });
          setError(null);
        }
      } catch (failure) {
        if (active) { setSession(null); setError(failure instanceof Error ? failure.message : 'Subscription verification unavailable'); }
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [wallet.address, wallet.api]);

  const logout = async () => {
    setSession(null);
    try { await subscriptionRequest('logout', {}); setError(null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Logout unavailable'); }
  };

  const verify = async () => {
    const address = wallet.address;
    const api = wallet.api;
    if (!address || !api?.signData || wallet.networkId !== 1) { setError('Cardano mainnet wallet with message signing required'); return; }
    setVerifying(true);
    setError(null);
    try {
      const identity = await walletIdentity(api, address);
      const challenge = await subscriptionRequest<{ id: string; addressHex: string; payload: string }>('challenge', { address: identity });
      const proof = await api.signData(challenge.addressHex, challenge.payload);
      if (latestWallet.current !== address) return;
      const verified = await subscriptionRequest<VerifiedSubscription>('verify', { id: challenge.id, ...proof });
      if (latestWallet.current !== address) { await subscriptionRequest('logout', {}); return; }
      setSession({ ...verified, walletAddress: address });
    } catch (failure) {
      setSession(null);
      setError(failure instanceof Error ? failure.message : 'Wallet verification cancelled');
    } finally { setVerifying(false); }
  };

  const current = wallet.address && session?.walletAddress === wallet.address ? session : null;
  const tier = current?.authenticated && SUBSCRIPTION_TIERS.includes(current.tier) ? current.tier : 'FREE';
  return <SubscriptionContext.Provider value={{ tier, plans, authenticated: current?.authenticated ?? false, identity: current?.address ?? null,
    checkedAt: current?.checkedAt ?? null, verifying, error, verify, logout, canAccess: (minimum) => hasSubscriptionTier(tier, minimum) }}>
    {children}
  </SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('SubscriptionProvider required');
  return context;
}