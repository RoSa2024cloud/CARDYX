import Parser from 'rss-parser';

interface SocialPost {
  id: string;
  text: string;
  author: string;
  createdAt: number;
  interactions: number;
}

export interface SocialBuzzSnapshot {
  sentiment: number;
  posts24h: number;
  interactions24h: number;
  trend: 'up' | 'down' | 'flat';
  updatedAt: number;
  sources: string[];
}

export interface SocialBuzzAsset {
  marketId: string;
  ticker: string;
  name: string;
}

interface BlueskySearchResponse {
  posts?: Array<{
    uri?: string;
    indexedAt?: string;
    record?: { text?: string; createdAt?: string };
    author?: { handle?: string };
    likeCount?: number;
    repostCount?: number;
    replyCount?: number;
    quoteCount?: number;
  }>;
}

const parser = new Parser({ timeout: 10_000 });
const refreshIntervalMs = 15 * 60 * 1000;
const tokenCacheTtlMs = 10 * 60 * 1000;
const defaultRssFeeds = [
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://www.crypto-news-flash.com/feed/',
];
const positiveWords = new Set([
  'adoption', 'approve', 'bull', 'bullish', 'gain', 'good', 'growth', 'great', 'green', 'launch', 'partnership',
  'positive', 'profit', 'rise', 'strong', 'success', 'upgrade', 'upside', 'win', 'surge', 'breakthrough',
]);
const negativeWords = new Set([
  'bear', 'bearish', 'crash', 'decline', 'dump', 'fear', 'hack', 'lawsuit', 'loss', 'negative', 'risk', 'scam',
  'sell', 'slump', 'downside', 'weak', 'fail', 'exploit', 'collapse', 'outage',
]);

let latestSnapshot: SocialBuzzSnapshot | null = null;
let previousPostCount: number | null = null;
let lastRunAt: string | null = null;
let lastRunError: string | null = null;
let isRunning = false;
const tokenSnapshotCache = new Map<string, { expiresAt: number; snapshot: SocialBuzzSnapshot }>();
const tokenSnapshotRequests = new Map<string, Promise<SocialBuzzSnapshot | null>>();
const previousTokenPostCounts = new Map<string, number>();

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function validDate(value: unknown): number {
  if (typeof value !== 'string') return Date.now();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function sentimentFor(posts: SocialPost[]): number {
  let positive = 0;
  let negative = 0;
  for (const post of posts) {
    const words = post.text.toLowerCase().match(/[a-z]+/g) ?? [];
    const positiveHits = words.filter((word) => positiveWords.has(word)).length;
    const negativeHits = words.filter((word) => negativeWords.has(word)).length;
    const weight = Math.max(1, Math.log2(post.interactions + 1));
    positive += positiveHits * weight;
    negative += negativeHits * weight;
  }
  const classified = positive + negative;
  if (classified === 0) return 50;
  const rawScore = 50 + ((positive - negative) / classified) * 50;
  const confidence = Math.min(0.75, posts.length / 80);
  return Math.round(50 + (rawScore - 50) * confidence);
}

async function fetchText(url: string, userAgent: string): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: 'application/rss+xml, application/atom+xml, application/json, text/xml', 'user-agent': userAgent },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchBluesky(query = 'cardano'): Promise<SocialPost[]> {
  const url = new URL('https://api.bsky.app/xrpc/app.bsky.feed.searchPosts');
  url.searchParams.set('q', query);
  url.searchParams.set('sort', 'latest');
  url.searchParams.set('limit', '100');
  const body = await fetchText(url.toString(), 'CARDYX-SocialBuzz/1.0');
  const response = JSON.parse(body) as BlueskySearchResponse;
  return (response.posts ?? []).flatMap((post) => {
    if (!post.uri) return [];
    return [{
      id: post.uri,
      text: cleanText(post.record?.text),
      author: post.author?.handle ?? post.uri,
      createdAt: validDate(post.record?.createdAt ?? post.indexedAt),
      interactions: (post.likeCount ?? 0) + (post.repostCount ?? 0) + (post.replyCount ?? 0) + (post.quoteCount ?? 0),
    }];
  });
}

async function fetchRss(url: string, source: string, matches?: (text: string) => boolean): Promise<SocialPost[]> {
  const xml = await fetchText(url, 'CARDYX-SocialBuzz/1.0 (Cardano market sentiment)');
  const feed = await parser.parseString(xml);
  return (feed.items ?? []).flatMap((item) => {
    const text = cleanText([item.title, item.contentSnippet, item.content].filter(Boolean).join(' '));
    if (!text || (matches && !matches(text))) return [];
    const id = item.guid ?? item.link ?? `${source}:${item.title ?? ''}`;
    return [{
      id,
      text,
      author: item.creator ?? item.author ?? source,
      createdAt: validDate(item.isoDate),
      interactions: 1,
    }];
  });
}

function configuredRssFeeds(): string[] {
  const configured = process.env.CARDYX_SOCIAL_RSS_FEEDS?.split(',').map((feed) => feed.trim()).filter(Boolean);
  return (configured?.length ? configured : defaultRssFeeds).slice(0, 4);
}

