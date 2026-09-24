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
        body: JSON.stringify({ text: content, from: 'en', to: 'id' }),
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
      <div className="flex justify-end group/usermsg my-2">
        <div className="relative max-w-[85%] sm:max-w-[78%]">
          {/* Action buttons on hover */}
          {!isStreaming && onEdit && (
            <div className="absolute -left-9 top-1/2 -translate-y-1/2 opacity-100 md:opacity-0 md:group-hover/usermsg:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(id, content)}
                title="Edit message"
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors shadow-sm"
              >
                <PencilSimple size={14} />
              </button>
            </div>
          )}

          <div className="rounded-2xl bg-zinc-100 text-zinc-950 px-4 py-3 text-[14px] leading-relaxed font-medium shadow-sm">
            <div className="whitespace-pre-wrap">{formatContent(content)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start items-start gap-3 group/assistantmsg my-2">
      <Avatar url={avatarUrl} name={characterName || 'AI'} />

      <div className="relative max-w-[85%] sm:max-w-[78%]">
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-100 px-4 py-3 text-[14px] leading-relaxed shadow-sm">
          {characterName && (
            <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-zinc-800/60">
              <span className="text-[11px] font-mono text-zinc-400 font-semibold uppercase tracking-wider">
                {characterName}
              </span>
            </div>
          )}

          <div className="whitespace-pre-wrap">
            {isRegenerating && !displayContent && (
              <div className="flex items-center gap-2 text-purple-400 text-xs animate-pulse mb-1">
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
            <div className="mt-2.5 pt-2 border-t border-zinc-800 text-[13px] text-emerald-300 bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-900/40">
              <span className="block text-[10px] font-mono text-emerald-400 uppercase tracking-wider mb-1 font-semibold">
                Terjemahan Bahasa Indonesia:
              </span>
              <div className="whitespace-pre-wrap">{formatContent(translatedText)}</div>
            </div>
          )}
        </div>

        {/* Action Buttons on hover */}
        {!isStreaming && (
          <div className="absolute -right-20 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover/assistantmsg:opacity-100 transition-opacity">
            <button
              onClick={handleTranslate}
              disabled={isTranslating}
              title={showTranslation ? 'Show Original' : 'Translate'}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors shadow-sm"
            >
              <Translate size={14} className={isTranslating ? 'animate-spin' : ''} />
            </button>
            {onRegenerate && (
              <button
                onClick={() => onRegenerate(id)}
                title="Regenerate"
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors shadow-sm"
              >
                <ArrowClockwise size={14} />
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
    <span className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 grid place-items-center text-[11px] font-medium shrink-0 text-zinc-300 mt-1">
      {initials}
    </span>
  );
}
