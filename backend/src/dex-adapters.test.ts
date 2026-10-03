import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateAdaTokenPrice, splashClassicAdapter, splashFeeSwitchAdapter, splashRoyaltyV1Adapter, vyfiV1Adapter, type DexAsset, type DexPoolRegistryEntry, type DexUtxoValue } from './dex-adapters';

const poolNft: DexAsset = {
  policyId: 'bde0baebb269e9296c9ecdcceeb33fe464361d099b89698470d6b804',
  assetName: '53504c4153485f4144415f4e4654',
  decimals: 0,
};
const splash: DexAsset = {
  policyId: 'ececc92aeaaac1f5b665f567b01baec8bc2771804b4c21716a87a4e3',
  assetName: '53504c415348',
  decimals: 6,
};
const liquidityAsset: DexAsset = {
  policyId: '68bb6e95337a3cb1207da06564820bdf0387bd8011dd5d2fb99c836c',
  assetName: '53504c4153485f4144415f4c51',
  decimals: 0,
};
const entry: DexPoolRegistryEntry = {
  poolId: 'splash-fee-switch-bde0baebb269e9296c9ecdcceeb33fe464361d099b89698470d6b804-53504c4153485f4144415f4e4654',
  dex: 'splash',
  version: 'fee-switch',
  txOutId: '356021456',
  poolNft,
  assetA: { policyId: null, assetName: null, decimals: 6 },
  assetB: splash,
  enabled: true,
};

const datumAsset = (asset: DexAsset) => ({
  constructor: 0,
  fields: [{ bytes: asset.policyId ?? '' }, { bytes: asset.assetName ?? '' }],
});

function poolUtxo(treasuryAda = 154684007, tokenAsset = splash): DexUtxoValue {
  return {
    lovelace: 215426274984n,
    assets: new Map([
      [`${poolNft.policyId}:${poolNft.assetName}`, 1n],
      [`${splash.policyId}:${splash.assetName}`, 18249987601693n],
      [`${liquidityAsset.policyId}:${liquidityAsset.assetName}`, 9223370101136792544n],
    ]),
    datum: {
      constructor: 0,
      fields: [
        datumAsset(poolNft), datumAsset(entry.assetA), datumAsset(tokenAsset), datumAsset(liquidityAsset),
        { int: 99100 }, { int: 100 }, { int: treasuryAda }, { int: 17394962097 },
        { list: [] }, { int: 0 }, { bytes: 'e67b02322e98f8f622980042a69508d67e2750afc92f4f8956188573' },
      ],
    },
  };
}

test('Splash fee-switch pool prices only tradable reserves', () => {
  const decoded = splashFeeSwitchAdapter.decodePool(entry, poolUtxo());
  assert.ok(decoded);
  assert.equal(decoded.reserveA, 215271590977n);
  assert.equal(decoded.reserveB, 18249987601693n - 17394962097n);
  assert.equal(calculateAdaTokenPrice(decoded)?.priceAda, 0.011806965429013721);
});

test('Splash fee-switch rejects an incorrect pool NFT', () => {
  const utxo = poolUtxo();
  utxo.assets.delete(`${poolNft.policyId}:${poolNft.assetName}`);
  assert.equal(splashFeeSwitchAdapter.decodePool(entry, utxo), null);
});

test('Splash fee-switch rejects the wrong token in its datum', () => {
  assert.equal(splashFeeSwitchAdapter.decodePool(entry, poolUtxo(154684007, poolNft)), null);
});

test('Splash fee-switch rejects treasury exceeding the ADA output', () => {
  assert.equal(splashFeeSwitchAdapter.decodePool(entry, poolUtxo(215426274985)), null);
});

