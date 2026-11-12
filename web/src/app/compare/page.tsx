'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import type { PropertyMapItem } from '@/components/PropertyMap';
import {
  getCompareList,
  removeFromCompare,
  clearCompareList,
  toggleCompareProperty,
  getPlanSummary,
  type PlanSummary,
} from '@/lib/pro-plan';
import { isLandlordOnSiteProperty } from '@/lib/geo';
import {
  Sparkle,
  Scales,
  Trophy,
  Trash,
  ArrowSquareOut,
  CheckCircle,
  WarningCircle,
  Crown,
  Plus,
  MagnifyingGlass,
  CircleNotch,
} from '@phosphor-icons/react';

interface CompareRanking {
  id: string;
  rank: number;
  score: number;
  headline: string;
  best_for: string;
  biggest_tradeoff: string;
  wfh_fit: string;
  acoustic_verdict: string;
  value_verdict: string;
}

interface CompareResult {
  winner_id: string;
  executive_verdict: string;
  rankings: CompareRanking[];
  matrix_highlights: { category: string; winner_id: string; note: string }[];
  is_fallback?: boolean;
  fallback_reason?: string;
}

const LIFESTYLE_MODES = [
  'Work from home (full-time)',
  'Work from home (part-time)',
  'Work from cafes',
  'Work from an office',
];

const SAMPLE_COMPARE_PROPERTIES: PropertyMapItem[] = [
  {
    id: 'sample-gardens-palmhof',
    title: '0.5 Bed Studio in Palmhof, Gardens',
    address: '12 Union Street, Gardens',
    suburb: 'Gardens',
    price: 15500,
    bedrooms: 0.5,
    bathrooms: 1,
    sqm: 50,
    lat: -33.9341,
    lng: 18.4112,
    noise_risk: 'sanctuary',
    fibre_ready: true,
    has_garage: false,
    has_secure_bay: true,
    stove_type: 'gas',
    pet_friendly: false,
    acoustic_audit: { estimated_db: 38, facing_direction: 'North-facing' },
    description: 'Art Deco studio apartment in Palmhof with parquet floors, high ceilings, north-facing balcony, and gas hob.',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'sample-tamboerskloof-1bed',
    title: '1 Bed Private Garden Flat in Tamboerskloof',
    address: '24 Leeuwenvoet Road, Tamboerskloof',
    suburb: 'Tamboerskloof',
    price: 17800,
    bedrooms: 1,
    bathrooms: 1,
    sqm: 68,
    lat: -33.9308,
    lng: 18.4045,
    noise_risk: 'sanctuary',
    fibre_ready: true,
    has_garage: true,
    has_secure_bay: true,
    stove_type: 'gas',
    pet_friendly: true,
    acoustic_audit: { estimated_db: 37, facing_direction: 'North-East' },
    description: 'Standalone 1-bedroom apartment with separate living room, lock-up garage, fibre, and quiet mountain views.',
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'sample-seapoint-mainrd',
    title: '1 Bed Modern Apartment on Main Road, Sea Point',
    address: '180 Main Road, Sea Point',
    suburb: 'Sea Point',
    price: 16200,
    bedrooms: 1,
    bathrooms: 1,
    sqm: 56,
    lat: -33.9165,
    lng: 18.3885,
    noise_risk: 'high',
    fibre_ready: true,
    has_garage: false,
    has_secure_bay: true,
    stove_type: 'electric',
    pet_friendly: false,
    acoustic_audit: { estimated_db: 66, facing_direction: 'West-facing' },
    description: 'Modern renovated apartment on Main Road, Sea Point, walking distance to coffee shops and MyCiTi.',
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
  },
];

