'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

type Character = {
  id: string;
  name: string;
  avatar_url: string | null;
  gender: string;
  persona: string;
  greeting: string;
  scenario: string;
};

type Message = {
  id?: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
};

type Session = {
  id: string;
  title: string;
  character: { id: string; name: string; avatar_url: string | null };
};

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadCharacters = useCallback(async () => {
    const res = await fetch('/api/characters');
    setCharacters(await res.json());
  }, []);

  const loadSessions = useCallback(async () => {
    const res = await fetch('/api/sessions');
    const j: Session[] = await res.json();
    setSessions(j);
    return j;
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadCharacters();
      const list = await loadSessions();
      if (list.length) await openSession(list[0]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const openSession = useCallback(
    async (s: Session) => {
      setActiveSession(s);
      setDraft(null);
      const ch = characters.find((c) => c.id === s.character.id) ?? null;
      setActiveCharacter(ch);
      const res = await fetch(`/api/sessions/${s.id}`);
      const j: { messages: Message[] } = await res.json();
      setMessages(j.messages);
    },
    [characters]
  );

  const startSession = useCallback(
    async (character: Character) => {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id }),
      });
      const s: Session & { character_id: string } = await res.json();
      const session: Session = { id: s.id, title: s.title, character: { ...s.character, id: s.character_id } };
      const list = await loadSessions();
      setActiveCharacter(character);
      setMessages([{ sender: 'assistant', content: character.greeting }]);
      setActiveSession(session);
      void list;
    },
    [loadSessions]
  );

  const doTranslate = useCallback(async () => {
    if (!input.trim()) return;
    setTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });
      const j: { translation?: string; error?: string } = await res.json();
      setDraft(j.translation ?? input);
    } finally {
      setTranslating(false);
    }
  }, [input]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!activeSession || !text.trim() || streaming) return;
      const content = text.trim();
      setMessages((m) => [...m, { sender: 'user', content }]);
      setInput('');
      setDraft(null);
      setStreaming(true);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSession.id, message: content }),
      });

      if (!res.ok) {
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let acc = '';
      const id = crypto.randomUUID();

      setMessages((m) => [...m, { id, sender: 'assistant', content: '' }]);

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const payload = line.replace(/^data:\s*/, '').trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const j: { token?: string; error?: string } = JSON.parse(payload);
            if (j.error) {
              setMessages((m) => m.map((x) => (x.id === id ? { ...x, content: acc + `\n\n[error: ${j.error}]` } : x)));
            } else if (j.token) {
              acc += j.token;
              setMessages((m) => m.map((x) => (x.id === id ? { ...x, content: acc } : x)));
            }
          } catch {
            /* keepalive */
          }
        }
      }
      setStreaming(false);
    },
    [activeSession, streaming]
  );

  if (loading) {
    return (
      <main className="h-[100dvh] grid place-items-center bg-zinc-950 text-zinc-500">
        <div className="flex flex-col gap-3 items-center">
          <div className="h-10 w-10 rounded-full border-2 border-zinc-800 border-t-zinc-300 animate-spin" />
          <p className="text-sm">Loading personas</p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] grid grid-cols-1 md:grid-cols-[300px_1fr] bg-zinc-950 text-zinc-100">
      {/* Sidebar: persona + session switch */}
      <aside className="border-r border-zinc-900 flex flex-col min-h-0">
        <div className="p-5 border-b border-zinc-900">
          <p className="font-mono text-[11px] text-zinc-600">uchat</p>
          <h1 className="text-lg font-semibold tracking-tight mt-1">Personas</h1>
        </div>

        <div className="p-3 flex flex-col gap-1 overflow-y-auto">
          {characters.map((c) => {
            const active = activeCharacter?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => (activeCharacter?.id === c.id ? null : startSession(c))}
                className="group flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors hover:bg-zinc-900
                           data-[active=true]:bg-zinc-900"
                data-active={active}
              >
                <Avatar url={c.avatar_url} name={c.name} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{c.name}</span>
                  <span className="block text-xs text-zinc-500 truncate">{c.gender}</span>
                </span>
              </button>
            );
          })}
        </div>

        {sessions.length > 0 && (
          <div className="mt-auto border-t border-zinc-900 p-3 flex flex-col gap-1 overflow-y-auto max-h-[40%]">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => openSession(s)}
                className="text-left p-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200
                           data-[active=true]:bg-zinc-900 data-[active=true]:text-zinc-100"
                data-active={activeSession?.id === s.id}
              >
                <span className="block truncate">{s.title}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Chat surface */}
      <section className="flex flex-col min-h-0">
        {activeCharacter ? (
          <>
            <header className="flex items-center gap-3 px-6 h-16 border-b border-zinc-900 shrink-0">
              <Avatar url={activeCharacter.avatar_url} name={activeCharacter.name} />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold leading-tight">{activeCharacter.name}</h2>
                <p className="text-xs text-zinc-500 leading-tight truncate max-w-[55ch]">
                  {stripTags(activeCharacter.persona).slice(0, 90)}
                </p>
              </div>
            </header>

            <div ref={logRef} className="flex-1 overflow-y-auto px-6 py-6">
              <div className="max-w-3xl mx-auto flex flex-col gap-5">
                <AnimatePresence initial={false}>
                  {messages.map((m, i) => (
                    <Bubble key={m.id ?? i} message={m} characterName={activeCharacter.name} />
                  ))}
                </AnimatePresence>
                <div ref={bottomRef} />
              </div>
            </div>

            <Composer
              input={input}
              setInput={setInput}
              draft={draft}
              setDraft={setDraft}
              translating={translating}
              streaming={streaming}
              onTranslate={doTranslate}
              onSend={() => sendMessage(draft ?? input)}
            />
          </>
        ) : (
          <div className="flex-1 grid place-items-center px-8">
            <div className="max-w-md text-center">
              <h2 className="text-2xl font-semibold tracking-tight">Pick a persona</h2>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                Choose someone from the sidebar to begin. Everything you say is remembered.
              </p>
            </div>
          </div>
        )}
      </section>
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
    return <img src={url} alt={name} className="h-9 w-9 rounded-full object-cover shrink-0" />;
  }
  return (
    <span className="h-9 w-9 rounded-full bg-zinc-800 grid place-items-center text-xs font-medium shrink-0">
      {initials}
    </span>
  );
}

