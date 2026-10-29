'use client';

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
  ShieldCheck
} from '@phosphor-icons/react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/lib/auth-context';
import { fetchWithAuth } from '@/lib/api';
import { RealViewSlider } from '@/components/RealViewSlider';
import { ListingImageGallery } from '@/components/ListingImageGallery';

interface RankedItem {
  id: string;
  listing_id: string;
  title: string;
  price: number | null;
  address: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqm: number | null;
  parking: number | null;
  is_furnished: boolean | null;
  image: string | null;
  url: string;
  area: string;
  rank: number;
  fit_score: number;
  short_explanation: string;
  pros: string[];
  cons: string[];
  verdict: string;
  noise_risk?: string;
  noise_reason?: string;
  vision_audit_available?: boolean;
}

interface IntelligenceReport {
  id: string;
  alert_id?: string;
  alert_title: string;
  created_at: string;
  areas_scouted: string[];
  total_found: number;
  overall_summary: string;
  user_prompt: string;
  personal_tastes: string;
  max_price?: number;
  ranked_listings: RankedItem[];
}

export default function ReportsPage() {
  const { user, profile, loading, login, logout } = useAuth();
  const [reports, setReports] = useState<IntelligenceReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<IntelligenceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [realviewTarget, setRealviewTarget] = useState<{ url: string; title: string } | null>(null);

  const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const getRectifiedUrl = (rawUrl: string) => `${backendBase}/api/realview/rectify?url=${encodeURIComponent(rawUrl)}`;

  const loadReports = async () => {
    const uid = profile?.id || user?.uid || 'taun_test_user';
    try {
      setIsLoading(true);
      const res = await fetchWithAuth(`/reports/${uid}`);
      if (res && res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.reports)) {
          setReports(data.reports);
          if (data.reports.length > 0 && !selectedReport) {
            setSelectedReport(data.reports[0]);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load reports:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [user, profile]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadReports();
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

            <div className="flex items-center gap-3 shrink-0">
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
                      type="button"
                      onClick={() => setSelectedReport(rep)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 shadow-2xs ${isSelected
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                          : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60 text-zinc-900'
                        }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-bold flex items-center gap-1 ${isSelected ? 'text-emerald-400' : 'text-zinc-900'}`}>
                          <MapPin size={13} weight="bold" />
                          {rep.areas_scouted.join(', ')}
                        </span>
                        <span className={`text-[11px] ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          {formatDate(rep.created_at)}
                        </span>
                      </div>
                      <div className="text-sm font-semibold truncate">
                        {rep.alert_title}
                      </div>
                      <div className={`text-xs ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {rep.ranked_listings?.length || 0} listings ranked (Top 10)
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Selected Report Briefing & Top 10 Table (8 Cols) */}
            <div className="lg:col-span-8 space-y-8">
              {selectedReport && (
                <>
                  {/* Executive Briefing Card */}
                  <section className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xs relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-xs font-semibold mb-2">
                          <Sparkle size={13} weight="fill" className="text-zinc-900" />
                          <span>AI Executive Briefing</span>
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
                          {selectedReport.alert_title}
                        </h2>
                        <p className="text-xs text-zinc-500 mt-1">
                          Generated on {formatDate(selectedReport.created_at)} • Scouted {selectedReport.total_found} properties across {selectedReport.areas_scouted.join(', ')}
                        </p>
                      </div>

                      <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-800 px-3 py-1.5 rounded-full self-start shrink-0">
                        Top 10 Digest
                      </span>
                    </div>

                    {/* AI Advisor Summary */}
                    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 sm:p-5 text-sm text-zinc-800 leading-relaxed">
                      <span className="font-bold text-zinc-950 block mb-1">Advisor Evaluation:</span>
                      {selectedReport.overall_summary}
                    </div>

                    {/* Criteria Pill Tags */}
                    <div className="flex flex-wrap gap-2 text-xs text-zinc-600 pt-2 border-t border-zinc-100">
                      <span className="bg-zinc-100 px-3 py-1 rounded-xl font-medium text-zinc-800">
                        Max Budget: R {selectedReport.max_price?.toLocaleString() || '18,000'} pm
                      </span>
                      {selectedReport.personal_tastes && (
                        <span className="bg-zinc-100 px-3 py-1 rounded-xl font-medium text-zinc-700 truncate max-w-md">
                          Tastes: {selectedReport.personal_tastes}
                        </span>
                      )}
                    </div>
                  </section>

                  {/* Top 10 Ranked Matches Section */}
                  <section className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-2xs">
                      <div className="p-6 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-zinc-950 text-lg">
                              Top 10 Ranked Matches
                            </h3>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <ShieldCheck size={13} weight="bold" /> RealView™ Protected
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Photos are mathematically de-distorted to 1.0x human eye perspective.
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* View Switcher: Gallery vs Table */}
                          <div className="flex items-center p-1 rounded-2xl bg-zinc-100 border border-zinc-200/80">
                            <button
                              onClick={() => setViewMode('cards')}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${viewMode === 'cards'
                                  ? 'bg-white text-zinc-950 shadow-2xs font-bold'
                                  : 'text-zinc-600 hover:text-zinc-950'
                                }`}
                            >
                              <SquaresFour size={14} weight="bold" />
                              <span>Photo Gallery</span>
                            </button>
                            <button
                              onClick={() => setViewMode('table')}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${viewMode === 'table'
                                  ? 'bg-white text-zinc-950 shadow-2xs font-bold'
                                  : 'text-zinc-600 hover:text-zinc-950'
                                }`}
                            >
                              <ListDashes size={14} weight="bold" />
                              <span>Table View</span>
                            </button>
                          </div>

                          <span className="text-xs font-semibold text-zinc-700 bg-zinc-100 px-3 py-1.5 rounded-full hidden sm:inline-block">
                            11:00 AM Cron
                          </span>
                        </div>
                      </div>

                                      {/* VIEW MODE 1: Gallery Cards (Sliders + Transformed Thumbnails) */}
                                      {viewMode === 'cards' && (
                                        <div className="p-6 space-y-8 bg-zinc-50/50">
                                          {selectedReport.ranked_listings.map((item) => (
                                            <div
                                              key={item.id}
                                              className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-6 shadow-2xs hover:shadow-xs transition-shadow space-y-5"
                                            >
                                              {/* Card Top: RealView Transformed Gallery Slider */}
                                              <ListingImageGallery
                                                initialImage={item.image}
                                                listingUrl={item.url}
                                                title={item.title}
                                                onOpenRealViewSlider={(url) => setRealviewTarget({ url, title: item.title })}
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
                                                      </div>

                                                      <div className="text-left sm:text-right pl-8 sm:pl-0 shrink-0">
                                                        <div className="font-extrabold text-zinc-950 text-lg">
                                                          {item.price ? `R ${item.price.toLocaleString()}` : 'Contact'}
                                                        </div>
                                                        <div className="text-[11px] text-zinc-400">per month</div>
                                                      </div>
                                                    </div>

                                                    {/* Badges & Specs Bar */}
                                                    <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 px-3.5 bg-zinc-50 rounded-2xl border border-zinc-100">
                                                      <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${item.fit_score >= 80 ? 'bg-zinc-950 text-white' : item.fit_score >= 65 ? 'bg-zinc-200 text-zinc-800' : 'bg-rose-100 text-rose-800'
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
                                    <div className="flex items-center gap-1">
                                      <Ruler size={15} className="text-zinc-400" />
                                      <span>{item.sqm} m²</span>
                                    </div>
                                  )}
                                </div>
                                                    </div>

                                                        {/* Advisor Explanation */}
                                                        <p className="text-xs text-zinc-700 leading-relaxed font-normal">
                                                          {item.short_explanation}
                                                        </p>

                                                        {/* Cons / Warnings */}
                                                        {item.cons && item.cons.length > 0 && (
                                <div className="space-y-1">
                                  {item.cons.map((con, cIdx) => (
                                    <div 
                                      key={cIdx} 
                                      className={`text-xs font-medium leading-tight ${
                                        con.includes('🚨') || con.toLowerCase().includes('noise') 
                                          ? 'text-rose-700 font-semibold flex items-start gap-1.5 bg-rose-50/70 p-2 rounded-xl border border-rose-200/60' 
                                          : 'text-zinc-600'
                                      }`}
                                    >
                                      <span>•</span>
                                      <span>{con}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                                                          {/* Card Footer: Takeaway & External View */}
                                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100">
                                                            {item.verdict && (
                                                              <div className="text-xs font-semibold text-zinc-950 italic">
                                                                Takeaway: {item.verdict}
                                                              </div>
                                                            )}
                                                          <a
                                                            href={item.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs transition-all shadow-2xs self-end"
                                                          >
                                                            <span>View on Property24</span>
                                                            <ArrowSquareOut size={13} weight="bold" />
                                                          </a>
                                                        </div>
                            </div>
                                                </div>
                        ))}
                                              </div>
                    )}

                                                        {/* VIEW MODE 2: Compact Table (With Transformed Thumbnails) */}
                                                        {viewMode === 'table' && (
                                                          <div className="overflow-x-auto">
                                                            <table className="w-full text-left text-sm">
                                                              <thead className="bg-zinc-50/80 text-zinc-600 text-xs uppercase tracking-wider border-b border-zinc-200">
                                                                <tr>
                                                                  <th className="py-3.5 px-5 font-semibold">Rank & Property</th>
                                                                  <th className="py-3.5 px-4 font-semibold">Price</th>
                                                                  <th className="py-3.5 px-4 font-semibold">Specs</th>
                                                                  <th className="py-3.5 px-5 font-semibold">Advisor Insight</th>
                                                                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                                                                </tr>
                                                              </thead>
                                                              <tbody className="divide-y divide-zinc-200/70">
                                                                {selectedReport.ranked_listings.map((item) => (
                                                                  <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors group">
                                                                    {/* Rank, Thumbnail & Title */}
                                                                    <td className="py-4 px-5 align-top">
                                                                      <div className="flex items-start gap-3">
                                                                        <div className="w-7 h-7 rounded-xl bg-zinc-950 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                                                          #{item.rank}
                                                                        </div>

                                                                        {/* RealView Transformed Thumbnail */}
                                                                        {item.image && (
                                                                          <button
                                                                            onClick={() => setRealviewTarget({ url: item.image!, title: item.title })}
                                                                            title="Click to open RealView™ slider"
                                                                            className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-zinc-200 group/thumb hover:ring-2 hover:ring-zinc-900 transition-all"
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
                                                                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                                            <div className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${item.fit_score >= 80 ? 'bg-zinc-950 text-white' : item.fit_score >= 65 ? 'bg-zinc-200 text-zinc-800' : 'bg-rose-100 text-rose-800'
                                                                              }`}>
                                                                              Fit Score: {item.fit_score}%
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
                                                                        <div className="font-extrabold text-zinc-950 text-base">
                                                                          {item.price ? `R ${item.price.toLocaleString()}` : 'Contact'}
                                                                        </div>
                                                                      <div className="text-[11px] text-zinc-400">per month</div>
                                                                    </td>

                                {/* Specs */}
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
                                </td>

                                {/* Advisor Insight */}
                                                                        <td className="py-4 px-5 align-top">
                                                                          <p className="text-xs text-zinc-700 leading-relaxed mb-2 font-normal">
                                                                            {item.short_explanation}
                                                                          </p>
                                                                          {item.cons && item.cons.length > 0 && (
                                                                            <div className="space-y-1 mb-2">
                                                                              {item.cons.map((con, cIdx) => (
                                                                                <div
                                                                                  key={cIdx}
                                                                                  className={`text-[11px] font-medium leading-tight ${con.includes('🚨') || con.toLowerCase().includes('noise')
                                                                                      ? 'text-rose-700 font-semibold flex items-start gap-1 bg-rose-50/70 p-1.5 rounded-lg border border-rose-200/60'
                                                                                      : 'text-zinc-600'
                                                                                    }`}
                                                                                >
                                                                                  <span>•</span>
                                                                                  <span>{con}</span>
                                                                                </div>
                                                                              ))}
                                                                            </div>
                                                                          )}
                                                                          {item.verdict && (
                                                                            <div className="text-[11px] font-semibold text-zinc-950 italic">
                                                                              Takeaway: {item.verdict}
                                                                            </div>
                                                                          )}
                                                                        </td>

                                                                        {/* Action Link & RealView */}
                                                                        <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                                                                          <div className="flex items-center justify-end gap-2">
                                                                            {item.image && (
                                                                              <button
                                                                                onClick={() => setRealviewTarget({ url: item.image!, title: item.title })}
                                                                                title="Open RealView™ Lens Rectification"
                                                                                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold text-xs transition-colors"
                                                                              >
                                                                                <Eye size={13} weight="bold" />
                                                                                <span>RealView™</span>
                                                                              </button>
                                                                            )}
                                                                            <a
                                                                              href={item.url}
                                                                              target="_blank"
                                                                              rel="noopener noreferrer"
                                                                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs transition-all shadow-2xs"
                                                                            >
                                                              <span>View</span>
                                                              <ArrowSquareOut size={13} weight="bold" />
                                                            </a>
                                                          </div>
                                </td>
                              </tr>
                            ))}
                                            </tbody>
                        </table>
                      </div>
                    )}
                                  </section>
                                </>
              )}
                              </div>
          </div>
        )}

                          {/* RealView™ Modal */}
                          {realviewTarget && (
                            <RealViewSlider
                              originalImageUrl={realviewTarget.url}
                              listingTitle={realviewTarget.title}
                              onClose={() => setRealviewTarget(null)}
                            />
                          )}
                        </main>
                      </div>
                      );
}
