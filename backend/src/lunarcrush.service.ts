interface LunarCrushTopicResponse {
  config?: { generated?: number };
  data?: {
    types_count?: Record<string, unknown>;
    types_interactions?: Record<string, unknown>;
    types_sentiment?: Record<string, unknown>;
    num_posts?: unknown;
    interactions_24h?: unknown;
    trend?: unknown;
  };
}

export interface LunarCrushSocialSnapshot {
  sentiment: number;
  posts24h: number;
  interactions24h: number;
  trend: 'up' | 'down' | 'flat';
  updatedAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedSnapshot: LunarCrushSocialSnapshot | null = null;
let cacheExpiresAt = 0;
let pendingRequest: Promise<LunarCrushSocialSnapshot | null> | null = null;

function finiteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function sumValues(values: Record<string, unknown> | undefined): number {
  return Object.values(values ?? {}).reduce<number>((sum, value) => sum + (finiteNumber(value) ?? 0), 0);
}

function parseSnapshot(response: LunarCrushTopicResponse): LunarCrushSocialSnapshot | null {
  const data = response.data;
  if (!data) return null;

  const sentiments = data.types_sentiment ?? {};
  const interactions = data.types_interactions ?? {};
  let weightedSentiment = 0;
  let sentimentWeight = 0;

  for (const [network, rawSentiment] of Object.entries(sentiments)) {
    const sentiment = finiteNumber(rawSentiment);
    if (sentiment === null || sentiment < 0 || sentiment > 100) continue;
    const weight = finiteNumber(interactions[network]);
    const effectiveWeight = weight !== null && weight > 0 ? weight : 1;
    weightedSentiment += sentiment * effectiveWeight;
    sentimentWeight += effectiveWeight;
  }

  if (sentimentWeight === 0) return null;

  const trend = data.trend === 'up' || data.trend === 'down' ? data.trend : 'flat';
  return {
    sentiment: weightedSentiment / sentimentWeight,
    posts24h: finiteNumber(data.num_posts) ?? sumValues(data.types_count),
    interactions24h: finiteNumber(data.interactions_24h) ?? sumValues(interactions),
    trend,
    updatedAt: (finiteNumber(response.config?.generated) ?? Date.now() / 1000) * 1000,
  };
}

export async function getLunarCrushSocialSnapshot(): Promise<LunarCrushSocialSnapshot | null> {
  const apiKey = process.env.LUNARCRUSH_API_KEY?.trim();
  if (!apiKey) return null;
  if (cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
    const response = await fetch('https://lunarcrush.com/api4/public/topic/cardano/v1', {
      headers: { accept: 'application/json', authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`LunarCrush returned HTTP ${response.status}`);

    const snapshot = parseSnapshot(await response.json() as LunarCrushTopicResponse);
    if (!snapshot) throw new Error('LunarCrush returned no usable Cardano sentiment data');
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return snapshot;
  })();

  try {
    return await pendingRequest;
  } catch (error) {
    if (cachedSnapshot) return cachedSnapshot;
    throw error;
  } finally {
    pendingRequest = null;
  }
}