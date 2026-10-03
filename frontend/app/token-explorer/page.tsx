'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Activity, ArrowDownUp, ArrowUpRight, BadgeCheck, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, Database, ExternalLink, FileJson, Globe, Layers3, Loader2, Share2, ShieldCheck, Star, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SiDiscord, SiGithub, SiMedium, SiTelegram, SiX } from 'react-icons/si';
import TerminalTopbar from '../components/TerminalTopbar';
import TokenLogo from '../components/TokenLogo';
import TokenActivity from '../components/TokenActivity';
import { SubscriptionProvider, useSubscription } from '../components/SubscriptionProvider';
import { WalletProvider } from '../components/WalletProvider';
import { useCurrency } from '../components/CurrencyProvider';
import { useLanguage } from '../components/LanguageProvider';
import { useAdminSession } from '../components/AdminSessionProvider';
import { useApplicationConfiguration } from '../components/ApplicationConfigurationProvider';
import { API_URL } from '../lib/api';
import { MarketToken, formatChange, formatCompactNumber, formatDate, formatMarketValue, formatTokenPrice } from '../lib/tokens';
import { tokenProjectBackground, tokenProjectWebsite, tokenSocialLinks } from '../lib/token-socials';
import ExplorerPriceChart from './ExplorerPriceChart';
import styles from './explorer.module.css';

type DetailTab = 'general' | 'pools' | 'related' | 'supply';
type ExplorerView = 'overview' | 'details' | 'activity';
type SupplyHistoryEvent = { txHash: string; blockNo: string; occurredAt: string; quantityRaw: string; type: 'mint' | 'burn' };
type SupplyHistoryData = {
  ticker: string;
  decimals: number | null;
  totals: { mintedRaw: string; burnedRaw: string; netRaw: string; eventCount: number; maxSupplyRaw: string | null; mintingDisabled: boolean };
  events: SupplyHistoryEvent[];
};
const socialChannels = {
  x: { label: 'X / Twitter', Icon: SiX }, discord: { label: 'Discord', Icon: SiDiscord },
  telegram: { label: 'Telegram', Icon: SiTelegram }, github: { label: 'GitHub', Icon: SiGithub }, medium: { label: 'Medium', Icon: SiMedium },
};
function subscribeViewport(listener: () => void) {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}
function viewportSnapshot() { return `${window.innerWidth}:${window.innerHeight}`; }
const favoritesKey = 'cardyx:explorer-favorites';
const favoritesEvent = 'cardyx:explorer-favorites-updated';
function subscribeFavorites(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(favoritesEvent, listener);
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(favoritesEvent, listener); };
}
function favoritesSnapshot() {
  try { return window.localStorage.getItem(favoritesKey) ?? '[]'; } catch { return '[]'; }
}
function readFavorites(serialized: string): string[] {
  try {
    const saved: unknown = JSON.parse(serialized);
    return Array.isArray(saved) ? saved.filter((value): value is string => typeof value === 'string').slice(0, 200) : [];
  } catch { return []; }
}

export default function TokenExplorerPage() {
  return <WalletProvider><SubscriptionProvider><ExplorerWorkspace /></SubscriptionProvider></WalletProvider>;
}

