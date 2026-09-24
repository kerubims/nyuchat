'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass, Plus, MagnifyingGlass, ChatCircleDots, PencilSimple, Trash } from '@phosphor-icons/react';

type Character = {
  id: string;
  name: string;
  avatar_url: string | null;
  gender: string;
  persona: string;
  greeting: string;
  scenario: string;
};

export default function CharactersCatalog() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [search, setSearch] = useState('');
  const [filterGender, setFilterGender] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/characters');
      const data = await res.json();
      setCharacters(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete persona "${name}"?`)) return;
    try {
      const res = await fetch(`/api/characters/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCharacters((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = characters.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.persona.toLowerCase().includes(search.toLowerCase()) ||
      c.scenario.toLowerCase().includes(search.toLowerCase());
    const matchGender = filterGender === 'all' || c.gender.toLowerCase() === filterGender.toLowerCase();
    return matchSearch && matchGender;
  });

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-900">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Compass size={24} className="text-zinc-400" /> Persona Catalog
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Browse and manage stateful AI personas for roleplay.
          </p>
        </div>

        <Link
          href="/characters/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors self-start md:self-auto"
        >
          <Plus size={16} weight="bold" />
          <span>Create Persona</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search personas..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-700 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {['all', 'Female', 'Male'].map((g) => (
            <button
              key={g}
              onClick={() => setFilterGender(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filterGender === g
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid place-items-center py-16 text-zinc-500">
          <div className="h-6 w-6 rounded-full border-2 border-zinc-800 border-t-zinc-400 animate-spin mb-2" />
          <p className="text-xs font-mono">Loading catalog...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-900 rounded-2xl p-8">
          <p className="text-sm text-zinc-400">No personas match your search.</p>
          <button onClick={() => { setSearch(''); setFilterGender('all'); }} className="mt-2 text-xs text-zinc-500 underline">
            Reset filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="group rounded-2xl border border-zinc-900 bg-zinc-900/30 p-5 hover:bg-zinc-900/70 hover:border-zinc-800 transition-all flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar url={c.avatar_url} name={c.name} />
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-zinc-100 truncate">{c.name}</h2>
                      <span className="inline-block text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                        {c.gender}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      href={`/characters/${c.id}/edit`}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                      title="Edit Persona"
                    >
                      <PencilSimple size={15} />
                    </Link>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                      title="Delete Persona"
                    >
                      <Trash size={15} />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                  {stripTags(c.persona)}
                </p>

                {c.scenario && (
                  <div className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-900 text-[11px] text-zinc-500 line-clamp-2 italic">
                    &quot;{c.scenario}&quot;
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-900 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-600">ID: {c.id}</span>
                <Link
                  href={`/chat/${c.id}`}
                  className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors flex items-center gap-1.5"
                >
                  <ChatCircleDots size={16} />
                  <span>Start Chat</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-10 w-10 rounded-full object-cover shrink-0 border border-zinc-800" />;
  }
  return (
    <span className="h-10 w-10 rounded-full bg-zinc-800 border border-zinc-700 grid place-items-center text-xs font-medium shrink-0 text-zinc-300">
      {initials}
    </span>
  );
}

function stripTags(s: string): string {
  return s.replace(/\[[^\]]*\]/g, '').trim();
}