export default function ComparePage() {
  const [compareProps, setCompareProps] = useState<PropertyMapItem[]>([]);
  const [favProps, setFavProps] = useState<PropertyMapItem[]>([]);
  const [preferences, setPreferences] = useState('');
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setCompareProps(getCompareList());
    setPlan(getPlanSummary());
    try {
      const savedPrefs = localStorage.getItem('homeseek_personal_preferences') || '';
      setPreferences(savedPrefs);
      const rawFavs = localStorage.getItem('homeseek_imported_favourites');
      if (rawFavs) {
        const parsed = JSON.parse(rawFavs);
        if (Array.isArray(parsed)) setFavProps(parsed);
      }
    } catch {}

    const onCompareSync = () => setCompareProps(getCompareList());
    const onPlanSync = () => setPlan(getPlanSummary());
    window.addEventListener('homeseek-compare-updated', onCompareSync);
    window.addEventListener('homeseek-plan-updated', onPlanSync);
    return () => {
      window.removeEventListener('homeseek-compare-updated', onCompareSync);
      window.removeEventListener('homeseek-plan-updated', onPlanSync);
    };
  }, []);

  const updatePreferences = (next: string) => {
    setPreferences(next);
    try {
      localStorage.setItem('homeseek_personal_preferences', next);
    } catch {}
  };

  const toggleMode = (mode: string) => {
    const escaped = mode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:,\\s*|\\n\\s*)?${escaped}\\.?`, 'gi');
    if (preferences.toLowerCase().includes(mode.toLowerCase())) {
      const cleaned = preferences.replace(regex, '').replace(/^[\s,]+|[\s,]+$/g, '').trim();
      updatePreferences(cleaned);
    } else {
      const next = preferences.trim() ? `${preferences.trim().replace(/[.,]+$/, '')}. ${mode}` : mode;
      updatePreferences(next);
    }
  };

  const handleLoadSamples = () => {
    clearCompareList();
    SAMPLE_COMPARE_PROPERTIES.forEach((p) => toggleCompareProperty(p));
    setCompareProps(getCompareList());
    setCompareResult(null);
  };

  const handleRunCompare = async () => {
    if (compareProps.length < 2) {
      setErrorMsg('Select at least 2 properties to run an AI side-by-side comparison.');
      return;
    }
    setErrorMsg(null);
    setIsComparing(true);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${backendBase}/api/properties/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: compareProps,
          personal_preferences: preferences,
        }),
      });
      if (!resp.ok) {
        throw new Error(`Comparison request failed (${resp.status})`);
      }
      const data = await resp.json();
      if (data?.comparison) {
        setCompareResult(data.comparison);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to run comparison. Ensure backend server is running.');
    } finally {
      setIsComparing(false);
    }
  };

  const rankingById = (id: string): CompareRanking | undefined =>
    compareResult?.rankings?.find((r) => String(r.id) === String(id));

  const propById = (id: string): PropertyMapItem | undefined =>
    compareProps.find((p) => String(p.id) === String(id));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-700 text-white flex items-center justify-center">
                <Scales size={18} weight="bold" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                AI Side-by-Side Property Compare
              </h1>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200 uppercase">
                {compareProps.length} / 4 Selected
              </span>
            </div>
            <p className="text-xs text-zinc-600">
              Rank shortlisted properties head-to-head on WFH ergonomics, acoustic decibels, privacy, security, and value per m².
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {plan && !plan.canUseAiCompare && (
              <Link
                href="/pricing"
                className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-100 transition-colors"
              >
                <Crown size={14} weight="fill" className="text-amber-600" />
                <span>Hunter Pass Recommended (Preview Active)</span>
              </Link>
            )}
            <Link
              href="/search"
              className="px-3.5 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-800 flex items-center gap-1.5"
            >
              <MagnifyingGlass size={14} weight="bold" />
              <span>Add from Search</span>
            </Link>
            {compareProps.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearCompareList();
                  setCompareResult(null);
                }}
                className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <Trash size={14} weight="bold" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Lifestyle & Preferences Input */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-800 flex items-center gap-1.5">
              <Sparkle size={15} weight="fill" className="text-purple-600" />
              <span>Your Work &amp; Lifestyle Criteria for Ranking</span>
            </h2>
            <span className="text-[11px] text-zinc-500">Synced with Search preferences</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {LIFESTYLE_MODES.map((mode) => {
              const active = preferences.toLowerCase().includes(mode.toLowerCase());
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => toggleMode(mode)}
                  className={`px-3 py-2 rounded-xl border text-left text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    active
                      ? 'bg-purple-50 border-purple-400 text-purple-950 shadow-2xs'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center text-[10px] border ${
                      active ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-zinc-300'
                    }`}
                  >
                    {active ? '✓' : ''}
                  </span>
                  <span>{mode}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <textarea
              value={preferences}
              onChange={(e) => updatePreferences(e.target.value)}
              rows={2}
              placeholder="e.g., Need quiet WFH space with fibre, 100% private (no landlord), secure parking, close to cafes..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-zinc-50/50"
            />
            <button
              type="button"
              onClick={handleRunCompare}
              disabled={isComparing || compareProps.length < 2}
              className={`px-6 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 shrink-0 transition-all cursor-pointer ${
                isComparing || compareProps.length < 2
                  ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  : 'bg-purple-700 hover:bg-purple-800 text-white shadow-md shadow-purple-700/20 active:scale-98'
              }`}
            >
              {isComparing ? (
                <>
                  <CircleNotch size={16} className="animate-spin" />
                  <span>Comparing with AI...</span>
                </>
              ) : (
                <>
                  <Sparkle size={16} weight="fill" />
                  <span>Run AI Comparison ({compareProps.length})</span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Empty State / Quick Loader */}
        {compareProps.length === 0 && (
          <div className="p-10 rounded-3xl bg-white border-2 border-dashed border-zinc-300 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
              <Scales size={24} weight="bold" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-base font-black text-zinc-900">Your Compare Shortlist Is Empty</h3>
              <p className="text-xs text-zinc-600">
                Click <strong>&ldquo;+ Compare&rdquo;</strong> on any property card or Forensic Report in Search, or load 3 sample Cape Town listings below to test the AI comparison matrix right away.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleLoadSamples}
                className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black cursor-pointer shadow-xs"
              >
                Load 3 Sample Listings to Compare
              </button>
              <Link
                href="/search"
                className="px-4 py-2.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-800"
              >
                Browse Search Map
              </Link>
            </div>
          </div>
        )}

        {/* Quick Add from Imported Favourites */}
        {favProps.length > 0 && compareProps.length < 4 && (
          <div className="p-4 rounded-2xl bg-white border border-zinc-200 space-y-2.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
              Quick-Add from Your Imported Favourites ({favProps.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {favProps.slice(0, 8).map((fav) => {
                const selected = compareProps.some((p) => String(p.id) === String(fav.id));
                return (
                  <button
                    key={fav.id}
                    type="button"
                    onClick={() => {
                      toggleCompareProperty(fav);
                      setCompareProps(getCompareList());
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      selected
                        ? 'bg-purple-100 border-purple-400 text-purple-900'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <Plus size={12} weight="bold" />
                    <span className="truncate max-w-[200px]">{fav.title}</span>
                    <span className="text-zinc-500">· R{Number(fav.price || 0).toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Executive Verdict Banner */}
        {compareResult && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-900 via-indigo-900 to-zinc-900 text-white shadow-lg space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-zinc-950 flex items-center justify-center shrink-0">
                  <Trophy size={22} weight="fill" />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                    AI Side-by-Side Winner Verdict
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-white/95">
                    {compareResult.executive_verdict}
                  </p>
                </div>
              </div>
              {compareResult.is_fallback && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-amber-200">
                  Deterministic Scoring Engine Active
                </span>
              )}
            </div>

            {compareResult.matrix_highlights?.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-white/10">
                {compareResult.matrix_highlights.map((h, i) => {
                  const winProp = propById(h.winner_id);
                  return (
                    <div key={i} className="p-3 rounded-xl bg-white/10 border border-white/15 space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-wider text-purple-200">
                        {h.category}
                      </div>
                      <div className="text-xs font-black text-white truncate">
                        🏆 {winProp?.title || h.winner_id}
                      </div>
                      <div className="text-[11px] text-white/80">{h.note}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Side-by-Side Cards Matrix */}
        {compareProps.length > 0 && (
          <div className={`grid grid-cols-1 ${compareProps.length === 2 ? 'md:grid-cols-2' : compareProps.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4'} gap-4`}>
            {compareProps.map((prop) => {
              const r = rankingById(prop.id);
              const isWinner = compareResult && String(compareResult.winner_id) === String(prop.id);
              const estDb = prop.acoustic_audit?.estimated_db || (prop.noise_risk === 'sanctuary' ? 38 : 48);
              const landlordOnSite = isLandlordOnSiteProperty(prop);

              return (
                <div
                  key={prop.id}
                  className={`rounded-2xl bg-white border-2 overflow-hidden flex flex-col justify-between shadow-xs transition-all ${
                    isWinner ? 'border-amber-400 ring-2 ring-amber-200/70' : 'border-zinc-200'
                  }`}
                >
                  <div>
                    {/* Thumbnail */}
                    <div className="relative h-40 bg-zinc-200">
                      {prop.image ? (
                        <img src={prop.image} alt={prop.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500 font-semibold">
                          No Photo
                        </div>
                      )}
                      {r && (
                        <div
                          className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-xs font-black shadow-md flex items-center gap-1 ${
                            isWinner ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-900/90 text-white'
                          }`}
                        >
                          {isWinner && <Trophy size={13} weight="fill" />}
                          <span>#{r.rank} · {r.score}/100</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          removeFromCompare(prop.id);
                          setCompareProps(getCompareList());
                        }}
                        title="Remove from Compare"
                        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/65 hover:bg-rose-600 text-white flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
                      >
                        ×
                      </button>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-sm font-black text-zinc-950 leading-snug">{prop.title}</h3>
                        <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                          {prop.address} {prop.suburb ? `· ${prop.suburb}` : ''}
                        </p>
                      </div>

                      {/* Core Metrics */}
                      <div className="grid grid-cols-3 gap-1.5 text-center bg-zinc-50 p-2 rounded-xl border border-zinc-200/70">
                        <div>
                          <div className="text-[9.5px] font-bold uppercase text-zinc-400">Rent</div>
                          <div className="text-xs font-black text-zinc-900">R{Number(prop.price || 0).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[9.5px] font-bold uppercase text-zinc-400">Size</div>
                          <div className="text-xs font-black text-zinc-900">
                            {prop.bedrooms}bd · {prop.sqm ? `${prop.sqm}m²` : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9.5px] font-bold uppercase text-zinc-400">Noise</div>
                          <div className={`text-xs font-black ${estDb <= 42 ? 'text-emerald-700' : 'text-amber-700'}`}>
                            ~{estDb} dBA
                          </div>
                        </div>
                      </div>

                      {/* AI Verdict Rows */}
                      {r && (
                        <div className="space-y-2 text-[11px]">
                          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                            <div className="font-extrabold text-emerald-900 flex items-center gap-1 mb-0.5">
                              <CheckCircle size={13} weight="fill" className="text-emerald-600" />
                              <span>Best For</span>
                            </div>
                            <div className="text-emerald-950 font-medium">{r.best_for}</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/80">
                            <div className="font-extrabold text-rose-900 flex items-center gap-1 mb-0.5">
                              <WarningCircle size={13} weight="fill" className="text-rose-600" />
                              <span>Biggest Trade-Off</span>
                            </div>
                            <div className="text-rose-950 font-medium">{r.biggest_tradeoff}</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                            <div><span className="font-bold text-slate-800">WFH Fit:</span> <span className="text-slate-700">{r.wfh_fit}</span></div>
                            <div><span className="font-bold text-slate-800">Acoustics:</span> <span className="text-slate-700">{r.acoustic_verdict}</span></div>
                            <div><span className="font-bold text-slate-800">Value:</span> <span className="text-slate-700">{r.value_verdict}</span></div>
                          </div>
                        </div>
                      )}

                      {/* Quick Attribute Pills */}
                      <div className="flex flex-wrap gap-1 text-[10px] font-bold">
                        <span className={`px-2 py-0.5 rounded-md border ${landlordOnSite ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                          {landlordOnSite ? 'Landlord On-Site' : '100% Private'}
                        </span>
                        {prop.fibre_ready && (
                          <span className="px-2 py-0.5 rounded-md bg-cyan-50 border border-cyan-200 text-cyan-900">Fibre</span>
                        )}
                        {(prop.has_garage || prop.has_secure_bay) && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-800">
                            {prop.has_garage ? 'Lock-Up Garage' : 'Secure Bay'}
                          </span>
                        )}
                        {prop.stove_type === 'gas' && (
                          <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-900">Gas Hob</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between gap-2">
                    {prop.url ? (
                      <a
                        href={prop.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-purple-700 hover:underline flex items-center gap-1"
                      >
                        <span>View Original</span>
                        <ArrowSquareOut size={12} weight="bold" />
                      </a>
                    ) : (
                      <span className="text-[10px] text-zinc-400 font-medium">Sample / Local</span>
                    )}
                    <Link
                      href="/search"
                      className="text-[11px] font-bold text-zinc-700 hover:text-zinc-950"
                    >
                      Open in Search →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

