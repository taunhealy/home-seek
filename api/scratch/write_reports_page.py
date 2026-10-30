import os

reports_page_content = """'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Sparkle,
  MapPin,
  CalendarBlank,
  ArrowSquareOut,
  CheckCircle,
  WarningCircle,
  Car,
  Bed,
  Bathtub,
  Ruler,
  ArrowsClockwise,
  CircleNotch,
  ArrowRight,
  Target,
  House,
  SlidersHorizontal,
  Clock,
  Eye,
  SquaresFour,
  ListDashes,
  ShieldCheck,
  Star,
  UserCheck,
  Buildings,
  Check,
  X
} from '@phosphor-icons/react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/lib/auth-context';
import { fetchWithAuth } from '@/lib/api';
import { RealViewSlider } from '@/components/RealViewSlider';
import { ListingImageGallery } from '@/components/ListingImageGallery';

interface ProUniversalFoundation {
  true_dimensions?: string;
  lens_distortion?: {
    detected: boolean;
    severity: string;
    summary: string;
  };
  view_and_acoustics?: {
    rating: string;
    visual_evidence: string;
    acoustic_risk_score?: number;
  };
  natural_light?: {
    level: string;
    orientation: string;
    notes: string;
  };
  building_dossier?: {
    name: string;
    google_stars?: number | null;
    review_count?: number | null;
    soundproofing: string;
    airbnb_party_risk: string;
    community_summary: string;
  };
  accessibility_and_parking?: {
    floor: string;
    has_lift: string;
    parking_summary: string;
    stair_climb_effort: string;
  };
}

interface ProPersonalizedAudit {
  wfh_studio_feasibility?: {
    status: string;
    desk_fit_analysis: string;
    acoustic_reverberation_notes: string;
  };
  gear_storage_and_transit?: {
    status: string;
    details: string;
  };
  personalized_fit_score?: number;
  tailored_advisor_verdict?: string;
}

interface ProReport {
  universal_foundation?: ProUniversalFoundation;
  personalized_audit?: ProPersonalizedAudit;
  generated_at?: number;
  credits_spent?: number;
}

interface RankedItem {
  id: string;
  listing_id: string;
  title: string;
  price: number | null;
  address: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqm?: number | null;
  parking: number | null;
  is_furnished: boolean | null;
  image: string | null;
  images?: string[];
  url: string;
  area: string;
  rank: number;
  fit_score: number;
  short_explanation: string;
  pros?: string[];
  cons?: string[];
  verdict: string;
  noise_risk: string;
  noise_reason?: string | null;
  vision_audit_available?: boolean;
  vision_audit?: any;
  agency_name?: string | null;
  agency_rating?: number | null;
  agency_review_count?: number | null;
  agency_risk_level?: string | null;
  agency_flags?: string[];
  agency_complaint_sample?: string | null;
  agency_url?: string | null;
  agency_hellopeter_rating?: number | null;
  price_value_pct?: number | null;
  floor_number?: string | null;
  has_lift?: string | null;
  building_name?: string | null;
  pro_report?: ProReport | null;
}

interface IntelligenceReport {
  id: string;
  alert_id?: string;
  created_at: string;
  overall_summary: string;
  areas_scouted: string[];
  total_found: number;
  user_prompt: string;
  personal_tastes: string;
  max_price?: number;
  ranked_listings: RankedItem[];
}

export default function ReportsPage() {
  const { user, profile, loading, login, logout, refreshProfile } = useAuth();
  const [reports, setReports] = useState<IntelligenceReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<IntelligenceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [realviewTarget, setRealviewTarget] = useState<{ url: string; title: string } | null>(null);
  
  // Pro AI Credit and Auditing States
  const [proCredits, setProCredits] = useState<number>(profile?.pro_credits ?? 5);
  const [isAuditingListingId, setIsAuditingListingId] = useState<string | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const getRectifiedUrl = (rawUrl: string) => `${backendBase}/api/realview/rectify?url=${encodeURIComponent(rawUrl)}`;

  const loadReports = async () => {
    const uid = profile?.id || user?.uid || 'taun_test_user';
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await fetchWithAuth(`/reports/${uid}`);
      if (res && res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.reports)) {
          setReports(data.reports);
          if (data.reports.length > 0 && !selectedReport) {
            setSelectedReport(data.reports[0]);
          }
        }
      } else {
        setFetchError('Backend returned an error loading reports');
      }
    } catch (err: any) {
      console.warn("Failed to load reports:", err);
      setFetchError(err?.message || 'Could not connect to HomeSeek backend on port 8000');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [user, profile]);

  useEffect(() => {
    if (profile?.pro_credits !== undefined) {
      setProCredits(profile.pro_credits);
    }
  }, [profile]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadReports();
    if (refreshProfile) refreshProfile();
  };

  // Top up credits (e.g. 5 Pro Reports for R50)
  const handleTopupCredits = async (pack: 'starter_5' | 'hunter_12', credits: number) => {
    const uid = profile?.id || user?.uid || 'taun_test_user';
    try {
      setTopupLoading(true);
      const res = await fetch(`${backendBase}/api/credits/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid, pack, credits })
      });
      if (res.ok) {
        const data = await res.json();
        setProCredits(data.new_balance);
        setShowCreditModal(false);
        if (refreshProfile) refreshProfile();
      }
    } catch (e) {
      console.error("Topup error:", e);
    } finally {
      setTopupLoading(false);
    }
  };

  // Unlock Pro AI Report for a listing
  const handleUnlockProReport = async (listingId: string) => {
    if (!selectedReport) return;
    const uid = profile?.id || user?.uid || 'taun_test_user';

    if (proCredits < 1) {
      setShowCreditModal(true);
      return;
    }

    try {
      setIsAuditingListingId(listingId);
      setAuditError(null);

      const res = await fetch(`${backendBase}/api/reports/pro-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listingId,
          report_id: selectedReport.id,
          user_id: uid
        })
      });

      const data = await res.json();
      if (data.status === 'success' && data.pro_report) {
        if (data.remaining_credits !== undefined) {
          setProCredits(data.remaining_credits);
        }
        // Update local state immediately
        const updatedListings = selectedReport.ranked_listings.map((item) => {
          if (item.listing_id === listingId) {
            return {
              ...item,
              pro_report: data.pro_report,
              vision_audit: data.pro_report
            };
          }
          return item;
        });

        const updatedReport = { ...selectedReport, ranked_listings: updatedListings };
        setSelectedReport(updatedReport);
        setReports((prev) => prev.map((r) => (r.id === updatedReport.id ? updatedReport : r)));
      } else if (data.status === 'insufficient_credits') {
        setShowCreditModal(true);
      } else {
        setAuditError(data.message || 'Failed to generate Pro Report');
      }
    } catch (err: any) {
      setAuditError(err?.message || 'Connection error generating Pro Report');
    } finally {
      setIsAuditingListingId(null);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col pt-16">
      <Navbar
        user={user}
        profile={profile}
        loading={loading}
        handleLogin={login}
        handleLogout={logout}
      />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 space-y-10">
        {/* Header - Matching Search Page Style */}
        <div className="space-y-4 border-b border-zinc-200 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-xs font-semibold">
                <FileText size={14} weight="bold" />
                <span>SaaS Intelligence Digest</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
                Daily Top 10 Property Reports
              </h1>
              <p className="text-sm text-zinc-600 max-w-2xl leading-relaxed">
                Automated AI scans scheduled daily at 11:00 AM SAST. The engine searches Property24 portals, ranks the top 10 listings against your personalized lifestyle desires, and provides actionable insights.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {/* Pro Credit Balance Pill */}
              <button
                type="button"
                onClick={() => setShowCreditModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100/90 border border-amber-200 text-amber-950 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Click to view Pro AI Report packages"
              >
                <Sparkle size={15} weight="fill" className="text-amber-500" />
                <span>{proCredits} Pro Credits</span>
                <span className="text-[10px] bg-amber-200/90 text-amber-950 px-1.5 py-0.5 rounded-md font-extrabold">+ Buy</span>
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-xs font-semibold text-zinc-800 transition-all cursor-pointer shadow-2xs"
              >
                <ArrowsClockwise size={14} className={isRefreshing ? 'animate-spin' : ''} weight="bold" />
                <span>Refresh</span>
              </button>

              <Link
                href="/discover"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <Sparkle size={14} weight="bold" />
                <span>New AI Scout</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && reports.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4 text-center">
            <CircleNotch size={32} className="text-zinc-900 animate-spin" />
            <p className="text-sm text-zinc-600 font-medium">Fetching your intelligence reports...</p>
          </div>
        ) : fetchError ? (
          /* Backend Connection Error Banner */
          <section className="bg-white border border-rose-200 rounded-3xl p-10 text-center max-w-xl mx-auto my-8 space-y-4 shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <WarningCircle size={28} weight="bold" />
            </div>
            <h3 className="text-xl font-bold text-zinc-950">Backend Connection Error</h3>
            <p className="text-sm text-zinc-600 leading-relaxed max-w-md mx-auto">
              Could not connect to the HomeSeek backend service at <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-900 font-mono">http://127.0.0.1:8000</code>.
            </p>
            <div className="pt-2">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                <ArrowsClockwise size={14} weight="bold" />
                <span>Retry Connection</span>
              </button>
            </div>
          </section>
        ) : reports.length === 0 ? (
          /* Empty State - Matching Search Page Cards */
          <section className="bg-white border border-zinc-200 rounded-3xl p-12 text-center max-w-xl mx-auto my-8 space-y-4 shadow-2xs">
            <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-900 flex items-center justify-center mx-auto">
              <FileText size={32} weight="regular" />
            </div>
            <h3 className="text-xl font-bold text-zinc-950">No Reports Generated Yet</h3>
            <p className="text-sm text-zinc-600 leading-relaxed max-w-md mx-auto">
              Configure your search criteria and lifestyle tastes on the Search or AI Scout page. The daily 11:00 AM SAST cron will automatically generate your interactive reports here.
            </p>
            <div className="pt-2">
              <Link
                href="/discover"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs shadow-sm transition-all"
              >
                <Sparkle size={14} weight="bold" />
                <span>Configure AI Scout Alert</span>
              </Link>
            </div>
          </section>
        ) : (
          /* Master-Detail Layout in Search Page Styling */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left: Report Archive List (4 Cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Report Archive ({reports.length})
                </span>
                <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                  <Clock size={12} />
                  11:00 AM SAST
                </span>
              </div>

              <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
                {reports.map((rep) => {
                  const isSelected = selectedReport?.id === rep.id;
                  return (
                    <button
                      key={rep.id}
                      onClick={() => setSelectedReport(rep)}
                      className={`w-full text-left p-4 rounded-3xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-md ring-1 ring-zinc-950'
                          : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-900 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-700'
                        }`}>
                          {formatDate(rep.created_at)}
                        </span>
                        <span className={`text-xs font-semibold ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                          {rep.ranked_listings?.length || 0} listings
                        </span>
                      </div>

                      <div className="text-xs font-medium line-clamp-2 leading-relaxed mb-3 opacity-90">
                        {rep.user_prompt || 'Custom Lifestyle Search'}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {rep.areas_scouted?.map((area, idx) => (
                          <span
                            key={idx}
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                              isSelected ? 'bg-zinc-900 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Selected Report Dossier (8 Cols) */}
            <div className="lg:col-span-8 space-y-6">
              {selectedReport && (
                <div className="space-y-6">

                  {/* Overview Banner Card */}
                  <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            Report Generated {formatDate(selectedReport.created_at)}
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 mt-1">
                          Scouted Selection: Top {selectedReport.ranked_listings?.length || 0} Contenders
                        </h2>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="px-3 py-1 rounded-xl bg-zinc-100 text-xs font-bold text-zinc-800 border border-zinc-200">
                          {selectedReport.total_found} Scanned
                        </div>
                      </div>
                    </div>

                    {/* AI Executive Summary */}
                    <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 sm:p-5 text-sm text-zinc-800 leading-relaxed space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-950 uppercase tracking-wider">
                        <Sparkle size={14} className="text-amber-500" weight="fill" />
                        <span>Executive Scout Digest</span>
                      </div>
                      <p className="font-normal text-xs sm:text-sm text-zinc-700 leading-relaxed">
                        {selectedReport.overall_summary}
                      </p>
                    </div>

                    {/* Search Parameters Chips */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-600">
                      <span className="font-semibold text-zinc-900">Criteria:</span>
                      <span className="bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200">
                        Areas: {selectedReport.areas_scouted?.join(', ')}
                      </span>
                      {selectedReport.max_price && (
                        <span className="bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200">
                          Max: R {selectedReport.max_price.toLocaleString()} pm
                        </span>
                      )}
                      {selectedReport.personal_tastes && (
                        <span className="bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200 max-w-md truncate">
                          Tastes: {selectedReport.personal_tastes}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Listings Container Header & View Mode Switcher */}
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                      <span>Curated Properties</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-semibold">
                        {selectedReport.ranked_listings?.length || 0}
                      </span>
                    </h3>

                    <div className="flex items-center p-1 bg-zinc-100 rounded-xl border border-zinc-200">
                      <button
                        onClick={() => setViewMode('cards')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          viewMode === 'cards'
                            ? 'bg-white text-zinc-950 shadow-2xs'
                            : 'text-zinc-600 hover:text-zinc-950'
                        }`}
                      >
                        <SquaresFour size={14} weight="bold" />
                        <span>Photo Gallery</span>
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          viewMode === 'table'
                            ? 'bg-white text-zinc-950 shadow-2xs'
                            : 'text-zinc-600 hover:text-zinc-950'
                        }`}
                      >
                        <ListDashes size={14} weight="bold" />
                        <span>Table View</span>
                      </button>
                    </div>
                  </div>

                  {/* Error Alert if Pro Audit Fails */}
                  {auditError && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
                      <span>{auditError}</span>
                      <button onClick={() => setAuditError(null)} className="text-rose-500 hover:text-rose-700">
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* CARD VIEW MODE */}
                  {viewMode === 'cards' ? (
                    <div className="space-y-6">
                      {selectedReport.ranked_listings?.map((item) => (
                        <div
                          key={item.id || item.listing_id}
                          className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-6 space-y-4 hover:border-zinc-300 transition-all shadow-2xs"
                        >
                          {/* Image Gallery */}
                          <ListingImageGallery
                            listingId={item.listing_id}
                            title={item.title}
                            primaryImage={item.image}
                            images={item.images}
                            listingUrl={item.url}
                          />

                          {/* Card Content */}
                          <div className="space-y-4 pt-2">
                            {/* Header: Rank, Title, Price */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-zinc-950 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                                    #{item.rank}
                                  </span>
                                  <h4 className="font-bold text-zinc-950 text-base">
                                    {item.title}
                                  </h4>
                                </div>
                                <div className="text-xs text-zinc-500 flex items-center gap-1 pl-8">
                                  <MapPin size={13} className="text-zinc-400" />
                                  <span>{item.address}</span>
                                </div>

                                {/* Building & Agency Badges */}
                                <div className="flex flex-wrap items-center gap-2 pl-8 pt-1 text-xs">
                                  {item.building_name && (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-900 font-medium border border-indigo-200/80 text-[11px]">
                                      <Buildings size={13} className="text-indigo-600" />
                                      <span className="font-semibold">{item.building_name}</span>
                                    </div>
                                  )}

                                  {item.agency_name && (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-zinc-100 text-zinc-800 font-medium border border-zinc-200/80 text-[11px]">
                                      <span className="font-semibold">{item.agency_name}</span>
                                      {item.agency_rating && (
                                        <span className="flex items-center gap-0.5 text-amber-700 font-bold ml-0.5">
                                          <Star size={12} weight="fill" className="text-amber-500" />
                                          {item.agency_rating.toFixed(1)}★
                                          {item.agency_review_count ? (
                                            <span className="text-zinc-400 font-normal text-[10px]">({item.agency_review_count})</span>
                                          ) : null}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 sm:justify-end pl-8 sm:pl-0 shrink-0">
                                {item.price_value_pct !== null && item.price_value_pct !== undefined && (
                                  <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors ${
                                    item.price_value_pct <= -4
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : item.price_value_pct >= 4
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                  }`}>
                                    {item.price_value_pct < 0
                                      ? `${Math.abs(item.price_value_pct)}% underpriced`
                                      : item.price_value_pct > 0
                                      ? `${item.price_value_pct}% overpriced`
                                      : 'Fair Value'}
                                  </div>
                                )}

                                <div className="text-left sm:text-right">
                                  <div className="font-extrabold text-zinc-950 text-lg whitespace-nowrap">
                                    {item.price ? `R ${item.price.toLocaleString()}` : 'Contact'}
                                  </div>
                                  <div className="text-[11px] text-zinc-400">per month</div>
                                </div>
                              </div>
                            </div>

                            {/* Badges & Specs Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 px-3.5 bg-zinc-50 rounded-2xl border border-zinc-100">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                                  item.fit_score >= 80 ? 'bg-zinc-950 text-white' : item.fit_score >= 65 ? 'bg-zinc-200 text-zinc-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  Fit Score: {item.fit_score}%
                                </span>

                                {item.noise_risk === 'high' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <WarningCircle size={13} weight="bold" />
                                    Traffic Noise Trap
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle size={13} weight="bold" />
                                    Quiet Street
                                  </span>
                                )}

                                {/* Floor Level Badge */}
                                {item.floor_number && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                                    <Buildings size={13} className="text-zinc-500" />
                                    {item.floor_number}
                                  </span>
                                )}

                                {/* Lift / Elevator Badge */}
                                {item.has_lift && (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                                    item.has_lift === 'yes'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : item.has_lift === 'no'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : item.has_lift === 'N/A (Ground)'
                                      ? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                      : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                                  }`}>
                                    {item.has_lift === 'yes' ? '🛗 Lift Available' : item.has_lift === 'no' ? '⚠️ Stairs Only (No Lift)' : item.has_lift === 'N/A (Ground)' ? '🌿 Ground Level' : '🛗 Lift: Unknown'}
                                  </span>
                                )}
                              </div>

                              {/* Specs */}
                              <div className="flex items-center gap-3 text-xs text-zinc-600 font-medium">
                                {item.bedrooms !== null && (
                                  <div className="flex items-center gap-1">
                                    <Bed size={15} className="text-zinc-400" />
                                    <span>{item.bedrooms} Bed</span>
                                  </div>
                                )}
                                {item.bathrooms !== null && (
                                  <div className="flex items-center gap-1">
                                    <Bathtub size={15} className="text-zinc-400" />
                                    <span>{item.bathrooms} Bath</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <Car size={15} className="text-zinc-400" />
                                  <span>{item.parking ? `${item.parking} Bay` : 'Street'}</span>
                                </div>
                                {item.sqm && (
                                  <div className="flex items-center gap-1 font-semibold text-zinc-900">
                                    <Ruler size={15} className="text-zinc-500" />
                                    <span>{item.sqm} m²</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Advisor Evaluation */}
                            <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 text-xs text-zinc-800 leading-relaxed font-normal">
                              <span className="font-bold text-zinc-950 block mb-1">Advisor Evaluation:</span>
                              {item.short_explanation}
                            </div>

                            {/* Pros & Cons Container */}
                            {((item.pros && item.pros.length > 0) || (item.cons && item.cons.length > 0)) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                {/* Pros Container */}
                                {item.pros && item.pros.length > 0 && (
                                  <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-2xl p-3.5 space-y-2">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 uppercase tracking-wider">
                                      <CheckCircle size={14} weight="fill" className="text-emerald-600" />
                                      <span>Pros & Highlights</span>
                                    </div>
                                    <ul className="space-y-1.5 text-xs text-emerald-950">
                                      {item.pros.map((pro, pIdx) => (
                                        <li key={pIdx} className="flex items-start gap-2 leading-relaxed">
                                          <span className="text-emerald-500 font-bold mt-0.5">•</span>
                                          <span>{pro}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Cons Container */}
                                {item.cons && item.cons.length > 0 && (
                                  <div className="bg-rose-50/50 border border-rose-200/70 rounded-2xl p-3.5 space-y-2">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900 uppercase tracking-wider">
                                      <WarningCircle size={14} weight="fill" className="text-rose-600" />
                                      <span>Cons & Drawbacks</span>
                                    </div>
                                    <ul className="space-y-1.5 text-xs text-rose-950">
                                      {item.cons.map((con, cIdx) => (
                                        <li key={cIdx} className="flex items-start gap-2 leading-relaxed">
                                          <span className="text-rose-500 font-bold mt-0.5">•</span>
                                          <span>{con}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* PRO AI REPORT DOSSIER (IF UNLOCKED) */}
                            {item.pro_report && (
                              <div className="mt-4 rounded-3xl bg-zinc-900 text-white p-5 sm:p-6 shadow-xl border border-zinc-800 space-y-6 animate-fadeIn">
                                {/* Pro Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-amber-400 text-zinc-950 flex items-center justify-center font-black shrink-0">
                                      <Sparkle size={18} weight="fill" />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-sm tracking-tight text-white uppercase">AI Pro Forensic Report</span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                          Verified Dossier
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-zinc-400">Multimodal Vision • Room Scale Forensics • Building Reviews • Personal Lifestyle Fit</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <span className="text-xs text-zinc-400">Personalized Match:</span>
                                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-extrabold text-xs border border-emerald-500/30">
                                      {item.pro_report?.personalized_audit?.personalized_fit_score ?? item.fit_score}% Fit
                                    </span>
                                  </div>
                                </div>

                                {/* Part 1: Universal Foundation Points */}
                                <div className="space-y-3">
                                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Target size={14} className="text-amber-400" />
                                    <span>Part 1: Foundational Universal Inspection</span>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {/* RealView Spatial Scale */}
                                    <div className="bg-zinc-800/60 rounded-2xl p-3.5 border border-zinc-700/60 space-y-1.5">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                                          <Ruler size={14} className="text-indigo-400" /> True Room Dimensions
                                        </span>
                                        <span className="text-[10px] text-amber-300 font-semibold">1.0x Scale</span>
                                      </div>
                                      <div className="text-xs text-zinc-300 font-medium leading-relaxed">
                                        {item.pro_report?.universal_foundation?.true_dimensions}
                                      </div>
                                      <div className="text-[11px] text-zinc-400 pt-1">
                                        {item.pro_report?.universal_foundation?.lens_distortion?.summary}
                                      </div>
                                    </div>

                                    {/* View & Acoustics */}
                                    <div className="bg-zinc-800/60 rounded-2xl p-3.5 border border-zinc-700/60 space-y-1.5">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                                          <Eye size={14} className="text-emerald-400" /> Balcony View & Acoustics
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                          item.pro_report?.universal_foundation?.view_and_acoustics?.rating?.includes('Trap')
                                            ? 'bg-rose-500/20 text-rose-300'
                                            : 'bg-emerald-500/20 text-emerald-300'
                                        }`}>
                                          {item.pro_report?.universal_foundation?.view_and_acoustics?.rating}
                                        </span>
                                      </div>
                                      <div className="text-xs text-zinc-300 font-medium leading-relaxed">
                                        {item.pro_report?.universal_foundation?.view_and_acoustics?.visual_evidence}
                                      </div>
                                    </div>

                                    {/* Building & Community Reviews */}
                                    <div className="bg-zinc-800/60 rounded-2xl p-3.5 border border-zinc-700/60 space-y-1.5">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                                          <Buildings size={14} className="text-sky-400" /> Building Reviews
                                        </span>
                                        {item.pro_report?.universal_foundation?.building_dossier?.google_stars && (
                                          <span className="text-[10px] text-amber-300 font-bold flex items-center gap-0.5">
                                            <Star size={11} weight="fill" /> {item.pro_report?.universal_foundation?.building_dossier?.google_stars}★
                                            ({item.pro_report?.universal_foundation?.building_dossier?.review_count})
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs font-semibold text-white">
                                        {item.pro_report?.universal_foundation?.building_dossier?.name}
                                      </div>
                                      <div className="text-[11px] text-zinc-400 leading-tight">
                                        {item.pro_report?.universal_foundation?.building_dossier?.community_summary}
                                      </div>
                                      <div className="text-[10px] text-zinc-400 pt-0.5">
                                        Airbnb Risk: <span className="text-zinc-200 font-medium">{item.pro_report?.universal_foundation?.building_dossier?.airbnb_party_risk}</span> • Soundproofing: <span className="text-zinc-200">{item.pro_report?.universal_foundation?.building_dossier?.soundproofing}</span>
                                      </div>
                                    </div>

                                    {/* Daylight & Orientation */}
                                    <div className="bg-zinc-800/60 rounded-2xl p-3.5 border border-zinc-700/60 space-y-1.5">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                                          ☀️ Natural Sunlight
                                        </span>
                                        <span className="text-[10px] text-amber-300 font-semibold">
                                          {item.pro_report?.universal_foundation?.natural_light?.level}
                                        </span>
                                      </div>
                                      <div className="text-xs text-zinc-300">
                                        {item.pro_report?.universal_foundation?.natural_light?.orientation}
                                      </div>
                                      <div className="text-[11px] text-zinc-400">
                                        {item.pro_report?.universal_foundation?.natural_light?.notes}
                                      </div>
                                    </div>

                                    {/* Accessibility & Lift/Stairs */}
                                    <div className="bg-zinc-800/60 rounded-2xl p-3.5 border border-zinc-700/60 space-y-1.5 col-span-1 md:col-span-2">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                                          🛗 Floor Level & Lift Access
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                          item.pro_report?.universal_foundation?.accessibility_and_parking?.has_lift === 'yes'
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : item.pro_report?.universal_foundation?.accessibility_and_parking?.has_lift === 'no'
                                            ? 'bg-amber-500/20 text-amber-300'
                                            : 'bg-zinc-700 text-zinc-300'
                                        }`}>
                                          {item.pro_report?.universal_foundation?.accessibility_and_parking?.has_lift === 'yes' ? 'Lift Available' : item.pro_report?.universal_foundation?.accessibility_and_parking?.has_lift === 'no' ? 'Walk-up Only (No Lift)' : 'Lift Unconfirmed'}
                                        </span>
                                      </div>
                                      <div className="text-xs text-zinc-300">
                                        <span className="font-semibold text-white">{item.pro_report?.universal_foundation?.accessibility_and_parking?.floor}</span>: {item.pro_report?.universal_foundation?.accessibility_and_parking?.stair_climb_effort}
                                      </div>
                                      <div className="text-[11px] text-zinc-400">
                                        Parking: {item.pro_report?.universal_foundation?.accessibility_and_parking?.parking_summary}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Part 2: Personalized Lifestyle & Tastes Audit */}
                                <div className="space-y-3 pt-2 border-t border-zinc-800">
                                  <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkle size={14} weight="fill" className="text-amber-400" />
                                    <span>Part 2: Tailored Lifestyle & Personal Tastes Audit</span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* WFH & Music Workstation Fit */}
                                    <div className="bg-zinc-800/80 rounded-2xl p-4 border border-zinc-700 space-y-2">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-white flex items-center gap-1.5">
                                          🎧 Music & WFH Studio Feasibility
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
                                          {item.pro_report?.personalized_audit?.wfh_studio_feasibility?.status}
                                        </span>
                                      </div>
                                      <p className="text-xs text-zinc-300 leading-relaxed">
                                        {item.pro_report?.personalized_audit?.wfh_studio_feasibility?.desk_fit_analysis}
                                      </p>
                                      <p className="text-[11px] text-zinc-400 border-t border-zinc-700/60 pt-2">
                                        Acoustics: {item.pro_report?.personalized_audit?.wfh_studio_feasibility?.acoustic_reverberation_notes}
                                      </p>
                                    </div>

                                    {/* Gear Storage & Transport */}
                                    <div className="bg-zinc-800/80 rounded-2xl p-4 border border-zinc-700 space-y-2">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-white flex items-center gap-1.5">
                                          🚵 Sports Gear Storage & Transit (MTB/Surf)
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                          item.pro_report?.personalized_audit?.gear_storage_and_transit?.status === 'Demanding'
                                            ? 'bg-amber-500/20 text-amber-300'
                                            : 'bg-emerald-500/20 text-emerald-300'
                                        }`}>
                                          {item.pro_report?.personalized_audit?.gear_storage_and_transit?.status}
                                        </span>
                                      </div>
                                      <p className="text-xs text-zinc-300 leading-relaxed">
                                        {item.pro_report?.personalized_audit?.gear_storage_and_transit?.details}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Tailored Verdict */}
                                  <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-4 text-xs text-amber-200 leading-relaxed">
                                    <span className="font-bold text-amber-300 block mb-1">Advisor Tailored Verdict:</span>
                                    {item.pro_report?.personalized_audit?.tailored_advisor_verdict}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* UNLOCK PRO AI REPORT BANNER (IF NOT YET UNLOCKED) */}
                            {!item.pro_report && (
                              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-amber-50/70 via-zinc-50 to-amber-50/40 rounded-2xl border border-amber-200/60">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                                    <Sparkle size={17} weight="fill" />
                                  </div>
                                  <div>
                                    <div className="text-xs font-bold text-zinc-950 flex items-center gap-1.5">
                                      <span>AI Pro Forensic Report</span>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-200/90 text-amber-950 font-extrabold">1 Credit (R10)</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-500">Unlocks true room scale, building reviews, balcony view acoustics & 140cm WFH desk fit</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleUnlockProReport(item.listing_id)}
                                  disabled={isAuditingListingId === item.listing_id}
                                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
                                >
                                  {isAuditingListingId === item.listing_id ? (
                                    <>
                                      <CircleNotch size={14} className="animate-spin text-amber-400" />
                                      <span>Auditing Photos...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkle size={14} weight="fill" className="text-amber-400" />
                                      <span>Unlock AI Pro Report</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Footer: Verdict and Actions */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100">
                              <div className="text-xs text-zinc-600 italic">
                                <span className="font-bold text-zinc-900 not-italic">Takeaway: </span>
                                {item.verdict}
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-2xs"
                                >
                                  <span>View on Property24</span>
                                  <ArrowSquareOut size={13} weight="bold" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* TABLE VIEW MODE */
                    <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-2xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-200 bg-zinc-50/70 text-[11px] font-bold text-zinc-600 uppercase tracking-wider">
                              <th className="py-3.5 px-4">Property & Address</th>
                              <th className="py-3.5 px-4">Price</th>
                              <th className="py-3.5 px-4">Specs & Access</th>
                              <th className="py-3.5 px-5">Advisor Insight</th>
                              <th className="py-3.5 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 text-sm">
                            {selectedReport.ranked_listings?.map((item) => (
                              <tr key={item.id || item.listing_id} className="hover:bg-zinc-50/50 transition-colors group">
                                {/* Title, Address, Agency */}
                                <td className="py-4 px-4 align-top max-w-xs">
                                  <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-zinc-950 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                      #{item.rank}
                                    </div>

                                    {/* RealView Transformed Thumbnail */}
                                    {item.image && (
                                      <button
                                        onClick={() => setRealviewTarget({ url: item.image!, title: item.title })}
                                        title="Click to open RealView™ slider"
                                        className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-zinc-200 group/thumb hover:ring-2 hover:ring-zinc-900 transition-all cursor-pointer"
                                      >
                                        <img
                                          src={getRectifiedUrl(item.image)}
                                          alt={item.title}
                                          className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity">
                                          <Eye size={14} weight="bold" />
                                        </div>
                                      </button>
                                    )}

                                    <div>
                                      <div className="font-bold text-zinc-950 group-hover:text-zinc-800 transition-colors">
                                        {item.title}
                                      </div>
                                      <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                                        <MapPin size={13} className="text-zinc-400" />
                                        {item.address}
                                      </div>
                                      {item.building_name && (
                                        <div className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1 mt-0.5">
                                          <Buildings size={12} className="text-indigo-500" />
                                          <span>{item.building_name}</span>
                                        </div>
                                      )}
                                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        <div className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                          item.fit_score >= 80 ? 'bg-zinc-950 text-white' : item.fit_score >= 65 ? 'bg-zinc-200 text-zinc-800' : 'bg-rose-100 text-rose-800'
                                        }`}>
                                          Fit: {item.fit_score}%
                                        </div>
                                        {item.noise_risk === 'high' ? (
                                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                            <WarningCircle size={12} weight="bold" />
                                            Traffic Trap
                                          </div>
                                        ) : (
                                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <CheckCircle size={12} weight="bold" />
                                            Quiet Street
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Price */}
                                <td className="py-4 px-4 align-top whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    {item.price_value_pct !== null && item.price_value_pct !== undefined && (
                                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                        item.price_value_pct <= -4
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          : item.price_value_pct >= 4
                                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                                          : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                      }`}>
                                        {item.price_value_pct < 0
                                          ? `-${Math.abs(item.price_value_pct)}%`
                                          : item.price_value_pct > 0
                                          ? `+${item.price_value_pct}%`
                                          : 'Fair'}
                                      </span>
                                    )}
                                    <div>
                                      <div className="font-extrabold text-zinc-950 text-base">
                                        {item.price ? `R ${item.price.toLocaleString()}` : 'Contact'}
                                      </div>
                                      <div className="text-[11px] text-zinc-400">per month</div>
                                    </div>
                                  </div>
                                </td>

                                {/* Specs & Access */}
                                <td className="py-4 px-4 align-top whitespace-nowrap text-xs text-zinc-600 space-y-1">
                                  {item.bedrooms !== null && (
                                    <div className="flex items-center gap-1">
                                      <Bed size={14} className="text-zinc-400" />
                                      <span>{item.bedrooms} Bed{item.bedrooms > 1 ? 's' : ''}</span>
                                    </div>
                                  )}
                                  {item.bathrooms !== null && (
                                    <div className="flex items-center gap-1">
                                      <Bathtub size={14} className="text-zinc-400" />
                                      <span>{item.bathrooms} Bath</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <Car size={14} className="text-zinc-400" />
                                    <span>{item.parking ? `${item.parking} Bay` : 'Street'}</span>
                                  </div>
                                  {item.sqm && (
                                    <div className="flex items-center gap-1 font-semibold text-zinc-800">
                                      <Ruler size={14} className="text-zinc-500" />
                                      <span>{item.sqm} m²</span>
                                    </div>
                                  )}
                                  {item.floor_number && (
                                    <div className="text-[11px] text-zinc-700 font-medium pt-0.5">
                                      🏢 {item.floor_number}
                                    </div>
                                  )}
                                  {item.has_lift && (
                                    <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-max ${
                                      item.has_lift === 'yes' ? 'bg-emerald-50 text-emerald-700' : item.has_lift === 'no' ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-600'
                                    }`}>
                                      {item.has_lift === 'yes' ? 'Lift' : item.has_lift === 'no' ? 'Stairs' : 'Lift ?'}
                                    </div>
                                  )}
                                </td>

                                {/* Advisor Insight */}
                                <td className="py-4 px-5 align-top">
                                  <p className="text-xs text-zinc-700 leading-relaxed mb-2 font-normal">
                                    {item.short_explanation}
                                  </p>
                                  {item.pro_report && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                                      <Sparkle size={12} weight="fill" /> Pro Dossier Unlocked
                                    </span>
                                  )}
                                </td>

                                {/* Action */}
                                <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-2xs"
                                  >
                                    <span>View</span>
                                    <ArrowSquareOut size={13} weight="bold" />
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* BEFORE / AFTER REALVIEW MODAL */}
      {realviewTarget && (
        <RealViewSlider
          rawImageUrl={realviewTarget.url}
          title={realviewTarget.title}
          isOpen={true}
          onClose={() => setRealviewTarget(null)}
        />
      )}

      {/* PRO CREDITS TOP-UP MODAL */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-zinc-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowCreditModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
            >
              <X size={20} weight="bold" />
            </button>

            <div className="space-y-2 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                <Sparkle size={24} weight="fill" />
              </div>
              <h3 className="text-2xl font-extrabold text-zinc-950">HomeSeek Pro AI Credits</h3>
              <p className="text-xs text-zinc-600 max-w-sm mx-auto leading-relaxed">
                Unlock deep multimodal vision inspections, true room dimensions, balcony noise checks, and building reviews for R10 per report.
              </p>
              <div className="inline-block mt-1 px-3 py-1 rounded-full bg-zinc-100 text-xs font-bold text-zinc-800">
                Current Balance: <span className="text-amber-600">{proCredits} Pro Credits</span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Pack 1: Starter Pack (5 for R50) */}
              <div className="p-4 rounded-2xl border-2 border-amber-400/80 bg-amber-50/40 hover:bg-amber-50 transition-all flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-zinc-950 text-sm">5 Pro AI Reports</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase">
                      Popular Starter
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">R10 per full property forensic dossier</p>
                </div>
                <button
                  type="button"
                  disabled={topupLoading}
                  onClick={() => handleTopupCredits('starter_5', 5)}
                  className="px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-95"
                >
                  {topupLoading ? 'Processing...' : 'Buy for R 50'}
                </button>
              </div>

              {/* Pack 2: Hunter Pack (12 for R100) */}
              <div className="p-4 rounded-2xl border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 transition-all flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-zinc-950 text-sm">12 Pro AI Reports</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Save 17%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">R8.33 per report for active home hunters</p>
                </div>
                <button
                  type="button"
                  disabled={topupLoading}
                  onClick={() => handleTopupCredits('hunter_12', 12)}
                  className="px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-xs transition-all cursor-pointer whitespace-nowrap active:scale-95 border border-zinc-200"
                >
                  {topupLoading ? 'Processing...' : 'Buy for R 100'}
                </button>
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 text-center leading-relaxed">
              Credits never expire. Once unlocked, a property's Pro AI report remains in your archive permanently with zero recurring charges.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"""

with open("c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx", "w", encoding="utf-8") as f:
    f.write(reports_page_content)

print("web/src/app/reports/page.tsx written successfully!")

