'use client';

import { useState } from 'react';
import { Dog, LogOut, Search, Settings, Wallet } from 'lucide-react';
import WalletConnectModal from './WalletConnectModal';
import { useWallet } from './WalletProvider';

const NAV_LINKS = ['Dashboard', 'Tokens', 'Wallets', 'Analytics', 'Premium', 'API'];

/** Kürzt eine Cardano-Adresse: addr1q8x7…9k2f */
function shortAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 9)}…${address.slice(-4)}`;
}

export default function Navbar() {
  const wallet = useWallet();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#05070d]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        {/* Logo */}
        <a href="#" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-600/20">
            <Dog className="h-5 w-5 text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">
            CARDYX
            <span className="ml-2 hidden text-[10px] font-medium uppercase tracking-widest text-slate-500 lg:inline">
              Cardano Intelligence
            </span>
          </span>
        </a>

        {/* Suche (vorerst dekorativ, wird mit dem Indexer verknüpft) */}
        <div className="relative hidden min-w-0 flex-1 max-w-xs md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Token, Wallet oder Policy suchen…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
          />
        </div>

        {/* Navigation */}
        <nav className="ml-auto hidden items-center gap-5 lg:flex">
          {NAV_LINKS.map((link, i) => (
            <a
              key={link}
              href="#"
              className={`text-[13px] font-medium transition-colors hover:text-white ${
                i === 0
                  ? 'text-white'
                  : link === 'Premium'
                    ? 'text-amber-400/90 hover:text-amber-300'
                    : 'text-slate-400'
              }`}
            >
              {link}
            </a>
          ))}
        </nav>

        {/* Aktionen */}
        <div className="ml-auto flex items-center gap-2 lg:ml-4">
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
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500"
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Connect Wallet</span>
            </button>
          )}
          <button
            type="button"
            aria-label="Einstellungen"
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Wallet-Auswahl */}
      {modalOpen && <WalletConnectModal onClose={() => setModalOpen(false)} />}
    </header>
  );
}
