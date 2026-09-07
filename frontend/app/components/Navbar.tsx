'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { LogOut, Search, Settings, Wallet } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import WalletConnectModal from './WalletConnectModal';
import { useWallet } from './WalletProvider';

/** Kürzt eine Cardano-Adresse: addr1q8x7…9k2f */
function shortAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 9)}…${address.slice(-4)}`;
}

export default function Navbar() {
  const wallet = useWallet();
  const { language, setLanguage } = useLanguage();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.startsWith('addr1')) {
      router.push(`/wallet/${encodeURIComponent(query)}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-400/15 bg-[#05070d]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        {/* Logo */}
        <a href="#" aria-label="CARDYX Dashboard" className="flex shrink-0 items-center gap-2.5">
          <span className="relative h-9 w-9 overflow-hidden rounded-lg border border-cyan-300/30 bg-[#02050b] shadow-lg shadow-cyan-500/15">
            <Image src="/cardyx-logo.jpeg" alt="" fill sizes="36px" className="object-cover object-[50%_20%]" priority />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">
            CARDYX
            <span className="ml-2 hidden text-[10px] font-medium uppercase tracking-widest text-emerald-300/60 lg:inline">
              {language === 'de' ? 'Trade & Analyse Platform' : 'Trade & Analytics Platform'}
            </span>
          </span>
        </a>

        {/* Suche (vorerst dekorativ, wird mit dem Indexer verknüpft) */}
        <form onSubmit={handleSearch} className="relative hidden min-w-0 flex-1 max-w-xs md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={language === 'de' ? 'Token, Wallet oder Policy suchen…' : 'Search token, wallet, or policy…'}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
          />
        </form>

        {/* Aktionen */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {wallet.address ? (
            /* Verbunden: Guthaben + Adresse + Trennen */
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-2.5 rounded-lg border border-blue-500/30 bg-blue-600/10 px-3 py-1.5">
                {wallet.balanceAda !== null && (
                  <span className="text-[13px] font-bold text-white">
                    ₳{wallet.balanceAda.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
                  </span>
                )}
                <span className="h-4 w-px bg-white/10" />
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  {shortAddress(wallet.address)}
                </span>
              </div>
              <button
                type="button"
                onClick={wallet.disconnect}
                title="Wallet trennen"
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:border-red-500/40 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Nicht verbunden: Connect-Button */
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-[13px] font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400"
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">{language === 'de' ? 'Wallet verbinden' : 'Connect Wallet'}</span>
            </button>
          )}
          <button
            type="button"
            aria-label={language === 'de' ? 'Einstellungen' : 'Settings'}
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Wallet-Auswahl */}
      {modalOpen && <WalletConnectModal onClose={() => setModalOpen(false)} />}
      {settingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={language === 'de' ? 'Einstellungen' : 'Settings'}>
          <button type="button" aria-label={language === 'de' ? 'Schließen' : 'Close'} onClick={() => setSettingsOpen(false)} className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <section className="relative w-full max-w-sm rounded-xl border border-cyan-400/20 bg-[#0a0f1c] p-5 shadow-2xl shadow-blue-950/50">
            <h2 className="text-base font-bold text-white">{language === 'de' ? 'Einstellungen' : 'Settings'}</h2>
            <p className="mt-1 text-xs text-slate-500">{language === 'de' ? 'Sprache der Benutzeroberfläche' : 'Interface language'}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {([{ code: 'de', label: 'Deutsch' }, { code: 'en', label: 'English' }] as const).map(({ code, label }) => (
                <button key={code} type="button" onClick={() => { setLanguage(code); setSettingsOpen(false); }} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${language === code ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'}`}>
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </header>
  );
}
