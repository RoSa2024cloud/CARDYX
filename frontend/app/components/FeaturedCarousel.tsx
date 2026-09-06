'use client';

import { Crown, Dog, Radar, ShieldCheck } from 'lucide-react';

/**
 * Banner-Karussell für CARDYX-eigene Produktbereiche (cDOG Intelligence,
 * Wallet Radar, Risk Scanner, Premium). Horizontales Scrollen mit Snap.
 */
const BANNERS = [
  {
    title: 'cDOG Intelligence',
    subtitle: 'Der On-Chain Scout: Whale Alerts, Risk Scores & Smart Money',
    cta: 'Alpha entdecken',
    icon: Dog,
    gradient: 'from-blue-600/40 via-blue-900/30 to-[#0a0f1c]',
    accent: 'text-blue-400',
    border: 'hover:border-blue-500/40',
  },
  {
    title: 'Wallet Radar',
    subtitle: 'Beobachte Wallets und Smart-Money-Bewegungen on-chain',
    cta: 'Radar aktivieren',
    icon: Radar,
    gradient: 'from-cyan-500/30 via-cyan-900/20 to-[#0a0f1c]',
    accent: 'text-cyan-400',
    border: 'hover:border-cyan-500/40',
  },
  {
    title: 'Risk Scanner',
    subtitle: 'Transparente On-Chain-Scores für jeden Cardano-Token',
    cta: 'Score ansehen',
    icon: ShieldCheck,
    gradient: 'from-emerald-500/25 via-emerald-900/15 to-[#0a0f1c]',
    accent: 'text-emerald-400',
    border: 'hover:border-emerald-500/40',
  },
  {
    title: 'CARDYX Premium',
    subtitle: 'Advanced Analytics, erweiterte Alerts & Developer API',
    cta: 'Mehr erfahren',
    icon: Crown,
    gradient: 'from-amber-500/25 via-amber-900/15 to-[#0a0f1c]',
    accent: 'text-amber-400',
    border: 'hover:border-amber-500/40',
  },
];

export default function FeaturedCarousel() {
  return (
    <section aria-label="Highlights" className="pt-2">
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {BANNERS.map((banner) => (
          <a
            key={banner.title}
            href="#"
            className={`group relative h-36 w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br sm:w-[340px] ${banner.gradient} ${banner.border} transition-colors`}
          >
            <banner.icon className="absolute -right-4 -top-4 h-28 w-28 text-white/5 transition-transform duration-300 group-hover:scale-110" />
            <div className="flex h-full flex-col justify-end p-5">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${banner.accent}`}>
                {banner.cta}
              </p>
              <h3 className="mt-1 text-lg font-bold text-white">{banner.title}</h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{banner.subtitle}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