const sundaeClassicPoolNft: DexAsset = {
  policyId: 'e3a879f88db87ed3107502bf21f0f43a0210ac7546a54887f2c84d76',
  assetName: '53554e4441455f4144415f4e4654',
  decimals: 0,
};
const classicLiquidityAsset: DexAsset = {
  policyId: '3a2a9affeed8376411dc7c42e4c0db52e85f65762d3328abe3969b98',
  assetName: '53554e4441455f4144415f4c51',
  decimals: 0,
};
const sundaeClassicEntry: DexPoolRegistryEntry = {
  poolId: 'splash-classic-e3a879f88db87ed3107502bf21f0f43a0210ac7546a54887f2c84d76-53554e4441455f4144415f4e4654',
  dex: 'splash',
  version: 'classic',
  txOutId: '346671997',
  poolNft: sundaeClassicPoolNft,
  assetA: { policyId: null, assetName: null, decimals: 6 },
  assetB: { policyId: '9a9693a9a37912a5097918f97918d15240c92ab729a0b7c4aa144d77', assetName: '53554e444145', decimals: 6 },
  enabled: true,
};

function sundaeClassicUtxo(tokenAsset = sundaeClassicEntry.assetB): DexUtxoValue {
  return {
    lovelace: 4532045n,
    assets: new Map([
      [`${sundaeClassicPoolNft.policyId}:${sundaeClassicPoolNft.assetName}`, 1n],
      [`${sundaeClassicEntry.assetB.policyId}:${sundaeClassicEntry.assetB.assetName}`, 1628120339n],
      [`${classicLiquidityAsset.policyId}:${classicLiquidityAsset.assetName}`, 9223372036770160863n],
    ]),
    datum: {
      constructor: 0,
      fields: [
        datumAsset(sundaeClassicPoolNft), datumAsset(sundaeClassicEntry.assetA), datumAsset(tokenAsset),
        datumAsset(classicLiquidityAsset), { int: 997 }, { list: [] }, { int: 0 },
      ],
    },
  };
}

test('Splash classic pool validates assets and reads ADA/SUNDAE UTxO reserves', () => {
  const decoded = splashClassicAdapter.decodePool(sundaeClassicEntry, sundaeClassicUtxo());
  assert.ok(decoded);
  assert.equal(decoded.reserveA, 4532045n);
  assert.equal(decoded.reserveB, 1628120339n);
});

test('Splash classic pool rejects an unregistered datum asset', () => {
  assert.equal(splashClassicAdapter.decodePool(sundaeClassicEntry, sundaeClassicUtxo(poolNft)), null);
});

test('Splash fee-switch decodes an rsERG ADA pool below 500 ADA with nine token decimals', () => {
  const poolId = 'splash-fee-switch-5cb6e093f8a900f82ad299c807511b9faf2273adbac58cf4a35a4c99-72734552475f4144415f4e4654';
  const poolNftAsset = {
    policyId: '5cb6e093f8a900f82ad299c807511b9faf2273adbac58cf4a35a4c99',
    assetName: '72734552475f4144415f4e4654',
    decimals: 0,
  };
  const rsErg = {
    policyId: '04b95368393c821f180deee8229fbd941baaf9bd748ebcdbf7adbb14',
    assetName: '7273455247',
    decimals: 9,
  };
  const lpAsset = {
    policyId: '84e481732b09cef3a4e13b4cae97630fc680dce0429691432f07b2ba',
    assetName: '72734552475f4144415f4c51',
    decimals: 0,
  };
  const poolEntry: DexPoolRegistryEntry = {
    poolId,
    dex: 'splash',
    version: 'fee-switch',
    txOutId: '356098306',
    poolNft: poolNftAsset,
    assetA: { policyId: null, assetName: null, decimals: 6 },
    assetB: rsErg,
    enabled: true,
  };
  const utxo: DexUtxoValue = {
    lovelace: 464090172n,
    assets: new Map([
      [`${poolNftAsset.policyId}:${poolNftAsset.assetName}`, 1n],
      [`${rsErg.policyId}:${rsErg.assetName}`, 331902798710558n],
      [`${lpAsset.policyId}:${lpAsset.assetName}`, 9223362620431443234n],
    ]),
    datum: {
      constructor: 0,
      fields: [
        datumAsset(poolNftAsset), datumAsset(poolEntry.assetA), datumAsset(rsErg), datumAsset(lpAsset),
        { int: 99100 }, { int: 90 }, { int: 1000000 }, { int: 8888365616949 },
        { list: [] }, { int: 0 }, { bytes: '75c4570eb625ae881b32a34c52b159f6f3f3f2c7aaabf5bac4688133' },
      ],
    },
  };

  const decoded = splashFeeSwitchAdapter.decodePool(poolEntry, utxo);
  assert.ok(decoded);
  assert.equal(decoded.reserveA, 463090172n);
  assert.equal(decoded.reserveB, 323014433093609n);
  const price = calculateAdaTokenPrice(decoded);
  assert.ok(price);
  assert.ok(price.reserveAda > 0 && price.reserveAda < 500);
});

