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

export interface LimitOrderPayload {
  token_in: string;
  token_out: string;
  amount_in: number;
  wanted_price: number;
  multiples?: number;
  dex?: string;
  blacklisted_dexes?: string[];
}

export interface DcaPayload {
  user_address: string;
  token_in: string;
  token_out: string;
  amount_in: number;
  interval: 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  interval_length: number;
  slippage: number;
  cycles: number;
  dex_allowlist?: string[];
}

export type DexhunterChartPeriod = '1min' | '5min' | '15min' | '1hour' | '4hour' | '1day';

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

function validateLimitOrder(payload: LimitOrderPayload): LimitOrderPayload {
  const amount = Number(payload.amount_in);
  const wantedPrice = Number(payload.wanted_price);
  const multiples = Number(payload.multiples ?? 1);
  if (!payload.token_out || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Ungültige Limitorder: Ziel-Asset und positiver Betrag sind erforderlich.');
  }
  if (!Number.isFinite(wantedPrice) || wantedPrice <= 0) {
    throw new Error('Der Limitpreis muss eine positive ADA-pro-Token-Angabe sein.');
  }
  if (!Number.isInteger(multiples) || multiples < 1 || multiples > 20) {
    throw new Error('Die Anzahl der Limitorder-Teile muss zwischen 1 und 20 liegen.');
  }
  return {
    token_in: payload.token_in ?? '',
    token_out: payload.token_out,
    amount_in: amount,
    wanted_price: wantedPrice,
    multiples,
    ...(payload.dex ? { dex: payload.dex } : {}),
    blacklisted_dexes: Array.isArray(payload.blacklisted_dexes) ? payload.blacklisted_dexes : [],
  };
}

function validateDca(payload: DcaPayload): DcaPayload {
  const amount = Number(payload.amount_in);
  const intervalLength = Number(payload.interval_length);
  const slippage = Number(payload.slippage);
  const cycles = Number(payload.cycles);
  const intervals = ['minutely', 'hourly', 'daily', 'weekly', 'monthly'];
  if (!/^addr1[0-9a-z]{20,}$/i.test(payload.user_address)) {
    throw new Error('Ungültige Cardano-Mainnet-Adresse.');
  }
  if (!payload.token_out || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Ungültige DCA-Order: Ziel-Asset und positiver Gesamtbetrag sind erforderlich.');
  }
  if (!intervals.includes(payload.interval) || !Number.isInteger(intervalLength) || intervalLength < 1 || intervalLength > 30) {
    throw new Error('Ungültiges DCA-Intervall.');
  }
  if (!Number.isInteger(cycles) || cycles < 1 || cycles > 1000) {
    throw new Error('Die Anzahl der DCA-Ausführungen muss zwischen 1 und 1000 liegen.');
  }
  if (!Number.isFinite(slippage) || slippage < 0.1 || slippage > 10) {
    throw new Error('Slippage muss zwischen 0,1 % und 10 % liegen.');
  }
  return {
    ...payload,
    token_in: payload.token_in ?? '',
    amount_in: amount,
    interval_length: intervalLength,
    slippage,
    cycles,
    dex_allowlist: Array.isArray(payload.dex_allowlist) ? payload.dex_allowlist : [],
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

/** Quotes a limit order without building its transaction. */
export async function estimateLimitOrder(payload: LimitOrderPayload): Promise<any> {
  return dexhunterRequest('/swap/limit/estimate', validateLimitOrder(payload));
}

/** Builds an unsigned limit order transaction for the connected wallet. */
export async function buildLimitOrder(buyerAddress: string, payload: LimitOrderPayload): Promise<any> {
  if (!/^addr1[0-9a-z]{20,}$/i.test(buyerAddress)) {
    throw new Error('Ungültige Cardano-Mainnet-Adresse.');
  }
  return dexhunterRequest('/swap/limit/build', {
    buyer_address: buyerAddress,
    ...validateLimitOrder(payload),
  });
}

/** Builds an unsigned DCA order transaction for the connected wallet. */
export async function createDcaOrder(payload: DcaPayload): Promise<any> {
  return dexhunterRequest('/dca/create', validateDca(payload));
}

/** Retrieves the user's DCA orders without exposing the partner credential. */
export async function getDcaOrders(address: string): Promise<any> {
  if (!/^addr1[0-9a-z]{20,}$/i.test(address)) {
    throw new Error('Ungültige Cardano-Mainnet-Adresse.');
  }
  const response = await fetch(`${DEXHUNTER_API_URL}/dca/${encodeURIComponent(address)}`, {
    headers: { accept: 'application/json', 'X-Partner-Id': partnerId() },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = data?.message ?? data?.error ?? data ?? `DexHunter antwortet mit HTTP ${response.status}`;
    throw new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
  }
  return data;
}

/** Retrieves open DexHunter limit orders for an ADA/token pair. */
export async function getDexhunterOrderBook(tokenId: string): Promise<any> {
  if (!/^[a-f0-9]{56,120}$/i.test(tokenId)) {
    throw new Error('Ungültige DexHunter-Token-ID.');
  }
  const response = await fetch(`${DEXHUNTER_API_URL}/swap/limit_orders/ADA/${encodeURIComponent(tokenId)}`, {
    headers: { accept: 'application/json', 'X-Partner-Id': partnerId() },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = data?.message ?? data?.error ?? data ?? `DexHunter antwortet mit HTTP ${response.status}`;
    throw new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
  }
  return data;
}

/** Retrieves DexHunter OHLCV candles for the dedicated trading chart. */
export async function getDexhunterCandles(
  tokenId: string,
  period: DexhunterChartPeriod,
  from: number,
  to: number,
): Promise<any> {
  if (!/^[a-f0-9]{56,120}$/i.test(tokenId)) throw new Error('Ungültige DexHunter-Token-ID.');
  const periods: DexhunterChartPeriod[] = ['1min', '5min', '15min', '1hour', '4hour', '1day'];
  if (!periods.includes(period) || !Number.isInteger(from) || !Number.isInteger(to) || from <= 0 || to <= from) {
    throw new Error('Ungültiger Chart-Zeitraum.');
  }
  const response = await fetch('https://charts.dhapi.io/charts', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'X-Partner-Id': partnerId(),
    },
    body: JSON.stringify({ tokenIn: '', tokenOut: tokenId, period, from, to }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = data?.message ?? data?.error ?? data ?? `DexHunter antwortet mit HTTP ${response.status}`;
    throw new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
  }
  return data;
}

/** Builds an unsigned cancellation transaction for a limit or DCA order. */
export async function cancelDexhunterOrder(orderId: string, address: string): Promise<any> {
  if (!orderId.trim() || !/^addr1[0-9a-z]{20,}$/i.test(address)) {
    throw new Error('Order-ID und gültige Cardano-Mainnet-Adresse sind erforderlich.');
  }
  return dexhunterRequest('/swap/cancel', { order_id: orderId, address });
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
