// DexHunter Partner-Integration
//
// CARDYX leitet Swaps an DexHunter (Cardano DEX Aggregator) weiter.
// Sobald die Partnerschaft aktiv ist, wird der Partner-Code über die
// Umgebungsvariable NEXT_PUBLIC_DEXHUNTER_PARTNER_CODE gesetzt und an
// jeden Swap-Link angehängt – CARDYX verdient dann an jedem Trade mit.
//
// Setup:
//   1. Partner-Account bei DexHunter beantragen
//   2. In frontend/.env.local:
//        NEXT_PUBLIC_DEXHUNTER_PARTNER_CODE=<dein-partner-code>
//   3. Dev-Server neu starten – fertig.

export const DEXHUNTER_PARTNER_CODE = process.env.NEXT_PUBLIC_DEXHUNTER_PARTNER_CODE ?? '';

/**
 * Baut die DexHunter-Swap-URL für ein Paar ADA → Token.
 * @param policyId Cardano Policy-ID des Ziel-Tokens (null → allgemeine Swap-Seite)
 */
export function buildSwapUrl(policyId: string | null | undefined): string {
  const base = policyId
    ? `https://app.dexhunter.io/swap?from=ADA&to=${encodeURIComponent(policyId)}`
    : 'https://app.dexhunter.io/';

  return DEXHUNTER_PARTNER_CODE
    ? `${base}&partnerCode=${encodeURIComponent(DEXHUNTER_PARTNER_CODE)}`
    : base;
}
