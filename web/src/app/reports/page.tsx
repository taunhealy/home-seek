'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PropertyMap, PropertyMapItem, ProximityAnchor, AcousticAudit } from '@/components/PropertyMap';
import Link from 'next/link';
import {
  FileText,
  Sparkle,
  Lightning,
  NavigationArrow,
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
  Compass,
  CaretDown,
  MapTrifold,
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
  X,
  ChatCenteredDots,
  Quotes,
  SpeakerHigh
} from '@phosphor-icons/react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/lib/auth-context';
import { fetchWithAuth } from '@/lib/api';
import { RealViewSlider } from '@/components/RealViewSlider';
import { ListingImageGallery } from '@/components/ListingImageGallery';
import { ThumbnailGallery } from '@/components/ThumbnailGallery';

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


interface LocationProximityItem {
  label: string;
  target_place: string;
  distance_km: number;
  distance_text: string;
  duration_mins: number;
  duration_text: string;
  commute_mode: 'driving' | 'walking' | 'bicycling' | 'transit' | string;
  is_within_threshold?: boolean;
  maps_route_url?: string;
}

interface AreaQuote {
  source: string;
  author: string;
  topic: string;
  sentiment: 'pro' | 'con' | 'neutral';
  quote: string;
}

interface AreaIntelligence {
  area_name: string;
  vibe_tag: string;
  walkability_score: number;
  safety_rating: string;
  summary: string;
  pros: string[];
  cons: string[];
  quotes: AreaQuote[];
}

interface GoogleReview {
  author: string;
  rating: number;
  text: string;
  relative_time?: string;
}

interface BuildingReputation {
  building_name?: string;
  address?: string;
  google_rating?: number;
  google_review_count?: number;
  party_risk: string;
  party_details: string;
  sound_insulation: string;
  maintenance_status: string;
  positives: string[];
  concerns: string[];
  google_reviews: GoogleReview[];
  verdict: string;
}

interface CommunitySentiment {
  area_intelligence?: AreaIntelligence;
  building_reputation?: BuildingReputation;
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
  is_direct_landlord?: boolean;
  pro_report?: ProReport | null;
  community_sentiment?: CommunitySentiment | null;
  acoustic_audit?: AcousticAudit | null;
  is_available?: boolean;
  availability_status?: string;
  last_verified_at?: number;
  location_proximity?: LocationProximityItem[];
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
  min_bedrooms?: number;
  ranked_listings: RankedItem[];
  last_availability_check?: number;
  location_anchors?: any[];
  commute_anchors?: any[];
}


// Precise coordinates for known scout listings
const KNOWN_LISTING_COORDS: Record<string, [number, number]> = {
  // 4 Derwent Road, Tamboerskloof (Listing 117763397) - Exactly on Derwent Rd between Weltevreden & Kloof
  "117763397": [-33.9328, 18.4103],
  // 301 Monreith, 22 Hall Road, Sea Point (Listing 117762862)
  "117762862": [-33.9165, 18.3920],
  // Gardens 1-bed (Listing 117408746)
  "117408746": [-33.9315, 18.4115],
  // Green Point 1-bed (Listing 117768485)
  "117768485": [-33.9085, 18.4090],
  // Green Point High Level (Listing 117661239)
  "117661239": [-33.9105, 18.4065],
  // Sea Point (Listing 117203667)
  "117203667": [-33.9195, 18.3880],
  // Sea Point (Listing 115749863)
  "115749863": [-33.9215, 18.3855],
  // Green Point (Listing 107456792)
  "107456792": [-33.9130, 18.4010],
  // Green Point (Listing 116267326)
  "116267326": [-33.9095, 18.4075],
  // Sea Point (Listing 117771952)
  "117771952": [-33.9230, 18.3880]
};

// Verified Cape Town Street Anchors (OpenStreetMap geocoded)
const SPECIFIC_STREET_ANCHORS: Record<string, [number, number]> = {
  "derwent": [-33.9338, 18.4055], // Derwent Road, Tamboerskloof (near Kloof St & Weltevreden)
  "hall road": [-33.9165, 18.3920], // Hall Rd, Sea Point
  "union street": [-33.9325, 18.4120],
  "mill street": [-33.9305, 18.4140],
  "kloof street": [-33.9315, 18.4105],
  "kloof nek": [-33.9350, 18.4020],
  "somerset": [-33.9090, 18.4110],
  "high level": [-33.9110, 18.4050],
  "ocean view": [-33.9130, 18.4010],
  "main road": [-33.9085, 18.4090],
  "carstens": [-33.9295, 18.4035],
  "belle ombre": [-33.9315, 18.4015],
  "leeuwenvoet": [-33.9275, 18.4020],
  "hof street": [-33.9355, 18.4100],
  "breda": [-33.9345, 18.4135],
  "weltevreden": [-33.9330, 18.4070],
  "camp street": [-33.9320, 18.4080],
  "upper orange": [-33.9370, 18.4150],
  "hastings": [-33.9310, 18.4045],
  "milner": [-33.9285, 18.4040],
  "cavalcade": [-33.9095, 18.4075],
  "regent": [-33.9210, 18.3850],
  "kloof road": [-33.9230, 18.3880],
  "myrtle": [-33.9340, 18.4110],
  "wandel": [-33.9320, 18.4150]
};

