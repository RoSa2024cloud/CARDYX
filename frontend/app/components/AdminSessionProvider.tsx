'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { adminRequest, AdminApiError, type AdminSession } from '../lib/application-config';

interface AdminContextValue {
  session: AdminSession | null;
  ready: boolean;
  error: string | null;
  busy: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);
const sessionEvent = 'cardyx:admin-session-updated';
const storageKey = 'cardyx:admin-session-change';
const refreshSession = () => window.dispatchEvent(new Event(sessionEvent));

function notifyOtherTabs() {
  try { window.localStorage.setItem(storageKey, String(Date.now())); } catch {}
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const changing = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const refresh = async () => {
      if (changing.current) return;
      const request = ++generation.current;
      try {
        const current = await adminRequest<AdminSession>('session');
        if (mounted.current && request === generation.current) {
          setSession(current.authenticated && (!current.expiresAt || Date.parse(current.expiresAt) <= Date.now())
            ? { authenticated: false, configured: current.configured } : current);
          setError(null);
        }
      } catch (failure) {
        if (mounted.current && request === generation.current) { setSession(null); setError(failure instanceof Error ? failure.message : 'Admin session unavailable.'); }
      } finally { if (mounted.current && request === generation.current) setReady(true); }
    };
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey) void refresh(); };
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener(sessionEvent, refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      mounted.current = false;
      generation.current += 1;
      window.clearInterval(interval);
      window.removeEventListener(sessionEvent, refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!session?.authenticated || !session.expiresAt) return;
    const timeout = window.setTimeout(() => {
      generation.current += 1;
      setSession({ authenticated: false, configured: session.configured });
    }, Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [session?.authenticated, session?.expiresAt, session?.configured]);

  const login = async (username: string, password: string) => {
    if (changing.current) return;
    changing.current = true;
    const request = ++generation.current;
    setBusy(true); setError(null);
    try {
      const current = await adminRequest<AdminSession>('login', { method: 'POST', body: { username, password } });
      if (mounted.current && request === generation.current) { setSession(current); setReady(true); notifyOtherTabs(); }
    } catch (failure) {
      if (mounted.current && request === generation.current) { setSession(null); setError(failure instanceof Error ? failure.message : 'Admin login unavailable.'); }
      throw failure;
    } finally { changing.current = false; if (mounted.current) setBusy(false); }
  };

  const logout = async () => {
    if (changing.current) return;
    changing.current = true;
    generation.current += 1;
    setBusy(true); setError(null);
    try {
      await adminRequest('logout', { method: 'POST', csrfToken: session?.csrfToken });
      if (mounted.current) { setSession({ authenticated: false, configured: true }); notifyOtherTabs(); }
    } catch (failure) {
      if (failure instanceof AdminApiError && failure.status === 401) {
        if (mounted.current) { setSession({ authenticated: false, configured: true }); notifyOtherTabs(); }
      } else { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Admin logout unavailable.'); throw failure; }
    } finally { changing.current = false; if (mounted.current) setBusy(false); }
  };

  return <AdminContext.Provider value={{ session, ready, error, busy, login, logout, refresh: refreshSession }}>{children}</AdminContext.Provider>;
}

export function useAdminSession() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('AdminSessionProvider required.');
  return context;
}