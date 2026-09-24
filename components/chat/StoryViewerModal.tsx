'use client';

import { useEffect, useState } from 'react';
import { X, BookOpen } from '@phosphor-icons/react';

type Chapter = {
  id: string;
  title: string;
  content: string;
};

interface StoryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

export function StoryViewerModal({ isOpen, onClose, sessionId }: StoryViewerModalProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !sessionId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/chapters`);
        if (res.ok) {
          const data = await res.json();
          setChapters(data.chapters || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-amber-400" />
            <h3 className="font-semibold text-base text-zinc-100">Story Journal</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <p className="text-xs text-zinc-500 font-mono text-center py-8">Loading journal entries...</p>
          ) : chapters.length === 0 ? (
            <p className="text-xs text-zinc-600 italic text-center py-8">No journal entries yet.</p>
          ) : (
            chapters.map((ch) => (
              <div key={ch.id} className="bg-zinc-900 border border-zinc-850 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">{ch.title}</h4>
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{ch.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
