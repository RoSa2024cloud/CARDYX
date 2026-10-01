'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChartNoAxesCombined, LogOut, MessageCircle, Search, Settings, Wallet } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import WalletConnectModal from './WalletConnectModal';
import { useWallet } from './WalletProvider';

/** Kürzt eine Cardano-Adresse: addr1q8x7…9k2f */
function shortAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 9)}…${address.slice(-4)}`;
}

export default function Navbar({ onTradeClick, showTradeButton = true }: { onTradeClick: () => void; showTradeButton?: boolean }) {
  const wallet = useWallet();
  const { language, setLanguage } = useLanguage();
  const { currency, setCurrency } = useCurrency();
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
    <header className="sticky top-0 z-50 border-b border-cyan-300/20 bg-[#040611]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" aria-label="CARDYX Home" className="flex shrink-0 items-center gap-2.5">
          <span className="relative h-9 w-9 overflow-hidden rounded-lg border border-cyan-300/40 bg-[#02050b] shadow-lg shadow-blue-500/25">
            <Image src="/cardyx-logo-new.jpeg" alt="" fill sizes="36px" className="object-cover" priority />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">
            CARDYX
            <span className="ml-2 hidden text-[10px] font-medium uppercase tracking-widest text-emerald-300/60 lg:inline">
              {language === 'de' ? 'Trade & Analyse Platform' : 'Trade & Analytics Platform'}
            </span>
          </span>
        </Link>

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

        {showTradeButton && <button
          type="button"
          onClick={onTradeClick}
          aria-label={language === 'de' ? 'Handelsterminal öffnen' : 'Open trade terminal'}
          title={language === 'de' ? 'Handelsterminal öffnen' : 'Open trade terminal'}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-blue-400/40 bg-blue-500/15 px-2.5 text-xs font-bold text-sky-100 transition-colors hover:border-cyan-300/60 hover:bg-blue-500/25"
        >
          <ChartNoAxesCombined className="h-3.5 w-3.5 text-sky-300" />
          <span className="hidden sm:inline">Trading Terminal</span>
        </button>}
        <button
          type="button"
          onClick={() => router.push('/community')}
          aria-label={language === 'de' ? 'Community öffnen' : 'Open community'}
          title={language === 'de' ? 'CARDYX Community' : 'CARDYX Community'}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] px-2.5 text-xs font-semibold text-cyan-100 transition-colors hover:border-cyan-300/50 hover:bg-cyan-400/15"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Community</span>
        </button>

        {/* Aktionen */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.03] p-0.5" role="group" aria-label={language === 'de' ? 'Anzeigewährung' : 'Display currency'}>
            {(['ADA', 'USD'] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                aria-pressed={currency === unit}
                onClick={() => setCurrency(unit)}
                className={`h-full rounded-md px-2 text-[11px] font-bold transition-colors ${currency === unit ? 'bg-cyan-400/20 text-cyan-100' : 'text-slate-500 hover:text-slate-200'}`}
              >
                {unit}
              </button>
            ))}
          </div>
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
                title={language === 'de' ? 'Wallet trennen' : 'Disconnect wallet'}
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
              className="cardyx-accent-button flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-white transition-all hover:brightness-110"
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
          <section className="cardyx-glass-strong relative w-full max-w-sm rounded-xl p-5">
            <h2 className="text-base font-bold text-white">{language === 'de' ? 'Einstellungen' : 'Settings'}</h2>
            <p className="mt-1 text-xs text-slate-500">{language === 'de' ? 'Sprache der Benutzeroberfläche' : 'Interface language'}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {([{ code: 'de', label: 'Deutsch' }, { code: 'en', label: 'English' }] as const).map(({ code, label }) => (
                <button key={code} type="button" onClick={() => {
                  if (code === language) {
                    setSettingsOpen(false);
                    return;
                  }
                  setLanguage(code);
                  window.location.reload();
                }} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${language === code ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'}`}>
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
