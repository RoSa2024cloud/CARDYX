export interface DexAsset {
  policyId: string | null;
  assetName: string | null;
  decimals: number;
}

export interface DexPoolRegistryEntry {
  poolId: string;
  dex: string;
  version: string;
  txOutId: string | null;
  poolNft: DexAsset;
  assetA: DexAsset;
  assetB: DexAsset;
  enabled: boolean;
}

export interface DexUtxoValue {
  lovelace: bigint;
  assets: Map<string, bigint>;
  datum: unknown;
}

export interface DecodedPool {
  poolId: string;
  assetA: DexAsset;
  assetB: DexAsset;
  reserveA: bigint;
  reserveB: bigint;
  liquidity: bigint | null;
}

export interface DexProtocolAdapter {
  readonly dex: string;
  readonly version: string;
  decodePool(entry: DexPoolRegistryEntry, utxo: DexUtxoValue): DecodedPool | null;
}

export function assetKey(asset: DexAsset): string {
  return `${asset.policyId ?? ''}:${asset.assetName ?? ''}`;
}

function reserveFor(asset: DexAsset, utxo: DexUtxoValue): bigint | null {
  if (asset.policyId === null && asset.assetName === null) return utxo.lovelace;
  return utxo.assets.get(assetKey(asset)) ?? null;
}

type DatumNode = { constructor?: number; fields?: DatumNode[]; list?: DatumNode[]; bytes?: string; int?: number | string };

function datumAsset(node: DatumNode | undefined): { policyId: string | null; assetName: string | null } | null {
  if (node?.constructor !== 0 || !node.fields || node.fields.length !== 2) return null;
  const policyId = node.fields[0]?.bytes;
  const assetName = node.fields[1]?.bytes;
  if (policyId === undefined || assetName === undefined) return null;
  return { policyId: policyId || null, assetName: assetName || null };
}

function datumInteger(node: DatumNode | undefined): bigint | null {
  if (node?.int === undefined) return null;
  try {
    return BigInt(node.int);
  } catch {
    return null;
  }
}

function datumBytes(node: DatumNode | undefined): string | null {
  return typeof node?.bytes === 'string' ? node.bytes : null;
}

const minswapV1FactoryPolicy = '13aa2accf2e1561723aa26871e071fdf32c867cff7e7d50ad470d62f';
const minswapV1FactoryAssetName = '4d494e53574150';
const minswapV1PoolNftPolicy = '0be55d262b29f564998ff81efe21bdc0022621c12f15af08d0f2ddb1';

export const minswapV1Adapter: DexProtocolAdapter = {
  dex: 'minswap',
  version: 'v1',
  decodePool(entry, utxo) {
    if (entry.poolNft.policyId !== minswapV1PoolNftPolicy) return null;
    if ((utxo.assets.get(assetKey(entry.poolNft)) ?? 0n) <= 0n) return null;
    if (utxo.assets.get(`${minswapV1FactoryPolicy}:${minswapV1FactoryAssetName}`) !== 1n) return null;

    const datum = utxo.datum as DatumNode | null;
    const fields = datum?.constructor === 0 ? datum.fields ?? [] : [];
    if (fields.length < 4) return null;
    const assetA = datumAsset(fields[0]);
    const assetB = datumAsset(fields[1]);
    const liquidity = datumInteger(fields[2]);
    if (!assetA || !assetB || liquidity === null || liquidity <= 0n) return null;
    if (assetA.policyId !== entry.assetA.policyId || assetA.assetName !== entry.assetA.assetName) return null;
    if (assetB.policyId !== entry.assetB.policyId || assetB.assetName !== entry.assetB.assetName) return null;

    const reserveA = reserveFor(entry.assetA, utxo);
    const reserveB = reserveFor(entry.assetB, utxo);
    if (reserveA === null || reserveB === null || reserveA <= 0n || reserveB <= 0n) return null;

    return {
      poolId: entry.poolId,
      assetA: { ...assetA, decimals: entry.assetA.decimals },
      assetB: { ...assetB, decimals: entry.assetB.decimals },
      reserveA,
      reserveB,
      liquidity,
    };
  },
};

/**
 * Minswap V2 pool state is accepted only for explicitly registered pools.
 * The UTxO itself is the authoritative reserve source; the datum decoder is
 * intentionally kept separate until a versioned datum fixture is validated.
 */
