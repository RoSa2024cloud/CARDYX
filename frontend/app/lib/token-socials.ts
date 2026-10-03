import type { MarketToken } from './tokens';

export const SOCIAL_CHANNELS = ['x', 'discord', 'telegram', 'github', 'medium'] as const;
export type SocialChannel = typeof SOCIAL_CHANNELS[number];
type ProjectSocials = Partial<Record<SocialChannel, string>>;
interface VerifiedProject {
  policyId: string;
  assetName: string;
  website: string;
  backgroundImage?: string;
  sources: string[];
  verifiedAt: string;
  links: ProjectSocials;
}

const projects: VerifiedProject[] = [
  {
    policyId: '0691b2fecca1ac4f53cb6dfb00b7013e561d1f34403b957cbb5af1fa', assetName: '4e49474854',
    website: 'https://midnight.network/',
    sources: ['https://midnight.network/', 'https://midnight.network/developer-hub'], verifiedAt: '2026-10-03',
    links: { x: 'https://x.com/MidnightNtwrk', discord: 'https://discord.com/invite/midnightnetwork', telegram: 'https://t.me/Midnight_Network_Official', github: 'https://github.com/midnightntwrk', medium: 'https://medium.com/@midnightnetwork/' },
  },
  {
    policyId: 'a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235', assetName: '484f534b59',
    website: 'https://hosky.io/',
    backgroundImage: '/project-backgrounds/hosky.png',
    sources: ['https://hosky.io/'], verifiedAt: '2026-10-03',
    links: { x: 'https://twitter.com/hoskytoken', discord: 'https://discord.gg/hosky', telegram: 'https://t.me/hoskytoken', github: 'https://github.com/hoskytoken', medium: 'https://medium.com/@hosky_' },
  },
  {
    policyId: '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f', assetName: '534e454b',
    website: 'https://www.snek.com/',
    sources: ['https://www.snek.com/'], verifiedAt: '2026-10-03',
    links: { x: 'https://twitter.com/snek', discord: 'https://discord.gg/KB4GdmCNjh', telegram: 'https://t.me/snekcoinada' },
  },
  {
    policyId: '29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6', assetName: '4d494e',
    website: 'https://minswap.org/',
    sources: ['https://minswap.org/', 'https://docs.minswap.org/'], verifiedAt: '2026-10-03',
    links: { x: 'https://x.com/MinswapDEX', github: 'https://github.com/minswap/docs', medium: 'https://minswap-labs.medium.com/' },
  },
  {
    policyId: '9a9693a9a37912a5097918f97918d15240c92ab729a0b7c4aa144d77', assetName: '53554e444145',
    website: 'https://sundae.fi/',
    sources: ['https://sundae.fi/'], verifiedAt: '2026-10-03',
    links: { x: 'https://twitter.com/SundaeSwap', discord: 'https://discord.gg/sundaeswap', medium: 'https://sundaeswap-finance.medium.com/' },
  },
];

function verifiedProject(token: Pick<MarketToken, 'policyId' | 'assetName'>) {
  if (!token.policyId || token.assetName == null) return null;
  return projects.find((entry) => entry.policyId === token.policyId!.toLowerCase() && entry.assetName === token.assetName!.toLowerCase()) ?? null;
}

export function tokenProjectWebsite(token: Pick<MarketToken, 'policyId' | 'assetName'>): string | null {
  return verifiedProject(token)?.website ?? null;
}

export function tokenProjectBackground(token: Pick<MarketToken, 'policyId' | 'assetName'>): string | null {
  return verifiedProject(token)?.backgroundImage ?? null;
}

export function tokenSocialLinks(token: Pick<MarketToken, 'policyId' | 'assetName'>): { channel: SocialChannel; url: string }[] {
  const project = verifiedProject(token);
  return project ? SOCIAL_CHANNELS.flatMap((channel) => project.links[channel] ? [{ channel, url: project.links[channel]! }] : []) : [];
}