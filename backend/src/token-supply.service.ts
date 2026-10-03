export interface SupplyInput {
  rawQuantity: unknown;
  decimals: unknown;
  priceAda: number;
  adaPriceUsd: number;
  circulatingSupply?: number | null;
  providerTotalSupply?: number | null;
  maxSupply?: number | null;
}

export function normalizedOnchainSupply(rawQuantity: unknown, decimals: unknown): { value: number; exact: string } | null {
  if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 19) return null;
  if (typeof rawQuantity === 'number' && !Number.isSafeInteger(rawQuantity)) return null;
  if (typeof rawQuantity !== 'string' && typeof rawQuantity !== 'number' && typeof rawQuantity !== 'bigint') return null;
  const raw = String(rawQuantity);
  if (!/^\d+$/.test(raw)) return null;
  const quantity = BigInt(raw);
  const scale = 10n ** BigInt(decimals);
  const fraction = decimals ? (quantity % scale).toString().padStart(decimals, '0').replace(/0+$/, '') : '';
  const exact = `${quantity / scale}${fraction ? `.${fraction}` : ''}`;
  const value = Number(exact);
  return Number.isFinite(value) ? { value, exact } : null;
}

function knownSupply(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function tokenSupplyValuation(input: SupplyInput) {
  const onchain = normalizedOnchainSupply(input.rawQuantity, input.decimals);
  const providerTotal = knownSupply(input.providerTotalSupply);
  const reportedTotal = providerTotal !== null && providerTotal > 0 && (onchain === null || providerTotal >= onchain.value) ? providerTotal : null;
  const totalSupply = reportedTotal ?? onchain?.value ?? null;
  const maximum = knownSupply(input.maxSupply);
  const circulation = knownSupply(input.circulatingSupply);
  const circulatingSupply = circulation !== null && totalSupply !== null && circulation <= totalSupply ? circulation : null;
  const maxSupply = maximum !== null && totalSupply !== null && maximum >= totalSupply ? maximum : null;
  const positivePrice = Number.isFinite(input.priceAda) && input.priceAda > 0;
  const valuation = (supply: number | null) => positivePrice && supply !== null && Number.isFinite(supply * input.priceAda) ? supply * input.priceAda : null;
  const usd = (ada: number | null) => ada !== null && Number.isFinite(input.adaPriceUsd) && input.adaPriceUsd > 0 && Number.isFinite(ada * input.adaPriceUsd) ? ada * input.adaPriceUsd : null;
  const verifiedMarketCapAda = valuation(circulatingSupply);
  const onchainMarketCapEstimateAda = verifiedMarketCapAda === null ? valuation(onchain?.value ?? null) : null;
  const fdvSupply = maxSupply ?? totalSupply;
  const fdvAda = valuation(fdvSupply);
  const onchainValueAda = valuation(onchain?.value ?? null);
  return {
    totalSupply,
    totalSupplyExact: totalSupply === null ? null : String(totalSupply),
    onchainSupply: onchain?.value ?? null,
    onchainSupplyExact: onchain?.exact ?? null,
    circulatingSupply,
    maxSupply,
    marketCapAda: verifiedMarketCapAda ?? onchainMarketCapEstimateAda,
    marketCapUsd: usd(verifiedMarketCapAda ?? onchainMarketCapEstimateAda),
    marketCapBasis: (verifiedMarketCapAda !== null ? 'verified-circulating-supply' : onchainMarketCapEstimateAda !== null ? 'on-chain-supply-estimate' : null) as 'verified-circulating-supply' | 'on-chain-supply-estimate' | null,
    fdvAda,
    fdvUsd: usd(fdvAda),
    fdvBasis: (maxSupply !== null ? 'maximum-supply' : reportedTotal !== null && reportedTotal > 0 ? 'provider-total-supply' : onchain ? 'on-chain-supply' : null) as 'maximum-supply' | 'provider-total-supply' | 'on-chain-supply' | null,
    onchainValueAda,
    onchainValueUsd: usd(onchainValueAda),
  };
}