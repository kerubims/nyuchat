'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Translate,
  Brain,
  Plus,
  PaperPlaneRight,
  SidebarSimple,
  Circle,
  Trash,
  PencilSimple,
  Check,
  X,
} from '@phosphor-icons/react';

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

type Fact = {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  raw_fact: string;
  created_at: string;
};

export default function DedicatedChatRoom() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const characterId = params?.characterId as string;
  const initialSessionId = searchParams?.get('sessionId');

  const [character, setCharacter] = useState<Character | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<string | null>(null);

  // Editing state for user messages
  const [editingMsgIndex, setEditingMsgIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  // Translations map for assistant message bubbles: { msgIndexOrId: translatedText }
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingMsgId, setTranslatingMsgId] = useState<string | null>(null);

  const [translatingInput, setTranslatingInput] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);

  // RAG Memory Inspector State
  const [showFactsModal, setShowFactsModal] = useState(false);
  const [ragState, setRagState] = useState<{ global_summary: string | null; current_state: string | null; facts: Fact[] }>({
    global_summary: null,
    current_state: null,
    facts: [],
  });

  const [showSidebar, setShowSidebar] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const loadCharacter = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}`);
    if (!res.ok) {
      router.push('/characters');
      return null;
    }
    const data = await res.json();
    setCharacter(data);
    return data;
  }, [characterId, router]);

  const loadSessions = useCallback(async () => {
    const res = await fetch('/api/sessions');
    const data: Session[] = await res.json();
    const charSessions = data.filter((s) => s.character?.id === characterId);
    setSessions(charSessions);
    return charSessions;
  }, [characterId]);

  const openSession = useCallback(async (s: Session) => {
    setActiveSession(s);
    setDraft(null);
    setEditingMsgIndex(null);
    const res = await fetch(`/api/sessions/${s.id}`);
    const j: { messages: Message[] } = await res.json();
    setMessages(j.messages);
  }, []);

  const createNewSession = useCallback(async () => {
    if (!character) return;
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: character.id }),
    });
    const s: Session & { character_id: string } = await res.json();
    const session: Session = { id: s.id, title: s.title, character: { ...s.character, id: s.character_id } };
    await loadSessions();
    setActiveSession(session);
    setMessages([{ sender: 'assistant', content: character.greeting }]);
  }, [character, loadSessions]);

  const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        setSessions(remaining);
        if (activeSession?.id === sessionId) {
          if (remaining.length > 0) openSession(remaining[0]);
          else createNewSession();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ch = await loadCharacter();
      if (ch) {
        const list = await loadSessions();
        if (initialSessionId) {
          const matched = list.find((s) => s.id === initialSessionId);
          if (matched) await openSession(matched);
          else if (list.length > 0) await openSession(list[0]);
          else await createNewSession();
        } else if (list.length > 0) {
          await openSession(list[0]);
        } else {
          await createNewSession();
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  // Fetch RAG Memory Facts for Inspector
  const fetchRagFacts = async () => {
    if (!activeSession) return;
    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/facts`);
      if (res.ok) {
        const data = await res.json();
        setRagState(data);
      }
    } catch (err) {
      console.error(err);
    }
    setShowFactsModal(true);
  };

  // Translate Assistant Bubble Message (On-Demand EN -> ID)
  const translateMessageBubble = async (msgKey: string, text: string) => {
    if (translations[msgKey]) {
      const updated = { ...translations };
      delete updated[msgKey];
      setTranslations(updated);
      return;
    }

    setTranslatingMsgId(msgKey);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, from: 'en', to: 'id' }),
      });
      const data = await res.json();
      if (data.translation) {
        setTranslations((prev) => ({ ...prev, [msgKey]: data.translation }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTranslatingMsgId(null);
    }
  };

  // Translate User Input (ID -> EN preview)
  const doTranslateInput = useCallback(async () => {
    if (!input.trim()) return;
    setTranslatingInput(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });
      const j: { translation?: string; error?: string } = await res.json();
      setDraft(j.translation ?? input);
    } finally {
      setTranslatingInput(false);
    }
  }, [input]);

  const sendMessage = useCallback(
    async (textToSend: string) => {
      if (!activeSession || !textToSend.trim() || streaming) return;
      const content = textToSend.trim();
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

  const saveEditedMessage = (index: number) => {
    if (!editingText.trim()) return;
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, content: editingText } : m)));
    setEditingMsgIndex(null);
    sendMessage(editingText);
  };

  if (loading || !character) {
    return (
      <main className="flex-1 grid place-items-center bg-zinc-950 text-zinc-500 p-8">
        <div className="flex flex-col gap-3 items-center">
          <div className="h-8 w-8 rounded-full border-2 border-zinc-800 border-t-zinc-300 animate-spin" />
          <p className="text-xs font-mono">Entering chat room...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 h-[calc(100vh-3.5rem)] grid grid-cols-1 md:grid-cols-[auto_1fr] bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Session Drawer / Sidebar */}
      <aside
        className={`border-r border-zinc-900 bg-zinc-950 flex flex-col min-h-0 transition-all duration-200 ${
          showSidebar ? 'w-64' : 'w-0 hidden md:flex md:w-0 overflow-hidden border-none'
        }`}
      >
        <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-zinc-300 truncate">{character.name}&apos;s Rooms</h2>
            <p className="text-[10px] text-zinc-500 font-mono">{sessions.length} sessions</p>
          </div>
          <button
            onClick={createNewSession}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors"
            title="New Chat Session"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => openSession(s)}
              className={`group w-full text-left p-2.5 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                activeSession?.id === s.id
                  ? 'bg-zinc-900 text-zinc-100 border border-zinc-800 font-medium'
                  : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
              }`}
            >
              <span className="truncate flex-1 pr-2">{s.title}</span>
              <div className="flex items-center gap-1">
                {activeSession?.id === s.id && <Circle size={6} weight="fill" className="text-emerald-500 shrink-0" />}
                <button
                  onClick={(e) => deleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-all rounded"
                  title="Delete Session"
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <section className="flex flex-col min-h-0 flex-1 relative">
        {/* Chat Room Top Bar */}
        <header className="h-14 px-4 md:px-6 border-b border-zinc-900 flex items-center justify-between shrink-0 bg-zinc-950/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Toggle Sidebar"
            >
              <SidebarSimple size={18} />
            </button>

            <Avatar url={character.avatar_url} name={character.name} />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-100 truncate">{character.name}</h2>
                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                  {character.gender}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 truncate max-w-md hidden sm:block">
                {stripTags(character.persona).slice(0, 80)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchRagFacts}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 text-xs font-medium transition-colors"
              title="Inspect RAG Vector Memories"
            >
              <Brain size={16} className="text-purple-400" />
              <span className="hidden sm:inline">Memory Inspector</span>
            </button>
          </div>
        </header>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="max-w-3xl mx-auto space-y-5">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => {
                const msgKey = m.id || `msg-${i}`;
                const isUser = m.sender === 'user';
                const translated = translations[msgKey];
                const isTranslating = translatingMsgId === msgKey;
                const isEditing = editingMsgIndex === i;

                return (
                  <motion.div
                    key={msgKey}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="group relative max-w-[85%] sm:max-w-[78%]">
                      <div
                        className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
                          isUser
                            ? 'bg-zinc-100 text-zinc-950 font-medium'
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-100'
                        }`}
                      >
                        {!isUser && (
                          <div className="flex items-center justify-between gap-4 mb-1.5 pb-1 border-b border-zinc-800/60">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                              {character.name}
                            </span>
                            <button
                              onClick={() => translateMessageBubble(msgKey, m.content)}
                              disabled={isTranslating || !m.content.trim()}
                              className={`flex items-center gap-1 text-[11px] transition-colors ${
                                translated ? 'text-emerald-400 font-medium' : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                              title="Terjemahkan balasan ke Bahasa Indonesia"
                            >
                              <Translate size={13} />
                              <span>{isTranslating ? 'Translating...' : translated ? 'Original' : 'Translate'}</span>
                            </button>
                          </div>
                        )}

                        {isUser && !isEditing && (
                          <div className="flex items-center justify-between gap-3 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-mono text-zinc-500">You</span>
                            <button
                              onClick={() => {
                                setEditingMsgIndex(i);
                                setEditingText(m.content);
                              }}
                              className="text-zinc-500 hover:text-zinc-900 transition-colors"
                              title="Edit message"
                            >
                              <PencilSimple size={13} />
                            </button>
                          </div>
                        )}

                        {isEditing ? (
                          <div className="space-y-2 py-1">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full bg-zinc-200 text-zinc-950 p-2 rounded-lg text-xs outline-none resize-none font-medium"
                              rows={2}
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setEditingMsgIndex(null)}
                                className="p-1 rounded text-zinc-600 hover:text-zinc-950"
                              >
                                <X size={14} />
                              </button>
                              <button
                                onClick={() => saveEditedMessage(i)}
                                className="p-1 rounded bg-zinc-950 text-zinc-100 hover:bg-zinc-800"
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <FormattedText text={m.content} />
                        )}

                        {/* Translated Box */}
                        {translated && (
                          <div className="mt-2.5 pt-2 border-t border-zinc-800/80 text-[13px] text-emerald-300/90 bg-emerald-950/20 p-2 rounded-lg border border-emerald-900/40">
                            <span className="block text-[10px] font-mono text-emerald-500/80 uppercase tracking-widest mb-1">
                              Terjemahan Bahasa Indonesia:
                            </span>
                            <FormattedText text={translated} />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input Composer */}
        <footer className="border-t border-zinc-900 bg-zinc-950 p-4 shrink-0">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* Draft Preview Box */}
            {draft !== null && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  <span>English Translation Draft (Editable)</span>
                  <button onClick={() => setDraft(null)} className="hover:text-zinc-300">
                    Cancel
                  </button>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  className="w-full bg-transparent text-xs text-zinc-100 outline-none resize-none placeholder:text-zinc-600"
                  placeholder="Edit the English draft before sending..."
                />
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                value={draft !== null ? draft : input}
                onChange={(e) => (draft !== null ? setDraft(e.target.value) : setInput(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(draft !== null ? draft : input);
                  }
                }}
                rows={1}
                placeholder={draft !== null ? 'Editing English draft...' : 'Tulis pesan dalam Bahasa Indonesia atau English...'}
                className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-xs text-zinc-100 outline-none resize-none placeholder:text-zinc-600 focus:border-zinc-700 transition-colors max-h-32"
              />

              {draft === null && (
                <button
                  type="button"
                  onClick={doTranslateInput}
                  disabled={translatingInput || !input.trim()}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-xs font-medium text-zinc-300 hover:bg-zinc-850 hover:text-zinc-100 transition-colors disabled:opacity-40"
                  title="Terjemahkan input ke Bahasa Inggris"
                >
                  <Translate size={16} />
                  <span className="hidden sm:inline">{translatingInput ? 'Translating...' : 'Translate'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => sendMessage(draft !== null ? draft : input)}
                disabled={streaming || (draft !== null ? !draft.trim() : !input.trim())}
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-zinc-100 text-zinc-950 font-semibold px-4 py-3 text-xs hover:bg-zinc-200 transition-colors disabled:opacity-40"
              >
                <PaperPlaneRight size={16} weight="fill" />
                <span>{streaming ? 'Sending...' : 'Send'}</span>
              </button>
            </div>
          </div>
        </footer>
      </section>

      {/* RAG Memory Inspector Drawer */}
      {showFactsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full p-6 flex flex-col gap-6 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <div className="flex items-center gap-2">
                <Brain size={20} className="text-purple-400" />
                <h3 className="text-base font-semibold text-zinc-100">RAG Memory Inspector</h3>
              </div>
              <button onClick={() => setShowFactsModal(false)} className="text-xs text-zinc-500 hover:text-zinc-300">
                Close
              </button>
            </div>

            {/* Current State Summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Current State Context</h4>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300 font-mono leading-relaxed">
                {ragState.current_state || 'No state tracked yet.'}
              </div>
            </div>

            {/* Global Conversation Summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Global Story Summary</h4>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300 leading-relaxed">
                {ragState.global_summary || 'Conversation is fresh — no global summary generated yet.'}
              </div>
            </div>

            {/* Indexed Facts (User Facts) */}
            <div className="space-y-2 flex-1">
              <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Indexed Facts (BGE-M3 1024-dim Vector)</h4>
              {ragState.facts.length === 0 ? (
                <p className="text-xs text-zinc-600 italic">No user facts extracted in vector DB yet.</p>
              ) : (
                <div className="space-y-2">
                  {ragState.facts.map((f) => (
                    <div key={f.id} className="bg-zinc-900/60 border border-zinc-850 rounded-xl p-3 space-y-1">
                      <p className="text-xs text-zinc-200 font-medium">{f.raw_fact}</p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                        <span>{f.subject}</span>
                        <span>→</span>
                        <span>{f.predicate}</span>
                        <span>→</span>
                        <span>{f.object}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
    return <img src={url} alt={name} className="h-9 w-9 rounded-full object-cover shrink-0 border border-zinc-800" />;
  }
  return (
    <span className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 grid place-items-center text-xs font-medium shrink-0 text-zinc-300">
      {initials}
    </span>
  );
}

function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith('*') && p.endsWith('*') && p.length > 2 ? (
          <em key={i} className="text-zinc-400 font-normal">
            {p.slice(1, -1)}
          </em>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

function stripTags(s: string): string {
  return s.replace(/\[[^\]]*\]/g, '').trim();
}