// Real residential street coordinates per suburb - prevents flinging pins into mountains/oceans
const SUBURB_STREET_ANCHORS: Record<string, Array<[number, number]>> = {
  "tamboerskloof": [
    [-33.9338, 18.4055], // Derwent Rd / Weltevreden
    [-33.9310, 18.4045], // Hastings St
    [-33.9295, 18.4035], // Carstens St
    [-33.9285, 18.4040], // Milner Rd
    [-33.9320, 18.4060], // Camp St / Tamboerskloof
    [-33.9275, 18.4025], // Leeuwenvoet Rd
    [-33.9315, 18.4020]  // Belle Ombre Rd
  ],
  "gardens": [
    [-33.9325, 18.4120], // Union St
    [-33.9305, 18.4140], // Mill St
    [-33.9355, 18.4100], // Hof St
    [-33.9345, 18.4135], // Breda St
    [-33.9370, 18.4150], // Upper Orange St
    [-33.9340, 18.4110], // Myrtle St
    [-33.9320, 18.4150], // Wandel St
    [-33.9315, 18.4105]  // Kloof St
  ],
  "green point": [
    [-33.9085, 18.4090], // Main Rd / York Rd
    [-33.9110, 18.4050], // High Level Rd
    [-33.9095, 18.4075], // Cavalcade Rd
    [-33.9130, 18.4010], // Ocean View Dr
    [-33.9090, 18.4060], // Clyde Rd
    [-33.9115, 18.4035]  // Romney Rd
  ],
  "sea point": [
    [-33.9165, 18.3920], // Hall Rd
    [-33.9210, 18.3850], // Regent Rd
    [-33.9180, 18.3890], // High Level Rd
    [-33.9195, 18.3880], // Wisbeach Rd
    [-33.9230, 18.3880], // Kloof Rd
    [-33.9240, 18.3820]  // Tramway Rd
  ],
  "oranjezicht": [
    [-33.9390, 18.4180], // Montrose Ave
    [-33.9410, 18.4160], // Belvedere Ave
    [-33.9380, 18.4210]  // Upper Buitenkant
  ]
};

function resolveListingCoords(addressOrArea: string, seed?: string, index: number = 0, url?: string, title?: string): { lat: number; lng: number } {
  const text = (addressOrArea || '').toLowerCase();
  const seedStr = String(seed || '');
  const urlStr = (url || '').toLowerCase();
  const titleStr = (title || '').toLowerCase();
  const combined = `${text} ${seedStr} ${urlStr} ${titleStr}`;

  // 1. Direct Listing ID Match (Deterministic exact pin)
  for (const [lid, [lat, lng]] of Object.entries(KNOWN_LISTING_COORDS)) {
    if (combined.includes(lid)) {
      return { lat, lng };
    }
  }

  // 2. Specific Street Match
  for (const [street, [lat, lng]] of Object.entries(SPECIFIC_STREET_ANCHORS)) {
    if (combined.includes(street)) {
      return { lat, lng };
    }
  }

  // 3. Suburb Real-Street Assignment (Safe, verified habitable street blocks)
  for (const [suburb, streetList] of Object.entries(SUBURB_STREET_ANCHORS)) {
    if (combined.includes(suburb)) {
      const [lat, lng] = streetList[index % streetList.length];
      return { lat, lng };
    }
  }

  // 4. Default City Bowl fallback
  return { lat: -33.9315, lng: 18.4105 };
}

