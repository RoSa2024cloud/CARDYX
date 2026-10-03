'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { FEATURE_DEFAULTS, TERMINAL_DEFAULTS, type PublicConfiguration } from '../lib/application-config';

const ConfigurationContext = createContext<{
  configuration: PublicConfiguration; loaded: boolean; error: string | null; refresh: () => void;
} | null>(null);

export function ApplicationConfigurationProvider({ children }: { children: ReactNode }) {
  const [configuration, setConfiguration] = useState<PublicConfiguration>({ revision: 0, features: FEATURE_DEFAULTS, terminal: TERMINAL_DEFAULTS });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let running = false;
    const load = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch('/api/application/configuration', { cache: 'no-store' });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error('Application configuration unavailable.');
        if (active) { setConfiguration(json.data); setError(null); }
      } catch { if (active) setError('Application configuration unavailable.'); }
      finally { running = false; if (active) setLoaded(true); }
    };
    void load();
    const interval = window.setInterval(load, 60_000);
    window.addEventListener('cardyx:configuration-updated', load);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('cardyx:configuration-updated', load); };
  }, []);
  return <ConfigurationContext.Provider value={{ configuration, loaded, error, refresh: () => window.dispatchEvent(new Event('cardyx:configuration-updated')) }}>{children}</ConfigurationContext.Provider>;
}

export function useApplicationConfiguration() {
  const context = useContext(ConfigurationContext);
  if (!context) throw new Error('ApplicationConfigurationProvider required.');
  return context;
}