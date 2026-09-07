// Cardano Wallet Intelligence via Koios.
// Koios ist eine öffentliche, read-only Cardano-API. Der Service speichert
// keine Wallet-Daten dauerhaft und fragt niemals Schlüssel oder Seed Phrases ab.

const KOIOS_API_URL = 'https://api.koios.rest/api/v1';
const CACHE_TTL_MS = 60_000;

export interface WalletAsset {
  policyId: string;
  assetName: string;
  fingerprint: string;
  quantity: string;
  decimals: number;
  displayQuantity: string;
  kind: 'Token' | 'NFT';
}

export interface WalletTransaction {
  hash: string;
  blockHeight: number;
  blockTime: number;
  epoch: number | null;
}

export interface WalletAnalysis {
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

const cache = new Map<string, { data: WalletAnalysis; fetchedAt: number }>();

function formatQuantity(quantity: string, decimals: number): string {
  const value = Number(quantity) / 10 ** decimals;
  if (!Number.isFinite(value)) return quantity;
  return value.toLocaleString('en-US', { maximumFractionDigits: Math.min(decimals, 6) });
}

async function koiosPost(path: string, body: Record<string, unknown>): Promise<any> {
  const response = await fetch(`${KOIOS_API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Koios antwortet mit HTTP ${response.status}`);
  return response.json();
}

/** Prüft das minimale Mainnet-Adressformat, bevor eine externe Anfrage erfolgt. */
export function isCardanoAddress(address: string): boolean {
  return /^addr1[0-9a-z]{20,}$/i.test(address);
}

/**
 * Aggregiert ADA, Native Assets, NFTs und die letzten bestätigten Aktivitäten.
 * Der 60-Sekunden-Cache verhindert redundante API-Aufrufe beim Reload.
 */
export async function getWalletAnalysis(address: string): Promise<WalletAnalysis> {
  const normalizedAddress = address.trim();
  if (!isCardanoAddress(normalizedAddress)) {
    throw new Error('Bitte eine gültige Cardano-Mainnet-Adresse (addr1...) eingeben.');
  }

  const cached = cache.get(normalizedAddress);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

  const request = { _addresses: [normalizedAddress] };
  const [addressInfo, addressTransactions] = await Promise.all([
    koiosPost('/address_info', request),
    koiosPost('/address_txs', request),
  ]);

  const info = Array.isArray(addressInfo) ? addressInfo[0] : null;
  if (!info) throw new Error('Adresse wurde im Cardano Mainnet nicht gefunden.');

  const assetsByFingerprint = new Map<string, WalletAsset>();
  const utxos = Array.isArray(info.utxo_set) ? info.utxo_set : [];

  for (const utxo of utxos) {
    for (const asset of Array.isArray(utxo.asset_list) ? utxo.asset_list : []) {
      const decimals = Number(asset.decimals) || 0;
      const key = String(asset.fingerprint ?? `${asset.policy_id}${asset.asset_name}`);
      const existing = assetsByFingerprint.get(key);
      const rawQuantity = (BigInt(existing?.quantity ?? '0') + BigInt(asset.quantity ?? '0')).toString();
      assetsByFingerprint.set(key, {
        policyId: String(asset.policy_id ?? ''),
        assetName: String(asset.asset_name ?? ''),
        fingerprint: key,
        quantity: rawQuantity,
        decimals,
        displayQuantity: formatQuantity(rawQuantity, decimals),
        kind: decimals === 0 && rawQuantity === '1' ? 'NFT' : 'Token',
      });
    }
  }

  const allAssets = Array.from(assetsByFingerprint.values()).sort((a, b) => Number(b.quantity) - Number(a.quantity));
  const transactions: WalletTransaction[] = (Array.isArray(addressTransactions) ? addressTransactions : [])
    .slice(0, 20)
    .map((tx: any) => ({
      hash: String(tx.tx_hash ?? ''),
      blockHeight: Number(tx.block_height) || 0,
      blockTime: Number(tx.block_time) || 0,
      epoch: tx.epoch_no == null ? null : Number(tx.epoch_no),
    }));

  const data: WalletAnalysis = {
    address: normalizedAddress,
    stakeAddress: info.stake_address ? String(info.stake_address) : null,
    adaBalance: (Number(info.balance) || 0) / 1_000_000,
    utxoCount: utxos.length,
    assets: allAssets.filter((asset) => asset.kind === 'Token'),
    nfts: allAssets.filter((asset) => asset.kind === 'NFT'),
    transactions,
    transactionCount: Array.isArray(addressTransactions) ? addressTransactions.length : 0,
    lastActivity: transactions[0]?.blockTime ?? null,
    dataSource: 'koios',
    updatedAt: new Date().toISOString(),
  };

  cache.set(normalizedAddress, { data, fetchedAt: Date.now() });
  return data;
}
