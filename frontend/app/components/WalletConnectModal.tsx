'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dog, Loader2, ShieldCheck, X } from 'lucide-react';
import { useDetectedWallets, useWallet } from './WalletProvider';

interface WalletConnectModalProps {
  onClose: () => void;
}

/**
 * Wallet-Auswahl: Listet alle installierten CIP-30-Wallets (Eternl, Lace,
 * Nami, …) mit Original-Icons und stellt die Verbindung her.
 * CARDYX fragt niemals Seed Phrases oder Private Keys ab.
 */
export default function WalletConnectModal({ onClose }: WalletConnectModalProps) {
  const wallets = useDetectedWallets();
  const { connect } = useWallet();
  const [connectingKey, setConnectingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConnect = async (key: string) => {
    setConnectingKey(key);
    setError(null);
    try {
      await connect(key);
      onClose();
    } catch (err: any) {
      // Nutzer hat im Wallet-Popup abgelehnt oder ein Fehler ist passiert
      setError(
        err?.info?.includes('declined') || err?.code === -3
          ? 'Verbindung wurde in der Wallet abgelehnt.'
          : 'Verbindung fehlgeschlagen. Bitte erneut versuchen.'
      );
      setConnectingKey(null);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[100] overflow-y-auto p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="Wallet verbinden">
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
      />

      <div className="cardyx-glass-strong fixed inset-0 m-auto h-fit max-h-[calc(100vh-4rem)] w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-2xl">
        {/* Kopf */}
        <div className="flex items-center gap-3 border-b border-cyan-200/10 bg-white/[0.03] px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 via-cyan-400 to-violet-500 shadow-lg shadow-blue-600/30">
            <Dog className="h-5 w-5 text-white" />
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-white">Wallet verbinden</h2>
            <p className="text-[11px] text-slate-500">cDOG braucht nur Lesezugriff (CIP-30)</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fenster schließen"
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Wallet-Liste */}
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto p-4">
          {wallets.length === 0 && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
              <p className="text-sm font-semibold text-slate-300">Keine Wallet gefunden</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Installiere eine Cardano-Wallet-Erweiterung wie Eternl, Lace oder Nami und lade die Seite neu.
              </p>
            </div>
          )}

          {wallets.map((wallet) => (
            <button
              key={wallet.key}
              type="button"
              onClick={() => handleConnect(wallet.key)}
              disabled={connectingKey !== null}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-left transition-colors hover:border-cyan-300/45 hover:bg-cyan-300/10 disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Wallet-Icons kommen als Data-URI von der Erweiterung */}
              <img src={wallet.icon} alt="" className="h-8 w-8 rounded-lg" />
              <span className="flex-1 text-sm font-bold text-white">{wallet.name}</span>
              {connectingKey === wallet.key && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              )}
            </button>
          ))}

          {error && (
            <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Sicherheitshinweis */}
        <div className="flex items-start gap-2 border-t border-white/5 px-5 py-3.5">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
          <p className="text-[10px] leading-relaxed text-slate-500">
            CARDYX fragt niemals Seed Phrases oder Private Keys ab. Die Verbindung erlaubt
            ausschließlich das Lesen von Adresse &amp; Guthaben – jede Transaktion muss
            zusätzlich in deiner Wallet bestätigt werden.
          </p>
        </div>
      </div>
    </div>
  );

  // Portal nach document.body: Die Navbar nutzt backdrop-blur (backdrop-filter),
  // was den position:fixed-Kontext einschränken würde. Vor dem Mount (SSR) nichts rendern.
  if (!mounted) return null;
  return createPortal(modal, document.body);
}
