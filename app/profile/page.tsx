'use client';

import { useState, useEffect } from 'react';
import { User, FloppyDisk, CheckCircle } from '@phosphor-icons/react';

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    display_name: 'User',
    gender: 'Not specified',
    persona: '',
    response_style: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile({
            display_name: data.display_name || 'User',
            gender: data.gender || 'Not specified',
            persona: data.persona || '',
            response_style: data.response_style || '',
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      if (!res.ok) throw new Error('Failed to update profile');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 grid place-items-center bg-zinc-950 text-zinc-500 p-8">
        <div className="flex flex-col gap-3 items-center">
          <div className="h-6 w-6 rounded-full border-2 border-zinc-800 border-t-zinc-400 animate-spin" />
          <p className="text-xs font-mono">Loading user profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">
      <div className="pb-4 border-b border-zinc-900">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <User size={24} className="text-zinc-400" /> User Profile Settings
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Configure how AI personas perceive you during roleplay conversations.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Display Name</label>
            <input
              type="text"
              value={profile.display_name}
              onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              placeholder="e.g. Zack"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-zinc-700"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Gender</label>
            <select
              value={profile.gender}
              onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-zinc-700"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Not specified">Not specified</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Your Persona & Demographics</label>
          <textarea
            value={profile.persona}
            onChange={(e) => setProfile({ ...profile, persona: e.target.value })}
            rows={4}
            placeholder="e.g. A 19-year-old college student home for the summer. Quiet, observant, and speaks casually."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-100 outline-none focus:border-zinc-700 resize-none font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Your Response Style Directives</label>
          <textarea
            value={profile.response_style}
            onChange={(e) => setProfile({ ...profile, response_style: e.target.value })}
            rows={3}
            placeholder="e.g. Short, casual messages. Often uses action tags *...* to describe actions instead of words."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-100 outline-none focus:border-zinc-700 resize-none"
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
          {savedSuccess ? (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
              <CheckCircle size={16} weight="fill" />
              <span>Profile updated successfully!</span>
            </div>
          ) : <div />}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            <FloppyDisk size={16} weight="bold" />
            <span>{saving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>
      </form>
    </main>
  );
}
