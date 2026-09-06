'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Cip30Api,
  decodeLovelace,
  detectWallets,
  normalizeAddress,
} from '../lib/cip30';

export interface WalletState {
  /** Wallet-Key (z.B. "eternl"), sobald verbunden */
  key: string | null;
  /** Anzeigename der Wallet (z.B. "Eternl") */
  name: string | null;
  /** Primäre Adresse (bech32, addr1…) */
  address: string | null;
  /** ADA-Guthaben (aus CBOR-Balance dekodiert) */
  balanceAda: number | null;
  /** Netzwerk: 1 = Mainnet, 0 = Testnet */
  networkId: number | null;
  /** Verbindungsaufbau läuft gerade */
  connecting: boolean;
  /** Rohe CIP-30-API für spätere Tx-Signierung (Phase 7) */
  api: Cip30Api | null;
  connect: (walletKey: string) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

const STORAGE_KEY = 'cardyx.wallet';

/**
 * Globaler Wallet-Kontext: Hält die CIP-30-Verbindung, stellt Adresse und
 * Guthaben bereit und stellt die Session nach einem Reload wieder her.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [balanceAda, setBalanceAda] = useState<number | null>(null);
  const [networkId, setNetworkId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [api, setApi] = useState<Cip30Api | null>(null);

  const connect = useCallback(async (walletKey: string) => {
    // Unterstützt auch Unter-Instanzen wie "typhon.cip30"
    const wallet = walletKey.split('.').reduce<any>((acc, part) => acc?.[part], window.cardano);
    if (!wallet || typeof wallet.enable !== 'function') {
      throw new Error('Wallet nicht gefunden.');
    }

    setConnecting(true);
    try {
      const enabledApi = await wallet.enable();

      // Adresse: bevorzugt genutzte Adresse, sonst Change-Adresse
      let rawAddress: string | null = null;
      try {
        const used = await enabledApi.getUsedAddresses();
        rawAddress = used[0] ?? null;
      } catch {
        /* manche Wallets liefern keine used addresses */
      }
      if (!rawAddress) {
        rawAddress = await enabledApi.getChangeAddress();
      }

      // Guthaben & Netzwerk parallel
      const [balanceCbor, netId] = await Promise.all([
        enabledApi.getBalance().catch(() => '0'),
        enabledApi.getNetworkId().catch(() => 1),
      ]);

      setApi(enabledApi);
      setKey(walletKey);
      setName(wallet.name);
      setAddress(rawAddress ? normalizeAddress(rawAddress) : null);
      setBalanceAda(balanceCbor && balanceCbor !== '0' ? decodeLovelace(balanceCbor) / 1_000_000 : 0);
      setNetworkId(netId);

      // Session merken (nur der Wallet-Key – niemals sensible Daten!)
      try {
        localStorage.setItem(STORAGE_KEY, walletKey);
      } catch {
        /* Storage voll/blockiert – kein Problem */
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setApi(null);
    setKey(null);
    setName(null);
    setAddress(null);
    setBalanceAda(null);
    setNetworkId(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignorieren */
    }
  }, []);

  // Session-Wiederherstellung nach Reload
  useEffect(() => {
    let cancelled = false;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const wallet = saved.split('.').reduce<any>((acc, part) => acc?.[part], window.cardano);
        if (wallet && typeof wallet.isEnabled === 'function') {
          wallet.isEnabled()
            .then((enabled: boolean) => {
              if (enabled && !cancelled) connect(saved);
            })
            .catch(() => {
              /* Wallet nicht mehr freigegeben */
            });
        }
      }
    } catch {
      /* kein Storage-Zugriff */
    }
    return () => {
      cancelled = true;
    };
  }, [connect]);

  const value = useMemo<WalletState>(
    () => ({
      key,
      name,
      address,
      balanceAda,
      networkId,
      connecting,
      api,
      connect,
      disconnect,
    }),
    [key, name, address, balanceAda, networkId, connecting, api, connect, disconnect]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/** Hook für den Zugriff auf die Wallet-Verbindung. */
export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet muss innerhalb von <WalletProvider> genutzt werden.');
  return ctx;
}

/** Erkannte Wallets (für das Auswahl-Modal). */
export function useDetectedWallets() {
  const [wallets, setWallets] = useState(() => detectWallets());

  useEffect(() => {
    // Wallet-Erweiterungen injizieren teilweise verzögert → einmal nachladen
    const timer = setTimeout(() => setWallets(detectWallets()), 600);
    return () => clearTimeout(timer);
  }, []);

  return wallets;
}
