'use client';

import { X, Coins, Code, CheckCircle } from '@phosphor-icons/react';

interface TokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
  };
}

export function TokenModal({ isOpen, onClose, usage }: TokenModalProps) {
  if (!isOpen) return null;

  const totalTokens = usage.promptTokens + usage.completionTokens;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
          <div className="flex items-center gap-2">
            <Coins size={20} className="text-emerald-400" />
            <h3 className="font-semibold text-base text-zinc-100">Token Usage</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Breakdown Card */}
        <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-4 space-y-3 font-mono text-xs">
          <div className="flex justify-between items-center text-zinc-300">
            <div className="flex items-center gap-2">
              <Code size={14} className="text-zinc-400" />
              <span>Prompt Tokens</span>
            </div>
            <span className="text-zinc-100 font-bold">{usage.promptTokens.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center text-zinc-300">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-zinc-400" />
              <span>Completion Tokens</span>
            </div>
            <span className="text-zinc-100 font-bold">{usage.completionTokens.toLocaleString()}</span>
          </div>

          <div className="border-t border-zinc-800 pt-2 flex justify-between items-center text-zinc-300">
            <span>Total Tokens</span>
            <span className="text-zinc-100 font-bold">{totalTokens.toLocaleString()}</span>
          </div>

          <div className="border-t border-zinc-800 pt-3 flex justify-between items-center">
            <span className="text-zinc-400 font-sans font-medium">Total Cost</span>
            <span className="text-emerald-400 font-bold text-sm">
              {usage.totalCost < 0.0001 ? '< $0.0001' : `$${usage.totalCost.toFixed(4)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
