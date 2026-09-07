'use client';

import { Crown, Dog, Radar, ShieldCheck } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

/**
 * Banner-Karussell für CARDYX-eigene Produktbereiche (cDOG Intelligence,
 * Wallet Radar, Risk Scanner und Premium). Horizontales Scrollen mit Snap.
 */
const BANNERS = [
  {
    title: 'cDOG Intelligence',
    subtitle: 'Der On-Chain Scout: Whale Alerts, Risk Scores & Smart Money',
    subtitleEn: 'The on-chain scout: whale alerts, risk scores & smart money',
    cta: 'Alpha entdecken',
    ctaEn: 'Discover alpha',
    icon: Dog,
    gradient: 'from-blue-600/40 via-blue-900/30 to-[#0a0f1c]',
    accent: 'text-blue-400',
    border: 'hover:border-blue-500/40',
  },
  {
    title: 'Wallet Radar',
    subtitle: 'Beobachte Wallets und Smart-Money-Bewegungen on-chain',
    subtitleEn: 'Track wallets and smart-money movements on-chain',
    cta: 'Radar aktivieren',
    ctaEn: 'Activate radar',
    icon: Radar,
    gradient: 'from-cyan-500/30 via-cyan-900/20 to-[#0a0f1c]',
    accent: 'text-cyan-400',
    border: 'hover:border-cyan-500/40',
  },
  {
    title: 'Risk Scanner',
    subtitle: 'Transparente On-Chain-Scores für jeden Cardano-Token',
    subtitleEn: 'Transparent on-chain scores for every Cardano token',
    cta: 'Score ansehen',
    ctaEn: 'View score',
    icon: ShieldCheck,
    gradient: 'from-emerald-500/25 via-emerald-900/15 to-[#0a0f1c]',
    accent: 'text-emerald-400',
    border: 'hover:border-emerald-500/40',
  },
  {
    title: 'CARDYX Premium',
    subtitle: 'Advanced Analytics, Liquidity Pools, Token Launches, Alerts & Developer API',
    subtitleEn: 'Advanced analytics, liquidity pools, token launches, alerts & developer API',
    cta: 'Mehr erfahren',
    ctaEn: 'Learn more',
    icon: Crown,
    gradient: 'from-amber-500/25 via-amber-900/15 to-[#0a0f1c]',
    accent: 'text-amber-400',
    border: 'hover:border-amber-500/40',
  },
];

export default function FeaturedCarousel() {
  const { language } = useLanguage();
  return (
    <section aria-label={language === 'de' ? 'Highlights' : 'Highlights'} className="pt-2">
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {BANNERS.map((banner) => (
          <article
            key={banner.title}
            className={`group relative h-36 w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br sm:w-[340px] ${banner.gradient} ${banner.border} transition-colors`}
          >
            <banner.icon className="absolute -right-4 -top-4 h-28 w-28 text-white/5 transition-transform duration-300 group-hover:scale-110" />
            <span className="absolute right-4 top-4 rounded-full border border-white/10 bg-[#05070d]/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {language === 'de' ? 'In Entwicklung' : 'In development'}
            </span>
            <div className="flex h-full flex-col justify-end p-5">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${banner.accent}`}>
                {language === 'de' ? banner.cta : banner.ctaEn}
              </p>
              <h3 className="mt-1 text-lg font-bold text-white">{banner.title}</h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{language === 'de' ? banner.subtitle : banner.subtitleEn}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