const songPoolNft: DexAsset = {
  policyId: 'd8eb52caf3289a2880288b23141ce3d2a7025dcf76f26fd5659add06',
  assetName: 'de3498de00239a8372e540be094d1c17be04e35c5516094d04c572fcc287f391',
  decimals: 0,
};
const songMarketCap: DexAsset = {
  policyId: 'f71b4cf652d8edb33a57928b8b8a546a3c954b7ba24db5583ac79b34',
  assetName: '534f4e474d41524b4554434150',
  decimals: 0,
};
const royaltyLiquidityAsset: DexAsset = {
  policyId: '6e917b8b965078a39804a6313e5be73535612421acd70aa83f0ec200',
  assetName: '551dc3ea3f3cb1af3a3066a71370eb2ef25ac0cb0dfa416360eb950c7ab70e9d',
  decimals: 0,
};
const royaltyEntry: DexPoolRegistryEntry = {
  poolId: 'splash-royalty-v1-song-ada',
  dex: 'splash',
  version: 'royalty-v1',
  txOutId: '356100000',
  poolNft: songPoolNft,
  assetA: { policyId: null, assetName: null, decimals: 6 },
  assetB: songMarketCap,
  enabled: true,
};

function songRoyaltyUtxo(royaltyToken = 17386n): DexUtxoValue {
  return {
    lovelace: 626109738416n,
    assets: new Map([
      [`${songPoolNft.policyId}:${songPoolNft.assetName}`, 1n],
      [`${songMarketCap.policyId}:${songMarketCap.assetName}`, 21024635n],
      [`${royaltyLiquidityAsset.policyId}:${royaltyLiquidityAsset.assetName}`, 9223372033701496036n],
    ]),
    datum: {
      constructor: 0,
      fields: [
        datumAsset(songPoolNft), datumAsset(royaltyEntry.assetA), datumAsset(songMarketCap), datumAsset(royaltyLiquidityAsset),
        { int: 99100 }, { int: 50 }, { int: 50 }, { int: 917329149 }, { int: 32602 },
        { int: 516234467 }, { int: royaltyToken },
        { list: [{ fields: [{ fields: [{ bytes: '66e711a4bf9ddf46ff239143870b6893055a4fd4dea9f99fed6665cd' }], constructor: 1 }], constructor: 0 }] },
        { bytes: 'e67b02322e98f8f622980042a69508d67e2750afc92f4f8956188573' },
        { bytes: '72c68f905716a5f59a0ee2552ab68559f42287d335396d8f430da98e96c5009c' },
        { int: 13 },
      ],
    },
  };
}

test('Splash royalty V1 subtracts treasury and royalty amounts', () => {
  const decoded = splashRoyaltyV1Adapter.decodePool(royaltyEntry, songRoyaltyUtxo());
  assert.ok(decoded);
  assert.equal(decoded.reserveA, 624676174800n);
  assert.equal(decoded.reserveB, 20974647n);
  assert.equal(calculateAdaTokenPrice(decoded)?.priceAda, 0.029782440429152398);
});

test('Splash royalty V1 rejects a pool NFT mismatch', () => {
  const utxo = songRoyaltyUtxo();
  utxo.assets.delete(`${songPoolNft.policyId}:${songPoolNft.assetName}`);
  assert.equal(splashRoyaltyV1Adapter.decodePool(royaltyEntry, utxo), null);
});

