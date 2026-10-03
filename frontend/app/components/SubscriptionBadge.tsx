'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from './LanguageProvider';
import { useSubscription } from './SubscriptionProvider';
import { useAdminSession } from './AdminSessionProvider';

export default function SubscriptionBadge({ compact = false }: { compact?: boolean }) {
  const { tier, plans } = useSubscription();
  const { session } = useAdminSession();
  const { language } = useLanguage();
  const isAdmin = session?.authenticated === true;
  const role = isAdmin ? 'ADMIN' : tier;
  const logo = isAdmin ? '/subscriptions/admin.jpeg' : plans.find((plan) => plan.tier === tier)?.logo ?? `/subscriptions/${tier.toLowerCase()}.jpeg`;
  const label = isAdmin ? (language === 'de' ? 'Adminverwaltung: ADMIN' : 'Admin management: ADMIN') : `${language === 'de' ? 'Mein Abo' : 'My subscription'}: ${tier}`;
  return <Link href={isAdmin ? '/admin?section=nfts' : '/subscription'} aria-label={label} title={label} className={`${compact ? 'h-9 w-[104px]' : 'h-10 w-32'} block shrink-0 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 sm:h-12 sm:w-[152px]`}>
    <Image src={logo} alt={`${language === 'de' ? 'Aktiver Zugang' : 'Active access'}: ${role}`} width={653} height={206} className="h-full w-full object-contain" />
  </Link>;
}