'use client';

import { useState } from 'react';
import { Translate, ArrowClockwise, PencilSimple } from '@phosphor-icons/react';

interface ChatMessageProps {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  characterName?: string;
  avatarUrl?: string | null;
  isStreaming?: boolean;
  isRegenerating?: boolean;
  onRegenerate?: (id: string) => void;
  onEdit?: (id: string, content: string) => void;
}

export function ChatMessage({
  id,
  role,
  content,
  characterName,
  avatarUrl,
  isStreaming,
  isRegenerating,
  onRegenerate,
  onEdit,
}: ChatMessageProps) {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const formatContent = (text: string) => {
    const parts = text.split(/(\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return (
          <em key={i} className="text-zinc-400 font-normal">
            {part.slice(1, -1)}
          </em>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleTranslate = async () => {
    if (translatedText) {
      setShowTranslation(!showTranslation);
      return;
    }

    setIsTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, to: 'id', from: 'en' }),
      });
      const data = await res.json();
      if (data.translation) {
        setTranslatedText(data.translation);
        setShowTranslation(true);
      }
    } catch (err) {
      console.error('Translation failed', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const displayContent = showTranslation && translatedText ? translatedText : content;

  if (role === 'user') {
    return (
      <div className="flex justify-end my-2">
        <div className="max-w-[88%] sm:max-w-[80%] flex items-end gap-1.5">
          {/* Icon ONLY Edit Button matching user bubble style */}
          {!isStreaming && onEdit && (
            <button
              onClick={() => onEdit(id, content)}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0 shadow-sm"
              title="Edit message"
            >
              <PencilSimple size={14} weight="bold" />
            </button>
          )}

          <div className="rounded-2xl bg-zinc-100 text-zinc-950 px-4 py-3 text-[14px] leading-relaxed font-medium shadow-sm">
            <div className="whitespace-pre-wrap">{formatContent(content)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start items-start gap-3 my-2">
      <Avatar url={avatarUrl} name={characterName || 'AI'} />

      <div className="max-w-[88%] sm:max-w-[80%] flex flex-col gap-1.5">
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-100 px-4 py-3 text-[14px] leading-relaxed shadow-sm space-y-2">
          {characterName && (
            <div className="flex justify-between items-center pb-1 border-b border-zinc-800/60">
              <span className="text-[11px] font-mono text-zinc-400 font-semibold uppercase tracking-wider">
                {characterName}
              </span>
            </div>
          )}

          <div className="whitespace-pre-wrap">
            {isRegenerating && !displayContent && (
              <div className="flex items-center gap-2 text-purple-400 text-xs animate-pulse mb-1 font-mono">
                <ArrowClockwise className="animate-spin" size={14} />
                <span>Regenerating response...</span>
              </div>
            )}
            {formatContent(displayContent)}
            {isStreaming && (!isRegenerating || displayContent) && (
              <span className="inline-block w-2 h-4 ml-1 bg-purple-400 animate-pulse" />
            )}
          </div>

          {/* Translated sub-box */}
          {showTranslation && translatedText && (
            <div className="pt-2 border-t border-zinc-800 text-[13px] text-emerald-300 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-900/60 space-y-1">
              <span className="block text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-bold">
                Terjemahan Bahasa Indonesia:
              </span>
              <div className="whitespace-pre-wrap">{formatContent(translatedText)}</div>
            </div>
          )}
        </div>

        {/* Icon ONLY Action Buttons underneath Assistant bubble matching bubble colors */}
        {!isStreaming && (
          <div className="flex items-center gap-1 pt-0.5">
            <button
              onClick={handleTranslate}
              disabled={isTranslating}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-50"
              title={showTranslation ? 'Tampilkan Teks Asli' : 'Terjemahkan ke Bahasa Indonesia'}
            >
              <Translate size={14} weight="bold" className={isTranslating ? 'animate-spin' : ''} />
            </button>

            {onRegenerate && (
              <button
                onClick={() => onRegenerate(id)}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shadow-sm"
                title="Regenerate Balasan"
              >
                <ArrowClockwise size={14} weight="bold" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ url, name }: { url?: string | null; name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-8 w-8 rounded-full object-cover shrink-0 border border-zinc-800 mt-1" />;
  }
  return (
    <span className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 grid place-items-center text-[11px] font-bold shrink-0 text-zinc-300 mt-1">
      {initials}
    </span>
  );
}
