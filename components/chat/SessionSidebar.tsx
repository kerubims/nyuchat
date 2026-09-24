'use client';

import Link from 'next/link';
import { Plus, Trash, X, ArrowLeft, Sliders, Coins } from '@phosphor-icons/react';

interface Session {
  id: string;
  title: string;
  created_at?: string;
  total_prompt_tokens?: number;
  total_completion_tokens?: number;
  total_cost_usd?: number;
}

interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId?: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  characterName: string;
  temperature: number;
  setTemperature: (v: number) => void;
  usageStats?: UsageStats;
  isOpen: boolean;
  onClose: () => void;
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  characterName,
  temperature,
  setTemperature,
  usageStats,
  isOpen,
  onClose,
}: SessionSidebarProps) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col w-72 bg-zinc-950 border-r border-zinc-900 transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:z-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-900 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <h2 className="text-xs font-semibold text-zinc-300 truncate">{characterName}&apos;s Rooms</h2>
              <p className="text-[10px] font-mono text-zinc-500">{sessions.length} sessions</p>
            </div>
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <button
            onClick={() => {
              onNewSession();
              onClose();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-zinc-100 text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus size={16} weight="bold" />
            <span>New Session</span>
          </button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
          {sessions.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-8">No sessions yet</p>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  className="group relative flex items-center gap-1"
                >
                  <button
                    onClick={() => {
                      onSelectSession(session.id);
                      onClose();
                    }}
                    className={`flex-1 text-left px-3 py-2.5 rounded-xl text-xs transition-all truncate ${
                      isActive
                        ? 'bg-zinc-900 text-zinc-100 border border-zinc-800 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                    }`}
                  >
                    {session.title}
                  </button>

                  {/* High Contrast Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this session?')) {
                        onDeleteSession(session.id);
                      }
                    }}
                    className="px-2 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-400 hover:bg-rose-900 hover:text-rose-100 transition-colors flex items-center justify-center shrink-0 shadow-sm"
                    title="Delete session"
                  >
                    <Trash size={14} weight="bold" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Settings Section */}
        <div className="p-4 border-t border-zinc-900 flex flex-col gap-3">
          {/* Creativity Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
              <span className="flex items-center gap-1 font-semibold uppercase">
                <Sliders size={12} /> Creativity (Temp)
              </span>
              <span className="text-zinc-200 font-bold text-xs">{temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.5"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-zinc-100 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Usage Stats Section */}
        {usageStats && (
          <div className="p-4 border-t border-zinc-900 space-y-2">
            <span className="text-[10px] font-mono font-semibold uppercase text-zinc-400 flex items-center gap-1">
              <Coins size={12} /> Session Usage
            </span>
            <div className="text-[11px] font-mono space-y-1 text-zinc-400">
              <div className="flex justify-between">
                <span>Session Tokens:</span>
                <span className="text-zinc-100 font-bold">
                  {(usageStats.promptTokens + usageStats.completionTokens).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Session Cost:</span>
                <span className="text-emerald-400 font-bold">
                  {usageStats.totalCost < 0.0001 ? '< $0.0001' : `$${usageStats.totalCost.toFixed(4)}`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="p-3 border-t border-zinc-900">
          <Link
            href="/characters"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors font-medium"
          >
            <ArrowLeft size={14} />
            <span>Back to Characters</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