function ExplorerWorkspace() {
  const router = useRouter();
  const { language } = useLanguage();
  const { currency } = useCurrency();
  const { session: adminSession } = useAdminSession();
  const { configuration, loaded: rulesLoaded, error: rulesError } = useApplicationConfiguration();
  const { canAccess } = useSubscription();
  const de = language === 'de';
  const isAdmin = adminSession?.authenticated === true;
  const [catalog, setCatalog] = useState<{ tokens: MarketToken[]; adaPriceUsd: number | null } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [policyCap, setPolicyCap] = useState<{ tokenId: string; netRaw: string; maxSupplyRaw: string | null; mintingDisabled: boolean } | null>(null);
  const [marketError, setMarketError] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<DetailTab>('general');
  const [view, setView] = useState<ExplorerView>('overview');
  const [metadataPage, setMetadataPage] = useState(1);
  const [poolPage, setPoolPage] = useState(1);
  const [relatedPage, setRelatedPage] = useState(1);
  const viewport = useSyncExternalStore(subscribeViewport, viewportSnapshot, () => '1440:900');
  const [width, height] = viewport.split(':').map(Number);
  const metadataRows = width < 620 ? (height >= 800 ? 4 : 3) : width >= 1100 && height >= 900 ? 10 : width >= 1100 && height >= 760 ? 8 : height >= 640 ? 5 : 3;
  const listSize = height < 540 ? (width >= 620 ? 3 : 2) : width >= 620 ? 6 : height >= 640 ? 4 : 2;
  const savedFavorites = useSyncExternalStore(subscribeFavorites, favoritesSnapshot, () => '[]');
  const [memoryFavorites, setMemoryFavorites] = useState<string[] | null>(null);
  const favorites = memoryFavorites ?? readFavorites(savedFavorites);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    let active = true;
    let running = false;
    const load = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch(`${API_URL}/api/market/catalog`, { cache: 'no-store' });
        const json = await response.json();
        if (!response.ok || !json.success || !Array.isArray(json.data?.tokens)) throw new Error('Market unavailable.');
        if (!active) return;
        const tokens = json.data.tokens as MarketToken[];
        const requested = new URLSearchParams(window.location.search).get('token');
        setCatalog({ tokens, adaPriceUsd: json.data.adaPriceUsd > 0 ? json.data.adaPriceUsd : null });
        setSelectedId((current) => current ?? tokens.find((token) => token.id === requested)?.id ?? tokens.find((token) => token.ticker !== 'ADA' && token.priceAda > 0)?.id ?? tokens[0]?.id ?? null);
        setMarketError(false);
      } catch { if (active) setMarketError(true); }
      finally { running = false; }
    };
    void load();
    const interval = window.setInterval(load, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const selected = catalog?.tokens.find((token) => token.id === selectedId) ?? null;
  const selectedPolicyTokenId = selected?.id ?? null;
  useEffect(() => {
    if (!selectedPolicyTokenId) return;
    let active = true;
    fetch(`${API_URL}/api/market/supply-history/${encodeURIComponent(selectedPolicyTokenId)}?limit=1`, { cache: 'no-store' })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error('Policy supply unavailable.');
        if (active) setPolicyCap({ tokenId: selectedPolicyTokenId, ...json.data.totals });
      })
      .catch(() => { if (active) setPolicyCap(null); });
    return () => { active = false; };
  }, [selectedPolicyTokenId]);
  const tokens = catalog?.tokens ?? [];
  const adaPriceUsd = catalog?.adaPriceUsd ?? null;
  const selectToken = (token: MarketToken) => {
    setSelectedId(token.id); setQuery(''); setTab('general'); setNotice(null);
    setMetadataPage(1); setPoolPage(1); setRelatedPage(1);
    router.replace(`/token-explorer?token=${encodeURIComponent(token.id)}`, { scroll: false });
  };
  const copy = async (value: string, label: string) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const input = document.createElement('textarea');
        input.value = value; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.appendChild(input); input.select();
        try { if (!document.execCommand('copy')) throw new Error('Clipboard unavailable.'); }
        finally { input.remove(); }
      }
      setNotice(`${label} ${de ? 'kopiert' : 'copied'}`);
    } catch { setNotice(de ? 'Kopieren nicht möglich.' : 'Unable to copy.'); }
  };
  const toggleFavorite = () => {
    if (!selected) return;
    const next = favorites.includes(selected.id) ? favorites.filter((id) => id !== selected.id) : [...favorites, selected.id].slice(-200);
    try {
      window.localStorage.setItem(favoritesKey, JSON.stringify(next)); window.dispatchEvent(new Event(favoritesEvent)); setMemoryFavorites(null);
      setNotice(de ? 'Merkliste aktualisiert' : 'Watchlist updated');
    } catch { setMemoryFavorites(next); setNotice(de ? 'Merkliste nur für diese Sitzung gespeichert.' : 'Watchlist saved for this session only.'); }
  };
  const tabs: { id: DetailTab; label: string; Icon: typeof Activity }[] = [
    { id: 'general', label: de ? 'Allgemein' : 'Overview', Icon: Activity },
    { id: 'pools', label: 'Pools', Icon: Layers3 },
                    { id: 'related', label: de ? 'Ähnliche Token' : 'Related tokens', Icon: Globe },
                    { id: 'supply', label: de ? 'Mint & Burn' : 'Mint & burn', Icon: ArrowDownUp },
  ];
  const minted = selected?.onchainSupply ?? null;
  const circulating = selected && selected.circulatingSupply > 0 ? selected.circulatingSupply : null;
  const circulatingDisplay = circulating ?? (selected?.onchainSupply != null && selected.onchainSupply > 0 ? selected.onchainSupply : null);
  const circulatingIsEstimate = circulating === null && circulatingDisplay !== null;
  const tokenNumber = (value: number | null | undefined) => value != null && Number.isFinite(value) && value > 0 ? formatCompactNumber(value) : '—';
  const selectedPolicyCap = policyCap?.tokenId === selected?.id ? policyCap : null;
  const policyMaxSupplyRaw = selectedPolicyCap?.maxSupplyRaw ?? selected?.policyMaxSupplyRaw ?? null;
  const policyCurrentSupplyRaw = selectedPolicyCap?.netRaw ?? selected?.currentSupplyRaw ?? null;
  const policyCapVerified = (selectedPolicyCap?.mintingDisabled === true && policyMaxSupplyRaw !== null)
    || selected?.maxSupplySource === 'cardyx-expired-native-policy';
  const displaySupplyRaw = policyCapVerified ? policyMaxSupplyRaw : policyCurrentSupplyRaw;
  const displaySupplyDecimals = selected?.decimals;
  const displaySupplyValue = displaySupplyRaw && displaySupplyDecimals != null && displaySupplyDecimals >= 0 && displaySupplyDecimals <= 19
    ? Number(BigInt(displaySupplyRaw)) / 10 ** displaySupplyDecimals
    : null;
  const displaySupplyRawUnits = displaySupplyRaw && displaySupplyDecimals == null
    ? `${formatCompactNumber(Number(BigInt(displaySupplyRaw)))} raw`
    : null;
  const maxSupplyDisplay = tokenNumber(displaySupplyValue) !== '—'
    ? tokenNumber(displaySupplyValue)
    : displaySupplyRawUnits ?? tokenNumber(selected?.maxSupply ?? selected?.totalSupply ?? selected?.onchainSupply);
  const maxSupplyLabel = policyCapVerified
    ? (de ? 'Max. Versorgung' : 'Max supply')
    : (de ? 'Max. Versorgung · unbestätigt' : 'Max supply · unverified');
  const maxSupplyNote = policyCapVerified
    ? (de ? 'Minting-Policy abgelaufen; Obergrenze verifiziert' : 'Minting policy expired; cap verified')
    : policyCurrentSupplyRaw !== null
      ? (de ? 'Aktuelle Netto-Ausgabemenge; Obergrenze nicht verifiziert' : 'Current net issued supply; cap unverified')
      : (de ? 'Keine Obergrenze verifiziert; aktuelle Menge nicht verfügbar' : 'No cap verified; current supply unavailable');
  const fdvIsEstimate = selected?.fdvBasis === 'on-chain-supply' || selected?.fdvBasis === 'provider-total-supply';
  const fdvLabel = fdvIsEstimate ? (de ? 'FDV · Schätzung' : 'FDV · estimate') : 'FDV';
  const value = (ada: number, usd: number) => (currency === 'ADA' ? ada : usd) > 0 ? formatMarketValue(ada, usd, currency) : '—';
  const counterpart = (ada: number, usd: number) => (currency === 'ADA' ? usd : ada) > 0 ? formatMarketValue(ada, usd, currency === 'ADA' ? 'USD' : 'ADA') : null;
  const explorerUrl = selected?.fingerprint ? `https://cardanoscan.io/token/${encodeURIComponent(selected.fingerprint)}` : null;
  const socialLinks = selected ? tokenSocialLinks(selected) : [];
  const projectWebsite = selected ? tokenProjectWebsite(selected) : null;
  const projectBackground = selected ? tokenProjectBackground(selected) : null;
  const related = selected ? tokens.filter((token) => token.id !== selected.id && token.ticker !== 'ADA' && (selected.category ? token.category === selected.category : token.priceAda > 0)).slice(0, 9) : [];
  const poolPages = Math.max(1, Math.ceil((selected?.activePools?.length ?? 0) / listSize));
  const currentPoolPage = Math.min(poolPage, poolPages);
  const relatedPages = Math.max(1, Math.ceil(related.length / listSize));
  const currentRelatedPage = Math.min(relatedPage, relatedPages);
  const activityProps = selected ? { marketId: selected.id, ticker: selected.ticker, holderCount: selected.holderCount ?? 0, adaPriceUsd, policyId: selected.policyId, assetName: selected.assetName } : null;

  const metadataEntries: { label: string; content: ReactNode }[] = selected ? [
    { label: 'Name', content: selected.name }, { label: 'Ticker', content: selected.ticker },
    { label: 'Policy ID', content: <IdentityValue value={selected.policyId} label="Policy ID" copy={copy} de={de} /> },
    { label: 'Asset name', content: <IdentityValue value={selected.assetName} label="Asset name" copy={copy} de={de} /> },
    { label: 'Fingerprint', content: <IdentityValue value={selected.fingerprint} label="Fingerprint" copy={copy} de={de} /> },
    { label: de ? 'Dezimalstellen' : 'Decimals', content: selected.decimals ?? '—' },
    { label: de ? 'On-chain Menge' : 'On-chain supply', content: minted ? `${tokenNumber(minted)} ${selected.ticker}` : '—' },
    { label: de ? 'Kategorie' : 'Category', content: selected.category ?? '—' },
    { label: de ? 'Letzte Aktivität' : 'Latest activity', content: selected.latestActivity ? formatDate(selected.latestActivity) : '—' },
    { label: 'Explorer', content: explorerUrl ? <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-300">Cardanoscan<ExternalLink size={11} /></a> : '—' },
  ] : [];
  const metadataPages = Math.max(1, Math.ceil(metadataEntries.length / metadataRows));
  const currentMetadataPage = Math.min(metadataPage, metadataPages);
  const metadata = selected ? <section className={styles.metadata} aria-label={de ? 'Token-Metadaten' : 'Token metadata'}>
    <h2 className={styles.sectionHeading}><FileJson size={14} />{de ? 'Token-Metadaten' : 'Token metadata'}</h2>
    <dl>{metadataEntries.slice((currentMetadataPage - 1) * metadataRows, currentMetadataPage * metadataRows).map((entry) => <MetadataRow key={entry.label} label={entry.label}>{entry.content}</MetadataRow>)}</dl>
    <ExplorerPages page={currentMetadataPage} pages={metadataPages} onChange={setMetadataPage} label={de ? 'Metadaten-Seiten' : 'Metadata pages'} de={de} />
  </section> : null;

  return <div className={styles.page}>
    <TerminalTopbar query={query} onQueryChange={setQuery} choices={tokens} selectedTokenId={selected?.id} onSelectToken={selectToken} onCommunity={() => router.push('/community')} tradeHref={selected ? `/trade?token=${encodeURIComponent(selected.id)}` : '/trade'} />
    <main className={styles.content}>
      {(!rulesLoaded && !isAdmin) || (!catalog && !marketError) ? <div className={styles.empty}><Loader2 size={20} className="animate-spin" />{de ? 'Token Explorer wird geladen' : 'Loading token explorer'}</div>
        : rulesError && !isAdmin ? <p role="alert" className={styles.empty}>{de ? 'Zugangsregeln derzeit nicht verfügbar.' : 'Access rules unavailable.'}</p>
          : !isAdmin && (!configuration.features.explorer.enabled || !canAccess(configuration.features.explorer.minimumTier)) ? <div className={styles.empty}><Link href="/subscription">{configuration.features.explorer.minimumTier} {de ? 'Zugang erforderlich' : 'access required'}</Link></div>
            : !selected ? <p role="alert" className={styles.empty}>{de ? 'Lokale Tokendaten sind derzeit nicht verfügbar.' : 'Local token data unavailable.'}</p>
              : <>
                <section className={styles.identityBand} aria-label={de ? 'Token-Identität und Preis' : 'Token identity and price'}>
                  <div className={styles.identity}><div className={styles.avatar}><TokenLogo src={selected.image} ticker={selected.ticker} size={64} /></div><div className="min-w-0"><div className={styles.tokenTitle}><h1>{selected.ticker}</h1>{selected.catalogVerified && <span className={styles.verified} title={de ? 'Im CARDYX-Katalog bestätigt' : 'Confirmed in the CARDYX catalog'}><BadgeCheck size={12} />{de ? 'Verifiziert' : 'Verified'}</span>}</div><p className={styles.name} title={selected.name}>{selected.name}</p><p className={styles.description} title={selected.description ?? undefined}>{selected.description ?? (de ? 'Natives Cardano-Asset' : 'Native Cardano asset')}</p><div className={styles.tags}>{selected.category && <span>{selected.category}</span>}<span>Cardano</span><span>{de ? 'Native Asset' : 'Native asset'}</span></div></div></div>
                  <div className={styles.quote}><strong>{formatTokenPrice(selected.priceAda, selected.priceUsd, currency)}</strong><span className={`${styles.daily} ${selected.change24h >= 0 ? styles.positive : styles.negative}`}><Activity size={14} />{Number.isFinite(selected.change24h) ? formatChange(selected.change24h) : '—'} <small>(24h)</small></span><small>{formatTokenPrice(selected.priceAda, selected.priceUsd, currency === 'ADA' ? 'USD' : 'ADA')}</small><div className={styles.actions}>
                    <button type="button" aria-label={de ? 'Token-Link kopieren' : 'Copy token link'} title={de ? 'Token-Link kopieren' : 'Copy token link'} onClick={() => void copy(`${window.location.origin}/token-explorer?token=${encodeURIComponent(selected.id)}`, de ? 'Token-Link' : 'Token link')}><Share2 size={15} /></button>
                    {selected.policyId && <button type="button" aria-label={de ? 'Policy ID kopieren' : 'Copy policy ID'} title={de ? 'Policy ID kopieren' : 'Copy policy ID'} onClick={() => void copy(selected.policyId!, 'Policy ID')}><Copy size={15} /></button>}
                    <button type="button" aria-label={de ? 'Token merken' : 'Bookmark token'} title={favorites.includes(selected.id) ? (de ? 'Aus Merkliste entfernen' : 'Remove bookmark') : (de ? 'Token merken' : 'Bookmark token')} aria-pressed={favorites.includes(selected.id)} onClick={toggleFavorite}><Star size={15} fill={favorites.includes(selected.id) ? 'currentColor' : 'none'} /></button>
                    {explorerUrl && <a href={explorerUrl} target="_blank" rel="noopener noreferrer" aria-label={de ? 'Token auf Cardanoscan öffnen' : 'Open token on Cardanoscan'} title="Cardanoscan"><ExternalLink size={15} /></a>}
                  </div></div>
                  <div className={`${styles.artwork} ${projectBackground ? styles.projectArtwork : ''}`} data-project-banner={selected.id}><Image src={projectBackground ?? '/cardyx-sidebar-logo.jpeg'} alt="" fill sizes="(max-width: 1100px) 0px, 600px" /><div className={styles.artLabel}><span>CARDANO MAINNET</span><strong>{selected.ticker}</strong><small>{selected.category ?? 'Native asset'} · {selected.activePools?.length ?? 0} DEX pools</small></div>{!projectBackground && <div className={styles.artToken}><TokenLogo src={selected.image} ticker={selected.ticker} size={96} /></div>}</div>
                </section>
                {notice && <p role="status" className={styles.notice}><Check size={12} className="mr-1 inline" />{notice}</p>}{marketError && !notice && <p role="status" className={styles.notice}>{de ? 'Aktualisierung fehlgeschlagen; letzter verfügbarer Datenstand.' : 'Refresh failed; showing last available data.'}</p>}
                <div className={styles.viewTabs} role="tablist" aria-label={de ? 'Explorer-Ansicht' : 'Explorer view'}>{([{ id: 'overview', label: de ? 'Übersicht' : 'Overview', Icon: Activity }, { id: 'details', label: de ? 'Details' : 'Details', Icon: FileJson }, { id: 'activity', label: de ? 'Aktivität' : 'Activity', Icon: Users }] as const).map(({ id, label, Icon }) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}><Icon size={14} />{label}</button>)}</div>
                <div className={styles.workspace} data-view={view}><div className={styles.primary}>
                  <div className={styles.overview}><dl className={styles.statistics}>
                    <div className={styles.statColumn}><Metric label={selected.marketCapBasis === 'on-chain-supply-estimate' ? (de ? 'Marktkapitalisierung · Schätzung' : 'Market cap · estimate') : (de ? 'Marktkapitalisierung' : 'Market cap')} value={value(selected.marketCapAda, selected.marketCapUsd)} secondary={counterpart(selected.marketCapAda, selected.marketCapUsd)} note={selected.marketCapBasis === 'on-chain-supply-estimate' ? (de ? 'Preis × aktuelle On-chain-Menge; Umlaufmenge nicht verifiziert' : 'Price × current on-chain supply; circulating supply unverified') : selected.marketCapBasis === 'verified-circulating-supply' ? (de ? 'Umlaufmenge via Minswap' : 'Circulating supply via Minswap') : null} /><Metric label={de ? '24h Volumen' : '24h volume'} value={value(selected.volume24hAda, selected.volume24hUsd)} secondary={counterpart(selected.volume24hAda, selected.volume24hUsd)} /><Metric label={fdvLabel} value={value(selected.fdvAda, selected.fdvUsd)} note={selected.fdvBasis === 'maximum-supply' ? (de ? 'Basierend auf verifizierter Maximalversorgung' : 'Based on verified maximum supply') : selected.fdvBasis === 'provider-total-supply' ? (de ? 'Basierend auf Anbieter-Gesamtmenge; Cap nicht verifiziert' : 'Based on provider-reported total supply; cap unverified') : selected.fdvBasis === 'on-chain-supply' ? (de ? 'Preis × aktuelle Netto-Ausgabemenge; Cap nicht verifiziert' : 'Price × current net issued supply; cap unverified') : null} /></div>
                    <div className={styles.statColumn}><Metric label={circulatingIsEstimate ? (de ? 'Umlaufmenge · Schätzung' : 'Circulating supply · estimate') : (de ? 'Umlaufmenge' : 'Circulating supply')} value={tokenNumber(circulatingDisplay)} note={circulatingIsEstimate ? (de ? 'On-chain-Bestand; Umlaufmenge nicht verifiziert' : 'On-chain balance; circulation unverified') : circulating !== null ? (de ? 'Minswap-Meldung' : 'Reported by Minswap') : (de ? 'Nicht verifiziert' : 'Unverified')} noteTone={circulatingIsEstimate || circulating === null ? 'unverified' : 'verified'} /><Metric label={de ? 'On-chain Menge' : 'On-chain supply'} value={tokenNumber(minted)} secondary={selected.onchainSupplyExact && minted !== null ? `${selected.onchainSupplyExact} ${selected.ticker}` : null} note={selected.supplySource === 'minswap-api' ? (de ? 'Tokenidentität via Minswap geprüft' : 'Token identity verified via Minswap') : selected.supplySource === 'cardyx-on-chain' ? (de ? 'CARDYX UTxO-Snapshot' : 'CARDYX UTxO snapshot') : null} /><Metric label={maxSupplyLabel} value={maxSupplyDisplay} note={maxSupplyNote} noteTone={policyCapVerified ? 'verified' : 'unverified'} /></div>
                    <div className={styles.statColumn}><Metric label={de ? 'Halter' : 'Holders'} value={tokenNumber(selected.holderCount)} secondary={selected.holderChange24h != null ? `${selected.holderChange24h >= 0 ? '+' : ''}${selected.holderChange24h} (24h)` : null} /><Metric label={de ? 'Liquidität (Pools)' : 'Pool liquidity'} value={value(selected.liquidityAda ?? 0, (selected.liquidityAda ?? 0) * (adaPriceUsd ?? 0))} /><Metric label={de ? 'Aktive Pools' : 'Active pools'} value={String(selected.activePools?.length ?? 0)} /></div>
                  </dl><ExplorerPriceChart key={selected.id} marketId={selected.id} ticker={selected.ticker} adaPriceUsd={adaPriceUsd} /></div>
                  <div className={styles.details}><div role="tablist" aria-label={de ? 'Token-Details' : 'Token details'} className={styles.tabs}>{tabs.map(({ id, label, Icon }) => <button key={id} id={`explorer-tab-${id}`} type="button" role="tab" aria-label={label} title={label} aria-selected={tab === id} aria-controls={`explorer-panel-${id}`} onClick={() => setTab(id)}><Icon size={13} /><span>{label}</span></button>)}</div><section role="tabpanel" id={`explorer-panel-${tab}`} aria-labelledby={`explorer-tab-${tab}`} className={styles.detailBody}>
                    {tab === 'general' && <div className={styles.general}>{metadata}<section className={styles.narrative}><h2 className={styles.sectionHeading}><Database size={14} />{de ? 'Beschreibung' : 'Description'}</h2><div className={styles.narrativeBody}><p>{selected.description ?? (de ? `${selected.name} ist ein natives Asset auf Cardano. Die Identität wird durch Policy ID und Asset-Namen bestimmt.` : `${selected.name} is a native asset on Cardano, identified by its policy ID and asset name.`)}</p><ul className={styles.facts}><li><ShieldCheck size={13} />{de ? 'Cardano-native Tokenidentität' : 'Cardano-native token identity'}</li>{selected.decimals != null && <li><CheckCircle2 size={13} />{selected.decimals} {de ? 'Dezimalstellen' : 'decimals'}</li>}<li><Layers3 size={13} />{selected.activePools?.length ?? 0} {de ? 'indexierte lokale Pools' : 'indexed local pools'}</li>{selected.snapshotRefreshedAt && <li><Activity size={13} />{formatDate(selected.snapshotRefreshedAt)}</li>}</ul>{projectWebsite && <a className={styles.chainLink} href={projectWebsite} target="_blank" rel="noopener noreferrer" title={projectWebsite}><span><Globe size={14} />{de ? 'Offizielle Webseite' : 'Official website'}</span><ExternalLink size={13} /></a>}{socialLinks.length > 0 && <nav className={styles.socialLinks} aria-label={de ? 'Offizielle Projektkanäle' : 'Official project channels'}>{socialLinks.map(({ channel, url }) => { const { label, Icon } = socialChannels[channel]; return <a key={channel} href={url} target="_blank" rel="noopener noreferrer" title={label}><span><Icon size={14} aria-hidden="true" />{label}</span><ExternalLink size={12} aria-hidden="true" /></a>; })}</nav>}</div></section></div>}
                    {tab === 'pools' && <div className={styles.listPanel}><div className={styles.poolList}>{selected.activePools?.length ? selected.activePools.slice((currentPoolPage - 1) * listSize, currentPoolPage * listSize).map((pool) => <article key={pool.poolId}><div className="min-w-0"><h3><Layers3 size={15} />{pool.dex} <span className="text-xs text-slate-500">{pool.version}</span></h3><p title={pool.poolId}>{pool.poolId}</p></div><Link href={`/trade?token=${encodeURIComponent(selected.id)}`}>{de ? 'Handeln' : 'Trade'}<ArrowUpRight size={12} /></Link></article>) : <p className={styles.empty}>{de ? 'Keine aktiven lokalen Pools indexiert.' : 'No active local pools indexed.'}</p>}</div><ExplorerPages page={currentPoolPage} pages={poolPages} onChange={setPoolPage} label={de ? 'Pool-Seiten' : 'Pool pages'} de={de} /></div>}
                    {tab === 'related' && <div className={styles.listPanel}><div className={styles.related}>{related.length ? related.slice((currentRelatedPage - 1) * listSize, currentRelatedPage * listSize).map((token) => <button key={token.id} type="button" onClick={() => selectToken(token)}><TokenLogo src={token.image} ticker={token.ticker} size={34} /><div><strong>{token.ticker}</strong><small>{token.name}</small><span className={token.change24h >= 0 ? styles.positive : styles.negative}>{formatChange(token.change24h)}</span></div></button>) : <p className={styles.empty}>{de ? 'Keine ähnlichen Token im Katalog.' : 'No related tokens in the catalog.'}</p>}</div><ExplorerPages page={currentRelatedPage} pages={relatedPages} onChange={setRelatedPage} label={de ? 'Ähnliche-Token-Seiten' : 'Related token pages'} de={de} /></div>}
                    {tab === 'supply' && <SupplyHistoryPanel key={selected.id} token={selected} de={de} />}
                  </section></div>
                </div><aside className={styles.rail} aria-label={de ? 'Terminal und Aktivität' : 'Terminal and activity'}>
                  {activityProps && <div className={styles.activityCompact}><TokenActivity key={`${selected.id}:compact`} {...activityProps} compact scrollable /></div>}
                </aside></div>
              </>}
    </main>
  </div>;
}

