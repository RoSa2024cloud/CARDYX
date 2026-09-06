// CIP-30 Cardano Wallet Connector
//
// Implementiert den Cardano-Standard (CIP-30) für Browser-Wallets:
// Erkennt installierte Wallets (Eternl, Lace, Nami, Flint, Typhon, …),
// stellt die Verbindung her und liest Adresse & ADA-Guthaben aus.
//
// SICHERHEIT (siehe MASTERPLAN §14): CARDYX fragt niemals Seed Phrases
// oder Private Keys ab. Der Connector nutzt ausschließlich die öffentliche
// window.cardano-API der Wallet-Erweiterung.

// ---------------------------------------------------------------------------
// CIP-30 Typdefinitionen (Minimal-Subset, das CARDYX benötigt)
// ---------------------------------------------------------------------------

export interface Cip30Api {
  getUsedAddresses(): Promise<string[]>;
  getUnusedAddresses(): Promise<string[]>;
  getChangeAddress(): Promise<string>;
  getBalance(): Promise<string>; // CBOR-hex
  getNetworkId(): Promise<number>;
  signTx(tx: string, partialSign?: boolean): Promise<string>;
  submitTx(tx: string): Promise<string>;
}

interface Cip30WalletInfo {
  apiVersion: string;
  enable(): Promise<Cip30Api>;
  icon: string;
  isEnabled(): Promise<boolean>;
  name: string;
}

declare global {
  interface Window {
    cardano?: Record<string, Cip30WalletInfo | undefined>;
  }
}

// ---------------------------------------------------------------------------
// Erkennung installierter Wallets
// ---------------------------------------------------------------------------

/** Offizielle, kuratierte Wallet-Liste (Name & Icon kommen von der Wallet selbst). */
const KNOWN_WALLETS = [
  'eternl',
  'lace',
  'nami',
  'flint',
  'typhon',
  'gerowallet',
  'yoroi',
  'nufi',
  'begin',
  'vespr',
];

export interface DetectedWallet {
  key: string;
  name: string;
  icon: string;
}

/**
 * Findet alle im Browser installierten CIP-30-Wallets.
 * Manche Wallets (z.B. VESPR) registrieren sich unter mehreren Keys
 * (vespr, vespr_testnet, …) – dedupliziert wird deshalb nach Anzeigename.
 */
export function detectWallets(): DetectedWallet[] {
  if (typeof window === 'undefined' || !window.cardano) return [];

  const byName = new Map<string, DetectedWallet>();

  // Typhon-Sonderlocke: window.cardano.typhon ist ein Objekt, das
  // Unter-Instanzen (cip30, …) enthält – die eigentliche Wallet steckt tiefer.
  const rawKeys = Object.keys(window.cardano).flatMap((key) => {
    const entry = window.cardano![key] as any;
    if (entry && typeof entry.enable !== 'function' && typeof entry === 'object') {
      // Unter-Keys mit echter CIP-30-API einsammeln (z.B. typhon.cip30)
      return Object.keys(entry)
        .filter((sub) => typeof entry[sub]?.enable === 'function')
        .map((sub) => `${key}.${sub}`);
    }
    return [key];
  });

  const resolveWallet = (path: string): Cip30WalletInfo | undefined => {
    return path.split('.').reduce<any>((acc, part) => acc?.[part], window.cardano);
  };

  // Bekannte Wallets zuerst prüfen (für stabile Reihenfolge & Haupt-Key-Priorität)
  const ordered = [
    ...KNOWN_WALLETS.filter((k) => rawKeys.some((rk) => rk === k || rk.startsWith(`${k}.`))),
    ...rawKeys.filter((k) => !KNOWN_WALLETS.some((kw) => k === kw || k.startsWith(`${kw}.`))),
  ];

  for (const key of ordered) {
    const wallet = resolveWallet(key);
    if (
      wallet &&
      typeof wallet.enable === 'function' &&
      typeof wallet.name === 'string' &&
      typeof wallet.icon === 'string'
    ) {
      const normalized = wallet.name.trim().toLowerCase();
      // Erste (bekannte/priorisierte) Variante des Namens gewinnt
      if (!byName.has(normalized)) {
        byName.set(normalized, { key, name: wallet.name, icon: wallet.icon });
      }
    }
  }

  return Array.from(byName.values());
}

// ---------------------------------------------------------------------------
// CBOR-Decodierung (minimal, ohne externe Abhängigkeit)
// ---------------------------------------------------------------------------

/** Liest einen CBOR-Uint-Wert an Position i, gibt [Wert, neue Position] zurück. */
function cborUint(bytes: Uint8Array, i: number, addl: number): [number, number] {
  if (addl < 24) return [addl, i];
  if (addl === 24) return [bytes[i], i + 1];
  if (addl === 25) return [(bytes[i] << 8) | bytes[i + 1], i + 2];
  if (addl === 26)
    return [((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0, i + 4];
  // addl === 27 → 64-bit; ADA-Beträge passen locker in Number (2^53)
  let v = 0;
  for (let k = 0; k < 8; k++) v = v * 256 + bytes[i + k];
  return [v, i + 8];
}

/**
 * Dekodiert das CBOR-hex aus getBalance() zur Lovelace-Summe.
 * Format: entweder `uint` (nur ADA) oder `[uint, multiasset]`.
 */
export function decodeLovelace(cborHex: string): number {
  try {
    const bytes = new Uint8Array(cborHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    const major = bytes[0] >> 5;
    const addl = bytes[0] & 31;
    if (major === 0) {
      return cborUint(bytes, 1, addl)[0];
    }
    if (major === 4) {
      // Array: erstes Element ist die Lovelace-Menge
      const majorInner = bytes[1] >> 5;
      if (majorInner === 0) {
        return cborUint(bytes, 2, bytes[1] & 31)[0];
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

/** Wandelt Cardano-Adressen (Bytes, hex oder bech32) in bech32 um. */
export function normalizeAddress(raw: string): string {
  // Bereits bech32?
  if (raw.startsWith('addr1') || raw.startsWith('addr_test1')) return raw;

  // Hex-kodierte Bytes → bech32 (minimale Implementierung)
  try {
    const bytes = new Uint8Array(raw.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    return bech32Encode(raw.startsWith('addr_test') ? 'addr_test' : 'addr', bytes);
  } catch {
    return raw;
  }
}

// --- Minimale bech32-Implementierung (BIP-0173) ---

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values: number[]): number {
  const gen = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= gen[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (const c of hrp) ret.push(c.charCodeAt(0) >> 5);
  ret.push(0);
  for (const c of hrp) ret.push(c.charCodeAt(0) & 31);
  return ret;
}

function convertBits(data: Uint8Array, from: number, to: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) ret.push((acc << (to - bits)) & maxv);
  return ret;
}

function bech32Encode(hrp: string, data: Uint8Array): string {
  const fiveBit = convertBits(data, 8, 5, true);
  const values = [...bech32HrpExpand(hrp), ...fiveBit];
  const polymod = bech32Polymod([...values, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum: number[] = [];
  for (let i = 0; i < 6; i++) {
    checksum.push((polymod >> (5 * (5 - i))) & 31);
  }
  return hrp + '1' + [...fiveBit, ...checksum].map((d) => BECH32_CHARSET[d]).join('');
}
