'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, BarChart3, Blocks, ShieldCheck, Zap } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

const copy = {
  de: {
    beta: 'ÖFFENTLICHE BETA · IM AUFBAU',
    eyebrow: 'CARDANO DIGITAL ASSET INTELLIGENCE',
    headline: 'CARDYX',
    statement: 'Märkte lesen. On-chain prüfen. Eigenständig handeln.',
    intro: 'Cardano-Märkte, nachvollziehbare On-Chain-Daten und DEX-Trading an einem Ort. Mit sichtbarer Datenherkunft und einer Plattform, die Schritt für Schritt wächst.',
    market: 'Markt öffnen',
    trade: 'Trading starten',
    scroll: 'Die Plattform entdecken',
    sectionEyebrow: 'EIN ARBEITSPLATZ FÜR CARDANO',
    sectionTitle: 'Daten, die zusammengehören.',
    marketTitle: 'Märkte',
    marketText: 'Tokenpreise, Volumen und Marktübersicht mit klarer Kennzeichnung der jeweiligen Datenquelle.',
    chainTitle: 'On-chain',
    chainText: 'Asset-Identität, Metadaten und Netzwerkaktivität aus dem CARDYX Data Layer.',
    tradeTitle: 'Trading',
    tradeText: 'Swap, Limit und DCA mit Wallet-Signatur. Deine Schlüssel bleiben in deiner Wallet.',
    betaTitle: 'CARDYX ist in der Beta.',
    betaText: 'Datenabdeckung, lokaler Preisindex und Produktfunktionen werden laufend erweitert. Markt- und Orderdaten können je nach Quelle unterschiedlich vollständig sein.',
    openApp: 'Zur Plattform',
    sources: 'Quellen sichtbar',
    selfCustody: 'Wallet bleibt bei dir',
    builtFor: 'Für Cardano gebaut',
    footer: 'CARDYX · Cardano Digital Asset Intelligence',
  },
  en: {
    beta: 'PUBLIC BETA · IN DEVELOPMENT',
    eyebrow: 'CARDANO DIGITAL ASSET INTELLIGENCE',
    headline: 'CARDYX',
    statement: 'Read the market. Verify on-chain. Trade on your terms.',
    intro: 'Cardano markets, transparent on-chain data, and DEX trading in one place. Sources stay visible as the platform grows step by step.',
    market: 'Open markets',
    trade: 'Start trading',
    scroll: 'Explore the platform',
    sectionEyebrow: 'A WORKSPACE FOR CARDANO',
    sectionTitle: 'Data that belongs together.',
    marketTitle: 'Markets',
    marketText: 'Token prices, volume, and market overview with clear labels for each data source.',
    chainTitle: 'On-chain',
    chainText: 'Asset identity, metadata, and network activity from the CARDYX Data Layer.',
    tradeTitle: 'Trading',
    tradeText: 'Swap, Limit, and DCA with wallet signing. Your keys stay in your wallet.',
    betaTitle: 'CARDYX is in beta.',
    betaText: 'Data coverage, the local price index, and product features are being expanded continuously. Market and order data can vary in coverage by source.',
    openApp: 'Enter the platform',
    sources: 'Sources disclosed',
    selfCustody: 'Your wallet stays yours',
    builtFor: 'Built for Cardano',
    footer: 'CARDYX · Cardano Digital Asset Intelligence',
  },
} as const;