export default function ReportsPage() {
  const { user, profile, loading, login, logout, refreshProfile } = useAuth();
  const [reports, setReports] = useState<IntelligenceReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<IntelligenceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'split' | 'table'>('split');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [realviewTarget, setRealviewTarget] = useState<{ url: string; title: string } | null>(null);
  
  // Pro AI Credit and Auditing States
  const [proCredits, setProCredits] = useState<number>(profile?.pro_credits ?? 5);
  const [isAuditingListingId, setIsAuditingListingId] = useState<string | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [isVerifyingAvailability, setIsVerifyingAvailability] = useState(false);
  const [availabilityToast, setAvailabilityToast] = useState<{ active: number; unavailable: number; message: string } | null>(null);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [showArchiveDropdown, setShowArchiveDropdown] = useState(false);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');

  // Dynamically extract scouted areas from the report and listings
  const availableAreas = useMemo(() => {
    if (!selectedReport?.ranked_listings) return [];
    const set = new Set<string>();
    if (Array.isArray(selectedReport.areas_scouted)) {
      selectedReport.areas_scouted.forEach(a => {
        if (a && a.trim()) set.add(a.trim());
      });
    }
    selectedReport.ranked_listings.forEach(l => {
      if (l.area && l.area.trim()) set.add(l.area.trim());
    });
    return Array.from(set);
  }, [selectedReport]);

  // Count listings per area
  const areaListingCounts = useMemo(() => {
    if (!selectedReport?.ranked_listings) return {};
    const counts: Record<string, number> = {};
    availableAreas.forEach(area => {
      const target = area.toLowerCase();
      counts[area] = selectedReport.ranked_listings.filter(item => {
        const itemArea = (item.area || '').toLowerCase();
        const itemAddr = (item.address || '').toLowerCase();
        const itemTitle = (item.title || '').toLowerCase();
        return itemArea.includes(target) || itemAddr.includes(target) || itemTitle.includes(target);
      }).length;
    });
    return counts;
  }, [selectedReport, availableAreas]);

  // Reset area filter when changing active report
  useEffect(() => {
    setSelectedAreaFilter('all');
  }, [selectedReport?.id]);

  const filteredRankedListings = useMemo(() => {
    if (!selectedReport?.ranked_listings) return [];
    const minBeds = (selectedReport as any)?.min_bedrooms ? Number((selectedReport as any).min_bedrooms) : 1;
    return selectedReport.ranked_listings.filter((item) => {
      if (hideUnavailable && item.is_available === false) return false;
      if (selectedReport.max_price && item.price && item.price > selectedReport.max_price) return false;
      if (minBeds && item.bedrooms !== undefined && item.bedrooms !== null && item.bedrooms < minBeds) return false;
      if (selectedAreaFilter !== 'all') {
        const target = selectedAreaFilter.toLowerCase();
        const itemArea = (item.area || '').toLowerCase();
        const itemAddr = (item.address || '').toLowerCase();
        const itemTitle = (item.title || '').toLowerCase();
        const matches = itemArea.includes(target) || itemAddr.includes(target) || itemTitle.includes(target);
        if (!matches) return false;
      }
      return true;
    });
  }, [selectedReport, hideUnavailable, selectedAreaFilter]);

  const mapProperties: PropertyMapItem[] = useMemo(() => {
    return filteredRankedListings.map((item, idx) => {
      const coords = resolveListingCoords(item.address || item.area || 'Gardens', item.id || item.listing_id || String(idx), idx, item.url, item.title);
      return {
        id: item.id || item.listing_id || String(idx),
        title: item.title,
        address: item.address,
        price: item.price || 0,
        bedrooms: item.bedrooms || 1,
        bathrooms: item.bathrooms || 1,
        sqm: item.sqm || undefined,
        image: item.image || (item.images && item.images[0]) || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&auto=format&fit=crop&q=80',
        lat: coords.lat,
        lng: coords.lng,
        rank: idx + 1,
        fit_score: item.fit_score,
        noise_risk: item.noise_risk,
        noise_reason: item.noise_reason,
        location_proximity: item.location_proximity,
        acoustic_audit: item.acoustic_audit || undefined
      };
    });
  }, [filteredRankedListings]);

  const mapAnchors: ProximityAnchor[] = useMemo(() => {
    const rawAnchors = selectedReport?.location_anchors || selectedReport?.commute_anchors || [];
    if (!rawAnchors || rawAnchors.length === 0) {
      return [{
        id: 'anchor-default',
        label: 'Kloof Street Cafes',
        target_place: 'Kloof Street, Gardens',
        lat: -33.9315,
        lng: 18.4105,
        max_commute_mins: 20,
        max_distance_km: 10,
        commute_mode: 'driving'
      }];
    }
    return rawAnchors.map((a: any, idx: number) => {
      const placeName = a.target_place || a.label || a.name || 'Kloof Street, Gardens';
      const coords = (a.lat && a.lng) ? { lat: a.lat, lng: a.lng } : resolveListingCoords(placeName, String(idx));
      return {
        id: a.id || `anchor-${idx}`,
        label: a.label || a.name || placeName,
        target_place: placeName,
        lat: coords.lat,
        lng: coords.lng,
        max_commute_mins: a.max_commute_mins || 25,
        max_distance_km: a.max_distance_km || 15,
        commute_mode: a.commute_mode || 'driving'
      };
    });
  }, [selectedReport]);

  useEffect(() => {
    if (filteredRankedListings.length > 0 && !selectedPropertyId) {
      const first = filteredRankedListings[0];
      setSelectedPropertyId(first.id || first.listing_id || '0');
    }
  }, [filteredRankedListings, selectedPropertyId]);

  const handleVerifyAvailability = async () => {
    if (!selectedReport) return;
    const uid = profile?.id || user?.uid || 'taun_test_user';
    try {
      setIsVerifyingAvailability(true);
      const res = await fetch(`${backendBase}/api/reports/verify-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: selectedReport.id,
          user_id: uid
        })
      });
      if (res.ok) {
        const data = await res.json();
        const updatedReport: IntelligenceReport = {
          ...selectedReport,
          ranked_listings: data.listings,
          last_availability_check: data.checked_at
        };
        setSelectedReport(updatedReport);
        setReports(prev => prev.map(r => r.id === selectedReport.id ? updatedReport : r));
        setAvailabilityToast({
          active: data.active_count,
          unavailable: data.unavailable_count,
          message: data.unavailable_count > 0
            ? `Checked 10 listings: ${data.active_count} active • ${data.unavailable_count} off-market/rented detected`
            : `All ${data.active_count} listings confirmed active on Property24`
        });
        setTimeout(() => setAvailabilityToast(null), 7000);
      }
    } catch (e) {
      console.error("Availability verify error:", e);
    } finally {
      setIsVerifyingAvailability(false);
    }
  };

  const isLandlordListing = (item: RankedItem) => {
    // Known agency listing override (e.g. 117763397 is managed by Progressive Housing Investments)
    if (item.id === '117763397' || item.listing_id === '117763397' || (item.url && item.url.includes('117763397'))) {
      return false;
    }
    if (item.agency_name) {
      const a = item.agency_name.toLowerCase().trim();
      if (!a.includes('direct landlord') && !a.includes('private landlord') && !a.includes('private owner') && a !== 'none' && a !== '') {
        return false;
      }
    }
    return Boolean(item.is_direct_landlord);
  };

  const shouldShowLiftBadge = (floor?: string | null, hasLift?: string | null) => {
    if (!hasLift) return false;
    if (hasLift === 'N/A (Ground)') return false;
    if (!floor) return hasLift === 'yes' || hasLift === 'no';
    const f = floor.toLowerCase();
    if (f.includes('1st') || f.includes('first') || f.includes('ground')) {
      return false;
    }
    return true;
  };

  const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const getRectifiedUrl = (rawUrl: string) => `${backendBase}/api/realview/rectify?url=${encodeURIComponent(rawUrl)}`;

  const loadReports = async (isRetry = false) => {
    const uid = profile?.id || user?.uid || 'taun_test_user';
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await fetchWithAuth(`/reports/${uid}`);
      if (res && res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.reports)) {
          setReports(data.reports);
          const validReport = data.reports.find((r: any) => r.ranked_listings && r.ranked_listings.length > 0) || data.reports[0];
          if (!selectedReport || !selectedReport.ranked_listings || selectedReport.ranked_listings.length === 0) {
            setSelectedReport(validReport);
          }
        }
      } else {
        setFetchError('Backend returned an error loading reports');
      }
    } catch (err: any) {
      console.warn("Failed to load reports:", err);
      if (!isRetry) {
        // Auto retry once after 1s in case backend was briefly restarting
        setTimeout(() => loadReports(true), 1200);
        return;
      }
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

      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 py-8 space-y-8 transition-all ${viewMode === 'split' ? 'max-w-[1920px] lg:px-8' : 'max-w-6xl'}`}>

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
                onClick={handleVerifyAvailability}
                disabled={isVerifyingAvailability || !selectedReport}
                title="Verify real-time availability on Property24: catches 404 deleted or rented listings"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold text-emerald-950 transition-all cursor-pointer shadow-2xs"
              >
                <Lightning size={15} weight="fill" className={isVerifyingAvailability ? 'animate-spin text-emerald-600' : 'text-emerald-600'} />
                <span>{isVerifyingAvailability ? 'Checking Availability...' : 'Live Feed Check'}</span>
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
          <div className="space-y-6">
            {/* Airbnb-style Top Control & Report Selector Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-3xl bg-zinc-50 border border-zinc-200 shadow-2xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Report Dropdown Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowArchiveDropdown(!showArchiveDropdown)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Clock size={14} weight="bold" />
                    <span>Report: {selectedReport ? formatDate(selectedReport.created_at) : 'Select Report'}</span>
                    <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded-md font-semibold">
                      {filteredRankedListings.length} Contenders
                    </span>
                    <CaretDown size={12} weight="bold" className={`transition-transform duration-200 ${showArchiveDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {showArchiveDropdown && (
                    <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white border border-zinc-200 rounded-3xl shadow-2xl p-2.5 z-50 space-y-1.5 max-h-[480px] overflow-y-auto">
                      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        <span>Report Archive ({reports.length})</span>
                        <span className="text-[10px] text-zinc-400 font-normal">Daily 11:00 AM SAST</span>
                      </div>
                      {reports.map((rep) => {
                        const isSel = selectedReport?.id === rep.id;
                        return (
                          <button
                            key={rep.id}
                            onClick={() => { setSelectedReport(rep); setShowArchiveDropdown(false); }}
                            className={`w-full text-left p-3 rounded-2xl border text-xs transition-all cursor-pointer ${
                              isSel ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm' : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-900'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold mb-1">
                              <span>{formatDate(rep.created_at)}</span>
                              <span className={`text-[11px] ${isSel ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                {rep.ranked_listings?.length || 0} listings
                              </span>
                            </div>
                            <p className="text-[11px] line-clamp-1 opacity-80">{rep.user_prompt || 'Scouted Report'}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Scope & Filter Badges */}
                {selectedReport?.areas_scouted && selectedReport.areas_scouted.length > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-semibold text-zinc-700">
                    <span>📍</span>
                    <span>{selectedReport.areas_scouted.join(', ')}</span>
                  </span>
                )}
                {selectedReport?.max_price && (
                  <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-semibold text-zinc-700">
                    <span>Max R {selectedReport.max_price.toLocaleString()}</span>
                  </span>
                )}
              </div>

              {/* View Mode & Verification Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Live Availability Verification */}
                <button
                  onClick={handleVerifyAvailability}
                  disabled={isVerifyingAvailability}
                  title="Check if any listings have been rented or deleted on Property24"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                >
                  <Lightning size={13} weight="fill" className={isVerifyingAvailability ? 'animate-spin text-amber-500' : 'text-emerald-600'} />
                  <span>{isVerifyingAvailability ? 'Verifying...' : 'Verify Status'}</span>
                </button>

                {/* Hide Off-Market Toggle */}
                {(selectedReport?.ranked_listings?.filter(it => it.is_available === false).length ?? 0) > 0 && (
                  <button
                    onClick={() => setHideUnavailable(!hideUnavailable)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      hideUnavailable
                        ? 'bg-zinc-950 text-white border-zinc-950 shadow-2xs'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <span>{hideUnavailable ? '✓' : '🚫'}</span>
                    <span>Hide Off-Market ({selectedReport?.ranked_listings?.filter(it => it.is_available === false).length})</span>
                  </button>
                )}

                {/* View Switchers */}
                <div className="flex items-center p-1 bg-zinc-100 rounded-xl border border-zinc-200">
                  <button
                    onClick={() => setViewMode('split')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'split' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                    title="Airbnb-style split view with full-size interactive map on the right"
                  >
                    <Compass size={14} weight="bold" />
                    <span>Split Map</span>
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'cards' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    <SquaresFour size={14} weight="bold" />
                    <span>Photo Gallery</span>
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'table' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    <ListDashes size={14} weight="bold" />
                    <span>Table View</span>
                  </button>
                </div>
              </div>
            </div>

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

                    {/* Search Parameters Chips & Interactive Area Filters */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-600">
                      <span className="font-semibold text-zinc-900">Criteria:</span>
                      
                      {/* Interactive Area Filter Chips */}
                      {availableAreas.length > 0 ? (
                        <div className="inline-flex items-center gap-1 bg-zinc-100 p-0.5 rounded-xl border border-zinc-200">
                          <span className="text-[11px] font-bold text-zinc-500 pl-2 pr-1">Areas:</span>
                          <button
                            onClick={() => setSelectedAreaFilter('all')}
                            className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              selectedAreaFilter === 'all'
                                ? 'bg-white text-zinc-950 shadow-xs'
                                : 'text-zinc-600 hover:text-zinc-950'
                            }`}
                          >
                            All ({selectedReport.ranked_listings?.length || 0})
                          </button>
                          {availableAreas.map((area) => {
                            const isSelected = selectedAreaFilter.toLowerCase() === area.toLowerCase();
                            return (
                              <button
                                key={area}
                                onClick={() => setSelectedAreaFilter(isSelected ? 'all' : area)}
                                className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-zinc-950 text-white shadow-xs'
                                    : 'text-zinc-700 hover:bg-white/80'
                                }`}
                              >
                                <span>{area}</span>
                                <span className={`text-[10px] ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                  ({areaListingCounts[area] || 0})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200">
                          Areas: {selectedReport.areas_scouted?.join(', ') || 'Cape Town'}
                        </span>
                      )}

                      {selectedReport.max_price && (
                        <span className="bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200">
                          Max: R {selectedReport.max_price.toLocaleString()} pm
                        </span>
                      )}
                      {selectedReport.personal_tastes && (
                        <span className="bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200 max-w-md truncate" title={selectedReport.personal_tastes}>
                          Tastes: {selectedReport.personal_tastes}
                        </span>
                      )}
                    </div>

                    {/* User Priority Locations Bar */}
                    {(selectedReport.location_anchors || selectedReport.commute_anchors) && (
                      <div className="pt-3 border-t border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                        <div className="flex items-center gap-1.5 text-zinc-900 font-bold">
                          <NavigationArrow size={14} weight="bold" className="text-indigo-600" />
                          <span>Priority Location Anchors ({((selectedReport.location_anchors || selectedReport.commute_anchors) as any[]).length}):</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {((selectedReport.location_anchors || selectedReport.commute_anchors) as any[]).map((loc: any, idx: number) => (
                            <span
                              key={idx}
                              title={loc.target_place}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-zinc-800 text-[11px] font-medium transition-colors"
                            >
                              <span>{loc.commute_mode === 'walking' ? '🚶' : loc.commute_mode === 'bicycling' ? '🚲' : '🚗'}</span>
                              <span className="font-semibold text-zinc-950">{loc.label}</span>
                              <span className="text-zinc-500 font-normal hidden md:inline">({loc.target_place})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Availability Result Toast Notification */}
                  {availabilityToast && (
                    <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between transition-all ${
                      availabilityToast.unavailable > 0 
                        ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs' 
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-2xs'
                    }`}>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} weight="bold" className={availabilityToast.unavailable > 0 ? 'text-amber-600' : 'text-emerald-600'} />
                        <span className="font-semibold">{availabilityToast.message}</span>
                      </div>
                      <button onClick={() => setAvailabilityToast(null)} className="text-zinc-500 hover:text-zinc-800 p-1">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Listings Container Header & View Mode Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                        <span>Curated Properties</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-semibold">
                          {filteredRankedListings.length}
                        </span>
                      </h3>

                      {/* Live Verification Badge / Button in Subheader */}
                      <button
                        onClick={handleVerifyAvailability}
                        disabled={isVerifyingAvailability}
                        title="Click to check if any of these listings have been rented or deleted on Property24"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200/90 text-zinc-800 border border-zinc-200 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <Lightning size={13} weight="fill" className={isVerifyingAvailability ? 'animate-spin text-amber-500' : 'text-emerald-600'} />
                        <span>{isVerifyingAvailability ? 'Verifying...' : 'Verify Status'}</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Hide Off-Market Toggle (only shows if any off-market listings detected) */}
                      {(selectedReport.ranked_listings?.filter(it => it.is_available === false).length ?? 0) > 0 && (
                        <button
                          onClick={() => setHideUnavailable(!hideUnavailable)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            hideUnavailable
                              ? 'bg-zinc-950 text-white border-zinc-950 shadow-2xs'
                              : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          <span>{hideUnavailable ? '✓' : '🚫'}</span>
                          <span>Hide Off-Market ({selectedReport.ranked_listings?.filter(it => it.is_available === false).length})</span>
                        </button>
                      )}

                      <div className="flex items-center p-1 bg-zinc-100 rounded-xl border border-zinc-200">
                      <button
                        onClick={() => setViewMode('split')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          viewMode === 'split'
                            ? 'bg-white text-zinc-950 shadow-2xs'
                            : 'text-zinc-600 hover:text-zinc-950'
                        }`}
                        title="Side-by-side view with interactive map fixed on the right"
                      >
                        <Compass size={14} weight="bold" />
                        <span>Split Map</span>
                      </button>
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
                  </div>

                  {/* Area Filter Buttons Bar (One-click toggle between scouted areas) */}
                  {availableAreas.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2 px-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 mr-0.5 select-none">
                        <MapPin size={14} weight="bold" className="text-zinc-400" />
                        <span>Filter Area:</span>
                      </div>

                      {/* All Areas Pill Button */}
                      <button
                        onClick={() => setSelectedAreaFilter('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                          selectedAreaFilter === 'all'
                            ? 'bg-zinc-950 text-white shadow-sm ring-1 ring-zinc-950'
                            : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200/90 shadow-2xs'
                        }`}
                      >
                        <span>All Areas</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                          selectedAreaFilter === 'all' ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {selectedReport?.ranked_listings?.length || 0}
                        </span>
                      </button>

                      {/* Individual Area Filter Buttons */}
                      {availableAreas.map((area) => {
                        const isSelected = selectedAreaFilter.toLowerCase() === area.toLowerCase();
                        const count = areaListingCounts[area] || 0;

                        return (
                          <button
                            key={area}
                            onClick={() => setSelectedAreaFilter(isSelected ? 'all' : area)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-zinc-950 text-white shadow-sm ring-1 ring-zinc-950'
                                : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200/90 shadow-2xs'
                            }`}
                            title={`Filter report to show only ${area} properties`}
                          >
                            <span>{area}</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                              isSelected ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-600'
                            }`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}

                      {selectedAreaFilter !== 'all' && (
                        <button
                          onClick={() => setSelectedAreaFilter('all')}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline px-1 cursor-pointer ml-1"
                        >
                          Clear filter
                        </button>
                      )}
                    </div>
                  )}

                  {/* Error Alert if Pro Audit Fails */}
                  {auditError && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
                      <span>{auditError}</span>
                      <button onClick={() => setAuditError(null)} className="text-rose-500 hover:text-rose-700">
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* CARD OR SPLIT MAP VIEW MODE */}
                  {viewMode === 'cards' || viewMode === 'split' ? (
                    <div className={viewMode === 'split' ? "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full" : "space-y-6"}>
                      
                      {/* Left: Listing Cards (1/3 Width) */}
                      <div className={viewMode === 'split' ? "lg:col-span-5 xl:col-span-4 space-y-6" : "space-y-6"}>
                        
                        {/* Mobile inline map for split mode */}
                        {viewMode === 'split' && (
                          <div className="lg:hidden h-80 w-full rounded-3xl overflow-hidden border border-zinc-200 shadow-md mb-6">
                            <PropertyMap
                              properties={mapProperties}
                              anchors={mapAnchors}
                              selectedPropertyId={selectedPropertyId || (mapProperties[0]?.id)}
                              selectedAnchorId={selectedAnchorId}
                              onSelectProperty={(p) => {
                                setSelectedPropertyId(p.id);
                                const el = document.getElementById(`listing-card-${p.id}`);
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                              onSelectAnchor={(a) => setSelectedAnchorId(a.id)}
                            />
                          </div>
                        )}

                        {/* Empty Filter State */}
                        {filteredRankedListings.length === 0 && (
                          <div className="p-8 text-center bg-white rounded-3xl border border-zinc-200/90 shadow-2xs space-y-2.5">
                            <MapPin size={24} className="mx-auto text-zinc-400" />
                            <h4 className="text-sm font-bold text-zinc-900">No properties found in {selectedAreaFilter}</h4>
                            <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                              No listings matched this area filter under current search criteria.
                            </p>
                            <button
                              onClick={() => setSelectedAreaFilter('all')}
                              className="px-3.5 py-1.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                              Show All Areas ({selectedReport?.ranked_listings?.length || 0})
                            </button>
                          </div>
                        )}

                        {filteredRankedListings.map((item, idx) => {
                          const isSelectedCard = selectedPropertyId === (item.id || item.listing_id);
                          const detailUrl = `/reports/listing?reportId=${selectedReport?.id || ''}&id=${item.listing_id || item.id}`;
                          const isShielded = item.acoustic_audit?.is_shielded ?? (item.noise_risk !== 'high');
                          const estDb = item.acoustic_audit?.estimated_db ?? (isShielded ? 40 : 73);

                          return (
                            <div
                              key={item.id || item.listing_id}
                              id={`listing-card-${item.id || item.listing_id}`}
                              onClick={() => {
                                setSelectedPropertyId(item.id || item.listing_id);
                              }}
                              className={`group relative bg-white border rounded-3xl p-4 sm:p-5 transition-all duration-200 cursor-pointer hover:shadow-lg ${
                                isSelectedCard
                                  ? 'border-zinc-950 shadow-md ring-2 ring-zinc-950/20'
                                  : 'border-zinc-200 hover:border-zinc-400/80 shadow-2xs'
                              }`}
                            >
                              {/* 1. Airbnb-Style Image Thumbnail with Sliding Gallery Arrows */}
                              <div className="mb-3.5">
                                <ThumbnailGallery
                                  initialImage={item.image}
                                  images={item.images}
                                  listingUrl={item.url}
                                  title={item.title}
                                  aspectClassName="h-48 sm:h-52"
                                  badges={
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-6 h-6 rounded-lg bg-zinc-950/90 text-white font-black text-xs flex items-center justify-center backdrop-blur-md shadow-sm">
                                        #{idx + 1}
                                      </span>
                                      <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black backdrop-blur-md shadow-sm ${
                                        item.fit_score >= 75
                                          ? 'bg-emerald-600/90 text-white'
                                          : 'bg-amber-500/90 text-white'
                                      }`}>
                                        {item.fit_score}% Fit
                                      </span>
                                    </div>
                                  }
                                  actions={
                                    <a
                                      href={detailUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      title="Open full listing dossier in a new window"
                                      className="p-2 rounded-xl bg-white/90 hover:bg-white text-zinc-900 backdrop-blur-md shadow-md hover:scale-110 transition-all cursor-pointer"
                                    >
                                      <ArrowSquareOut size={14} weight="bold" />
                                    </a>
                                  }
                                  priceBadge={
                                    <div className="bg-zinc-950/90 backdrop-blur-md text-white font-black text-xs px-3 py-1 rounded-xl shadow-md flex items-center gap-1.5">
                                      <span>R {item.price ? item.price.toLocaleString() : 'Contact'}</span>
                                      <span className="text-[10px] text-zinc-300 font-normal">/mo</span>
                                    </div>
                                  }
                                  bottomBanner={
                                    item.is_available === false ? (
                                      <div className="py-1 bg-rose-600/90 backdrop-blur-xs text-white text-[10px] font-extrabold text-center tracking-wider uppercase">
                                        Off-Market / Let Agreed
                                      </div>
                                    ) : null
                                  }
                                />
                              </div>

                              {/* 2. Title & Suburb Row */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500">
                                  <span className="truncate uppercase tracking-wider">
                                    {item.area || 'Cape Town'} · {item.address.split(',')[0]}
                                  </span>
                                  {item.price_value_pct !== undefined && item.price_value_pct !== null && (
                                    <span className={`shrink-0 font-extrabold px-1.5 py-0.2 rounded ${
                                      item.price_value_pct < -5
                                        ? 'text-emerald-700 bg-emerald-50'
                                        : item.price_value_pct > 10
                                        ? 'text-amber-700 bg-amber-50'
                                        : 'text-zinc-600 bg-zinc-100'
                                    }`}>
                                      {item.price_value_pct < 0 ? `${Math.abs(item.price_value_pct)}% underpriced` : 'Fair Value'}
                                    </span>
                                  )}
                                </div>

                                <h4 className="font-extrabold text-zinc-950 text-sm leading-snug line-clamp-1 group-hover:text-indigo-600 transition-colors">
                                  {item.title}
                                </h4>
                              </div>

                              {/* 3. Fundamental Metrics Quick-View Row */}
                              <div className="flex flex-wrap items-center gap-2 pt-2.5 pb-1 text-xs font-semibold text-zinc-700">
                                <div className="inline-flex items-center gap-1 bg-zinc-100 px-2.5 py-1 rounded-lg">
                                  <Bed size={13} weight="bold" className="text-zinc-500" />
                                  <span>{item.bedrooms || 1} Bed{item.bedrooms && item.bedrooms > 1 ? 's' : ''}</span>
                                </div>

                                <div className="inline-flex items-center gap-1 bg-zinc-100 px-2.5 py-1 rounded-lg">
                                  <Bathtub size={13} weight="bold" className="text-zinc-500" />
                                  <span>{item.bathrooms || 1} Bath</span>
                                </div>

                                <div className="inline-flex items-center gap-1 bg-zinc-100 px-2.5 py-1 rounded-lg">
                                  <Ruler size={13} weight="bold" className="text-zinc-500" />
                                  <span>{item.sqm ? `${item.sqm} m²` : 'Standard'}</span>
                                </div>

                                {item.floor_number && (
                                  <div className="inline-flex items-center gap-1 bg-zinc-100 px-2.5 py-1 rounded-lg">
                                    <Buildings size={13} className="text-zinc-500" />
                                    <span>{item.floor_number}</span>
                                    {item.has_lift === 'yes' && <span className="text-[10px] text-emerald-700 font-bold ml-0.5">· 🛗 Lift</span>}
                                  </div>
                                )}
                              </div>

                              {/* 4. Acoustic Decibel & Sound Shadow Status Badge */}
                              <div className="pt-1.5">
                                <div className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-xs ${
                                  isShielded
                                    ? 'bg-emerald-50/80 text-emerald-950 border-emerald-200/80'
                                    : 'bg-rose-50/80 text-rose-950 border-rose-200/80'
                                }`}>
                                  <div className="flex items-center gap-1.5 truncate">
                                    {isShielded ? (
                                      <ShieldCheck size={14} weight="bold" className="text-emerald-600 shrink-0" />
                                    ) : (
                                      <SpeakerHigh size={14} weight="bold" className="text-rose-600 shrink-0" />
                                    )}
                                    <span className="font-bold truncate text-[11px]">
                                      {item.acoustic_audit?.sound_shadow_status || (isShielded ? 'In Sound Shadow (Shielded)' : 'Direct Sound Corridor')}
                                    </span>
                                  </div>
                                  <span className={`font-black text-xs shrink-0 ${isShielded ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {estDb} dBA
                                  </span>
                                </div>
                              </div>

                              {/* 5. Commute & Agency Footer */}
                              <div className="flex items-center justify-between pt-2.5 border-t border-zinc-100 text-[11px]">
                                <div className="flex items-center gap-1 text-zinc-500 font-medium truncate max-w-[170px]">
                                  <Car size={13} weight="fill" className="text-indigo-600 shrink-0" />
                                  <span className="truncate">
                                    {item.location_proximity && item.location_proximity[0]
                                      ? `${item.location_proximity[0].duration_text} · ${item.location_proximity[0].distance_text}`
                                      : '~8 mins drive'}
                                  </span>
                                </div>

                                <div className="text-right shrink-0">
                                  {isLandlordListing(item) ? (
                                    <span className="font-extrabold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/80">
                                      Direct Landlord
                                    </span>
                                  ) : (
                                    <span className="font-bold text-zinc-600 truncate max-w-[130px] inline-block">
                                      {item.agency_name || 'Verified Agency'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 6. Click to Open Full Details Action Button */}
                              <div className="pt-2.5">
                                <a
                                  href={detailUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full py-2 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs group-hover:bg-indigo-600 cursor-pointer"
                                >
                                  <span>Open Full Details in New Window</span>
                                  <ArrowSquareOut size={13} weight="bold" />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right: Fixed Interactive Map (2/3 Width) */}
                      {viewMode === 'split' && (
                        <div className="hidden lg:block lg:col-span-7 xl:col-span-8 sticky top-20 self-start h-[calc(100vh-6.5rem)] rounded-3xl overflow-hidden border border-zinc-200 shadow-xl bg-white z-20">
                          <PropertyMap
                            properties={mapProperties}
                            anchors={mapAnchors}
                            selectedPropertyId={selectedPropertyId || (mapProperties[0]?.id)}
                            selectedAnchorId={selectedAnchorId}
                            onSelectProperty={(p) => {
                              setSelectedPropertyId(p.id);
                              const el = document.getElementById(`listing-card-${p.id}`);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            onSelectAnchor={(a) => setSelectedAnchorId(a.id)}
                          />
                        </div>
                      )}

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
                            {filteredRankedListings.map((item, idx) => (
                              <tr key={item.id || item.listing_id} className="hover:bg-zinc-50/50 transition-colors group">
                                {/* Title, Address, Agency */}
                                <td className="py-4 px-4 align-top max-w-xs">
                                  <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-zinc-950 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                      #{idx + 1}
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
                                      {item.location_proximity && item.location_proximity.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                          {item.location_proximity.slice(0, 3).map((prox, pIdx) => (
                                            <a
                                              key={pIdx}
                                              href={prox.maps_route_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[10px] font-semibold transition-colors"
                                              title={`${prox.label} (${prox.target_place}) - Click for Google Maps route`}
                                            >
                                              <span>{prox.commute_mode === 'walking' ? '🚶' : prox.commute_mode === 'bicycling' ? '🚲' : '🚗'}</span>
                                              <span>{prox.label.split('(')[0].trim()}:</span>
                                              <span className="font-extrabold text-zinc-950">{prox.duration_text}</span>
                                            </a>
                                          ))}
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
                                            {item.noise_reason && (item.noise_reason.toLowerCase().includes('bar') || item.noise_reason.toLowerCase().includes('gate')) ? 'Bar/Gate Trap' : 'Noise Trap'}
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
                                  {shouldShowLiftBadge(item.floor_number, item.has_lift) && (
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
          )}
      </main>

      {/* BEFORE / AFTER REALVIEW MODAL */}
      {realviewTarget && (
        <RealViewSlider
          originalImageUrl={realviewTarget.url}
          listingTitle={realviewTarget.title}
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
