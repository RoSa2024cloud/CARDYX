'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Hash, MessageCircle, Radio, Send, Users, Wifi } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import { WalletProvider } from '../components/WalletProvider';
import { useLanguage } from '../components/LanguageProvider';
import { API_URL } from '../lib/api';

interface CommunityMessage {
  id: number;
  channel: string;
  author_name: string;
  body: string;
  created_at: string;
}

const channels = [
  { id: 'general', label: 'General', description: 'CARDYX community lounge' },
  { id: 'trading', label: 'Trading floor', description: 'Markets, setups, execution' },
  { id: 'builders', label: 'Builders', description: 'Indexer, API and product work' },
] as const;

export default function CommunityPage() {
  return <WalletProvider><CommunityWorkspace /></WalletProvider>;
}

function CommunityWorkspace() {
  const { language } = useLanguage();
  const router = useRouter();
  const [channel, setChannel] = useState('general');
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [authorName, setAuthorName] = useState(() => typeof window === 'undefined' ? '' : window.localStorage.getItem('cardyx-community-name') ?? '');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/api/community/messages?channel=${encodeURIComponent(channel)}`);
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error('Community unavailable');
        if (active) {
          setMessages(json.data ?? []);
          setError(null);
          setLoading(false);
        }
      } catch {
        if (active) {
          setError(language === 'de' ? 'Der Community-Chat ist derzeit nicht erreichbar.' : 'The community chat is currently unavailable.');
          setLoading(false);
        }
      }
    };
    void load();
    const interval = window.setInterval(load, 5_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [channel, language]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const name = authorName.trim();
    const body = draft.trim();
    if (name.length < 2 || name.length > 32 || !body || sending) return;
    setSending(true);
    try {
      const response = await fetch(`${API_URL}/api/community/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel, authorName: name, body }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error ?? 'Message failed');
      window.localStorage.setItem('cardyx-community-name', name);
      setMessages((current) => [...current, json.data]);
      setDraft('');
      setError(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Message failed');
    } finally {
      setSending(false);
    }
  };

  const activeChannel = channels.find((entry) => entry.id === channel) ?? channels[0];

  return (
    <main className="min-h-screen bg-[#070b12] text-slate-200">
      <Navbar onTradeClick={() => router.push('/trade')} />
      <div className="mx-auto max-w-[1440px] px-3 py-5 sm:px-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">CARDYX COMMUNITY</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Talk, trade, build.</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">{language === 'de' ? 'Ein eigener Raum fuer Trader, Builder und Cardano-Leute.' : 'A CARDYX-native room for traders, builders and Cardano people.'}</p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-xs font-semibold text-emerald-300"><Wifi className="h-3.5 w-3.5" /> {language === 'de' ? 'CARDYX live' : 'CARDYX live'}</div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)_230px]">
          <aside className="rounded-md border border-white/10 bg-[#0b111b] p-3">
            <div className="mb-3 flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"><Hash className="h-3.5 w-3.5" /> Channels</div>
            <nav className="space-y-1" aria-label="Community channels">
              {channels.map((entry) => <button key={entry.id} type="button" onClick={() => setChannel(entry.id)} className={`w-full rounded px-3 py-2.5 text-left transition-colors ${channel === entry.id ? 'bg-cyan-400/10 text-cyan-200' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'}`}><span className="block text-sm font-semibold">{entry.label}</span><span className="mt-0.5 block truncate text-[10px] text-slate-600">{entry.description}</span></button>)}
            </nav>
          </aside>

          <section className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-md border border-white/10 bg-[#0b111b]" aria-label="CARDYX Community Chat">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded bg-cyan-400/10 text-cyan-300"><MessageCircle className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-white">{activeChannel.label}</h2><p className="text-[10px] text-slate-500">{activeChannel.description}</p></div></div><span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> online</span></div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {loading ? <p className="py-16 text-center text-xs text-slate-500">{language === 'de' ? 'Nachrichten werden geladen...' : 'Loading messages...'}</p> : messages.length === 0 ? <div className="py-20 text-center"><MessageCircle className="mx-auto h-8 w-8 text-slate-700" /><p className="mt-3 text-sm font-semibold text-slate-300">{language === 'de' ? 'Noch ist es ruhig hier.' : 'It is quiet here for now.'}</p><p className="mt-1 text-xs text-slate-500">{language === 'de' ? 'Starte die erste Unterhaltung.' : 'Start the first conversation.'}</p></div> : messages.map((message) => <article key={message.id} className="flex gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-blue-500/10 text-xs font-bold text-blue-300">{message.author_name.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><div className="flex flex-wrap items-baseline gap-2"><strong className="text-xs text-slate-200">{message.author_name}</strong><time className="text-[10px] text-slate-600">{new Date(message.created_at).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-400">{message.body}</p></div></article>)}
            </div>
            <form onSubmit={sendMessage} className="border-t border-white/10 p-3"><div className="mb-2 flex gap-2"><input value={authorName} onChange={(event) => setAuthorName(event.target.value)} maxLength={32} placeholder={language === 'de' ? 'Dein Name' : 'Your name'} aria-label={language === 'de' ? 'Dein Name' : 'Your name'} className="w-32 rounded border border-white/10 bg-[#070b12] px-2.5 py-2 text-xs text-white placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none" /><span className="flex items-center text-[10px] text-slate-600">{language === 'de' ? 'Nachrichten werden CARDYX-intern gespeichert.' : 'Messages are stored by CARDYX.'}</span></div><div className="flex gap-2"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} rows={2} placeholder={language === 'de' ? 'Nachricht an die Community...' : 'Message the community...'} aria-label={language === 'de' ? 'Nachricht' : 'Message'} className="min-w-0 flex-1 resize-none rounded border border-white/10 bg-[#070b12] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none" /><button type="submit" disabled={sending || authorName.trim().length < 2 || !draft.trim()} aria-label={language === 'de' ? 'Nachricht senden' : 'Send message'} className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded bg-cyan-400 text-[#061016] transition-colors hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"><Send className="h-4 w-4" /></button></div></form>
            {error && <p role="alert" className="border-t border-rose-400/20 bg-rose-400/[0.05] px-4 py-2 text-xs text-rose-300">{error}</p>}
          </section>

          <aside className="space-y-4">
            <section className="rounded-md border border-white/10 bg-[#0b111b] p-4"><h2 className="flex items-center gap-2 text-sm font-bold text-white"><Users className="h-4 w-4 text-cyan-400" /> Community</h2><div className="mt-4 grid grid-cols-2 gap-3"><div><p className="text-[10px] uppercase text-slate-500">Members</p><p className="mt-1 text-xl font-bold text-white">—</p></div><div><p className="text-[10px] uppercase text-slate-500">Rooms</p><p className="mt-1 text-xl font-bold text-white">{channels.length}</p></div></div></section>
            <section className="rounded-md border border-white/10 bg-[#0b111b] p-4"><h2 className="flex items-center gap-2 text-sm font-bold text-white"><Radio className="h-4 w-4 text-emerald-400" /> Community code</h2><p className="mt-3 text-xs leading-5 text-slate-500">Be respectful, share signal with context, and keep wallet secrets private.</p></section>
          </aside>
        </div>
      </div>
    </main>
  );
}