export const minswapV2Adapter: DexProtocolAdapter = {
  dex: 'minswap',
  version: 'v2',
  decodePool(entry, utxo) {
    const poolIdentityQuantity = utxo.assets.get(assetKey(entry.poolNft));
    if (!poolIdentityQuantity || poolIdentityQuantity <= 0n) return null;

    const minswapMarkerQuantity = utxo.assets.get(
      'f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c:4d5350'
    );
    if (minswapMarkerQuantity !== 1n) return null;

    const datum = utxo.datum as { constructor?: number; fields?: Array<{ constructor?: number; fields?: unknown[]; bytes?: string; int?: number | string }> } | null;
    const fields = datum?.constructor === 0 ? datum.fields ?? [] : [];
    if (fields.length < 8) return null;

    // Minswap V2: [batcher, assetA, assetB, totalLiquidity, reserveA, reserveB, feeA, feeB, ...]
    const assetA = fields[1] as { fields?: Array<{ bytes?: string }> } | undefined;
    const assetB = fields[2] as { fields?: Array<{ bytes?: string }> } | undefined;
    const assetAFields = assetA?.fields ?? [];
    const assetBFields = assetB?.fields ?? [];
    const datumAssetA = { policyId: assetAFields[0]?.bytes || null, assetName: assetAFields[1]?.bytes || null };
    const datumAssetB = { policyId: assetBFields[0]?.bytes || null, assetName: assetBFields[1]?.bytes || null };
    if (datumAssetA.policyId !== entry.assetA.policyId || datumAssetA.assetName !== entry.assetA.assetName) return null;
    if (datumAssetB.policyId !== entry.assetB.policyId || datumAssetB.assetName !== entry.assetB.assetName) return null;

    const datumReserveA = BigInt(String(fields[4]?.int ?? 0));
    const datumReserveB = BigInt(String(fields[5]?.int ?? 0));
    const liquidity = BigInt(String(fields[3]?.int ?? 0));
    if (datumReserveA <= 0n || datumReserveB <= 0n || liquidity <= 0n) return null;

    const reserveA = reserveFor(entry.assetA, utxo);
    const reserveB = reserveFor(entry.assetB, utxo);
    if (reserveA === null || reserveB === null || reserveA <= 0n || reserveB <= 0n) return null;

    // The pool UTxO includes current order/batcher deltas, therefore the datum
    // reserves may be slightly below the actual UTxO amounts but never above.
    if (datumReserveA > reserveA || datumReserveB > reserveB) return null;

    return {
      poolId: entry.poolId,
      assetA: entry.assetA,
      assetB: entry.assetB,
      reserveA,
      reserveB,
      liquidity,
    };
  },
};

function decodeWingridersPool(
  entry: DexPoolRegistryEntry,
  utxo: DexUtxoValue,
  tokenPolicy: string | null,
  tokenName: string | null,
  exactPoolNftQuantity: boolean
): DecodedPool | null {
  const poolNftQuantity = utxo.assets.get(assetKey(entry.poolNft)) ?? 0n;
  if (exactPoolNftQuantity ? poolNftQuantity !== 1n : poolNftQuantity <= 0n) return null;
  if (tokenPolicy !== entry.assetB.policyId || tokenName !== entry.assetB.assetName) return null;

  const reserveA = reserveFor(entry.assetA, utxo);
  const reserveB = reserveFor(entry.assetB, utxo);
  if (reserveA === null || reserveB === null || reserveA <= 0n || reserveB <= 0n) return null;
  return {
    poolId: entry.poolId,
    assetA: entry.assetA,
    assetB: entry.assetB,
    reserveA,
    reserveB,
    liquidity: null,
  };
}

export const wingridersV2Adapter: DexProtocolAdapter = {
  dex: 'wingriders',
  version: 'v2',
  decodePool(entry, utxo) {
    const datum = utxo.datum as DatumNode | null;
    const fields = datum?.constructor === 0 ? datum.fields ?? [] : [];
    if (fields.length < 5) return null;
    return decodeWingridersPool(entry, utxo, datumBytes(fields[3]), datumBytes(fields[4]), false);
  },
};

export const wingridersV1Adapter: DexProtocolAdapter = {
  dex: 'wingriders',
  version: 'v1',
  decodePool(entry, utxo) {
    const datum = utxo.datum as DatumNode | null;
    const fields = datum?.constructor === 0 ? datum.fields ?? [] : [];
    const tokenNode = fields[1]?.fields?.[0]?.fields?.[1];
    return decodeWingridersPool(entry, utxo, datumBytes(tokenNode?.fields?.[0]), datumBytes(tokenNode?.fields?.[1]), false);
  },
};