test('Splash royalty V1 rejects a fee split larger than the LP fee', () => {
  const utxo = songRoyaltyUtxo();
  const datum = utxo.datum as { fields: Array<{ int?: number | string }> };
  datum.fields[6] = { int: 99500 };
  assert.equal(splashRoyaltyV1Adapter.decodePool(royaltyEntry, utxo), null);
});

test('Splash royalty V1 rejects treasury and royalty amounts exceeding reserves', () => {
  assert.equal(splashRoyaltyV1Adapter.decodePool(royaltyEntry, songRoyaltyUtxo(21000000n)), null);
});

const vyfiPoolNft: DexAsset = {
  policyId: 'fe87ca564b467aa6de634aad76368ae6219fd4342b5a2da8a3ded881',
  assetName: '',
  decimals: 0,
};
const vyfiAgent: DexAsset = {
  policyId: '97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec',
  assetName: '54616c6f73',
  decimals: 0,
};
const vyfiAgentEntry: DexPoolRegistryEntry = {
  poolId: 'vyfi-v1-fe87ca564b467aa6de634aad76368ae6219fd4342b5a2da8a3ded881-97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec54616c6f73',
  dex: 'vyfi',
  version: 'v1',
  txOutId: '355936375',
  poolNft: vyfiPoolNft,
  assetA: { policyId: null, assetName: null, decimals: 6 },
  assetB: vyfiAgent,
  enabled: true,
};
const vyfiAgentPoolUtxo: DexUtxoValue = {
  lovelace: 722614080n,
  assets: new Map([
    [`${vyfiPoolNft.policyId}:${vyfiPoolNft.assetName}`, 1n],
    [`${vyfiAgent.policyId}:${vyfiAgent.assetName}`, 983529n],
  ]),
  datum: { constructor: 0, fields: [{ int: 17075195 }, { int: 10346 }, { int: 24584927 }] },
};

test('VyFi V1 decodes the verified AGENT/ADA pool datum and local reserves', () => {
  const decoded = vyfiV1Adapter.decodePool(vyfiAgentEntry, vyfiAgentPoolUtxo);
  assert.ok(decoded);
  assert.equal(decoded.reserveA, 722614080n);
  assert.equal(decoded.reserveB, 983529n);
  assert.equal(calculateAdaTokenPrice(decoded)?.priceAda, 722614080 / 1_000_000 / 983529);
});

test('VyFi V1 rejects a missing pool marker or malformed datum', () => {
  const missingMarker = { ...vyfiAgentPoolUtxo, assets: new Map(vyfiAgentPoolUtxo.assets) };
  missingMarker.assets.delete(`${vyfiPoolNft.policyId}:${vyfiPoolNft.assetName}`);
  assert.equal(vyfiV1Adapter.decodePool(vyfiAgentEntry, missingMarker), null);
  assert.equal(vyfiV1Adapter.decodePool(vyfiAgentEntry, { ...vyfiAgentPoolUtxo, datum: { constructor: 0, fields: [{ int: 1 }] } }), null);
});

test('VyFi V1 decodes the current VYFI/ADA marker policy and reserves', () => {
  const vyfiToken: DexAsset = {
    policyId: '804f5544c1962a40546827cab750a88404dc7108c0f588b72964754f',
    assetName: '56594649',
    decimals: 6,
  };
  const poolMarker: DexAsset = {
    policyId: 'c285d6d7e61163b7f7a918f28e450e37d55dc684450d87b96750d8db',
    assetName: '',
    decimals: 0,
  };
  const entry: DexPoolRegistryEntry = {
    poolId: 'vyfi-v1-c285d6d7e61163b7f7a918f28e450e37d55dc684450d87b96750d8db-vyfi-ada',
    dex: 'vyfi',
    version: 'v1',
    txOutId: '356471233',
    poolNft: poolMarker,
    assetA: { policyId: null, assetName: null, decimals: 6 },
    assetB: vyfiToken,
    enabled: true,
  };
  const utxo: DexUtxoValue = {
    lovelace: 237202075733n,
    assets: new Map([
      [`${poolMarker.policyId}:${poolMarker.assetName}`, 1n],
      [`${vyfiToken.policyId}:${vyfiToken.assetName}`, 10685227857075n],
    ]),
    datum: { constructor: 0, fields: [{ int: 934502583 }, { int: 11630405 }, { int: 1524519852298 }] },
  };

  const decoded = vyfiV1Adapter.decodePool(entry, utxo);
  assert.ok(decoded);
  assert.equal(decoded.reserveA, 237202075733n);
  assert.equal(decoded.reserveB, 10685227857075n);
  assert.equal(calculateAdaTokenPrice(decoded)?.priceAda, 237202075733 / 1_000_000 / (10685227857075 / 1_000_000));
});

