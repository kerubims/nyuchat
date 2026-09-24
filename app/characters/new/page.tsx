'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkle, ArrowLeft, Check, FloppyDisk } from '@phosphor-icons/react';

export default function NewCharacter() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    avatar_url: '',
    gender: 'Female',
    persona: '',
    greeting: '',
    backstory: '',
    key_memories: '',
    scenario: '',
    response_directives: '',
    example_dialogue: '',
  });

  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/characters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      setFormData({
        name: data.name || '',
        avatar_url: data.avatar_url || '',
        gender: data.gender || 'Female',
        persona: data.persona || '',
        greeting: data.greeting || '',
        backstory: data.backstory || '',
        key_memories: data.key_memories || '',
        scenario: data.scenario || '',
        response_directives: data.response_directives || '',
        example_dialogue: data.example_dialogue || '',
      });
      setShowGenModal(false);
      setPrompt('');
    } catch (err) {
      alert('Failed to generate persona: ' + err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.persona.trim() || !formData.greeting.trim()) {
      alert('Name, Persona, and Greeting are required.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      router.push(`/characters`);
    } catch (err) {
      alert('Failed to save character: ' + err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <Link href="/characters" className="p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Create New Persona</h1>
            <p className="text-xs text-zinc-400">Define a stateful roleplay character persona.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowGenModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-950/40 text-purple-300 border border-purple-800/60 hover:bg-purple-900/50 text-xs font-semibold transition-colors"
        >
          <Sparkle size={16} weight="fill" />
          <span>AI Generate Persona</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Character Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Vey"
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-zinc-700"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Gender</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-zinc-700"
            >
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Not specified">Not specified</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Avatar Image URL</label>
          <input
            type="url"
            value={formData.avatar_url}
            onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
            placeholder="https://i.pravatar.cc/150?u=avatar"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-zinc-700"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Persona & Personality *</label>
          <textarea
            value={formData.persona}
            onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
            rows={4}
            placeholder="[Personality: Playful, curious][Background: 24-year-old...]"
            required
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-100 outline-none focus:border-zinc-700 resize-none font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Greeting Message *</label>
          <textarea
            value={formData.greeting}
            onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
            rows={3}
            placeholder='*Vey leans against the doorframe.* "Well, well... all alone tonight?"'
            required
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-100 outline-none focus:border-zinc-700 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Backstory</label>
            <textarea
              value={formData.backstory}
              onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
              rows={3}
              placeholder="Detailed background story..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-100 outline-none focus:border-zinc-700 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Scenario & Setting</label>
            <textarea
              value={formData.scenario}
              onChange={(e) => setFormData({ ...formData, scenario: e.target.value })}
              rows={3}
              placeholder="Location, time, and environment context..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-100 outline-none focus:border-zinc-700 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-900">
          <Link href="/characters" className="px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 text-xs font-medium hover:bg-zinc-900">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            <FloppyDisk size={16} weight="bold" />
            <span>{saving ? 'Saving...' : 'Save Persona'}</span>
          </button>
        </div>
      </form>

      {/* AI Generator Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2 text-purple-300">
                <Sparkle size={18} weight="fill" /> AI Persona Generator
              </h3>
              <button onClick={() => setShowGenModal(false)} className="text-zinc-500 hover:text-zinc-300 text-xs">
                Close
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Describe the character idea in plain Indonesian or English, and AI will construct the full persona schema.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="e.g. Wanita 22 tahun kapten tim atletik lari yang tsundere dan sering latihan malam hari di kampus..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-100 outline-none focus:border-zinc-700 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowGenModal(false)} className="px-3.5 py-2 rounded-xl text-xs text-zinc-400 hover:bg-zinc-900">
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold text-xs hover:bg-purple-500 transition-colors disabled:opacity-50"
              >
                {generating ? 'Generating Persona...' : 'Generate Persona'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