export const sundaeswapV1Adapter: DexProtocolAdapter = {
  dex: 'sundaeswap',
  version: 'v1',
  decodePool(entry, utxo) {
    const poolIdentity = entry.poolId.slice(entry.poolId.lastIndexOf('-') + 1);
    if (entry.poolNft.assetName !== `7020${poolIdentity}`) return null;
    if (utxo.assets.get(assetKey(entry.poolNft)) !== 1n) return null;

    const datum = utxo.datum as DatumNode | null;
    const fields = datum?.constructor === 0 ? datum.fields ?? [] : [];
    if (fields.length < 4 || datumBytes(fields[1]) !== poolIdentity) return null;

    const datumAssets = fields[0]?.fields ?? [];
    const datumAssetA = datumAsset(datumAssets[0]);
    const datumAssetB = datumAsset(datumAssets[1]);
    if (!datumAssetA || !datumAssetB) return null;
    if (datumAssetA.policyId !== entry.assetA.policyId || datumAssetA.assetName !== entry.assetA.assetName) return null;
    if (datumAssetB.policyId !== entry.assetB.policyId || datumAssetB.assetName !== entry.assetB.assetName) return null;

    const liquidity = datumInteger(fields[2]);
    if (liquidity === null || liquidity <= 0n) return null;
    const reserveA = reserveFor(entry.assetA, utxo);
    const reserveB = reserveFor(entry.assetB, utxo);
    if (reserveA === null || reserveB === null || reserveA <= 0n || reserveB <= 0n) return null;

    return { poolId: entry.poolId, assetA: entry.assetA, assetB: entry.assetB, reserveA, reserveB, liquidity };
  },
};

export const sundaeswapV3Adapter: DexProtocolAdapter = {
  dex: 'sundaeswap',
  version: 'v3',
  decodePool(entry, utxo) {
    if (utxo.assets.get(assetKey(entry.poolNft)) !== 1n) return null;
    const datum = utxo.datum as DatumNode | null;
    const fields = datum?.constructor === 0 ? datum.fields ?? [] : [];
    if (fields.length < 3) return null;

    const poolIdentity = datumBytes(fields[0]);
    const registeredPoolIdentity = entry.poolNft.assetName?.slice(8);
    if (!poolIdentity || poolIdentity !== registeredPoolIdentity) return null;

    const assetList = fields[1]?.list ?? [];
    const assetAFields = assetList[0]?.list ?? [];
    const assetBFields = assetList[1]?.list ?? [];
    const datumAssetA = { policyId: assetAFields[0]?.bytes || null, assetName: assetAFields[1]?.bytes || null };
    const datumAssetB = { policyId: assetBFields[0]?.bytes || null, assetName: assetBFields[1]?.bytes || null };
    if (datumAssetA.policyId !== entry.assetA.policyId || datumAssetA.assetName !== entry.assetA.assetName) return null;
    if (datumAssetB.policyId !== entry.assetB.policyId || datumAssetB.assetName !== entry.assetB.assetName) return null;

    const liquidity = datumInteger(fields[2]);
    if (liquidity === null || liquidity <= 0n) return null;
    const reserveA = reserveFor(entry.assetA, utxo);
    const reserveB = reserveFor(entry.assetB, utxo);
    if (reserveA === null || reserveB === null || reserveA <= 0n || reserveB <= 0n) return null;

    return { poolId: entry.poolId, assetA: entry.assetA, assetB: entry.assetB, reserveA, reserveB, liquidity };
  },
};

export const muesliswapAmmAdapter: DexProtocolAdapter = {
  dex: 'muesliswap',
  version: 'amm',
  decodePool(entry, utxo) {
    if (utxo.assets.get(assetKey(entry.poolNft)) !== 1n) return null;
    const datum = utxo.datum as DatumNode | null;
    const fields = datum?.constructor === 0 ? datum.fields ?? [] : [];
    if (fields.length < 3) return null;

    const datumAssetA = datumAsset(fields[0]);
    const datumAssetB = datumAsset(fields[1]);
    if (!datumAssetA || !datumAssetB) return null;
    if (datumAssetA.policyId !== entry.assetA.policyId || datumAssetA.assetName !== entry.assetA.assetName) return null;
    if (datumAssetB.policyId !== entry.assetB.policyId || datumAssetB.assetName !== entry.assetB.assetName) return null;

    const liquidity = datumInteger(fields[2]);
    if (liquidity === null || liquidity <= 0n) return null;
    const reserveA = reserveFor(entry.assetA, utxo);
    const reserveB = reserveFor(entry.assetB, utxo);
    if (reserveA === null || reserveB === null || reserveA <= 0n || reserveB <= 0n) return null;

    return { poolId: entry.poolId, assetA: entry.assetA, assetB: entry.assetB, reserveA, reserveB, liquidity };
  },
};