test('VyFi V1 decodes the xVYFI ADA order-validator pool marker', () => {
  const xVyfi: DexAsset = {
    policyId: 'b316f8f668aca7359ecc6073475c0c8106239bf87e05a3a1bd569764',
    assetName: '7856594649',
    decimals: 6,
  };
  const poolMarker: DexAsset = {
    policyId: 'fe496bc40d12f5032159a76b0cc4ff1f74e09e34f86bed95357916c8',
    assetName: '',
    decimals: 0,
  };
  const entry: DexPoolRegistryEntry = {
    poolId: 'vyfi-v1-fe496bc40d12f5032159a76b0cc4ff1f74e09e34f86bed95357916c8-b316f8f668aca7359ecc6073475c0c8106239bf87e05a3a1bd5697647856594649',
    dex: 'vyfi',
    version: 'v1',
    txOutId: '356410276',
    poolNft: poolMarker,
    assetA: { policyId: null, assetName: null, decimals: 6 },
    assetB: xVyfi,
    enabled: true,
  };
  const utxo: DexUtxoValue = {
    lovelace: 54814677757n,
    assets: new Map([
      [`${poolMarker.policyId}:${poolMarker.assetName}`, 1n],
      [`${xVyfi.policyId}:${xVyfi.assetName}`, 1626534198218n],
    ]),
    datum: { constructor: 0, fields: [{ int: 2401055 }, { int: 57318215 }, { int: 290584412355 }] },
  };

  const decoded = vyfiV1Adapter.decodePool(entry, utxo);
  assert.ok(decoded);
  assert.equal(decoded.reserveA, 54814677757n);
  assert.equal(decoded.reserveB, 1626534198218n);
  assert.equal(calculateAdaTokenPrice(decoded)?.priceAda, 54814677757 / 1_000_000 / (1626534198218 / 1_000_000));
});

test('VyFi V1 decodes the registered USDA/ADA pool from the supplied transaction', () => {
  const usda: DexAsset = {
    policyId: 'fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456',
    assetName: '55534441',
    decimals: 6,
  };
  const marker: DexAsset = {
    policyId: 'f7f9777979a2a96777823f149e6696954f43967fc56cfc7095a33f98',
    assetName: '',
    decimals: 0,
  };
  const entry: DexPoolRegistryEntry = {
    poolId: 'vyfi-v1-f7f9777979a2a96777823f149e6696954f43967fc56cfc7095a33f98-fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae45655534441',
    dex: 'vyfi',
    version: 'v1',
    txOutId: '356503056',
    poolNft: marker,
    assetA: { policyId: null, assetName: null, decimals: 6 },
    assetB: usda,
    enabled: true,
  };
  const utxo: DexUtxoValue = {
    lovelace: 8944980697n,
    assets: new Map([
      [`${marker.policyId}:${marker.assetName}`, 1n],
      [`${usda.policyId}:${usda.assetName}`, 2172518357n],
    ]),
    datum: { constructor: 0, fields: [{ int: 832543 }, { int: 161645 }, { int: 4302136218 }] },
  };

  const decoded = vyfiV1Adapter.decodePool(entry, utxo);
  assert.ok(decoded);
  assert.equal(decoded.reserveA, 8944980697n);
  assert.equal(decoded.reserveB, 2172518357n);
  assert.equal(calculateAdaTokenPrice(decoded)?.priceAda, 8944980697 / 1_000_000 / (2172518357 / 1_000_000));
});