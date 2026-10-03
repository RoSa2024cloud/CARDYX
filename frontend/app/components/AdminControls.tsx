'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useAdminSession } from './AdminSessionProvider';
import { useLanguage } from './LanguageProvider';

export default function AdminControls() {
  const { session, logout, busy } = useAdminSession();
  const { language } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const de = language === 'de';
  if (!session?.authenticated) return null;

  const signOut = async () => {
    setError(null);
    try { await logout(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Admin logout unavailable.'); }
  };

  return <div className="relative flex shrink-0 items-center gap-1">
    <Link href="/admin?section=nfts" aria-label={de ? 'Admin-Aboverwaltung' : 'Admin subscription management'} title={de ? 'Admin-Aboverwaltung' : 'Admin subscription management'} className="flex h-9 items-center gap-1.5 rounded border border-cyan-400/30 bg-cyan-400/5 px-2 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/10"><ShieldCheck className="h-4 w-4" /><span className="hidden 2xl:inline">{de ? 'Aboverwaltung' : 'Subscriptions'}</span></Link>
    <button type="button" disabled={busy} onClick={() => void signOut()} aria-label={de ? 'Admin abmelden' : 'Log out admin'} title={de ? 'Admin abmelden' : 'Log out admin'} className="flex h-9 w-9 items-center justify-center rounded text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}</button>
    {error && <p role="alert" className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-32px)] rounded border border-red-400/30 bg-[#081329] p-3 text-xs text-red-300">{error}</p>}
  </div>;
}