export default function StartPage() {
  const { language, setLanguage } = useLanguage();
  const text = copy[language];

  return (
    <main className="min-h-screen bg-[#070a08] text-slate-100">
      <section className="relative isolate flex min-h-[84svh] flex-col overflow-hidden border-b border-white/10 bg-[#050806]">
        <iframe
          src="/market"
          title="CARDYX live market dashboard"
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 h-full w-full scale-[1.08] border-0 opacity-40"
        />
        <div className="pointer-events-none absolute inset-0 bg-[#050806]/75" />
        <div className="pointer-events-none absolute inset-0 bg-black/20" />

        <header className="relative z-10 mx-auto flex h-[76px] w-full max-w-[1440px] items-center justify-between border-b border-white/10 px-5 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="CARDYX Home">
            <span className="relative h-9 w-9 overflow-hidden rounded-lg border border-cyan-300/40 bg-[#02050b] shadow-lg shadow-blue-500/25">
              <Image src="/cardyx-logo-new.jpeg" alt="" fill sizes="36px" className="object-cover" priority />
            </span>
            <span className="text-lg font-bold tracking-tight text-white">
              CARDYX
              <span className="ml-2 hidden text-[10px] font-medium uppercase tracking-widest text-emerald-300/60 lg:inline">
                {language === 'de' ? 'Trade & Analyse Platform' : 'Trade & Analytics Platform'}
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-5">
            <a href="#platform" className="hidden text-xs font-semibold text-slate-300 transition-colors hover:text-lime-200 sm:inline">{text.scroll}</a>
            <div className="flex items-center rounded-md border border-white/15 bg-black/30 p-0.5" role="group" aria-label={language === 'de' ? 'Sprache' : 'Language'}>
              {(['de', 'en'] as const).map((code) => <button key={code} type="button" aria-pressed={language === code} onClick={() => setLanguage(code)} className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${language === code ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-200'}`}>{code}</button>)}
            </div>
            <Link href="/market" className="hidden text-xs font-semibold text-slate-300 hover:text-white sm:inline">{text.openApp}</Link>
            <Link href="/trade" className="flex h-9 items-center gap-2 rounded-md bg-lime-300 px-3.5 text-xs font-bold text-[#11140c] transition-colors hover:bg-lime-200 sm:px-4">
              <Zap className="h-3.5 w-3.5" />{text.trade}<ArrowUpRight className="hidden h-3 w-3 sm:block" />
            </Link>
          </nav>
        </header>

        <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-5 pb-14 pt-12 sm:px-8 lg:pb-20">
          <div className="max-w-[930px]">
            <div className="mb-8 inline-flex items-center gap-2 border border-lime-200/30 bg-lime-200/[0.07] px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-lime-100">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-300" />{text.beta}
            </div>
            <p className="mb-4 font-mono text-[10px] font-bold tracking-[0.24em] text-lime-200/80 sm:text-xs">{text.eyebrow}</p>
            <h1 className="text-7xl font-black leading-[0.88] tracking-[-0.02em] text-white sm:text-8xl lg:text-9xl">{text.headline}</h1>
            <p className="mt-7 max-w-3xl text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-4xl">{text.statement}</p>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">{text.intro}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/market" className="group flex h-12 items-center gap-3 bg-white px-5 text-sm font-bold text-[#0a0c0a] transition-colors hover:bg-lime-200">
                {text.market}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/trade" className="flex h-12 items-center gap-2 border border-white/30 px-5 text-sm font-semibold text-white transition-colors hover:border-lime-200/70 hover:text-lime-100">
                <Zap className="h-4 w-4" />{text.trade}
              </Link>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-4 pt-14">
            <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400 sm:text-[10px]">
              <span>{text.sources}</span><span>{text.selfCustody}</span><span>{text.builtFor}</span>
            </div>
            <a href="#platform" aria-label={text.scroll} className="hidden h-9 w-9 shrink-0 items-center justify-center border border-white/20 text-slate-300 transition-colors hover:border-lime-200/60 hover:text-lime-100 sm:flex"><ArrowDown className="h-4 w-4" /></a>
          </div>
        </div>
      </section>

      <section id="platform" className="border-b border-white/10 bg-[#0b0e0b]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-white/10 pb-7">
            <div>
              <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-lime-200/75">{text.sectionEyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{text.sectionTitle}</h2>
            </div>
            <span className="border border-amber-200/25 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-100">BETA 0.1</span>
          </div>

          <div className="grid gap-x-8 md:grid-cols-3">
            <article className="border-t border-lime-200/50 py-5 md:border-r md:border-r-white/10 md:pr-8">
              <p className="font-mono text-[10px] text-lime-200">01 / 03</p>
              <BarChart3 className="mt-5 h-5 w-5 text-lime-200" />
              <h3 className="mt-4 text-lg font-bold text-white">{text.marketTitle}</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">{text.marketText}</p>
            </article>
            <article className="border-t border-cyan-200/50 py-5 md:border-r md:border-r-white/10 md:px-8">
              <p className="font-mono text-[10px] text-cyan-200">02 / 03</p>
              <ShieldCheck className="mt-5 h-5 w-5 text-cyan-200" />
              <h3 className="mt-4 text-lg font-bold text-white">{text.chainTitle}</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">{text.chainText}</p>
            </article>
            <article className="border-t border-orange-200/50 py-5 md:pl-8">
              <p className="font-mono text-[10px] text-orange-200">03 / 03</p>
              <Zap className="mt-5 h-5 w-5 text-orange-200" />
              <h3 className="mt-4 text-lg font-bold text-white">{text.tradeTitle}</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">{text.tradeText}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-[#080a08]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-amber-200/75">BETA · 2026</p>
            <h2 className="mt-3 text-2xl font-bold text-white">{text.betaTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{text.betaText}</p>
          </div>
          <Link href="/market" className="group inline-flex h-11 shrink-0 items-center gap-3 border-b border-lime-200/50 text-sm font-semibold text-lime-100 hover:border-lime-100">
            {text.market}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#050705] px-5 py-5 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600 sm:px-8">{text.footer}</footer>
    </main>
  );
}