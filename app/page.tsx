'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChatCircleDots, Plus, Compass, ArrowRight, User } from '@phosphor-icons/react';

type Character = {
  id: string;
  name: string;
  avatar_url: string | null;
  gender: string;
  persona: string;
  greeting: string;
  scenario: string;
};

type Session = {
  id: string;
  title: string;
  character: { id: string; name: string; avatar_url: string | null };
  updated_at: string;
};

export default function Dashboard() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cRes, sRes] = await Promise.all([fetch('/api/characters'), fetch('/api/sessions')]);
        const cData = await cRes.json();
        const sData = await sRes.json();
        setCharacters(Array.isArray(cData) ? cData : []);
        setSessions(Array.isArray(sData) ? sData : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main className="flex-1 grid place-items-center bg-zinc-950 text-zinc-500 p-8">
        <div className="flex flex-col gap-3 items-center">
          <div className="h-8 w-8 rounded-full border-2 border-zinc-800 border-t-zinc-300 animate-spin" />
          <p className="text-xs font-mono">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 flex flex-col gap-8">
      {/* Header Banner */}
      <section className="rounded-2xl border border-zinc-900 bg-zinc-900/30 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> RAG Memory Engine Active
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Stateful AI Persona Roleplay</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Engage in immersive, multi-turn roleplay conversations. Memories, preferences, and facts are automatically indexed via BGE-M3 vector search.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/characters"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-sm hover:bg-zinc-200 transition-colors"
          >
            <Compass size={18} />
            <span>Explore Catalog</span>
          </Link>
          <Link
            href="/characters/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 font-medium text-sm hover:bg-zinc-800 transition-colors"
          >
            <Plus size={18} />
            <span>Create Persona</span>
          </Link>
        </div>
      </section>

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <ChatCircleDots size={20} className="text-zinc-400" /> Recent Chat Rooms
            </h2>
            <span className="text-xs font-mono text-zinc-500">{sessions.length} active sessions</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.slice(0, 6).map((s) => (
              <Link
                key={s.id}
                href={`/chat/${s.character?.id || 'vey'}?sessionId=${s.id}`}
                className="group p-4 rounded-xl border border-zinc-900 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-800 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar url={s.character?.avatar_url} name={s.character?.name || 'Persona'} />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-200 truncate group-hover:text-zinc-100">
                      {s.title}
                    </h3>
                    <p className="text-xs text-zinc-500 truncate">{s.character?.name || 'Unknown'}</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-1 transition-all shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Persona Catalog */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <User size={20} className="text-zinc-400" /> Available Personas
          </h2>
          <Link href="/characters" className="text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors flex items-center gap-1">
            View All <ArrowRight size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {characters.map((c) => (
            <div
              key={c.id}
              className="group p-5 rounded-2xl border border-zinc-900 bg-zinc-900/30 hover:bg-zinc-900/70 hover:border-zinc-800 transition-all flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar url={c.avatar_url} name={c.name} size="lg" />
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-zinc-100 truncate">{c.name}</h3>
                    <span className="inline-block text-[11px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      {c.gender}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                  {stripTags(c.persona)}
                </p>
              </div>

              <div className="pt-2 border-t border-zinc-900/80 flex items-center justify-between gap-2">
                <Link
                  href={`/characters/${c.id}/edit`}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Edit
                </Link>
                <Link
                  href={`/chat/${c.id}`}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium transition-colors flex items-center gap-1"
                >
                  Chat <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Avatar({ url, name, size = 'md' }: { url: string | null; name: string; size?: 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const dim = size === 'lg' ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-xs';

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={`${dim} rounded-full object-cover shrink-0 border border-zinc-800`} />;
  }
  return (
    <span className={`${dim} rounded-full bg-zinc-800 border border-zinc-700 grid place-items-center font-medium shrink-0 text-zinc-300`}>
      {initials}
    </span>
  );
}

function stripTags(s: string): string {
  return s.replace(/\[[^\]]*\]/g, '').trim();
}
