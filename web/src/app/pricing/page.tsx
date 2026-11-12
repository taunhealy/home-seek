'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Check, Sparkle, Crown, Camera, Scales, ShieldCheck, ArrowRight, Lightning } from '@phosphor-icons/react';
import { getPlanSummary, setProPlanTier, addTopupCredits, type PlanSummary, type ProPlanTier } from '@/lib/pro-plan';

export default function PricingPage() {
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setPlan(getPlanSummary());
    const sync = () => setPlan(getPlanSummary());
    window.addEventListener('homeseek-plan-updated', sync);
    return () => window.removeEventListener('homeseek-plan-updated', sync);
  }, []);

  const handleSelectPlan = (tier: ProPlanTier, label: string) => {
    const updated = setProPlanTier(tier);
    setPlan(updated);
    setStatusMsg(`Active plan switched to ${label}. Remaining AI Audits: ${updated.remainingAudits}.`);
  };

  const handleTopup = () => {
    const updated = addTopupCredits(15);
    setPlan(updated);
    setStatusMsg(`+15 Photo Audit credits added! Total remaining audits: ${updated.remainingAudits}.`);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-16 space-y-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-900 border border-purple-200 text-xs font-extrabold uppercase tracking-wider">
            <Crown size={14} weight="fill" className="text-purple-700" />
            <span>Home-Seek Pro &amp; Hunter Passes</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
            Built for 2–8 Week Apartment Hunts — No Subscription Traps
          </h1>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Browse map layers, crime/noise telemetry, and favourites for free. Upgrade with a once-off <strong>30-Day Hunter Pass</strong> when you are actively viewing flats and want AI inspection on your own viewing photos &amp; side-by-side comparisons.
          </p>

          {plan && (
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white border border-zinc-200 shadow-xs text-xs font-bold text-zinc-800">
              <span>Current Plan: <span className="text-purple-700">{plan.label}</span></span>
              <span className="text-zinc-300">|</span>
              <span>Remaining AI Audits: <span className="text-emerald-700">{plan.remainingAudits}</span></span>
              <Link href="/search" className="text-purple-700 hover:underline flex items-center gap-1 ml-1">
                <span>Open Search</span>
                <ArrowRight size={12} weight="bold" />
              </Link>
            </div>
          )}

          {statusMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900">
              {statusMsg}
            </div>
          )}
        </div>

        {/* 3 Core Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free Scout */}
          <div className={`p-6 rounded-3xl bg-white border-2 flex flex-col justify-between space-y-6 shadow-xs ${plan?.tier === 'free' ? 'border-zinc-900' : 'border-zinc-200'}`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Free Scout</span>
                {plan?.tier === 'free' && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-zinc-900 text-white">Active</span>
                )}
              </div>
              <div>
                <div className="text-3xl font-black text-zinc-950">R0</div>
                <p className="text-xs text-zinc-500 mt-1">Forever free for map discovery &amp; filtering</p>
              </div>
              <ul className="space-y-2.5 text-xs font-medium text-zinc-700 pt-2 border-t border-zinc-100">
                <li className="flex items-start gap-2"><Check size={15} weight="bold" className="text-emerald-600 shrink-0 mt-0.5" /><span>Interactive map + Crime, Bar Noise &amp; Road overlays</span></li>
                <li className="flex items-start gap-2"><Check size={15} weight="bold" className="text-emerald-600 shrink-0 mt-0.5" /><span>Suburb median pricing &amp; Property24 favourites import</span></li>
                <li className="flex items-start gap-2"><Check size={15} weight="bold" className="text-emerald-600 shrink-0 mt-0.5" /><span>Heuristic Pros, Cons &amp; Tenant Vigilance checklist</span></li>
                <li className="flex items-start gap-2"><Check size={15} weight="bold" className="text-emerald-600 shrink-0 mt-0.5" /><span><strong>2 Free AI Forensic Audits</strong> (listing photos)</span></li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => handleSelectPlan('free', 'Free Scout')}
              className="w-full py-2.5 rounded-xl text-xs font-black border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-900 transition-colors cursor-pointer"
            >
              {plan?.tier === 'free' ? 'Current Plan' : 'Switch to Free Scout'}
            </button>
          </div>

          {/* 30-Day Hunter Pass (Flagship) */}
          <div className={`p-6 rounded-3xl bg-gradient-to-b from-purple-50/80 via-white to-white border-2 flex flex-col justify-between space-y-6 shadow-md relative ${plan?.tier === 'hunter_pass' ? 'border-purple-700' : 'border-purple-400'}`}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-purple-700 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
              Most Popular · Zero Auto-Renew
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-purple-800">30-Day Hunter Pass</span>
                {plan?.tier === 'hunter_pass' && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-700 text-white">Active</span>
                )}
              </div>
              <div>
                <div className="text-3xl font-black text-zinc-950">R149 <span className="text-xs font-bold text-zinc-500">once-off (~$8.50)</span></div>
                <p className="text-xs text-zinc-600 mt-1">Ideal for an active Cape Town apartment search</p>
              </div>
              <ul className="space-y-2.5 text-xs font-medium text-zinc-800 pt-2 border-t border-purple-100">
                <li className="flex items-start gap-2"><Sparkle size={15} weight="fill" className="text-purple-600 shrink-0 mt-0.5" /><span><strong>40 AI Forensic Multimodal Audits</strong></span></li>
                <li className="flex items-start gap-2"><Camera size={15} weight="fill" className="text-purple-600 shrink-0 mt-0.5" /><span><strong>Upload Viewing &amp; Off-Portal Photos</strong> (up to 8 photos/audit for damp, plugs, snags &amp; WhatsApp/FB listings)</span></li>
                <li className="flex items-start gap-2"><Scales size={15} weight="fill" className="text-purple-600 shrink-0 mt-0.5" /><span><strong>AI Side-by-Side Compare Page</strong> (rank up to 4 shortlisted flats)</span></li>
                <li className="flex items-start gap-2"><ShieldCheck size={15} weight="fill" className="text-purple-600 shrink-0 mt-0.5" /><span>6-Point Architectural/WFH Audit, Block Intel &amp; Snag Report Export</span></li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => handleSelectPlan('hunter_pass', '30-Day Hunter Pass')}
              className="w-full py-3 rounded-xl text-xs font-black bg-purple-700 hover:bg-purple-800 text-white shadow-sm transition-all cursor-pointer active:scale-98"
            >
              {plan?.tier === 'hunter_pass' ? 'Active: 30-Day Hunter Pass' : 'Activate 30-Day Hunter Pass'}
            </button>
          </div>

          {/* Pro Monthly Concierge */}
          <div className={`p-6 rounded-3xl bg-white border-2 flex flex-col justify-between space-y-6 shadow-xs ${plan?.tier === 'pro_monthly' ? 'border-indigo-700' : 'border-zinc-200'}`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-800">Pro Monthly</span>
                {plan?.tier === 'pro_monthly' && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-700 text-white">Active</span>
                )}
              </div>
              <div>
                <div className="text-3xl font-black text-zinc-950">R229 <span className="text-xs font-bold text-zinc-500">/ month (~$13)</span></div>
                <p className="text-xs text-zinc-500 mt-1">For relocators, longer searches &amp; property scouts</p>
              </div>
              <ul className="space-y-2.5 text-xs font-medium text-zinc-700 pt-2 border-t border-zinc-100">
                <li className="flex items-start gap-2"><Check size={15} weight="bold" className="text-indigo-600 shrink-0 mt-0.5" /><span><strong>150 AI Forensic Audits / month</strong></span></li>
                <li className="flex items-start gap-2"><Check size={15} weight="bold" className="text-indigo-600 shrink-0 mt-0.5" /><span>Unlimited Viewing &amp; Off-Portal Photo Uploads (within quota)</span></li>
                <li className="flex items-start gap-2"><Check size={15} weight="bold" className="text-indigo-600 shrink-0 mt-0.5" /><span>Full AI Side-by-Side Compare &amp; Move-In Snag Report Export</span></li>
                <li className="flex items-start gap-2"><Check size={15} weight="bold" className="text-indigo-600 shrink-0 mt-0.5" /><span>Priority architectural &amp; block-review refresh</span></li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => handleSelectPlan('pro_monthly', 'Pro Monthly')}
              className="w-full py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
            >
              {plan?.tier === 'pro_monthly' ? 'Active: Pro Monthly' : 'Activate Pro Monthly'}
            </button>
          </div>
        </div>

        {/* Credit Top-Up Add-on */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Lightning size={20} weight="fill" />
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-950">Credit Top-Up Pack — R69 (~$4)</h3>
              <p className="text-xs text-zinc-600">
                Need extra viewing photo audits without changing plans? Add <strong>+15 AI Photo Audits</strong> that never expire while your account is active.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTopup}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black shrink-0 cursor-pointer transition-colors"
          >
            + Add 15 Credits (R69)
          </button>
        </div>
      </main>
    </div>
  );
}

