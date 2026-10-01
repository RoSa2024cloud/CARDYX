'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DisplayCurrency } from '../lib/tokens';

interface CurrencyContextValue {
  currency: DisplayCurrency;
  setCurrency: (currency: DisplayCurrency) => void;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const STORAGE_KEY = 'cardyx.currency';

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>('ADA');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ADA' || saved === 'USD') setCurrencyState(saved);
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, []);

  const setCurrency = (nextCurrency: DisplayCurrency) => {
    setCurrencyState(nextCurrency);
    try {
      localStorage.setItem(STORAGE_KEY, nextCurrency);
    } catch {
      // Keep the in-memory preference for this session.
    }
  };

  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency muss innerhalb von <CurrencyProvider> genutzt werden.');
  return context;
}