export const splashFeeSwitchAdapter: DexProtocolAdapter = {
  dex: 'splash',
  version: 'fee-switch',
  decodePool(entry, utxo) {
    if (utxo.assets.get(assetKey(entry.poolNft)) !== 1n) return null;

    const datum = utxo.datum as DatumNode | null;
    const fields = datum?.constructor === 0 ? datum.fields ?? [] : [];
    if (fields.length < 10) return null;

    const poolNft = datumAsset(fields[0]);
    const assetA = datumAsset(fields[1]);
    const assetB = datumAsset(fields[2]);
    const liquidityAsset = datumAsset(fields[3]);
    if (!poolNft || !assetA || !assetB || !liquidityAsset?.policyId) return null;
    if (poolNft.policyId !== entry.poolNft.policyId || poolNft.assetName !== entry.poolNft.assetName) return null;
    if (assetA.policyId !== entry.assetA.policyId || assetA.assetName !== entry.assetA.assetName) return null;
    if (assetB.policyId !== entry.assetB.policyId || assetB.assetName !== entry.assetB.assetName) return null;
    if ((utxo.assets.get(assetKey({ ...liquidityAsset, decimals: 0 })) ?? 0n) <= 0n) return null;

    const feeNumerator = datumInteger(fields[4]);
    const treasuryFeeNumerator = datumInteger(fields[5]);
    const treasuryA = datumInteger(fields[6]);
    const treasuryB = datumInteger(fields[7]);
    if (feeNumerator === null || feeNumerator <= 0n || feeNumerator > 100_000n) return null;
    if (treasuryFeeNumerator === null || treasuryFeeNumerator < 0n || treasuryFeeNumerator > feeNumerator) return null;
    if (treasuryA === null || treasuryB === null || treasuryA < 0n || treasuryB < 0n) return null;

    const outputA = reserveFor(entry.assetA, utxo);
    const outputB = reserveFor(entry.assetB, utxo);
    if (outputA === null || outputB === null || outputA <= treasuryA || outputB <= treasuryB) return null;

    return {
      poolId: entry.poolId,
      assetA: entry.assetA,
      assetB: entry.assetB,
      reserveA: outputA - treasuryA,
      reserveB: outputB - treasuryB,
      liquidity: null,
    };
  },
};

export const splashClassicAdapter: DexProtocolAdapter = {
  dex: 'splash',
  version: 'classic',
  decodePool(entry, utxo) {
    if (utxo.assets.get(assetKey(entry.poolNft)) !== 1n) return null;

    const datum = utxo.datum as DatumNode | null;
    const fields = datum?.constructor === 0 ? datum.fields ?? [] : [];
    if (fields.length < 7) return null;

    const poolNft = datumAsset(fields[0]);
    const assetA = datumAsset(fields[1]);
    const assetB = datumAsset(fields[2]);
    const liquidityAsset = datumAsset(fields[3]);
    if (!poolNft || !assetA || !assetB || !liquidityAsset?.policyId || !liquidityAsset.assetName) return null;
    if (poolNft.policyId !== entry.poolNft.policyId || poolNft.assetName !== entry.poolNft.assetName) return null;
    if (assetA.policyId !== entry.assetA.policyId || assetA.assetName !== entry.assetA.assetName) return null;
    if (assetB.policyId !== entry.assetB.policyId || assetB.assetName !== entry.assetB.assetName) return null;
    if ((utxo.assets.get(assetKey({ ...liquidityAsset, decimals: 0 })) ?? 0n) <= 0n) return null;

    const lpFee = datumInteger(fields[4]);
    const liquidityLowerBound = datumInteger(fields[6]);
    if (lpFee === null || lpFee <= 0n || lpFee > 1000n) return null;
    if (liquidityLowerBound === null || liquidityLowerBound < 0n) return null;

    const reserveA = reserveFor(entry.assetA, utxo);
    const reserveB = reserveFor(entry.assetB, utxo);
    if (reserveA === null || reserveB === null || reserveA <= 0n || reserveB <= 0n) return null;

    return {
      poolId: entry.poolId,
      assetA: entry.assetA,
      assetB: entry.assetB,
      reserveA,
      reserveB,
      liquidity: null,
    };
  },
};

