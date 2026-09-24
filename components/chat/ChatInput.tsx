'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PaperPlaneRight, Lightbulb, Translate, BookOpen, Coins } from '@phosphor-icons/react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onSuggest?: () => void;
  isLoadingSuggestions?: boolean;
  onOpenTokenModal?: () => void;
  onOpenStoryJournal?: () => void;
  editingMessageId?: string | null;
  onCancelEdit?: () => void;
}

export function ChatInput({
  onSend,
  disabled,
  isStreaming,
  onSuggest,
  isLoadingSuggestions,
  onOpenTokenModal,
  onOpenStoryJournal,
  editingMessageId,
  onCancelEdit,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isTranslatingInput, setIsTranslatingInput] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + 'px';
    }
  }, [input]);

  const insertActionStars = () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = input;

    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);

    const newText = before + '*' + selected + '*' + after;
    setInput(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + 1, end + 1);
      }
    }, 0);
  };

  const handleTranslateInput = useCallback(async () => {
    if (!input.trim() || isStreaming || isTranslatingInput) return;
    setIsTranslatingInput(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, from: 'id', to: 'en' }),
      });
      const data = await res.json();
      if (data.translation) {
        setInput(data.translation);
      }
    } catch (err) {
      console.error('Translation failed', err);
    } finally {
      setIsTranslatingInput(false);
    }
  }, [input, isStreaming, isTranslatingInput]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || disabled || isStreaming) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertActionStars();
    }
  };

  // Custom Event listener to populate input (e.g. from Edit button or Suggestions)
  useEffect(() => {
    const handleSetChatInput = (e: CustomEvent<string>) => {
      setInput(e.detail || '');
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    };
    window.addEventListener('setChatInput', handleSetChatInput as EventListener);
    return () => window.removeEventListener('setChatInput', handleSetChatInput as EventListener);
  }, []);

  return (
    <div className="space-y-2">
      {/* Horizontal Toolbar Actions */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1 py-1">
        {onOpenStoryJournal && (
          <button
            type="button"
            onClick={onOpenStoryJournal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0"
          >
            <BookOpen size={14} className="text-amber-400" />
            <span>Story Journal</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleTranslateInput}
          disabled={isTranslatingInput || !input.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-40 shrink-0"
          title="Translate typed text from ID to EN"
        >
          <Translate size={14} className={isTranslatingInput ? 'animate-spin' : 'text-cyan-400'} />
          <span>{isTranslatingInput ? 'Translating...' : 'Translate to EN'}</span>
        </button>

        {onOpenTokenModal && (
          <button
            type="button"
            onClick={onOpenTokenModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0"
          >
            <Coins size={14} className="text-emerald-400" />
            <span>Token Usage</span>
          </button>
        )}
      </div>

      {/* Editing Message Banner */}
      {editingMessageId && (
        <div className="flex items-center justify-between bg-purple-950/40 border border-purple-800/60 px-3 py-1.5 rounded-xl text-xs text-purple-300">
          <span>Editing message...</span>
          <button
            onClick={() => {
              if (onCancelEdit) onCancelEdit();
              setInput('');
            }}
            className="text-purple-400 hover:text-purple-200 text-xs font-medium"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Input Form */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 shadow-lg focus-within:border-zinc-700 transition-colors"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tulis pesan dalam Bahasa Indonesia atau English..."
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-xs text-zinc-100 outline-none resize-none px-3 py-2 placeholder:text-zinc-600 max-h-36 min-h-[38px]"
        />

        <div className="flex items-center gap-1 shrink-0 pb-0.5 pr-0.5">
          {/* Action Star (*) Button */}
          <button
            type="button"
            onClick={insertActionStars}
            disabled={disabled}
            title="Tambah Action (*)"
            className="h-8 w-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 transition-colors font-bold text-base flex items-center justify-center disabled:opacity-40"
          >
            *
          </button>

          {/* Suggestion Idea Button */}
          {onSuggest && (
            <button
              type="button"
              onClick={onSuggest}
              disabled={disabled || isStreaming || isLoadingSuggestions}
              title="Get prompt suggestion"
              className="h-8 w-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-purple-400 hover:text-purple-300 transition-colors flex items-center justify-center disabled:opacity-40"
            >
              <Lightbulb size={16} className={isLoadingSuggestions ? 'animate-spin' : ''} />
            </button>
          )}

          {/* Send Button */}
          <button
            type="submit"
            disabled={disabled || isStreaming || !input.trim()}
            className="h-8 px-3 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <PaperPlaneRight size={14} weight="fill" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </form>
    </div>
  );
}