function ExplorerPages({ page, pages, onChange, label, de }: { page: number; pages: number; onChange: (page: number) => void; label: string; de: boolean }) {
  return <nav className={styles.pager} aria-label={label}><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={`${de ? 'Vorherige Seite' : 'Previous page'}: ${label}`} title={de ? 'Vorherige Seite' : 'Previous page'}><ChevronLeft size={14} /></button><span aria-live="polite">{page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={`${de ? 'Nächste Seite' : 'Next page'}: ${label}`} title={de ? 'Nächste Seite' : 'Next page'}><ChevronRight size={14} /></button></nav>;
}

function MetadataRow({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}
function IdentityValue({ value, label, copy, de }: { value: string | null | undefined; label: string; copy: (value: string, label: string) => Promise<void>; de: boolean }) {
  return value != null ? <span className={styles.identityValue}><span>{value || '∅'}</span><button type="button" aria-label={`${label} ${de ? 'kopieren' : 'copy'}`} title={`${label} ${de ? 'kopieren' : 'copy'}`} onClick={() => void copy(value, label)}><Copy size={11} /></button></span> : <>—</>;
}
function Metric({ label, value, secondary, note, noteTone }: { label: string; value: string; secondary?: string | null; note?: string | null; noteTone?: 'verified' | 'unverified' }) {
  return <div className={styles.metric}><dt>{label}</dt><dd>{value}</dd>{secondary && <small>{secondary}</small>}{note && <small className={styles.metricNote} data-tone={noteTone}>{note}</small>}</div>;
}

function formatAssetQuantity(raw: string, decimals: number | null, locale: string): string {
  if (!/^[-]?\d+$/.test(raw)) return '—';
  if (decimals === null || !Number.isInteger(decimals) || decimals < 0 || decimals > 19) return `${raw} raw`;
  const quantity = BigInt(raw);
  const negative = quantity < BigInt(0);
  const absolute = negative ? BigInt(0) - quantity : quantity;
  const scale = BigInt(10) ** BigInt(decimals);
  const whole = (absolute / scale).toLocaleString(locale);
  const fraction = decimals ? (absolute % scale).toString().padStart(decimals, '0').replace(/0+$/, '') : '';
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

function SupplyHistoryPanel({ token, de }: { token: MarketToken; de: boolean }) {
  const [page, setPage] = useState(0);
  const [state, setState] = useState<{ loading: boolean; error: boolean; data: SupplyHistoryData | null }>({ loading: true, error: false, data: null });
  const limit = 8;

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/market/supply-history/${encodeURIComponent(token.id)}?limit=${limit}&offset=${page * limit}`, { cache: 'no-store' })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error('Supply history unavailable.');
        if (active) setState({ loading: false, error: false, data: json.data as SupplyHistoryData });
      })
      .catch(() => { if (active) setState({ loading: false, error: true, data: null }); });
    return () => { active = false; };
  }, [token.id, page]);

  const data = state.data;
  const pages = Math.max(1, Math.ceil((data?.totals.eventCount ?? 0) / limit));
  const locale = de ? 'de-DE' : 'en-US';
  const cardanoscanTokenUrl = token.fingerprint ? `https://cardanoscan.io/token/${encodeURIComponent(token.fingerprint)}` : null;

  return <section className={styles.supplyHistory} aria-label={de ? 'Mint- und Burn-Historie' : 'Mint and burn history'}>
    <header className={styles.supplyHeader}>
      <div><h2>{de ? 'Supply-Historie' : 'Supply history'}</h2><p>{de ? 'On-chain-Mint- und Burn-Transaktionen' : 'On-chain mint and burn transactions'}</p></div>
      {cardanoscanTokenUrl && <a href={cardanoscanTokenUrl} target="_blank" rel="noopener noreferrer">Cardanoscan <ExternalLink size={12} /></a>}
    </header>
    {state.loading && !data ? <p className={styles.supplyMessage}>{de ? 'Mint-/Burn-Historie wird geladen' : 'Loading mint/burn history'}</p>
      : state.error || !data ? <p role="alert" className={styles.supplyMessage}>{de ? 'Mint-/Burn-Historie derzeit nicht verfügbar.' : 'Mint/burn history is currently unavailable.'}</p>
        : <>
          <dl className={styles.supplyTotals}>
            <div><dt>{de ? 'Gemintet' : 'Minted'}</dt><dd>{formatAssetQuantity(data.totals.mintedRaw, data.decimals, locale)}</dd></div>
            <div data-kind="burn"><dt>{de ? 'Geburnt' : 'Burned'}</dt><dd>{formatAssetQuantity(data.totals.burnedRaw, data.decimals, locale)}</dd></div>
            <div><dt>{de ? 'Netto ausgegeben' : 'Net issued'}</dt><dd>{formatAssetQuantity(data.totals.netRaw, data.decimals, locale)}</dd></div>
            <div><dt>{data.totals.maxSupplyRaw === null ? (de ? 'Aktuelle Versorgung · Cap unbestätigt' : 'Current supply · cap unverified') : (de ? 'Policy-Obergrenze' : 'Policy cap')}</dt><dd>{formatAssetQuantity(data.totals.maxSupplyRaw ?? data.totals.netRaw, data.decimals, locale)}</dd></div>
          </dl>
          <div className={styles.supplyTableWrap}>
            {data.events.length ? <table className={styles.supplyTable}>
              <thead><tr><th>{de ? 'Zeitpunkt' : 'Time'}</th><th>{de ? 'Vorgang' : 'Event'}</th><th>{de ? 'Menge' : 'Quantity'}</th><th>Cardanoscan</th></tr></thead>
              <tbody>{data.events.map((event) => <tr key={event.txHash}>
                <td><time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleDateString(locale)}<small>#{event.blockNo}</small></time></td>
                <td><span data-kind={event.type}>{event.type === 'mint' ? 'Mint' : 'Burn'}</span></td>
                <td data-kind={event.type}>{formatAssetQuantity(event.quantityRaw, data.decimals, locale)} {token.ticker}</td>
                <td><a href={`https://cardanoscan.io/transaction/${encodeURIComponent(event.txHash)}`} target="_blank" rel="noopener noreferrer" title={event.txHash}>{event.txHash.slice(0, 8)}…{event.txHash.slice(-6)} <ExternalLink size={10} /></a></td>
              </tr>)}</tbody>
            </table> : <p className={styles.supplyMessage}>{de ? 'Keine Mint- oder Burn-Events indexiert.' : 'No mint or burn events indexed.'}</p>}
          </div>
          <footer className={styles.supplyFooter}><span>{data.totals.eventCount.toLocaleString(locale)} {de ? 'Transaktionen · Quelle: Cardano DB-Sync' : 'transactions · source: Cardano DB-Sync'} · {data.totals.mintingDisabled ? (de ? 'Policy blockiert weitere Mints' : 'Policy prevents further mints') : (de ? 'Netto-Ausgabemenge aktuell; Cap nicht verifiziert' : 'Current net issued supply; cap unverified')}</span>{data.totals.eventCount > limit && <ExplorerPages page={page + 1} pages={pages} onChange={(next) => setPage(next - 1)} label={de ? 'Mint-/Burn-Seiten' : 'Mint/burn pages'} de={de} />}</footer>
        </>}
  </section>;
}