export async function runSocialBuzzOnce(): Promise<SocialBuzzSnapshot | null> {
  if (isRunning) return latestSnapshot;
  isRunning = true;
  try {
    const feedUrls = configuredRssFeeds();
    const requests = await Promise.allSettled([
      fetchBluesky(),
      fetchRss('https://www.reddit.com/search.rss?q=cardano&sort=new&t=day&limit=100', 'reddit'),
      ...feedUrls.map((url) => fetchRss(url, new URL(url).hostname, (text) => /\bcardano\b|\$ada\b|#cardano\b/i.test(text))),
    ]);
    const sourceNames = ['Bluesky', 'Reddit', ...feedUrls.map((url) => new URL(url).hostname)];
    const successfulPosts: SocialPost[] = [];
    const activeSources: string[] = [];
    const errors: string[] = [];

    requests.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        activeSources.push(sourceNames[index] ?? 'Unknown');
        successfulPosts.push(...result.value);
      } else {
        errors.push(`${sourceNames[index] ?? 'Source'}: ${result.reason instanceof Error ? result.reason.message : 'request failed'}`);
      }
    });

    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const uniquePosts = [...new Map(successfulPosts
      .filter((post) => post.createdAt >= cutoff)
      .map((post) => [post.id, post])).values()];
    if (activeSources.length === 0) throw new Error(errors.join('; ') || 'No social sources available');

    const previous = previousPostCount;
    const trend = previous === null || uniquePosts.length === previous
      ? 'flat'
      : uniquePosts.length > previous * 1.15 ? 'up'
        : uniquePosts.length < previous * 0.85 ? 'down' : 'flat';
    const snapshot: SocialBuzzSnapshot = {
      sentiment: sentimentFor(uniquePosts),
      posts24h: uniquePosts.length,
      interactions24h: uniquePosts.reduce((sum, post) => sum + post.interactions, 0),
      trend,
      updatedAt: Date.now(),
      sources: activeSources,
    };

    previousPostCount = uniquePosts.length;
    latestSnapshot = snapshot;
    lastRunAt = new Date(snapshot.updatedAt).toISOString();
    lastRunError = errors.length ? errors.join('; ') : null;
    return snapshot;
  } finally {
    isRunning = false;
  }
}

export function startSocialBuzzEngine(intervalMs = refreshIntervalMs): void {
  const run = () => runSocialBuzzOnce().catch((error: Error) => {
    lastRunError = error.message;
    console.error('CARDYX Social Buzz Engine failed:', error.message);
  });
  setTimeout(run, 2_000);
  setInterval(run, intervalMs);
}

export function getSocialBuzzSnapshot() {
  return latestSnapshot;
}

export function getSocialBuzzStatus() {
  return { lastRunAt, lastRunError, isRunning, source: 'cardyx-social-buzz', refreshIntervalMs };
}

function matchesToken(text: string, ticker: string, name: string): boolean {
  if (ticker.toUpperCase() === 'NIGHT' && !/\$night\b|\b(cardano|midnight|crypto|blockchain|token|dex)\b/iu.test(text)) return false;
  const escapedTerms = [...new Set([ticker, name])]
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return escapedTerms.some((term) => new RegExp(`(?:^|[^\\p{L}\\p{N}])\\$?${term}(?:$|[^\\p{L}\\p{N}])`, 'iu').test(text));
}

export async function getTokenSocialSnapshot(asset: SocialBuzzAsset): Promise<SocialBuzzSnapshot | null> {
  const cacheKey = asset.marketId;
  const cached = tokenSnapshotCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.snapshot;
  const pending = tokenSnapshotRequests.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    const feeds = configuredRssFeeds();
    const matches = (text: string) => matchesToken(text, asset.ticker, asset.name);
    const query = asset.ticker.length <= 4 ? `$${asset.ticker}` : asset.ticker;
    const requests = await Promise.allSettled([
      fetchBluesky(query),
      fetchRss(`https://www.reddit.com/search.rss?q=${encodeURIComponent(asset.ticker)}&sort=new&t=day&limit=100`, 'Reddit', matches),
      ...feeds.map((url) => fetchRss(url, new URL(url).hostname, matches)),
    ]);
    const sourceNames = ['Bluesky', 'Reddit', ...feeds.map((url) => new URL(url).hostname)];
    const posts: SocialPost[] = [];
    const sources: string[] = [];
    const errors: string[] = [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let successfulSources = 0;

    requests.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const source = sourceNames[index] ?? 'Unknown';
        successfulSources += 1;
        const matchingPosts = result.value.filter((post) => post.createdAt >= cutoff && matches(post.text));
        if (matchingPosts.length) sources.push(source);
        posts.push(...matchingPosts);
      } else {
        errors.push(`${sourceNames[index] ?? 'Source'}: ${result.reason instanceof Error ? result.reason.message : 'request failed'}`);
      }
    });

    if (!successfulSources) throw new Error(errors.join('; ') || 'No social sources available');
    const recentPosts = [...new Map(posts
      .filter((post) => post.createdAt >= cutoff)
      .map((post) => [post.id, post])).values()];
    const previous = previousTokenPostCounts.get(cacheKey);
    const trend = previous === undefined || recentPosts.length === previous
      ? 'flat'
      : recentPosts.length > previous * 1.15 ? 'up'
        : recentPosts.length < previous * 0.85 ? 'down' : 'flat';
    const snapshot: SocialBuzzSnapshot = {
      sentiment: sentimentFor(recentPosts),
      posts24h: recentPosts.length,
      interactions24h: recentPosts.reduce((sum, post) => sum + post.interactions, 0),
      trend,
      updatedAt: Date.now(),
      sources,
    };

    previousTokenPostCounts.set(cacheKey, recentPosts.length);
    tokenSnapshotCache.set(cacheKey, { snapshot, expiresAt: Date.now() + tokenCacheTtlMs });
    if (tokenSnapshotCache.size > 500) {
      const oldestKey = tokenSnapshotCache.keys().next().value;
      if (oldestKey) tokenSnapshotCache.delete(oldestKey);
    }
    return snapshot;
  })();

  tokenSnapshotRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    tokenSnapshotRequests.delete(cacheKey);
  }
}