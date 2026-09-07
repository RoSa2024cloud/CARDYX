// Sichere serverseitige DexHunter-Partner-Integration.
// Der Partner-Code bleibt ausschließlich im Backend (DEXHUNTER_PARTNER_ID).

const DEXHUNTER_API_URL = 'https://api-us.dexhunterv3.app';

export interface SwapPayload {
  token_in: string;
  token_out: string;
  amount_in: number;
  slippage: number;
  blacklisted_dexes?: string[];
}

function partnerId(): string {
  const id = process.env.DEXHUNTER_PARTNER_ID?.trim();
  if (!id) throw new Error('DexHunter Partner-ID ist im Backend noch nicht konfiguriert.');
  return id;
}

function validateSwap(payload: SwapPayload): SwapPayload {
  const amount = Number(payload.amount_in);
  const slippage = Number(payload.slippage);
  if (!payload.token_out || amount <= 0 || !Number.isFinite(amount)) {
    throw new Error('Ungültiger Swap: Ziel-Asset und positiver Betrag sind erforderlich.');
  }
  if (!Number.isFinite(slippage) || slippage < 0.1 || slippage > 10) {
    throw new Error('Slippage muss zwischen 0,1 % und 10 % liegen.');
  }
  return {
    token_in: payload.token_in ?? '',
    token_out: payload.token_out,
    amount_in: amount,
    slippage,
    blacklisted_dexes: Array.isArray(payload.blacklisted_dexes) ? payload.blacklisted_dexes : [],
  };
}

async function dexhunterRequest(path: string, body: unknown): Promise<any> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${DEXHUNTER_API_URL}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'X-Partner-Id': partnerId(),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);
    if (response.ok) return data;
    if (response.status >= 500 && response.status < 600 && attempt === 0) continue;

    const reason = data?.message ?? data?.error ?? data ?? `DexHunter antwortet mit HTTP ${response.status}`;
    const detail = typeof reason === 'string' ? reason : JSON.stringify(reason);
    throw new Error(`DexHunter ${path}: ${detail}`);
  }

  throw new Error(`DexHunter ${path}: Anfrage fehlgeschlagen.`);
}

/** Sucht handelbare Native Assets im von DexHunter gepflegten Katalog. */
export async function searchDexhunterTokens(query: string): Promise<any> {
  const search = query.trim();
  if (!search) throw new Error('Ein Suchbegriff für den DexHunter-Tokenkatalog ist erforderlich.');

  const response = await fetch(`${DEXHUNTER_API_URL}/swap/tokens?query=${encodeURIComponent(search)}`, {
    headers: {
      accept: 'application/json',
      'X-Partner-Id': partnerId(),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = data?.message ?? data?.error ?? data ?? `DexHunter antwortet mit HTTP ${response.status}`;
    throw new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
  }
  return data;
}

/** Live-Quote ohne Aufbau einer Transaktion. */
export async function estimateSwap(payload: SwapPayload): Promise<any> {
  return dexhunterRequest('/swap/estimate', validateSwap(payload));
}

/** Baut die unsignierte CBOR-Transaktion für eine verbundene Wallet. */
export async function buildSwap(buyerAddress: string, payload: SwapPayload): Promise<any> {
  if (!/^addr1[0-9a-z]{20,}$/i.test(buyerAddress)) {
    throw new Error('Ungültige Cardano-Mainnet-Adresse.');
  }
  return dexhunterRequest('/swap/build', {
    buyer_address: buyerAddress,
    ...validateSwap(payload),
  });
}

/** Fügt die in der Wallet erzeugten Witnesses in die CBOR-Transaktion ein. */
export async function addSwapSignatures(txCbor: string, signatures: string): Promise<any> {
  if (!txCbor || !signatures) throw new Error('Transaktion und Signatur sind erforderlich.');
  return dexhunterRequest('/swap/sign', { txCbor, signatures });
}

/** Gibt nur den Konfigurationsstatus aus, niemals den Partner-Code. */
export function dexhunterConfigured(): boolean {
  return Boolean(process.env.DEXHUNTER_PARTNER_ID?.trim());
}
