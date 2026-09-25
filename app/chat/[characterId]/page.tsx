'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { SidebarSimple, Brain, Coins, BookOpen, Circle } from '@phosphor-icons/react';

import { SessionSidebar } from '@/components/chat/SessionSidebar';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { TokenModal } from '@/components/chat/TokenModal';
import { RagInspectorModal } from '@/components/chat/RagInspectorModal';
import { StoryViewerModal } from '@/components/chat/StoryViewerModal';

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
  isStreaming?: boolean;
  isRegenerating?: boolean;
};

type Session = {
  id: string;
  title: string;
  created_at?: string;
  character?: { id: string; name: string; avatar_url: string | null };
  total_prompt_tokens?: number;
  total_completion_tokens?: number;
  total_cost_usd?: number;
};

type Fact = {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  raw_fact: string;
  created_at: string;
};

type UsageStats = {
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
};

export default function DedicatedChatRoom() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const characterId = params?.characterId as string;
  const initialSessionId = searchParams?.get('sessionId');

  const [character, setCharacter] = useState<Character | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Settings
  const [temperature, setTemperature] = useState<number>(0.8);

  // Editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Usage & Token tracking
  const [usage, setUsage] = useState<UsageStats>({
    promptTokens: 0,
    completionTokens: 0,
    totalCost: 0,
  });

  // UI state & Modals
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showRagModal, setShowRagModal] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);

  const [ragState, setRagState] = useState<{
    global_summary: string | null;
    current_state: string | null;
    facts: Fact[];
  }>({
    global_summary: null,
    current_state: null,
    facts: [],
  });

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll ONLY the message list container so header is 100% permanently fixed
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, streaming]);

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
    const charSessions = data.filter((s) => (s.character?.id || (s as unknown as { character_id: string }).character_id) === characterId);
    setSessions(charSessions);
    return charSessions;
  }, [characterId]);

  const openSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setEditingMessageId(null);
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      const loadedMsgs = (data.messages || []).map((m: { id?: string; sender: string; content: string }) => ({
        ...m,
        id: m.id || crypto.randomUUID(),
      }));
      setMessages(loadedMsgs);
      setUsage({
        promptTokens: data.session?.total_prompt_tokens || 0,
        completionTokens: data.session?.total_completion_tokens || 0,
        totalCost: data.session?.total_cost_usd || 0,
      });
    }
  }, []);

  const createNewSession = useCallback(async () => {
    if (!character) return;
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: character.id }),
    });
    const s = await res.json();
    await loadSessions();
    setActiveSessionId(s.id);
    setMessages([{ id: crypto.randomUUID(), sender: 'assistant', content: character.greeting }]);
    setUsage({ promptTokens: 0, completionTokens: 0, totalCost: 0 });
  }, [character, loadSessions]);

  const deleteSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        setSessions(remaining);
        if (activeSessionId === sessionId) {
          if (remaining.length > 0) openSession(remaining[0].id);
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
          if (matched) await openSession(matched.id);
          else if (list.length > 0) await openSession(list[0].id);
          else await createNewSession();
        } else if (list.length > 0) {
          await openSession(list[0].id);
        } else {
          await createNewSession();
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const fetchRagFacts = async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`/api/sessions/${activeSessionId}/facts`);
      if (res.ok) {
        const data = await res.json();
        setRagState(data);
      }
    } catch (err) {
      console.error(err);
    }
    setShowRagModal(true);
  };

  const handleCopy20Chats = useCallback(() => {
    const last20 = messages.slice(-20);
    const text = last20
      .map((m) => `[${m.sender === 'user' ? 'User' : character?.name || 'AI'}]: ${m.content}`)
      .join('\n\n');
    const fullExport = `=== CHAT DEBUG (LAST 20 MESSAGES) ===\nSession: ${activeSessionId}\nCharacter: ${character?.name}\nTime: ${new Date().toLocaleString()}\n\n${text}`;
    navigator.clipboard.writeText(fullExport);
  }, [messages, character, activeSessionId]);

  const handleSendMessage = async (text: string) => {
    if (!activeSessionId || !text.trim() || streaming) return;

    let currentEditId: string | null = null;
    if (editingMessageId !== null && editingMessageId !== undefined && editingMessageId !== '') {
      currentEditId = editingMessageId;
      setEditingMessageId(null);
    }

    const content = text.trim();
    const newUserMsgId = crypto.randomUUID();

    setMessages((m) => {
      let base = m;
      if (currentEditId) {
        const targetIndex = m.findIndex((x) => x.id === currentEditId);
        if (targetIndex !== -1) {
          base = m.slice(0, targetIndex);
        }
      }
      return [...base, { id: newUserMsgId, sender: 'user', content }];
    });
    setStreaming(true);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: activeSessionId,
        message: content,
        temperature,
        editMessageId: currentEditId || undefined,
        clientMsgId: newUserMsgId,
      }),
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

    setMessages((m) => [...m, { id, sender: 'assistant', content: '', isStreaming: true }]);

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
          const j: {
            token?: string;
            error?: string;
            usage?: { prompt_tokens: number; completion_tokens: number; cost_usd: number };
          } = JSON.parse(payload);
          if (j.error) {
            setMessages((m) => m.map((x) => (x.id === id ? { ...x, content: acc + `\n\n[error: ${j.error}]`, isStreaming: false } : x)));
          } else if (j.token) {
            acc += j.token;
            setMessages((m) => m.map((x) => (x.id === id ? { ...x, content: acc } : x)));
          } else if (j.usage) {
            setUsage((prev) => ({
              promptTokens: prev.promptTokens + j.usage!.prompt_tokens,
              completionTokens: prev.completionTokens + j.usage!.completion_tokens,
              totalCost: Number((prev.totalCost + (j.usage!.cost_usd || 0)).toFixed(6)),
            }));
          }
        } catch {
          /* keepalive */
        }
      }
    }
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, isStreaming: false } : x)));
    setStreaming(false);
    void loadSessions(); // pick up auto-title rename
  };

  const handleRegenerate = async (assistantMessageId: string) => {
    const targetIndex = messages.findIndex((m) => m.id === assistantMessageId);
    if (targetIndex === -1 || streaming || !activeSessionId) return;

    const newAssistantId = crypto.randomUUID();
    setStreaming(true);

    // Atomically replace target assistant message with a new empty streaming message
    setMessages((m) => {
      const idx = m.findIndex((x) => x.id === assistantMessageId);
      if (idx === -1) return m;
      const base = m.slice(0, idx);
      return [...base, { id: newAssistantId, sender: 'assistant', content: '', isStreaming: true, isRegenerating: true }];
    });

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: activeSessionId,
        regenerateMessageId: assistantMessageId,
        temperature,
      }),
    });

    if (!res.ok) {
      setStreaming(false);
      return;
    }

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let acc = '';

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
          const j: {
            token?: string;
            messageId?: string;
            error?: string;
            usage?: { prompt_tokens: number; completion_tokens: number; cost_usd: number };
          } = JSON.parse(payload);
          if (j.error) {
            setMessages((m) => m.map((x) => (x.id === newAssistantId ? { ...x, content: acc + `\n\n[error: ${j.error}]`, isStreaming: false, isRegenerating: false } : x)));
          } else if (j.messageId) {
            setMessages((m) => m.map((x) => (x.id === newAssistantId ? { ...x, id: j.messageId! } : x)));
          } else if (j.token) {
            acc += j.token;
            setMessages((m) => m.map((x) => (x.id === newAssistantId ? { ...x, content: acc } : x)));
          } else if (j.usage) {
            setUsage((prev) => ({
              promptTokens: prev.promptTokens + j.usage!.prompt_tokens,
              completionTokens: prev.completionTokens + j.usage!.completion_tokens,
              totalCost: Number((prev.totalCost + (j.usage!.cost_usd || 0)).toFixed(6)),
            }));
          }
        } catch {
          /* keepalive */
        }
      }
    }
    setMessages((m) => m.map((x) => (x.id === newAssistantId ? { ...x, isStreaming: false, isRegenerating: false } : x)));
    setStreaming(false);
  };

  const handleEditRequest = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    window.dispatchEvent(new CustomEvent('setChatInput', { detail: content }));
  };

  if (loading || !character) {
    return (
      <main className="h-screen w-screen grid place-items-center bg-zinc-950 text-zinc-500 p-8">
        <div className="flex flex-col gap-3 items-center">
          <div className="h-8 w-8 rounded-full border-2 border-zinc-800 border-t-zinc-300 animate-spin" />
          <p className="text-xs font-mono">Entering chat room...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen flex bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Session Sidebar Component */}
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => openSession(id)}
        onNewSession={createNewSession}
        onDeleteSession={deleteSession}
        characterName={character.name}
        temperature={temperature}
        setTemperature={setTemperature}
        usageStats={usage}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Workspace */}
      <section className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {/* Header Bar - Permanently Fixed at Top */}
        <header className="h-14 px-4 md:px-6 border-b border-zinc-900 flex items-center justify-between shrink-0 bg-zinc-950 z-30 select-none">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
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
              <p className="text-[11px] font-mono text-zinc-500 truncate flex items-center gap-1">
                <Circle size={6} weight="fill" className={streaming ? 'text-purple-400 animate-pulse' : 'text-emerald-500'} />
                <span>{streaming ? 'typing...' : 'online'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowStoryModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 text-xs font-medium transition-colors"
              title="Story Journal"
            >
              <BookOpen size={16} className="text-amber-400" />
              <span className="hidden sm:inline">Journal</span>
            </button>

            <button
              onClick={() => setShowTokenModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 text-xs font-medium transition-colors"
              title="Token Usage"
            >
              <Coins size={16} className="text-emerald-400" />
              <span className="hidden sm:inline">Tokens</span>
            </button>

            <button
              onClick={fetchRagFacts}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 text-xs font-medium transition-colors"
              title="RAG Memory Inspector"
            >
              <Brain size={16} className="text-purple-400" />
              <span className="hidden sm:inline">Memory</span>
            </button>
          </div>
        </header>

        {/* Message Log - Strictly Scrollable Inner Container */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6 space-y-4">
          <div className="max-w-3xl mx-auto space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={m.id || `msg-${i}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                >
                  <ChatMessage
                    id={m.id || `msg-${i}`}
                    role={m.sender === 'user' ? 'user' : 'assistant'}
                    content={m.content}
                    characterName={m.sender === 'assistant' ? character.name : undefined}
                    avatarUrl={m.sender === 'assistant' ? character.avatar_url : undefined}
                    isStreaming={m.isStreaming}
                    isRegenerating={m.isRegenerating}
                    onRegenerate={m.sender === 'assistant' ? handleRegenerate : undefined}
                    onEdit={m.sender === 'user' ? handleEditRequest : undefined}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Input Composer */}
        <footer className="border-t border-zinc-900 bg-zinc-950 p-4 shrink-0 z-10">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              onSend={handleSendMessage}
              disabled={!activeSessionId}
              isStreaming={streaming}
              onOpenTokenModal={() => setShowTokenModal(true)}
              onOpenStoryJournal={() => setShowStoryModal(true)}
              onCopy20Chats={handleCopy20Chats}
              editingMessageId={editingMessageId}
              onCancelEdit={() => setEditingMessageId(null)}
            />
          </div>
        </footer>
      </section>

      {/* Modals */}
      <TokenModal isOpen={showTokenModal} onClose={() => setShowTokenModal(false)} usage={usage} />

      <RagInspectorModal isOpen={showRagModal} onClose={() => setShowRagModal(false)} ragState={ragState} />

      {activeSessionId && (
        <StoryViewerModal
          isOpen={showStoryModal}
          onClose={() => setShowStoryModal(false)}
          sessionId={activeSessionId}
        />
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
