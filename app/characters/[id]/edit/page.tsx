'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FloppyDisk, Trash } from '@phosphor-icons/react';

export default function EditCharacter() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/characters/${id}`);
        if (!res.ok) throw new Error('Character not found');
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
      } catch (err) {
        alert(err);
        router.push('/characters');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.persona.trim() || !formData.greeting.trim()) {
      alert('Name, Persona, and Greeting are required.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/characters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error(await res.text());
      router.push('/characters');
    } catch (err) {
      alert('Failed to update character: ' + err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete persona "${formData.name}"?`)) return;
    try {
      const res = await fetch(`/api/characters/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/characters');
    } catch (err) {
      alert('Delete failed: ' + err);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 grid place-items-center bg-zinc-950 text-zinc-500 p-8">
        <div className="flex flex-col gap-3 items-center">
          <div className="h-6 w-6 rounded-full border-2 border-zinc-800 border-t-zinc-400 animate-spin" />
          <p className="text-xs font-mono">Loading character...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <Link href="/characters" className="p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Edit Persona: {formData.name}</h1>
            <p className="text-xs text-zinc-400">Update persona configuration & backstory.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-900/50 bg-rose-950/20 text-rose-400 hover:bg-rose-900/40 text-xs font-medium transition-colors"
        >
          <Trash size={15} />
          <span>Delete Persona</span>
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
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-zinc-700"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Persona & Personality *</label>
          <textarea
            value={formData.persona}
            onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
            rows={4}
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
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-100 outline-none focus:border-zinc-700 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Scenario & Setting</label>
            <textarea
              value={formData.scenario}
              onChange={(e) => setFormData({ ...formData, scenario: e.target.value })}
              rows={3}
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
            <span>{saving ? 'Saving...' : 'Update Persona'}</span>
          </button>
        </div>
      </form>
    </main>
  );
}
