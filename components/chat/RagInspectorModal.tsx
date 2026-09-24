'use client';

import { X, Brain } from '@phosphor-icons/react';

type Fact = {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  raw_fact: string;
  created_at: string;
};

interface RagInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  ragState: {
    global_summary: string | null;
    current_state: string | null;
    facts: Fact[];
  };
}

export function RagInspectorModal({ isOpen, onClose, ragState }: RagInspectorModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-950 border-l border-zinc-900 h-full p-6 flex flex-col gap-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-purple-400" />
            <h3 className="text-base font-semibold text-zinc-100">RAG Memory Inspector</h3>
          </div>
          <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">
            <X size={18} />
          </button>
        </div>

        {/* Current State Summary */}
        <div className="space-y-2">
          <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            Current State Context
          </h4>
          <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-3 text-xs text-zinc-300 font-mono leading-relaxed">
            {ragState.current_state || 'No state tracked yet.'}
          </div>
        </div>

        {/* Global Story Summary */}
        <div className="space-y-2">
          <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            Global Story Summary
          </h4>
          <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-3 text-xs text-zinc-300 leading-relaxed">
            {ragState.global_summary || 'Conversation is fresh — no global summary generated yet.'}
          </div>
        </div>

        {/* Indexed Facts */}
        <div className="space-y-2 flex-1">
          <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            Indexed Facts (BGE-M3 1024-dim Vector)
          </h4>
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
  );
}
