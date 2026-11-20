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
  replaceCompareProperty,
  getPlanSummary,
  type PlanSummary,
} from '@/lib/pro-plan';
import { isLandlordOnSiteProperty } from '@/lib/geo';
import { SUBURB_ABBREVIATIONS } from '@/constants/capeTownGeo';
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
  PencilSimple,
  MapPin,
  X,
} from '@phosphor-icons/react';

const COMPARE_AREA_SUGGESTIONS = Array.from(
  new Set([
    ...Object.keys(SUBURB_ABBREVIATIONS)
      .filter((k) => k !== 'simons town')
      .map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase())),
    'Llandudno',
    'Noordhoek',
    'Sunnydale',
    'Capri',
    'Kommetjie',
    'Scarborough',
    'Tokai',
    'Kenilworth',
    'Wynberg',
    'Plumstead',
  ])
).sort();

interface CompareRanking {
  id: string;
  rank: number;
  score: number;
  headline: string;
  best_for: string;
  biggest_tradeoff: string;
  photo_story?: string;
  wfh_fit: string;
  wall_acoustic_audit?: string;
  window_light_audit?: string;
  lighting_fixtures_audit?: string;
  acoustic_verdict: string;
  value_verdict: string;
  gotchas?: string[];
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

  // Swap / Add Property by Area Modal State
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  const [swapAreaQuery, setSwapAreaQuery] = useState('Hout Bay');
  const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);
  const [swapTextFilter, setSwapTextFilter] = useState('');
  const [areaListings, setAreaListings] = useState<PropertyMapItem[]>([]);
  const [isLoadingAreaListings, setIsLoadingAreaListings] = useState(false);

  const fetchListingsForArea = async (areaName: string) => {
    const clean = areaName.trim();
    if (!clean) return;
    setIsLoadingAreaListings(true);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/search/live-scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suburbs: [clean],
          min_price: 0,
          max_price: 999999,
          bedrooms: 'any',
          force_fresh: false,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw = Array.isArray(data?.listings) ? data.listings : [];
      setAreaListings(
        raw.map((it: any) => ({
          ...it,
          id: String(it.id || `p24-${it.p24_id}`),
          title: it.title || 'Property Listing',
          address: it.address || clean,
          price: Number(it.price || 0),
          bedrooms: Number(it.bedrooms || 1),
          bathrooms: Number(it.bathrooms || 1),
          image: it.image || (Array.isArray(it.images) && it.images[0]) || '',
          lat: Number(it.lat || -33.9249),
          lng: Number(it.lng || 18.4241),
        }))
      );
    } catch {
      setAreaListings([]);
    } finally {
      setIsLoadingAreaListings(false);
    }
  };

  const openSwapModal = (prop: PropertyMapItem | null) => {
    const initialArea = prop?.suburb || (prop?.address ? prop.address.split(',').slice(-1)[0].trim() : '') || 'Hout Bay';
    setSwapTargetId(prop ? String(prop.id) : '__add_new__');
    setSwapAreaQuery(initialArea);
    setSwapTextFilter('');
    setShowAreaSuggestions(false);
    fetchListingsForArea(initialArea);
  };

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
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openSwapModal(prop)}
                          title="Edit / swap this listing by area"
                          className="px-2.5 h-7 rounded-full bg-black/70 hover:bg-indigo-600 text-white flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors backdrop-blur-xs"
                        >
                          <PencilSimple size={12} weight="bold" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removeFromCompare(prop.id);
                            setCompareProps(getCompareList());
                          }}
                          title="Remove from Compare"
                          className="w-7 h-7 rounded-full bg-black/65 hover:bg-rose-600 text-white flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
                        >
                          ×
                        </button>
                      </div>
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

                      {/* AI Verdict Rows — Deep Architectural & Multimodal Insights */}
                      {r && (
                        <div className="space-y-2.5 text-[11px]">
                          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                            <div className="font-extrabold text-emerald-900 flex items-center gap-1 mb-0.5">
                              <CheckCircle size={13} weight="fill" className="text-emerald-600" />
                              <span>Best For</span>
                            </div>
                            <div className="text-emerald-950 font-medium leading-relaxed">{r.best_for}</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/80">
                            <div className="font-extrabold text-rose-900 flex items-center gap-1 mb-0.5">
                              <WarningCircle size={13} weight="fill" className="text-rose-600" />
                              <span>Biggest Trade-Off</span>
                            </div>
                            <div className="text-rose-950 font-medium leading-relaxed">{r.biggest_tradeoff}</div>
                          </div>

                          {r.photo_story && (
                            <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200/70 space-y-1">
                              <div className="font-extrabold text-indigo-950 uppercase tracking-wider text-[10px]">
                                Photo &amp; Spatial Read
                              </div>
                              <p className="text-zinc-800 leading-relaxed">{r.photo_story}</p>
                            </div>
                          )}

                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                            <div>
                              <div className="font-extrabold text-slate-900 text-[10px] uppercase tracking-wider mb-0.5">
                                WFH &amp; Desk Ergonomics
                              </div>
                              <p className="text-slate-700 leading-relaxed">{r.wfh_fit}</p>
                            </div>

                            <div>
                              <div className="font-extrabold text-slate-900 text-[10px] uppercase tracking-wider mb-0.5">
                                Walls, Floor Echo &amp; Acoustics
                              </div>
                              <p className="text-slate-700 leading-relaxed">
                                {r.wall_acoustic_audit || r.acoustic_verdict}
                              </p>
                            </div>

                            {r.window_light_audit && (
                              <div>
                                <div className="font-extrabold text-slate-900 text-[10px] uppercase tracking-wider mb-0.5">
                                  Windows, Daylight &amp; Sun Glare
                                </div>
                                <p className="text-slate-700 leading-relaxed">{r.window_light_audit}</p>
                              </div>
                            )}

                            {r.lighting_fixtures_audit && (
                              <div>
                                <div className="font-extrabold text-slate-900 text-[10px] uppercase tracking-wider mb-0.5">
                                  Lighting Fixtures &amp; Evening Feel
                                </div>
                                <p className="text-slate-700 leading-relaxed">{r.lighting_fixtures_audit}</p>
                              </div>
                            )}

                            <div>
                              <div className="font-extrabold text-slate-900 text-[10px] uppercase tracking-wider mb-0.5">
                                Monthly Value
                              </div>
                              <p className="text-slate-700 leading-relaxed">{r.value_verdict}</p>
                            </div>
                          </div>

                          {Array.isArray(r.gotchas) && r.gotchas.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-1">
                              <div className="font-extrabold text-amber-950 text-[10px] uppercase tracking-wider flex items-center gap-1">
                                <WarningCircle size={12} weight="fill" className="text-amber-600" />
                                <span>Gotchas &amp; Viewing Checks</span>
                              </div>
                              <ul className="space-y-1 list-disc pl-4 text-amber-950">
                                {r.gotchas.map((g, gi) => (
                                  <li key={gi} className="leading-snug">{g}</li>
                                ))}
                              </ul>
                            </div>
                          )}
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

            {compareProps.length < 4 && (
              <button
                type="button"
                onClick={() => openSwapModal(null)}
                className="min-h-[280px] rounded-2xl border-2 border-dashed border-zinc-300 hover:border-indigo-400 bg-white/70 hover:bg-indigo-50/40 flex flex-col items-center justify-center gap-2 p-6 text-center transition-all cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-colors">
                  <Plus size={22} weight="bold" />
                </div>
                <div className="text-xs font-black text-zinc-900">Add Property by Area</div>
                <div className="text-[11px] text-zinc-500 max-w-[190px]">
                  Search cached Cape Town listings by suburb to compare side-by-side
                </div>
              </button>
            )}
          </div>
        )}
      </main>

      {/* Change / Select Property by Area Modal */}
      {swapTargetId && (
        <div
          className="fixed inset-0 z-[200] bg-zinc-950/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSwapTargetId(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-zinc-950 flex items-center gap-2">
                  <MapPin size={18} weight="fill" className="text-indigo-600" />
                  <span>{swapTargetId === '__add_new__' ? 'Add Property to Compare' : 'Change Comparison Listing'}</span>
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Search cached listings by Cape Town suburb and click any property to select it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSwapTargetId(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 cursor-pointer"
                aria-label="Close"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Area Search + Keyword Filter */}
            <div className="p-4 border-b border-zinc-100 bg-zinc-50/70 space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2 relative">
                <div className="relative flex-1">
                  <MapPin size={14} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none" />
                  <input
                    type="text"
                    value={swapAreaQuery}
                    onFocus={() => setShowAreaSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowAreaSuggestions(false), 160)}
                    onChange={(e) => {
                      setSwapAreaQuery(e.target.value);
                      setShowAreaSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setShowAreaSuggestions(false);
                        fetchListingsForArea(swapAreaQuery);
                      }
                    }}
                    placeholder="Area / Suburb (e.g. Hout Bay, Gardens, Sea Point)..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-950 focus:outline-none focus:border-indigo-500"
                  />
                  {showAreaSuggestions && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl max-h-44 overflow-y-auto z-30 py-1">
                      {COMPARE_AREA_SUGGESTIONS.filter(
                        (sub) => !swapAreaQuery.trim() || sub.toLowerCase().includes(swapAreaQuery.trim().toLowerCase())
                      )
                        .slice(0, 8)
                        .map((sub) => (
                          <button
                            key={sub}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSwapAreaQuery(sub);
                              setShowAreaSuggestions(false);
                              fetchListingsForArea(sub);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-indigo-50 hover:text-indigo-900 flex items-center justify-between cursor-pointer"
                          >
                            <span>{sub}</span>
                            <span className="text-[10px] font-bold text-zinc-400">Load area</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fetchListingsForArea(swapAreaQuery)}
                  disabled={isLoadingAreaListings}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  {isLoadingAreaListings ? (
                    <CircleNotch size={14} className="animate-spin" />
                  ) : (
                    <MagnifyingGlass size={14} weight="bold" />
                  )}
                  <span>Search Area</span>
                </button>
              </div>

              <div className="relative">
                <MagnifyingGlass size={13} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={swapTextFilter}
                  onChange={(e) => setSwapTextFilter(e.target.value)}
                  placeholder="Filter loaded listings by street, title, bedrooms, or price..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {isLoadingAreaListings ? (
                <div className="space-y-2.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-20 rounded-2xl bg-zinc-100 animate-pulse" />
                  ))}
                </div>
              ) : (() => {
                const q = swapTextFilter.trim().toLowerCase();
                const filtered = areaListings.filter(
                  (item) =>
                    !q ||
                    `${item.title} ${item.address} ${item.suburb || ''} ${item.price} ${item.bedrooms} bed`
                      .toLowerCase()
                      .includes(q)
                );

                if (filtered.length === 0) {
                  return (
                    <div className="py-10 text-center space-y-2">
                      <p className="text-xs font-bold text-zinc-800">
                        No cached listings found for &ldquo;{swapAreaQuery}&rdquo;
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Try another Cape Town suburb above or scrape fresh listings on the Search page.
                      </p>
                    </div>
                  );
                }

                return filtered.map((item) => {
                  const isAlreadySelected = compareProps.some((p) => String(p.id) === String(item.id));
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        const next =
                          swapTargetId === '__add_new__'
                            ? toggleCompareProperty(item).list
                            : replaceCompareProperty(swapTargetId, item);
                        setCompareProps(next);
                        setCompareResult(null);
                        setSwapTargetId(null);
                      }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center gap-3.5 cursor-pointer ${
                        isAlreadySelected
                          ? 'bg-indigo-50/70 border-indigo-300'
                          : 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-indigo-300'
                      }`}
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-16 h-16 rounded-xl object-cover border border-zinc-200 shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 shrink-0">
                          <MapPin size={18} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-xs font-black text-zinc-950 truncate">{item.title}</div>
                        <div className="text-[11px] text-zinc-500 truncate">{item.address}</div>
                        <div className="flex items-center gap-2 text-[11px] font-bold pt-0.5">
                          <span className="text-emerald-700">
                            {item.price > 0 ? `R ${item.price.toLocaleString()}/mo` : 'POA'}
                          </span>
                          <span className="text-zinc-400">·</span>
                          <span className="text-zinc-700">
                            {item.bedrooms}bd{item.sqm ? ` · ${item.sqm}m²` : ''}
                          </span>
                        </div>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl bg-zinc-950 text-white text-[11px] font-extrabold shrink-0">
                        {swapTargetId === '__add_new__' ? 'Add' : 'Select'}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

