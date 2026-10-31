'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  WarningCircle,
  SpeakerHigh,
  ShieldCheck,
  Sparkle,
  Bed,
  Bathtub,
  Ruler,
  Car,
  Buildings,
  Target,
  Compass,
  Star,
  Quotes,
  MapPin,
  Clock,
  CircleNotch,
  CalendarBlank,
  Heart,
  ShareNetwork,
  Check,
  CaretLeft,
  CaretRight
} from '@phosphor-icons/react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/lib/auth-context';
import { fetchWithAuth } from '@/lib/api';
import { PropertyMap, PropertyMapItem, ProximityAnchor } from '@/components/PropertyMap';

function ListingDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile, loading, login, logout } = useAuth();

  const reportId = searchParams.get('reportId');
  const listingId = searchParams.get('id');

  const [report, setReport] = useState<any | null>(null);
  const [listing, setListing] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const uid = profile?.id || user?.uid || 'taun_test_user';
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await fetchWithAuth(`/reports/${uid}`);
        if (res && res.ok) {
          const data = await res.json();
          if (data.status === 'success' && Array.isArray(data.reports)) {
            let foundReport = null;
            if (reportId) {
              foundReport = data.reports.find((r: any) => r.id === reportId);
            }
            if (!foundReport && data.reports.length > 0) {
              foundReport = data.reports.find((r: any) => 
                r.ranked_listings?.some((l: any) => (l.listing_id === listingId || l.id === listingId))
              ) || data.reports[0];
            }
            setReport(foundReport);

            if (foundReport && foundReport.ranked_listings) {
              const foundListing = foundReport.ranked_listings.find(
                (l: any) => l.listing_id === listingId || l.id === listingId
              ) || foundReport.ranked_listings[0];
              setListing(foundListing);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load listing detail:", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [reportId, listingId, user, profile]);

  const mapProperties: PropertyMapItem[] = useMemo(() => {
    if (!listing) return [];
    return [{
      id: listing.listing_id || listing.id,
      title: listing.title,
      address: listing.address,
      price: listing.price || 0,
      bedrooms: listing.bedrooms || 1,
      bathrooms: listing.bathrooms || 1,
      sqm: listing.sqm || undefined,
      image: listing.image || (listing.images && listing.images[0]) || '',
      lat: -33.9328,
      lng: 18.4103,
      rank: listing.rank || 1,
      fit_score: listing.fit_score,
      noise_risk: listing.noise_risk,
      noise_reason: listing.noise_reason,
      location_proximity: listing.location_proximity,
      acoustic_audit: listing.acoustic_audit
    }];
  }, [listing]);

  const mapAnchors: ProximityAnchor[] = useMemo(() => {
    const rawAnchors = report?.location_anchors || report?.commute_anchors || [];
    if (!rawAnchors || rawAnchors.length === 0) {
      return [{
        id: 'anchor-default',
        label: 'Kloof Street Cafes',
        target_place: 'Kloof Street, Gardens',
        lat: -33.9315,
        lng: 18.4105,
        commute_mode: 'driving'
      }];
    }
    return rawAnchors.map((a: any, idx: number) => ({
      id: a.id || `anchor-${idx}`,
      label: a.label || a.name || 'Anchor',
      target_place: a.target_place || 'Cape Town',
      lat: a.lat || -33.9315,
      lng: a.lng || 18.4105,
      commute_mode: a.commute_mode || 'driving'
    }));
  }, [report]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col">
        <Navbar user={user} profile={profile} loading={loading} handleLogin={login} handleLogout={logout} />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <CircleNotch size={32} className="animate-spin text-zinc-950 mb-3" />
          <p className="text-sm font-bold text-zinc-600">Loading complete property dossier...</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col">
        <Navbar user={user} profile={profile} loading={loading} handleLogin={login} handleLogout={logout} />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
          <WarningCircle size={40} className="text-zinc-400 mb-3" />
          <h2 className="text-lg font-black text-zinc-950">Listing Dossier Not Found</h2>
          <p className="text-xs text-zinc-500 mt-1 mb-6">
            The requested property record could not be loaded from this scout report.
          </p>
          <Link
            href="/reports"
            className="px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 transition-colors"
          >
            Return to Scout Reports
          </Link>
        </div>
      </div>
    );
  }

  const allImages = (listing.images && listing.images.length > 0)
    ? listing.images
    : [listing.image || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&auto=format&fit=crop&q=80'];

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar user={user} profile={profile} loading={loading} handleLogin={login} handleLogout={logout} />

      {/* Top Breadcrumb & Action Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/reports"
              className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <ArrowLeft size={16} weight="bold" />
              <span className="hidden sm:inline">Back to Map</span>
            </Link>
            <div className="h-4 w-px bg-zinc-200 hidden sm:block" />
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold text-zinc-950 truncate">
                {listing.title}
              </h1>
              <p className="text-[11px] text-zinc-500 truncate">{listing.address}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleShare}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Share listing dossier"
            >
              {copiedLink ? <Check size={14} className="text-emerald-600" /> : <ShareNetwork size={14} />}
              <span className="hidden sm:inline">{copiedLink ? 'Copied' : 'Share'}</span>
            </button>

            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <span>View on Property24</span>
              <ArrowSquareOut size={13} weight="bold" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Dossier Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        
        {/* 1. Airbnb-Grade Photo Hero Gallery */}
        <section className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 h-[360px] sm:h-[460px] rounded-3xl overflow-hidden bg-zinc-100 border border-zinc-200">
            {/* Primary Large Hero */}
            <div className="md:col-span-2 h-full relative group cursor-pointer overflow-hidden">
              <img
                src={allImages[selectedPhotoIndex] || allImages[0]}
                alt={listing.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
              />
              <div className="absolute top-4 left-4 flex items-center gap-2 z-10 pointer-events-none">
                <span className="px-3 py-1 rounded-full bg-zinc-950/90 text-white text-xs font-black backdrop-blur-md shadow-md">
                  #{listing.rank || 1} Ranked Choice
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black backdrop-blur-md shadow-md">
                  {listing.fit_score}% Fit Score
                </span>
              </div>

              {/* Photo Counter */}
              <div className="absolute top-4 right-4 z-10 px-2.5 py-1 rounded-xl bg-zinc-950/80 backdrop-blur-md text-white text-xs font-bold shadow-md">
                {selectedPhotoIndex + 1} / {allImages.length}
              </div>

              {/* Left & Right Slide Navigation Arrows */}
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
                    }}
                    aria-label="Previous photo"
                    title="Previous photo"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 hover:bg-white text-zinc-900 shadow-md border border-zinc-200/60 flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95 cursor-pointer z-20 opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <CaretLeft size={18} weight="bold" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhotoIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
                    }}
                    aria-label="Next photo"
                    title="Next photo"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 hover:bg-white text-zinc-900 shadow-md border border-zinc-200/60 flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95 cursor-pointer z-20 opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <CaretRight size={18} weight="bold" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Grid */}
            <div className="hidden md:grid md:col-span-2 grid-cols-2 gap-3 h-full">
              {allImages.slice(1, 5).map((imgUrl: string, idx: number) => (
                <div
                  key={idx}
                  onClick={() => setSelectedPhotoIndex(idx + 1)}
                  className="relative h-full overflow-hidden cursor-pointer group bg-zinc-200"
                >
                  <img
                    src={imgUrl}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {idx === 3 && allImages.length > 5 && (
                    <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center text-white text-sm font-black">
                      +{allImages.length - 4} photos
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. Core Listing Header & Specs Bar */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-zinc-100">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  {listing.area || 'Tamboerskloof'} · Verified Rental
                </span>
                {listing.agency_name && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                    {listing.agency_name}
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                {listing.title}
              </h2>
              <p className="text-sm font-medium text-zinc-500 flex items-center gap-1.5 mt-1">
                <MapPin size={16} className="text-zinc-400" />
                {listing.address}
              </p>
            </div>

            <div className="sm:text-right shrink-0">
              <div className="text-3xl font-black text-zinc-950 tracking-tight">
                R {listing.price ? listing.price.toLocaleString() : 'Contact'}
                <span className="text-sm font-normal text-zinc-500"> / month</span>
              </div>
              {listing.price_value_pct !== undefined && listing.price_value_pct !== null && (
                <div className="mt-1">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                    listing.price_value_pct < -5
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : listing.price_value_pct > 10
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                  }`}>
                    {listing.price_value_pct < 0
                      ? `${Math.abs(listing.price_value_pct)}% below fair value`
                      : listing.price_value_pct > 0
                      ? `${listing.price_value_pct}% above fair value`
                      : 'Fair Market Value'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Bedrooms</span>
              <p className="text-sm font-extrabold text-zinc-950 mt-0.5 flex items-center gap-1.5">
                <Bed size={16} weight="bold" className="text-zinc-600" />
                {listing.bedrooms || 1} Bed{listing.bedrooms > 1 ? 's' : ''}
              </p>
            </div>

            <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Bathrooms</span>
              <p className="text-sm font-extrabold text-zinc-950 mt-0.5 flex items-center gap-1.5">
                <Bathtub size={16} weight="bold" className="text-zinc-600" />
                {listing.bathrooms || 1} Bath
              </p>
            </div>

            <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Floor Area</span>
              <p className="text-sm font-extrabold text-zinc-950 mt-0.5 flex items-center gap-1.5">
                <Ruler size={16} weight="bold" className="text-zinc-600" />
                {listing.sqm ? `${listing.sqm} m²` : 'Standard'}
              </p>
            </div>

            <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Floor Level</span>
              <p className="text-sm font-extrabold text-zinc-950 mt-0.5 flex items-center gap-1.5">
                <Buildings size={16} weight="bold" className="text-zinc-600" />
                {listing.floor_number || 'Ground'}
              </p>
            </div>

            <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Lift Access</span>
              <p className="text-sm font-extrabold text-zinc-950 mt-0.5">
                {listing.has_lift === 'yes' ? '🛗 Lift Equipped' : listing.has_lift === 'no' ? '⚠️ Stairs Only' : 'Ground Entry'}
              </p>
            </div>

            <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Parking</span>
              <p className="text-sm font-extrabold text-zinc-950 mt-0.5 flex items-center gap-1.5">
                <Car size={16} weight="bold" className="text-zinc-600" />
                {listing.parking && listing.parking > 0 ? `${listing.parking} Dedicated` : 'Street'}
              </p>
            </div>
          </div>
        </section>

        {/* 3. Acoustic Decibel & Sound Shadow Audit */}
        {listing.acoustic_audit && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                  listing.acoustic_audit.is_shielded
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20 shadow-md'
                    : 'bg-rose-600 text-white shadow-rose-600/20 shadow-md'
                }`}>
                  {listing.acoustic_audit.is_shielded ? (
                    <ShieldCheck size={22} weight="bold" />
                  ) : (
                    <SpeakerHigh size={22} weight="bold" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black text-zinc-950 tracking-tight">
                    Acoustic Decibel &amp; Sound Shadow Audit
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Physical line-of-sight sound propagation &amp; building diffraction analysis
                  </p>
                </div>
              </div>

              <div className={`px-4 py-2 rounded-2xl font-black text-sm flex items-center gap-2 border self-start sm:self-auto ${
                listing.acoustic_audit.estimated_db <= 44
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                  : listing.acoustic_audit.estimated_db <= 60
                  ? 'bg-amber-50 text-amber-950 border-amber-200'
                  : 'bg-rose-50 text-rose-950 border-rose-200'
              }`}>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Estimated Arrival:</span>
                <span className="text-lg">{listing.acoustic_audit.estimated_db}</span>
                <span className="text-xs text-zinc-500">dBA</span>
              </div>
            </div>

            {/* Spectrum Bar */}
            <div className="space-y-2 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-zinc-500">Sound Exposure Rating</span>
                <span className={listing.acoustic_audit.is_shielded ? 'text-emerald-700' : 'text-rose-700'}>
                  {listing.acoustic_audit.exposure_label} · {listing.acoustic_audit.sound_shadow_status}
                </span>
              </div>
              <div className="relative h-3 w-full bg-zinc-200 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500 w-[30%]" title="Sanctuary (<45 dB)" />
                <div className="h-full bg-amber-400 w-[30%]" title="Moderate Ambient (45-65 dB)" />
                <div className="h-full bg-rose-600 w-[40%]" title="High Risk Corridor (>65 dB)" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                <span>30 dB (Forest / Lion&apos;s Head)</span>
                <span>55 dB (Normal Conversation)</span>
                <span>85 dB (Aruba Bar / DJ Bass)</span>
              </div>
            </div>

            {/* Key Acoustic Observations */}
            {listing.acoustic_audit.acoustic_quirks && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                  Acoustic Behavior &amp; Environment
                </span>
                <ul className="space-y-2 text-xs">
                  {listing.acoustic_audit.acoustic_quirks.map((q: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-zinc-800">
                      <span className={`font-bold mt-0.5 ${listing.acoustic_audit.is_shielded ? 'text-emerald-500' : 'text-rose-500'}`}>•</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Verdict */}
            {listing.acoustic_audit.verdict && (
              <div className={`p-4 rounded-2xl flex items-start gap-3 ${
                listing.acoustic_audit.is_shielded
                  ? 'bg-emerald-950 text-emerald-100 border border-emerald-900/50'
                  : 'bg-zinc-950 text-zinc-100 border border-zinc-900'
              }`}>
                <Sparkle size={18} weight="fill" className={`shrink-0 mt-0.5 ${listing.acoustic_audit.is_shielded ? 'text-emerald-400' : 'text-amber-400'}`} />
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Acoustic Verdict
                  </span>
                  <p className="text-xs leading-relaxed font-medium">
                    {listing.acoustic_audit.verdict}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 4. Community Intelligence & Building Reputation */}
        {listing.community_sentiment && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-zinc-950 tracking-tight pb-4 border-b border-zinc-100">
              Community Sentiment &amp; Building Reputation
            </h3>

            {listing.community_sentiment.building_reputation && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Party Risk</span>
                    <p className="font-extrabold text-zinc-950">{listing.community_sentiment.building_reputation.party_risk}</p>
                    <p className="text-[11px] text-zinc-600">{listing.community_sentiment.building_reputation.party_details}</p>
                  </div>

                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Sound Insulation</span>
                    <p className="font-extrabold text-zinc-950">{listing.community_sentiment.building_reputation.sound_insulation}</p>
                  </div>

                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Management Status</span>
                    <p className="font-extrabold text-zinc-950">{listing.community_sentiment.building_reputation.maintenance_status}</p>
                  </div>
                </div>

                {/* Google Reviews */}
                {listing.community_sentiment.building_reputation.google_reviews?.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                      Google Reviews &amp; Resident Excerpts
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {listing.community_sentiment.building_reputation.google_reviews.map((rev: any, rIdx: number) => (
                        <div key={rIdx} className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-zinc-950">{rev.author}</span>
                            <div className="flex text-amber-500">
                              {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                                <Star key={i} size={12} weight="fill" />
                              ))}
                            </div>
                          </div>
                          <p className="text-zinc-700 italic leading-relaxed">&ldquo;{rev.text}&rdquo;</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* 5. AI Pros, Cons & Hidden Costs */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-sm space-y-6">
          <h3 className="text-lg font-black text-zinc-950 tracking-tight pb-4 border-b border-zinc-100">
            AI Scout Evaluation &amp; Trade-Offs
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pros */}
            <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-2xl p-5 space-y-3">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <CheckCircle size={16} weight="fill" className="text-emerald-600" />
                Verified Advantages
              </span>
              <ul className="space-y-2 text-xs text-emerald-950">
                {(listing.pros || []).map((pro: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cons */}
            <div className="bg-rose-50/50 border border-rose-200/70 rounded-2xl p-5 space-y-3">
              <span className="text-xs font-black uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
                <WarningCircle size={16} weight="fill" className="text-rose-600" />
                Potential Friction &amp; Traps
              </span>
              <ul className="space-y-2 text-xs text-rose-950">
                {(listing.cons || []).map((con: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-rose-500 font-bold">•</span>
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 6. Interactive Proximity & Commute Map */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-sm space-y-4">
          <h3 className="text-lg font-black text-zinc-950 tracking-tight">
            Location &amp; Commute Proximity
          </h3>
          <div className="h-96 w-full rounded-2xl overflow-hidden border border-zinc-200 shadow-md">
            <PropertyMap
              properties={mapProperties}
              anchors={mapAnchors}
              selectedPropertyId={listing.listing_id || listing.id}
              onSelectProperty={() => {}}
            />
          </div>
        </section>

      </main>
    </div>
  );
}

export default function ListingDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
        <CircleNotch size={32} className="animate-spin text-zinc-950" />
      </div>
    }>
      <ListingDetailContent />
    </Suspense>
  );
}

