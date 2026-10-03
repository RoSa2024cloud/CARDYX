'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, BadgeCheck, ChevronDown, ExternalLink, ListChecks, Loader2, LogIn, LogOut, RefreshCw, Save, Settings2, ShieldCheck } from 'lucide-react';
import Navbar from '../components/Navbar';
import { WalletProvider } from '../components/WalletProvider';
import { useLanguage } from '../components/LanguageProvider';
import { useApplicationConfiguration } from '../components/ApplicationConfigurationProvider';
import { useAdminSession } from '../components/AdminSessionProvider';
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from '../lib/subscription';
import { adminRequest, AdminApiError, IMPLEMENTED_FEATURES, type ApplicationConfiguration, type ApplicationSettings, type FeatureKey } from '../lib/application-config';

interface SystemOverview {
  database: string;
  checkedAt: string;
  indexers: Record<string, { isRunning?: boolean; lastRunAt?: string | null; lastRunError?: string | null }>;
}
interface AuditEntry { id: string; username: string; action: string; created_at: string; details: Record<string, unknown> }
type AdminTab = 'nfts' | 'terminal' | 'system' | 'audit';

export default function AdminPage() {
  return <WalletProvider><Suspense fallback={<div className="min-h-screen bg-[#040611]" />}><AdminWorkspace /></Suspense></WalletProvider>;
}

function AdminWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const de = language === 'de';
  const { refresh: refreshApplication } = useApplicationConfiguration();
  const { session, ready, login: loginAdmin, logout: logoutAdmin, refresh: refreshAdmin, error: sessionError } = useAdminSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [configuration, setConfiguration] = useState<ApplicationConfiguration | null>(null);
  const [draft, setDraft] = useState<ApplicationSettings | null>(null);
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const section = searchParams.get('section');
  const selectedFeature = searchParams.get('feature');
  const tab: AdminTab = section === 'terminal' || section === 'system' || section === 'audit' ? section : 'nfts';
  const setTab = (value: AdminTab) => router.replace(`/admin?section=${value}`, { scroll: false });
  const configurationAvailable = draft !== null;

  useEffect(() => {
    if (tab !== 'terminal' || !selectedFeature || !configurationAvailable) return;
    const row = document.getElementById(`admin-feature-${selectedFeature}`);
    row?.scrollIntoView({ block: 'center' });
    row?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }, [tab, selectedFeature, configurationAvailable]);

  useEffect(() => {
    if (!session?.authenticated) return;
    let active = true;
    Promise.all([adminRequest<ApplicationConfiguration>('configuration'), adminRequest<SystemOverview>('overview'), adminRequest<AuditEntry[]>('audit')])
      .then(([settings, status, history]) => { if (active) { setConfiguration(settings); setDraft(structuredClone(settings.settings)); setOverview(status); setAudit(history); setError(null); } })
      .catch((failure: unknown) => { if (active) { if (failure instanceof AdminApiError && failure.status === 401) refreshAdmin(); setError(failure instanceof Error ? failure.message : 'Admin API unavailable.'); } });
    return () => { active = false; };
  }, [session?.authenticated, refreshAdmin]);

  const handleFailure = (failure: unknown) => {
    if (failure instanceof AdminApiError && failure.status === 401) { refreshAdmin(); setDraft(null); }
    setError(failure instanceof Error ? failure.message : 'Admin API unavailable.');
  };
  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    const credentials = { username, password };
    setPassword('');
    try { await loginAdmin(credentials.username, credentials.password); }
    catch (failure) { handleFailure(failure); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true);
    try { await logoutAdmin(); setConfiguration(null); setDraft(null); setAudit([]); setOverview(null); setNotice(null); setError(null); }
    catch (failure) { handleFailure(failure); }
    finally { setBusy(false); }
  };
  const reload = async () => {
    if (draft && configuration && JSON.stringify(draft) !== JSON.stringify(configuration.settings)
      && !window.confirm(de ? 'Ungespeicherte Änderungen verwerfen?' : 'Discard unsaved changes?')) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const [settings, status, history] = await Promise.all([adminRequest<ApplicationConfiguration>('configuration'), adminRequest<SystemOverview>('overview'), adminRequest<AuditEntry[]>('audit')]);
      setConfiguration(settings); setDraft(structuredClone(settings.settings)); setOverview(status); setAudit(history);
    } catch (failure) { handleFailure(failure); }
    finally { setBusy(false); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || !configuration) return;
    if (JSON.stringify(draft.nftPolicies) !== JSON.stringify(configuration.settings.nftPolicies)
      && !window.confirm(de ? 'NFT-Zugangsregeln ändern? Vorhandene Abo-Sitzungen werden neu bewertet.' : 'Change NFT access rules? Existing subscription sessions will be re-evaluated.')) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const saved = await adminRequest<ApplicationConfiguration>('configuration', { method: 'PUT', csrfToken: session?.csrfToken, body: { revision: configuration.revision, settings: draft } });
      setConfiguration(saved); setDraft(structuredClone(saved.settings)); refreshApplication();
      setNotice(de ? `Konfiguration gespeichert · Revision ${saved.revision}` : `Configuration saved · revision ${saved.revision}`);
      setAudit(await adminRequest<AuditEntry[]>('audit'));
    } catch (failure) { handleFailure(failure); }
    finally { setBusy(false); }
  };
  const editPolicy = (tier: Exclude<SubscriptionTier, 'FREE'>, policyId: string) => setDraft((current) => {
    if (!current) return current;
    const nftPolicies = { ...current.nftPolicies };
    if (!policyId.trim()) delete nftPolicies[tier];
    else nftPolicies[tier] = { policyId: policyId.trim(), assetName: nftPolicies[tier]?.assetName ?? null };
    return { ...current, nftPolicies };
  });
  const editAsset = (tier: Exclude<SubscriptionTier, 'FREE'>, assetName: string | null) => setDraft((current) => current?.nftPolicies[tier]
    ? { ...current, nftPolicies: { ...current.nftPolicies, [tier]: { ...current.nftPolicies[tier], assetName } } } : current);
  const editFeature = (key: FeatureKey, update: Partial<ApplicationSettings['features'][FeatureKey]>) => setDraft((current) => current
    ? { ...current, features: { ...current.features, [key]: { ...current.features[key], ...update } } } : current);
  const tabs = [
    { id: 'nfts' as const, label: de ? 'Abo-NFTs' : 'Subscription NFTs', Icon: BadgeCheck },
    { id: 'terminal' as const, label: 'Terminal & Sidebar', Icon: Settings2 },
    { id: 'system' as const, label: de ? 'Systemstatus' : 'System status', Icon: Activity },
    { id: 'audit' as const, label: de ? 'Prüfprotokoll' : 'Audit log', Icon: ListChecks },
  ];
  const dirty = draft && configuration && JSON.stringify(draft) !== JSON.stringify(configuration.settings);
  const field = 'w-full min-w-0 rounded border border-white/15 bg-[#0b1320] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60 disabled:opacity-40';

  return <div className="min-h-screen bg-[#040611] text-slate-200">
    <Navbar onTradeClick={() => router.push('/trade')} />
    <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex flex-wrap items-center gap-4"><Image src="/subscriptions/admin.jpeg" alt="CARDYX Admin" width={258} height={78} priority className="h-14 w-[180px] object-contain" /><div><h1 className="flex items-center gap-2 text-xl font-bold text-white"><ShieldCheck className="h-5 w-5 text-cyan-300" />CARDYX Admin</h1>{session?.authenticated && <p className="mt-1 text-xs text-slate-400">{session.username} · {de ? 'Sitzung bis' : 'Session expires'} {session.expiresAt ? new Date(session.expiresAt).toLocaleTimeString() : '—'}</p>}</div></div>
        <div className="flex items-center gap-3 text-xs"><Link href="/trade" className="flex items-center gap-1 text-slate-300 hover:text-white">Terminal<ExternalLink className="h-3 w-3" /></Link><Link href="/subscription" className="flex items-center gap-1 text-slate-300 hover:text-white">{de ? 'Aboverwaltung' : 'Subscriptions'}<ExternalLink className="h-3 w-3" /></Link>{session?.authenticated && <button type="button" disabled={busy} onClick={() => void logout()} className="flex items-center gap-1 rounded border border-white/15 px-3 py-2 hover:bg-white/5 disabled:opacity-40"><LogOut className="h-3.5 w-3.5" />{de ? 'Abmelden' : 'Log out'}</button>}</div>
      </header>
      {(error || sessionError) && <p role="alert" className="my-4 break-words border-l-2 border-red-400 bg-red-400/5 px-3 py-2 text-sm text-red-300">{error ?? sessionError}</p>}
      {notice && <p role="status" className="my-4 text-sm text-emerald-300">{notice}</p>}
      {!ready ? <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />{de ? 'Admin-Sitzung wird geprüft' : 'Checking admin session'}</div>
        : !session?.authenticated ? <form onSubmit={(event) => void login(event)} className="mx-auto max-w-sm space-y-4 py-10">
          <h2 className="text-base font-semibold">Admin Login</h2>
          {session?.configured === false && <p role="status" className="text-sm text-amber-300">{de ? 'Admin-Zugang am Server noch nicht eingerichtet.' : 'Admin access has not been configured on the server.'}</p>}
          <label className="block text-sm text-slate-300">{de ? 'Benutzername' : 'Username'}<input name="username" autoComplete="username" required minLength={3} maxLength={64} value={username} onChange={(event) => setUsername(event.target.value)} className={`mt-2 ${field}`} /></label>
          <label className="block text-sm text-slate-300">{de ? 'Passwort' : 'Password'}<input name="password" type="password" autoComplete="current-password" required minLength={12} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} className={`mt-2 ${field}`} /></label>
          <button type="submit" disabled={busy || session?.configured === false} className="flex w-full items-center justify-center gap-2 rounded border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}{de ? 'Anmelden' : 'Log in'}</button>
        </form>
          : <>
            <div role="tablist" aria-label={de ? 'Adminbereiche' : 'Admin sections'} className="mt-5 flex gap-1 overflow-x-auto border-b border-white/10">{tabs.map(({ id, label, Icon }) => <button key={id} id={`admin-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`admin-panel-${id}`} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm ${tab === id ? 'border-cyan-300 text-cyan-200' : 'border-transparent text-slate-400 hover:text-white'}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
            <form onSubmit={(event) => void save(event)}>
              <div className="flex flex-wrap items-center justify-between gap-3 py-4"><span className="text-xs text-slate-500">{configuration ? `Revision ${configuration.revision}` : (de ? 'Daten werden geladen' : 'Loading data')}</span><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void reload()} title={de ? 'Daten neu laden' : 'Reload data'} aria-label={de ? 'Daten neu laden' : 'Reload data'} className="rounded border border-white/15 p-2 text-slate-300 disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></button>{['nfts', 'terminal'].includes(tab) && <button type="submit" disabled={busy || !dirty} className="flex items-center gap-2 rounded border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-40"><Save className="h-4 w-4" />{de ? 'Speichern' : 'Save'}</button>}</div></div>
              <section role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
                {tab === 'nfts' && draft && <div className="divide-y divide-white/10">{SUBSCRIPTION_TIERS.map((tier) => <div key={tier} className="grid gap-4 py-5 sm:grid-cols-[180px_minmax(0,1fr)]"><Image src={`/subscriptions/${tier.toLowerCase()}.jpeg`} alt={`${tier} Abo`} width={220} height={60} className="h-14 w-[180px] object-contain" />{tier === 'FREE' ? <p className="self-center text-sm text-slate-400">{de ? 'Ohne NFT-Nachweis' : 'No NFT proof required'}</p> : <div className="grid min-w-0 gap-3"><label className="text-xs text-slate-400">Policy ID<input value={draft.nftPolicies[tier]?.policyId ?? ''} onChange={(event) => editPolicy(tier, event.target.value)} maxLength={56} pattern="[a-fA-F0-9]{56}" className={`mt-1 font-mono ${field}`} /></label><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={draft.nftPolicies[tier]?.assetName == null} disabled={!draft.nftPolicies[tier]} onChange={(event) => editAsset(tier, event.target.checked ? null : '')} className="accent-cyan-400" />{de ? 'Alle Asset-Namen dieser Policy' : 'All asset names under this policy'}</label><label className="text-xs text-slate-400">{de ? 'Asset-Name (Hex)' : 'Asset name (hex)'}<input value={draft.nftPolicies[tier]?.assetName ?? ''} disabled={!draft.nftPolicies[tier] || draft.nftPolicies[tier]?.assetName === null} maxLength={64} pattern="([a-fA-F0-9]{2}){0,32}" onChange={(event) => editAsset(tier, event.target.value)} className={`mt-1 font-mono ${field}`} /></label></div>}</div>)}</div>}
                {tab === 'terminal' && draft && <>
                  <h2 className="text-sm font-semibold text-white">{de ? 'Terminal-Bereiche' : 'Terminal sections'}</h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-b border-white/10 pb-5 sm:grid-cols-4">{Object.keys(draft.terminal).map((key) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.terminal[key as keyof typeof draft.terminal]} onChange={(event) => setDraft((current) => current ? { ...current, terminal: { ...current.terminal, [key]: event.target.checked } } : current)} className="accent-cyan-400" />{{ chart: 'Chart', activity: de ? 'Trades & Halter' : 'Trades & holders', orderbook: 'Orderbook', sentiment: 'Sentiment' }[key]}</label>)}</div>
                  <h2 className="mt-5 text-sm font-semibold text-white">Sidebar</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2 pr-3">{de ? 'Anwendung' : 'Application'}</th><th className="px-3 py-2">{de ? 'Beschriftung' : 'Label'}</th><th className="px-3 py-2">{de ? 'Aktiv' : 'Enabled'}</th><th className="px-3 py-2">{de ? 'Mindestabo' : 'Minimum plan'}</th></tr></thead><tbody>{(Object.keys(draft.features) as FeatureKey[]).map((key) => { const feature = draft.features[key]; const pinned = key === 'dashboard' || key === 'subscriptions'; const implemented = IMPLEMENTED_FEATURES.includes(key); return <tr key={key} id={`admin-feature-${key}`} className={`scroll-mt-24 border-t border-white/5 ${selectedFeature === key ? 'bg-cyan-400/10' : ''}`}><td className="py-3 pr-3 text-slate-400">{key}{!implemented && <span className="ml-2 text-[10px] text-slate-600">{de ? 'Geplant' : 'Planned'}</span>}</td><td className="px-3 py-3"><input aria-label={`${key} ${de ? 'Beschriftung' : 'label'}`} maxLength={64} required value={feature.label} onChange={(event) => editFeature(key, { label: event.target.value })} className={field} /></td><td className="px-3 py-3"><input type="checkbox" aria-label={`${key} ${de ? 'aktiv' : 'enabled'}`} disabled={pinned || !implemented} checked={feature.enabled} onChange={(event) => editFeature(key, { enabled: event.target.checked })} className="accent-cyan-400" /></td><td className="px-3 py-3"><select aria-label={`${key} ${de ? 'Mindestabo' : 'minimum plan'}`} disabled={pinned} value={feature.minimumTier} onChange={(event) => editFeature(key, { minimumTier: event.target.value as SubscriptionTier })} className={field}>{SUBSCRIPTION_TIERS.map((tier) => <option key={tier}>{tier}</option>)}</select></td></tr>; })}</tbody></table></div>
                </>}
                {tab === 'system' && overview && <><div className="flex items-center justify-between border-b border-white/10 py-3 text-sm"><span>PostgreSQL</span><strong className="text-emerald-300">{overview.database}</strong></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-3">Indexer</th><th>Status</th><th>{de ? 'Letzter Lauf' : 'Last run'}</th><th>{de ? 'Fehler' : 'Error'}</th></tr></thead><tbody>{Object.entries(overview.indexers).map(([name, status]) => <tr key={name} className="border-t border-white/5"><td className="py-3 pr-4">{name}</td><td className="pr-4 text-cyan-200">{status.isRunning ? (de ? 'Läuft' : 'Running') : (de ? 'Bereit' : 'Ready')}</td><td className="pr-4 text-slate-400">{status.lastRunAt ? new Date(status.lastRunAt).toLocaleString() : '—'}</td><td className="max-w-[320px] break-words text-red-300">{status.lastRunError ?? '—'}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-slate-500">{new Date(overview.checkedAt).toLocaleString()}</p></>}
                {tab === 'audit' && <div className="divide-y divide-white/10">{audit.length === 0 && <p className="py-6 text-sm text-slate-500">{de ? 'Keine Einträge' : 'No entries'}</p>}{audit.map((entry) => <details key={entry.id} className="py-3"><summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm"><ChevronDown className="h-3 w-3 shrink-0 text-slate-500" /><span className="text-slate-500">{new Date(entry.created_at).toLocaleString()}</span><strong className="text-slate-200">{entry.action}</strong><span className="text-cyan-300">{entry.username}</span></summary><pre className="mt-3 overflow-x-auto rounded bg-white/[0.03] p-3 text-xs text-slate-400">{JSON.stringify(entry.details, null, 2)}</pre></details>)}</div>}
              </section>
            </form>
          </>}
    </main>
  </div>;
}