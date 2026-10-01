import { redirect } from 'next/navigation';

export default async function TradeNewRedirect({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  redirect(typeof token === 'string' ? `/trade?token=${encodeURIComponent(token)}` : '/trade');
}