function Bubble({ message, characterName }: { message: Message; characterName: string }) {
  const isUser = message.sender === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed
          ${isUser ? 'bg-accent text-zinc-950 font-medium' : 'bg-zinc-900 text-zinc-100'}`}
      >
        {!isUser && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">{characterName}</p>
        )}
        <FormattedText text={message.content} />
      </div>
    </motion.div>
  );
}

// Action tags (*...*) render italic, dialogue ("...") renders as-is.
function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith('*') && p.endsWith('*') && p.length > 2 ? (
          <em key={i} className="text-zinc-400">
            {p.slice(1, -1)}
          </em>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

function Composer({
  input,
  setInput,
  draft,
  setDraft,
  translating,
  streaming,
  onTranslate,
  onSend,
}: {
  input: string;
  setInput: (v: string) => void;
  draft: string | null;
  setDraft: (v: string | null) => void;
  translating: boolean;
  streaming: boolean;
  onTranslate: () => void;
  onSend: () => void;
}) {
  const editing = draft !== null;

  return (
    <div className="border-t border-zinc-900 p-4 shrink-0">
      <div className="max-w-3xl mx-auto flex flex-col gap-3">
        {editing && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-2">English draft</p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              className="w-full bg-transparent text-sm text-zinc-100 outline-none resize-none placeholder:text-zinc-600"
              placeholder="Edit the translation before sending"
            />
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={editing ? draft ?? '' : input}
            onChange={(e) => (editing ? setDraft(e.target.value) : setInput(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder={editing ? 'Editing English draft' : 'Tulis dalam Bahasa Indonesia'}
            className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-[15px]
                       text-zinc-100 outline-none resize-none placeholder:text-zinc-600
                       focus:border-zinc-700 transition-colors max-h-32"
          />

          {!editing ? (
            <button
              onClick={onTranslate}
              disabled={translating || !input.trim()}
              className="shrink-0 rounded-xl border border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300
                         hover:bg-zinc-900 transition-colors disabled:opacity-40 disabled:pointer-events-none
                         active:translate-y-[1px]"
            >
              {translating ? 'Translating' : 'Translate'}
            </button>
          ) : null}

          <button
            onClick={onSend}
            disabled={streaming || (!editing ? !input.trim() : !draft?.trim())}
            className="shrink-0 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-zinc-950
                       hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none
                       active:translate-y-[1px]"
          >
            {streaming ? 'Responding' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function stripTags(s: string): string {
  return s.replace(/\[[^\]]*\]/g, '').trim();
}