export const splashRoyaltyV1Adapter: DexProtocolAdapter = {
  dex: 'splash',
  version: 'royalty-v1',
  decodePool(entry, utxo) {
    if (utxo.assets.get(assetKey(entry.poolNft)) !== 1n) return null;

    const datum = utxo.datum as DatumNode | null;
    const fields = datum?.constructor === 0 ? datum.fields ?? [] : [];
    if (fields.length < 15) return null;

    const poolNft = datumAsset(fields[0]);
    const assetA = datumAsset(fields[1]);
    const assetB = datumAsset(fields[2]);
    const liquidityAsset = datumAsset(fields[3]);
    if (!poolNft || !assetA || !assetB || !liquidityAsset?.policyId || !liquidityAsset.assetName) return null;
    if (poolNft.policyId !== entry.poolNft.policyId || poolNft.assetName !== entry.poolNft.assetName) return null;
    if (assetA.policyId !== entry.assetA.policyId || assetA.assetName !== entry.assetA.assetName) return null;
    if (assetB.policyId !== entry.assetB.policyId || assetB.assetName !== entry.assetB.assetName) return null;
    if ((utxo.assets.get(assetKey({ ...liquidityAsset, decimals: 0 })) ?? 0n) <= 0n) return null;

    const lpFee = datumInteger(fields[4]);
    const treasuryFee = datumInteger(fields[5]);
    const royaltyFee = datumInteger(fields[6]);
    const treasuryA = datumInteger(fields[7]);
    const treasuryB = datumInteger(fields[8]);
    const royaltyA = datumInteger(fields[9]);
    const royaltyB = datumInteger(fields[10]);
    const nonce = datumInteger(fields[14]);
    if (lpFee === null || lpFee <= 0n || lpFee > 100_000n) return null;
    if (treasuryFee === null || royaltyFee === null || treasuryFee < 0n || royaltyFee < 0n) return null;
    if (treasuryFee + royaltyFee > lpFee) return null;
    if ([treasuryA, treasuryB, royaltyA, royaltyB, nonce].some((value) => value === null || value < 0n)) return null;
    if (!fields[11]?.list?.length || typeof fields[12]?.bytes !== 'string' || typeof fields[13]?.bytes !== 'string') return null;

    const outputA = reserveFor(entry.assetA, utxo);
    const outputB = reserveFor(entry.assetB, utxo);
    if (outputA === null || outputB === null) return null;
    const excludedA = treasuryA! + royaltyA!;
    const excludedB = treasuryB! + royaltyB!;
    if (outputA <= excludedA || outputB <= excludedB) return null;

    return {
      poolId: entry.poolId,
      assetA: entry.assetA,
      assetB: entry.assetB,
      reserveA: outputA - excludedA,
      reserveB: outputB - excludedB,
      liquidity: null,
    };
  },
};

const cswapPoolMarker = '63';

export const cswapAdapter: DexProtocolAdapter = {
  dex: 'cswap',
  version: 'v1',
  decodePool(entry, utxo) {
    if (entry.poolNft.assetName !== cswapPoolMarker) return null;
    if (utxo.assets.get(assetKey(entry.poolNft)) !== 1n) return null;

    const datum = utxo.datum as DatumNode | null;
    const fields = datum?.constructor === 0 ? datum.fields ?? [] : [];
    if (fields.length < 8) return null;
    if (datumInteger(fields[0]) === null || (datumInteger(fields[0]) ?? 0n) <= 0n) return null;
    const poolIdentity = entry.poolId.slice(entry.poolId.lastIndexOf('-') + 1);
    if (datumBytes(fields[4]) !== entry.assetB.policyId || datumBytes(fields[5]) !== entry.assetB.assetName) return null;
    if (datumBytes(fields[6]) !== entry.poolNft.policyId || datumBytes(fields[7]) !== poolIdentity) return null;

    const reserveA = reserveFor(entry.assetA, utxo);
    const reserveB = reserveFor(entry.assetB, utxo);
    if (reserveA === null || reserveB === null || reserveA <= 0n || reserveB <= 0n) return null;
    return { poolId: entry.poolId, assetA: entry.assetA, assetB: entry.assetB, reserveA, reserveB, liquidity: datumInteger(fields[0]) };
  },
};

