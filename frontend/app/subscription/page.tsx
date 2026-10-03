'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Activity, ArrowLeft, BadgeCheck, Check, Loader2, LogOut, ShieldCheck, Wallet } from 'lucide-react';
import { WalletProvider, useWallet } from '../components/WalletProvider';
import WalletConnectModal from '../components/WalletConnectModal';
import { SubscriptionProvider, useSubscription } from '../components/SubscriptionProvider';
import { useLanguage } from '../components/LanguageProvider';
import { useAdminSession } from '../components/AdminSessionProvider';
import AdminControls from '../components/AdminControls';

export default function SubscriptionPage() {
  return <WalletProvider><SubscriptionProvider><SubscriptionManagement /></SubscriptionProvider></WalletProvider>;
}

function SubscriptionManagement() {
  const { language } = useLanguage();
  const de = language === 'de';
  const wallet = useWallet();
  const subscription = useSubscription();
  const { session: adminSession } = useAdminSession();
  const [walletModal, setWalletModal] = useState(false);

  return <main className="min-h-screen bg-[#020711] text-slate-200">
    <header className="border-b border-cyan-400/20 bg-[#030a1b] px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <Image src="/cardyx-trade-logo.jpeg" alt="CARDYX" width={240} height={50} className="h-auto w-[160px] sm:w-[200px]" priority />
        <div className="flex flex-wrap items-center gap-2"><AdminControls /><Link href="/trade" className="flex items-center gap-2 rounded px-2 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10"><ArrowLeft className="h-4 w-4" /><span>Trading Terminal</span></Link></div>
      </div>
    </header>
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {adminSession?.authenticated && <nav aria-label={de ? 'Admin-Rücknavigation' : 'Admin return navigation'} className="mb-5 flex flex-wrap gap-3 border-b border-white/10 pb-4 text-xs"><Link href="/admin?section=nfts" className="flex items-center gap-2 text-cyan-200 hover:text-white"><ArrowLeft className="h-4 w-4" />{de ? 'Abo-NFT-Regeln' : 'Subscription NFT rules'}</Link><Link href="/admin?section=system" className="flex items-center gap-2 text-cyan-200 hover:text-white"><Activity className="h-4 w-4" />{de ? 'Systemstatus' : 'System status'}</Link></nav>}
      <div className="mb-5 flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-cyan-300" /><h1 className="text-xl font-bold text-white">{de ? 'Aboverwaltung' : 'Subscription Management'}</h1></div>
      <section aria-label={de ? 'Aktuelles Abo' : 'Current subscription'} className="grid gap-5 border-y border-white/10 py-5 md:grid-cols-[300px_minmax(0,1fr)]">
        <div className="self-center"><Image src={`/subscriptions/${subscription.tier.toLowerCase()}.jpeg`} alt={`CARDYX ${subscription.tier}`} width={653} height={206} className="h-auto w-full max-w-[300px] object-contain" priority /></div>
        <div className="min-w-0">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div><dt className="text-slate-500">{de ? 'Aktives Abo' : 'Active plan'}</dt><dd className="mt-1 font-bold text-white">{subscription.tier}</dd></div>
            <div><dt className="text-slate-500">{de ? 'Wallet-Verifikation' : 'Wallet verification'}</dt><dd className={`mt-1 font-semibold ${subscription.authenticated ? 'text-emerald-300' : 'text-slate-400'}`}>{subscription.authenticated ? (de ? 'Verifiziert' : 'Verified') : (de ? 'Nicht verifiziert' : 'Not verified')}</dd></div>
            <div className="col-span-2 min-w-0"><dt className="text-slate-500">Wallet</dt><dd className="mt-1 break-all font-mono text-[11px] text-slate-300">{wallet.address ?? (de ? 'Nicht verbunden' : 'Not connected')}</dd></div>
            <div className="col-span-2"><dt className="text-slate-500">{de ? 'Letzte NFT-Prüfung' : 'Last NFT check'}</dt><dd className="mt-1 text-slate-300">{subscription.checkedAt ? new Date(subscription.checkedAt).toLocaleString(de ? 'de-DE' : 'en-GB') : '-'}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!wallet.address ? <button type="button" onClick={() => setWalletModal(true)} className="flex h-10 w-full items-center justify-center gap-2 rounded border border-cyan-400/40 bg-cyan-400/10 text-xs font-bold text-cyan-100 hover:bg-cyan-400/20 sm:w-[196px]"><Wallet className="h-4 w-4" />{de ? 'Wallet verbinden' : 'Connect wallet'}</button>
              : <button type="button" disabled={subscription.verifying || wallet.networkId !== 1 || !wallet.api?.signData} onClick={() => void subscription.verify()} className="flex h-10 w-full items-center justify-center gap-2 rounded border border-cyan-400/40 bg-cyan-400/10 text-xs font-bold text-cyan-100 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40 sm:w-[196px]">{subscription.verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{de ? 'NFT-Zugang prüfen' : 'Verify NFT access'}</button>}
            {subscription.authenticated && <button type="button" onClick={() => void subscription.logout()} aria-label={de ? 'Abo-Sitzung beenden' : 'End subscription session'} title={de ? 'Abo-Sitzung beenden' : 'End subscription session'} className="flex h-10 w-10 items-center justify-center rounded border border-white/10 text-slate-400 hover:text-white"><LogOut className="h-4 w-4" /></button>}
          </div>
          {wallet.address && wallet.networkId !== 1 && <p role="status" className="mt-3 text-xs text-amber-300">{de ? 'Mainnet-Wallet erforderlich' : 'Mainnet wallet required'}</p>}
          {wallet.address && !wallet.api?.signData && <p role="status" className="mt-3 text-xs text-amber-300">{de ? 'Wallet unterstützt keine Nachrichtensignatur' : 'Wallet does not support message signing'}</p>}
          {subscription.error && <p role="alert" className="mt-3 break-words text-xs text-rose-300">{subscription.error}</p>}
        </div>
      </section>
      <section aria-label={de ? 'Abo-Stufen' : 'Subscription tiers'} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {subscription.plans.map((plan) => <article key={plan.tier} className={`min-w-0 overflow-hidden rounded-md border bg-[#090d14] ${plan.tier === subscription.tier ? 'border-cyan-400/60' : 'border-white/10'}`}>
          <Image src={plan.logo} alt={`CARDYX ${plan.tier}`} width={653} height={206} className="h-auto w-full object-contain" />
          <div className="p-3"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-white">{plan.tier}</h2>{plan.tier === subscription.tier && <span className="flex items-center gap-1 text-[11px] text-cyan-300"><Check className="h-3 w-3" />{de ? 'Aktiv' : 'Active'}</span>}</div>
            <p className="mt-2 text-xs text-slate-400">{plan.tier === 'FREE' ? (de ? 'Standardzugang' : 'Standard access') : plan.configured ? (de ? 'NFT-Policy hinterlegt' : 'NFT policy configured') : (de ? 'NFT noch nicht konfiguriert' : 'NFT not configured yet')}</p>
            {plan.nft && <dl className="mt-3 space-y-2 text-[10px]"><div><dt className="text-slate-500">Policy ID</dt><dd className="mt-1 break-all font-mono text-slate-300">{plan.nft.policyId}</dd></div><div><dt className="text-slate-500">Asset name (hex)</dt><dd className="mt-1 break-all font-mono text-slate-300">{plan.nft.assetName ?? (de ? 'Alle Assets der Policy' : 'All assets under policy')}</dd></div></dl>}
          </div>
        </article>)}
      </section>
    </div>
    {walletModal && <WalletConnectModal onClose={() => setWalletModal(false)} />}
  </main>;
}