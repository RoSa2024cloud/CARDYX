'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Boxes,
  CircleAlert,
  Clock3,
  Coins,
  Copy,
  Eye,
  Landmark,
  Layers3,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { API_URL } from '../../lib/api';

interface WalletAsset {
  policyId: string;
  assetName: string;
  fingerprint: string;
  quantity: string;
  decimals: number;
  displayQuantity: string;
  kind: 'Token' | 'NFT';
}

interface WalletTransaction {
  hash: string;
  blockHeight: number;
  blockTime: number;
  epoch: number | null;
}

interface WalletAnalysis {
  address: string;
  stakeAddress: string | null;
  adaBalance: number;
  utxoCount: number;
  assets: WalletAsset[];
  nfts: WalletAsset[];
  transactions: WalletTransaction[];
  transactionCount: number;
  lastActivity: number | null;
  dataSource: 'koios';
  updatedAt: string;
}

export default function WalletExplorerPage() {
  const params = useParams<{ address: string }>();
  const walletAddress = Array.isArray(params.address) ? params.address[0] : params.address;
  const [analysis, setAnalysis] = useState<WalletAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;
    fetch(`${API_URL}/api/wallets/${encodeURIComponent(walletAddress)}/analysis`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error ?? 'Wallet-Daten nicht verfügbar');
        return json.data as WalletAnalysis;
      })
      .then(setAnalysis)
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [walletAddress]);

  const copyAddress = async () => {
    if (!analysis) return;
    await navigator.clipboard.writeText(analysis.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  };

  if (loading) return <WalletLoading />;
  if (error || !analysis) return <WalletError message={error} />;

  return (
    <main className="min-h-screen bg-[#05070d] text-slate-200">
      <header className="border-b border-white/5 bg-[#05070d]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <span className="mx-3 text-slate-700">/</span>
          <span className="text-sm font-semibold text-slate-200">Wallet Explorer</span>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6">
        <section className="border-b border-white/5 pb-7">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-600/20">
                <Wallet className="h-7 w-7 text-white" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-extrabold tracking-tight text-white">Wallet Explorer</h1>
                  <span className="rounded-md border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400">Mainnet</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="max-w-[220px] truncate text-xs text-slate-400 sm:max-w-[560px]">{analysis.address}</code>
                  <button type="button" onClick={copyAddress} className="shrink-0 text-slate-500 transition-colors hover:text-blue-300" title="Adresse kopieren">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  {copied && <span className="text-[10px] font-semibold text-green-400">Kopiert</span>}
                </div>
              </div>
            </div>
            <div className="flex items-end gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">ADA-Bestand</p>
                <p className="mt-1 text-3xl font-extrabold text-white">₳{analysis.adaBalance.toLocaleString('en-US', { maximumFractionDigits: 6 })}</p>
              </div>
              <span className="mb-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">{analysis.utxoCount} UTxOs</span>
            </div>
          </div>
        </section>

        <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric icon={Boxes} label="Native Tokens" value={String(analysis.assets.length)} />
          <Metric icon={Layers3} label="NFTs" value={String(analysis.nfts.length)} />
          <Metric icon={Activity} label="Transaktionen" value={analysis.transactionCount.toLocaleString('de-DE')} />
          <Metric icon={Clock3} label="Letzte Aktivität" value={analysis.lastActivity ? formatDateTime(analysis.lastActivity) : 'Keine Daten'} />
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <Panel title="Token-Bestände" icon={Coins}>
              {analysis.assets.length === 0 ? <EmptyState text="Diese Adresse hält keine weiteren Native Tokens." /> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[580px] text-left">
                    <thead className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                      <tr><th className="pb-3">Asset</th><th className="pb-3">Fingerprint</th><th className="pb-3 text-right">Bestand</th></tr>
                    </thead>
                    <tbody>{analysis.assets.map((asset) => <AssetRow key={asset.fingerprint} asset={asset} />)}</tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="NFTs" icon={Layers3}>
              {analysis.nfts.length === 0 ? <EmptyState text="Diese Adresse hält derzeit keine als NFT klassifizierten Assets." /> : (
                <div className="grid gap-3 sm:grid-cols-2">{analysis.nfts.map((asset) => <NftCard key={asset.fingerprint} asset={asset} />)}</div>
              )}
            </Panel>

            <Panel title="Letzte Transaktionen" icon={Activity}>
              {analysis.transactions.length === 0 ? <EmptyState text="Keine bestätigten Transaktionen gefunden." /> : (
                <div className="divide-y divide-white/5">
                  {analysis.transactions.map((tx) => (
                    <a key={tx.hash} href={`https://cardanoscan.io/transaction/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-white/[0.02]">
                      <div className="min-w-0"><p className="truncate font-mono text-xs text-slate-300">{tx.hash}</p><p className="mt-1 text-[11px] text-slate-600">Block #{tx.blockHeight.toLocaleString('de-DE')}{tx.epoch !== null ? ` · Epoch ${tx.epoch}` : ''}</p></div>
                      <time className="shrink-0 text-xs text-slate-500">{formatDateTime(tx.blockTime)}</time>
                    </a>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <aside className="space-y-6">
            <Panel title="Wallet-Identität" icon={Landmark} compact>
              <Identity label="Adresse" value={analysis.address} />
              <Identity label="Stake-Adresse" value={analysis.stakeAddress ?? 'Nicht verfügbar'} />
              <Identity label="Netzwerk" value="Cardano Mainnet" />
              <Identity label="Datenquelle" value="Koios (Live On-Chain)" />
              <Identity label="Aktualisiert" value={new Date(analysis.updatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} />
            </Panel>

            <Panel title="Portfolio Intelligence" icon={Users} compact>
              <p className="mb-4 text-xs leading-relaxed text-slate-500">Preisbewertung, historische Portfolioentwicklung, Wallet-Aktivitätsprofil und relevante Interaktionen werden nach Anschluss des CARDYX Indexers berechnet.</p>
              {['Portfolio-Wert in ADA / USD', 'Historische Portfolioentwicklung', 'Relevante Interaktionen', 'Wallet-Aktivitätsprofil'].map((item) => <PendingRow key={item} label={item} />)}
            </Panel>

            <Panel title="Wallet Tracking" icon={Eye} compact>
              <p className="text-xs leading-relaxed text-slate-500">Diese Adresse kann im cDOG Radar auf dem Dashboard gespeichert werden. Realtime-Alerts folgen mit Phase 5.</p>
              <Link href="/#wallet-radar" className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-600/10 px-3 py-2 text-xs font-bold text-blue-300 transition-colors hover:bg-blue-600/20">
                <Eye className="h-3.5 w-3.5" /> Im cDOG Radar verwalten
              </Link>
            </Panel>

            <div className="rounded-xl border border-green-500/15 bg-green-500/[0.04] p-4"><div className="flex gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-400" /><p className="text-xs leading-relaxed text-slate-400">Diese Ansicht liest ausschließlich öffentliche On-Chain-Daten. CARDYX fragt niemals Private Keys oder Seed Phrases ab.</p></div></div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Panel({ title, icon: Icon, compact = false, children }: { title: string; icon: LucideIcon; compact?: boolean; children: React.ReactNode }) {
  return <section className={`rounded-xl border border-white/5 bg-white/[0.02] ${compact ? 'p-4' : 'p-5'}`}><h2 className="mb-5 flex items-center gap-2 text-sm font-bold text-white"><Icon className="h-4 w-4 text-blue-400" />{title}</h2>{children}</section>;
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4"><Icon className="h-4 w-4 text-blue-400" /><p className="mt-3 text-lg font-bold text-white">{value}</p><p className="mt-0.5 text-xs text-slate-500">{label}</p></div>;
}

function AssetRow({ asset }: { asset: WalletAsset }) {
  const title = asset.assetName || 'Native Asset';
  return <tr className="border-b border-white/5 last:border-0"><td className="py-3"><p className="font-semibold text-slate-100">{title}</p><p className="mt-0.5 font-mono text-[10px] text-slate-600">{asset.policyId}</p></td><td className="py-3 font-mono text-[11px] text-slate-500">{asset.fingerprint}</td><td className="py-3 text-right font-bold text-slate-200">{asset.displayQuantity}</td></tr>;
}

function NftCard({ asset }: { asset: WalletAsset }) { return <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3"><p className="truncate text-sm font-bold text-white">{asset.assetName || 'Unnamed NFT'}</p><p className="mt-1 break-all font-mono text-[10px] text-slate-600">{asset.fingerprint}</p></div>; }
function Identity({ label, value }: { label: string; value: string }) { return <div className="border-t border-white/5 py-2.5 first:border-t-0 first:pt-0"><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}</dt><dd className="mt-1 break-all font-mono text-[11px] text-slate-300">{value}</dd></div>; }
function PendingRow({ label }: { label: string }) { return <div className="flex justify-between border-t border-white/5 py-2.5 first:border-t-0 first:pt-0"><span className="text-xs text-slate-400">{label}</span><span className="text-[10px] font-semibold text-slate-600">Indexer folgt</span></div>; }
function EmptyState({ text }: { text: string }) { return <p className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-center text-xs text-slate-500">{text}</p>; }
function formatDateTime(unixSeconds: number): string { return new Date(unixSeconds * 1000).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function WalletLoading() { return <main className="min-h-screen bg-[#05070d] p-6"><div className="mx-auto max-w-[1440px] animate-pulse space-y-6"><div className="h-16 rounded-xl bg-white/[0.03]" /><div className="h-24 rounded-xl bg-white/[0.03]" /><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="h-96 rounded-xl bg-white/[0.03]" /><div className="h-96 rounded-xl bg-white/[0.03]" /></div></div></main>; }
function WalletError({ message }: { message: string | null }) { return <main className="flex min-h-screen items-center justify-center bg-[#05070d] px-4 text-slate-200"><div className="max-w-md rounded-2xl border border-red-900/40 bg-red-950/20 p-6 text-center"><CircleAlert className="mx-auto h-7 w-7 text-red-400" /><h1 className="mt-3 text-lg font-bold text-white">Wallet nicht verfügbar</h1><p className="mt-2 text-sm text-slate-400">{message ?? 'Diese Adresse konnte nicht geladen werden.'}</p><Link href="/" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300"><ArrowLeft className="h-4 w-4" /> Zur Übersicht</Link></div></main>; }
