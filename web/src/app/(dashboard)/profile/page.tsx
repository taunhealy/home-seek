'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  CheckCircle,
  Crown,
  MagnifyingGlass,
  Sparkle,
  UserCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-context';
import { getPlanSummary, type PlanSummary } from '@/lib/pro-plan';
import { apiUrl } from '@/lib/apiClient';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setPlan(getPlanSummary());
    const onPlanSync = () => setPlan(getPlanSummary());
    window.addEventListener('homeseek-plan-updated', onPlanSync);
    window.addEventListener('storage', onPlanSync);
    return () => {
      window.removeEventListener('homeseek-plan-updated', onPlanSync);
      window.removeEventListener('storage', onPlanSync);
    };
  }, []);

  useEffect(() => {
    setNickname(profile?.nickname || '');
    setAvatarUrl(profile?.avatar_url || user?.photoURL || '');
  }, [profile?.nickname, profile?.avatar_url, user?.photoURL]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_200_000) {
      setSaveMsg({ type: 'err', text: 'Please choose an image smaller than 1.2 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(apiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          nickname: nickname.trim(),
          avatar_url: avatarUrl.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || 'Failed to update profile');
      }
      await refreshProfile();
      setSaveMsg({ type: 'ok', text: 'Profile settings saved.' });
    } catch (err: any) {
      setSaveMsg({ type: 'err', text: err?.message || 'Could not save profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const remaining = plan?.remainingAudits ?? 0;
  const totalQuota = (plan?.baseQuota ?? 2) + (plan?.topupCredits ?? 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-white">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Profile &amp; AI Credits</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage your HomeSeek identity, active plan tier, and AI Vision / Chat credit balance.
          </p>
        </div>
        <Link
          href="/search"
          className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <MagnifyingGlass size={14} weight="bold" className="text-indigo-400" />
          <span>Back to Search Radar</span>
        </Link>
      </div>

      {/* AI Credits & Plan Card */}
      <div className="rounded-3xl bg-zinc-900/90 border border-white/10 p-6 space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg">
              <Sparkle size={22} weight="fill" className="text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold">AI Credits Balance</h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {plan?.label || 'Free Scout'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Used for individual Gemini AI Vision inspections and follow-up AI property chat (1 credit per message).
              </p>
            </div>
          </div>

          <Link
            href="/pricing"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-colors"
          >
            <Crown size={14} weight="fill" className="text-amber-300" />
            <span>Top Up / Upgrade</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Remaining Credits</div>
            <div className={`text-2xl font-black mt-1 tabular-nums ${remaining > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {remaining}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Used</div>
            <div className="text-2xl font-black mt-1 tabular-nums text-white">{plan?.auditsUsed ?? 0}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Plan Quota</div>
            <div className="text-2xl font-black mt-1 tabular-nums text-indigo-300">{plan?.baseQuota ?? 2}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Top-Up Credits</div>
            <div className="text-2xl font-black mt-1 tabular-nums text-amber-300">+{plan?.topupCredits ?? 0}</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-semibold">
            <span>Credit Usage ({plan?.auditsUsed ?? 0} of {totalQuota} used)</span>
            <span>{plan?.priceLabel || 'R0'}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-indigo-500 transition-all"
              style={{ width: `${Math.min(100, Math.round((remaining / Math.max(1, totalQuota)) * 100))}%` }}
            />
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 pt-1 text-[11px]">
          <span className={`px-2.5 py-1 rounded-full border font-bold ${plan?.canUploadPhotos ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-zinc-400'}`}>
            {plan?.canUploadPhotos ? '✓ Viewing Photo Upload' : '🔒 Viewing Photo Upload (Pro)'}
          </span>
          <span className={`px-2.5 py-1 rounded-full border font-bold ${plan?.canExportSnagReport ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-zinc-400'}`}>
            {plan?.canExportSnagReport ? '✓ Snag Report Export' : '🔒 Snag Report Export (Pro)'}
          </span>
          <span className={`px-2.5 py-1 rounded-full border font-bold ${plan?.canUseAiCompare ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-zinc-400'}`}>
            {plan?.canUseAiCompare ? '✓ AI Side-by-Side Compare' : '🔒 AI Compare (Pro)'}
          </span>
        </div>
      </div>

      {/* Account Identity & Profile Settings */}
      <form onSubmit={handleSave} className="rounded-3xl bg-zinc-900/90 border border-white/10 p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-white/10">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-14 h-14 rounded-2xl object-cover border border-white/20" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center">
              <UserCircle size={28} className="text-indigo-300" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-extrabold truncate">{user?.displayName || 'HomeSeek User'}</div>
            <div className="text-xs text-zinc-400 truncate">{user?.email}</div>
            {profile?.nickname && (
              <div className="text-[11px] font-bold text-indigo-300 mt-0.5">u/{profile.nickname}</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Community Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. CapeScout (3-24 chars)"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Avatar Image URL or Upload
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={avatarUrl.startsWith('data:image/') ? 'Uploaded image ready' : avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
              />
              <label className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0">
                <Camera size={14} weight="bold" />
                <span>Upload</span>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {saveMsg && (
          <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${saveMsg.type === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
            {saveMsg.type === 'ok' ? <CheckCircle size={15} weight="fill" /> : <WarningCircle size={15} weight="fill" />}
            <span>{saveMsg.text}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Profile Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