const vyfiPoolNftPolicies = new Set([
  'fe87ca564b467aa6de634aad76368ae6219fd4342b5a2da8a3ded881',
  'c285d6d7e61163b7f7a918f28e450e37d55dc684450d87b96750d8db',
  'fe496bc40d12f5032159a76b0cc4ff1f74e09e34f86bed95357916c8',
  'f7f9777979a2a96777823f149e6696954f43967fc56cfc7095a33f98',
]);

export const vyfiV1Adapter: DexProtocolAdapter = {
  dex: 'vyfi',
  version: 'v1',
  decodePool(entry, utxo) {
    if (!entry.poolNft.policyId || !vyfiPoolNftPolicies.has(entry.poolNft.policyId) || entry.poolNft.assetName !== '') return null;
    if (utxo.assets.get(assetKey(entry.poolNft)) !== 1n) return null;

    const datum = utxo.datum as DatumNode | null;
    const fields = datum?.constructor === 0 ? datum.fields ?? [] : [];
    if (fields.length !== 3) return null;
    const state = fields.map(datumInteger);
    const liquidity = state[0];
    const stateValueA = state[1];
    const stateValueB = state[2];
    if (liquidity === null || liquidity === undefined || liquidity <= 0n) return null;
    if (stateValueA === null || stateValueA === undefined || stateValueA < 0n) return null;
    if (stateValueB === null || stateValueB === undefined || stateValueB < 0n) return null;

    const reserveA = reserveFor(entry.assetA, utxo);
    const reserveB = reserveFor(entry.assetB, utxo);
    if (reserveA === null || reserveB === null || reserveA <= 0n || reserveB <= 0n) return null;

    return { poolId: entry.poolId, assetA: entry.assetA, assetB: entry.assetB, reserveA, reserveB, liquidity };
  },
};

const dexAdapters = new Map<string, DexProtocolAdapter>([
  [`${minswapV1Adapter.dex}:${minswapV1Adapter.version}`, minswapV1Adapter],
  [`${minswapV2Adapter.dex}:${minswapV2Adapter.version}`, minswapV2Adapter],
  [`${wingridersV1Adapter.dex}:${wingridersV1Adapter.version}`, wingridersV1Adapter],
  [`${wingridersV2Adapter.dex}:${wingridersV2Adapter.version}`, wingridersV2Adapter],
  [`${sundaeswapV1Adapter.dex}:${sundaeswapV1Adapter.version}`, sundaeswapV1Adapter],
  [`${sundaeswapV3Adapter.dex}:${sundaeswapV3Adapter.version}`, sundaeswapV3Adapter],
  [`${muesliswapAmmAdapter.dex}:${muesliswapAmmAdapter.version}`, muesliswapAmmAdapter],
  [`${splashClassicAdapter.dex}:${splashClassicAdapter.version}`, splashClassicAdapter],
  [`${splashFeeSwitchAdapter.dex}:${splashFeeSwitchAdapter.version}`, splashFeeSwitchAdapter],
  [`${splashRoyaltyV1Adapter.dex}:${splashRoyaltyV1Adapter.version}`, splashRoyaltyV1Adapter],
  [`${cswapAdapter.dex}:${cswapAdapter.version}`, cswapAdapter],
  [`${vyfiV1Adapter.dex}:${vyfiV1Adapter.version}`, vyfiV1Adapter],
]);

export function getDexAdapter(dex: string, version: string): DexProtocolAdapter | null {
  return dexAdapters.get(`${dex.toLowerCase()}:${version.toLowerCase()}`) ?? null;
}

export function calculateAdaTokenPrice(pool: DecodedPool): {
  policyId: string;
  assetName: string;
  reserveAda: number;
  reserveAsset: number;
  priceAda: number;
} | null {
  const ada = pool.assetA.policyId === null && pool.assetA.assetName === null
    ? { reserve: pool.reserveA, token: pool.assetB }
    : pool.assetB.policyId === null && pool.assetB.assetName === null
      ? { reserve: pool.reserveB, token: pool.assetA }
      : null;
  if (!ada || !ada.token.policyId || !ada.token.assetName) return null;

  const tokenReserve = ada.token === pool.assetA ? pool.reserveA : pool.reserveB;
  const reserveAda = Number(ada.reserve) / 1_000_000;
  const reserveAsset = Number(tokenReserve) / 10 ** ada.token.decimals;
  if (!Number.isFinite(reserveAda) || !Number.isFinite(reserveAsset) || reserveAda <= 0 || reserveAsset <= 0) return null;

  return {
    policyId: ada.token.policyId,
    assetName: ada.token.assetName,
    reserveAda,
    reserveAsset,
    priceAda: reserveAda / reserveAsset,
  };
}
