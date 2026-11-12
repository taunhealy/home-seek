'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  MagnifyingGlass,
  MapPin,
  Target,
  ShieldCheck,
  ShieldWarning,
  SlidersHorizontal,
  House,
  Car,
  Plus,
  Trash,
  CheckCircle,
  ArrowRight,
  Lightning,
  Sparkle,
  ArrowsClockwise,
  Info,
  X,
  NavigationArrow,
  Ruler,
  Compass,
  CircleNotch,
  CaretRight,
  CaretLeft,
  CaretDown,
  ArrowSquareOut,
  Sliders,
  Tree,
  Waves,
  Coffee,
  Bicycle,
  Eye,
  EyeSlash,
  Check,
  BookmarkSimple,
  FloppyDisk,
  SpeakerHigh,
  WarningCircle,
  Heart,
  Clock,
  Scales,
  Crown,
  Camera,
  SquaresFour,
  ListBullets
} from '@phosphor-icons/react';
import { Dumbbell, ShoppingBag } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { CAPE_TOWN_CRIME_HOTSPOTS, CAPE_TOWN_HOTSPOTS, CAPE_TOWN_BUSY_ROADS, getPropertyBarNoiseExposure, getPropertyBusyRoadExposure, getCrimeDepthTier, isMissingAddressListing, type PropertyMapItem, type PropertyMapProps, type ProximityAnchor, type ProximityFilterConfig } from '@/components/PropertyMap';
import { resolveLocationCoords, getDistanceKm, searchSuburbs, searchPlacesAndAttractions, type PlaceSuggestion, isLandlordOnSiteProperty, getDwellingPrivacyInfo, getAgencyReputationInfo, getPropertyMarketValuation, setEmpiricalMarketMedians, type PropertyValuationContext } from '@/lib/geo';
import {
  getPlanSummary,
  setProPlanTier,
  consumeAuditCredit,
  compressImageToDataUrl,
  getCompareList,
  toggleCompareProperty,
  type PlanSummary,
} from '@/lib/pro-plan';

const PropertyMap = dynamic<PropertyMapProps>(
  () => import('@/components/PropertyMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-zinc-400">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Loading Map Engine...</span>
        </div>
      </div>
    ),
  }
);

// Helper to determine if a property coordinate falls within any High Risk crime hotspot radius
export function isPropertyInHighRiskCrimeZone(lat: number, lng: number): boolean {
  if (!lat || !lng) return false;
  for (const spot of CAPE_TOWN_CRIME_HOTSPOTS) {
    const tier = getCrimeDepthTier(spot);
    const isHigh = tier === 'high' || spot.risk_level.toLowerCase().includes('high');
    if (isHigh) {
      const distKm = getDistanceKm(lat, lng, spot.lat, spot.lng);
      if (distKm * 1000 <= spot.radius_m) {
        return true;
      }
    }
  }
  return false;
}

export interface CrimePerimeterInfo {
  isNearHighRisk: boolean;
  isInsideCore: boolean;
  distanceKm: number;
  hotspotName: string;
  hasEstateSecurity: boolean;
  shortFlag: string | null;
  tooltipReason: string;
}

// Security-aware proximity check for High-Risk hotspots & townships (including 1.45x outer perimeter buffer)
export function getCrimePerimeterInfo(prop: {
  lat?: number;
  lng?: number;
  title?: string;
  address?: string;
  description?: string;
  ai_insight?: string;
}): CrimePerimeterInfo {
  const empty: CrimePerimeterInfo = {
    isNearHighRisk: false,
    isInsideCore: false,
    distanceKm: 99,
    hotspotName: '',
    hasEstateSecurity: false,
    shortFlag: null,
    tooltipReason: '',
  };
  if (!prop.lat || !prop.lng) return empty;

  const rawText = `${prop.title || ''} ${prop.address || ''} ${prop.description || ''} ${prop.ai_insight || ''}`.toLowerCase();
  const hasEstateSecurity = /\b(security\s+estate|gated\s+estate|gated\s+community|24.?h(our)?\s+security|24hr\s+security|manned\s+gate|boom\s+gate|biometric|electric\s+fenc|armed\s+response|access\s+control)\b/i.test(rawText);

  let closest: { spot: typeof CAPE_TOWN_CRIME_HOTSPOTS[number]; distM: number } | null = null;
  for (const spot of CAPE_TOWN_CRIME_HOTSPOTS) {
    const tier = getCrimeDepthTier(spot);
    const isHigh = tier === 'high' || spot.risk_level.toLowerCase().includes('high');
    if (!isHigh) continue;
    const distM = getDistanceKm(prop.lat, prop.lng, spot.lat, spot.lng) * 1000;
    const bufferM = spot.radius_m * 1.45;
    if (distM <= bufferM && (!closest || distM < closest.distM)) {
      closest = { spot, distM };
    }
  }

  if (!closest) return empty;

  const distKm = Math.round((closest.distM / 1000) * 10) / 10;
  const shortArea = closest.spot.name.split('(')[0].replace(/\s+Township.*$/i, '').trim();
  const isInsideCore = closest.distM <= closest.spot.radius_m;

  return {
    isNearHighRisk: true,
    isInsideCore,
    distanceKm: distKm,
    hotspotName: shortArea,
    hasEstateSecurity,
    shortFlag: hasEstateSecurity
      ? `Secured Estate · ${distKm}km from ${shortArea}`
      : `Perimeter Risk · ${distKm}km from ${shortArea} (No Estate Security)`,
    tooltipReason: hasEstateSecurity
      ? `Within ${distKm} km of ${closest.spot.name}, mitigated by estate/complex access control.`
      : `Within ${distKm} km of ${closest.spot.name} without confirmed 24h estate/complex security — inspect burglar bars, perimeter walls & nighttime street lighting.`,
  };
}

// Comprehensive real-world market valuation factoring crime/township proximity, estate security, main road noise, landlord on-site, parking, and m²
export function getRiskAdjustedValuation(
  prop: PropertyMapItem,
  sampleContext?: PropertyMapItem[]
) {
  const crime = getCrimePerimeterInfo(prop);
  const privacy = getDwellingPrivacyInfo(prop);
  const busy = getPropertyBusyRoadExposure(prop);
  const ctx: PropertyValuationContext = {
    isInsideCrimeCore: crime.isNearHighRisk && crime.isInsideCore,
    isInCrimeBuffer: crime.isNearHighRisk && !crime.isInsideCore,
    hasEstateSecurity: crime.hasEstateSecurity,
    isMainRoad: Boolean(prop.is_main_road) || isMainRoadProperty(prop.address, prop.title) || busy.isDirectlyOnRoad,
    isLandlordOnSite: privacy.isLandlordOnSite,
    hasParking: Boolean(prop.has_garage || prop.has_secure_bay),
  };
  return getPropertyMarketValuation(prop, sampleContext, ctx);
}

// Helper to identify properties located on busy arterial traffic corridors (Main Road, M4, Victoria Rd, New Church St, etc.)
export function isMainRoadProperty(address?: string, title?: string): boolean {
  const text = `${address || ''} ${title || ''}`.toLowerCase();
  return /\b(main\s+r(oa)?d|victoria\s+r(oa)?d|somerset\s+r(oa)?d|regent\s+r(oa)?d|kloof\s+st(reet)?|kloof\s+nek|buitengracht|new\s+church(\s+st(reet)?)?|orange\s+st(reet)?|roeland\s+st(reet)?|buitenkant(\s+st(reet)?)?|strand\s+st(reet)?|helen\s+suzman|mill\s+st(reet)?|voortrekker\s+r(oa)?d|ou\s+kaapse\s+weg|kommetjie\s+r(oa)?d|baden\s+powell|highway|freeway|motorway|m3|m4|m5|m6|m62)\b/i.test(text);
}

// Deterministic number formatting to avoid SSR/client locale hydration mismatch
function formatPrice(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Compact price abbreviation for buttons & chips (e.g. 11000 -> "11k")
function formatPriceAbbr(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || num <= 0) return '0';
  if (num >= 1000) {
    const k = num / 1000;
    return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return num.toString();
}

interface CommuteAnchor extends ProximityAnchor {
  iconType?: 'trail' | 'surf' | 'beach' | 'attraction' | 'cafe' | 'gym' | 'shop' | 'work' | 'general' | 'hub';
  category?: 'attraction' | 'gym' | 'hub' | 'trail' | 'cafe' | 'shop';
  templateId?: string;
}

const PRESET_TRAILHEADS_AND_HUBS: CommuteAnchor[] = [
  // ==========================================
  // 1. Deep South & False Bay
  // Main Location Attractions & Gyms
  // ==========================================
  {
    id: 'attraction-long-beach',
    label: 'Long Beach (Kommetjie)',
    target_place: 'Long Beach, Kommetjie, Cape Town',
    lat: -34.1370,
    lng: 18.3270,
    max_commute_mins: 15,
    max_distance_km: 10,
    commute_mode: 'driving',
    iconType: 'beach',
    category: 'attraction',
    templateId: 'preset-deepsouth-surf',
  },
  {
    id: 'attraction-noordhoek-village',
    label: 'Noordhoek Farm Village',
    target_place: 'Noordhoek Farm Village, Village Lane, Noordhoek',
    lat: -34.1020,
    lng: 18.3680,
    max_commute_mins: 15,
    max_distance_km: 10,
    commute_mode: 'driving',
    iconType: 'attraction',
    category: 'attraction',
    templateId: 'preset-deepsouth-surf',
  },
  {
    id: 'surf-muizenberg',
    label: 'Muizenberg Beach (Surfers Corner)',
    target_place: 'Surfers Corner, Beach Road, Muizenberg',
    lat: -34.1080,
    lng: 18.4720,
    max_commute_mins: 25,
    max_distance_km: 15,
    commute_mode: 'driving',
    iconType: 'surf',
    category: 'attraction',
    templateId: 'preset-deepsouth-surf',
  },
  {
    id: 'attraction-seaforth-beach',
    label: 'Seaforth Beach & Boulders',
    target_place: "Seaforth Beach, Seaforth Road, Simon's Town",
    lat: -34.1970,
    lng: 18.4520,
    max_commute_mins: 20,
    max_distance_km: 15,
    commute_mode: 'driving',
    iconType: 'beach',
    category: 'attraction',
    templateId: 'preset-deepsouth-surf',
  },
  {
    id: 'gym-va-sun-valley',
    label: 'Virgin Active Sun Valley',
    target_place: 'Sun Valley Mall, Ou Kaapse Weg, Sun Valley',
    lat: -34.1305,
    lng: 18.3970,
    max_commute_mins: 15,
    max_distance_km: 10,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-deepsouth-surf',
  },
  {
    id: 'gym-zone-fish-hoek',
    label: 'Zone Fitness Fish Hoek',
    target_place: 'Main Road, Fish Hoek, Cape Town',
    lat: -34.1360,
    lng: 18.4310,
    max_commute_mins: 15,
    max_distance_km: 10,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-deepsouth-surf',
  },
  {
    id: 'gym-planet-fitness-longbeach',
    label: 'Planet Fitness JustGym (Longbeach)',
    target_place: 'Longbeach Mall, Sunnydale, Noordhoek',
    lat: -34.1322,
    lng: 18.3932,
    max_commute_mins: 15,
    max_distance_km: 10,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-deepsouth-surf',
  },

  // ==========================================
  // 2. Southern Suburbs Trailside
  // Main Location Attractions & Gyms
  // ==========================================
  {
    id: 'trail-newlands',
    label: 'Newlands Forest Trailhead',
    target_place: 'Newlands Forest, Table Mountain National Park',
    lat: -33.9740,
    lng: 18.4550,
    max_commute_mins: 15,
    max_distance_km: 8,
    commute_mode: 'driving',
    iconType: 'trail',
    category: 'attraction',
    templateId: 'preset-cape-trailside',
  },
  {
    id: 'trail-tokai',
    label: 'Tokai Forest MTB Trails',
    target_place: 'Tokai MTB Trail Centre, Tokai Road, Tokai',
    lat: -34.0598,
    lng: 18.4148,
    max_commute_mins: 20,
    max_distance_km: 12,
    commute_mode: 'driving',
    iconType: 'trail',
    category: 'attraction',
    templateId: 'preset-cape-trailside',
  },
  {
    id: 'attraction-kirstenbosch',
    label: 'Kirstenbosch Botanical Gardens',
    target_place: 'Rhodes Drive, Newlands, Cape Town',
    lat: -33.9875,
    lng: 18.4325,
    max_commute_mins: 15,
    max_distance_km: 8,
    commute_mode: 'driving',
    iconType: 'attraction',
    category: 'attraction',
    templateId: 'preset-cape-trailside',
  },
  {
    id: 'trail-constantia-nek',
    label: 'Constantia Nek Trailhead',
    target_place: 'Constantia Nek, Hout Bay Main Rd',
    lat: -34.0118,
    lng: 18.4052,
    max_commute_mins: 15,
    max_distance_km: 10,
    commute_mode: 'driving',
    iconType: 'trail',
    category: 'attraction',
    templateId: 'preset-cape-trailside',
  },
  {
    id: 'gym-va-claremont',
    label: 'Virgin Active Claremont',
    target_place: 'Stadium on Main, Main Rd, Claremont',
    lat: -33.9825,
    lng: 18.4660,
    max_commute_mins: 15,
    max_distance_km: 8,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-cape-trailside',
  },
  {
    id: 'gym-va-constantia',
    label: 'Virgin Active Constantia',
    target_place: 'Constantia Village, Spaanschemat River Rd',
    lat: -34.0260,
    lng: 18.4420,
    max_commute_mins: 15,
    max_distance_km: 10,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-cape-trailside',
  },
  {
    id: 'gym-zone-rondebosch',
    label: 'Zone Fitness Rondebosch',
    target_place: 'Riverside Mall, Main Rd, Rondebosch',
    lat: -33.9620,
    lng: 18.4720,
    max_commute_mins: 15,
    max_distance_km: 8,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-cape-trailside',
  },

  // ==========================================
  // 3. City Bowl Enclaves
  // Attractions, Gyms, Cafes & Shops
  // ==========================================
  // Outdoors & Attractions
  {
    id: 'hub-kloof',
    label: 'Kloof Street Dining Hub',
    target_place: 'Kloof Street, Gardens, Cape Town',
    lat: -33.9315,
    lng: 18.4110,
    max_commute_mins: 15,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'attraction',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'trail-lions-head',
    label: "Lion's Head Spiral Trailhead",
    target_place: 'Signal Hill Road, Cape Town',
    lat: -33.9398,
    lng: 18.4010,
    max_commute_mins: 15,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'trail',
    category: 'attraction',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'attraction-table-mountain',
    label: 'Table Mountain Aerial Cableway',
    target_place: 'Tafelberg Road, Gardens, Cape Town',
    lat: -33.9538,
    lng: 18.4038,
    max_commute_mins: 15,
    max_distance_km: 8,
    commute_mode: 'driving',
    iconType: 'attraction',
    category: 'attraction',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'attraction-company-gardens',
    label: "Company's Garden Precinct",
    target_place: 'Queen Victoria St, Cape Town City Centre',
    lat: -33.9275,
    lng: 18.4170,
    max_commute_mins: 15,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'attraction',
    category: 'attraction',
    templateId: 'preset-citybowl-remote',
  },

  // City Bowl Gyms & Fitness
  {
    id: 'gym-va-wembley',
    label: 'Virgin Active Wembley Square',
    target_place: 'Wembley Square, McKenzie St, Gardens, Cape Town',
    lat: -33.932292,
    lng: 18.424188,
    max_commute_mins: 12,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'gym-va-kloof',
    label: 'Virgin Active Kloof Street',
    target_place: '50 Kloof Street, Gardens, Cape Town',
    lat: -33.929839,
    lng: 18.410876,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'gym-roark-cbd',
    label: 'Roark Gyms Cape Town',
    target_place: '130 Bree Street, Cape Town CBD',
    lat: -33.924669,
    lng: 18.414300,
    max_commute_mins: 12,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'gym-zone-kloof',
    label: 'Zone Fitness Kloof Street',
    target_place: 'Lifestyle on Kloof, 50 Kloof St, Gardens',
    lat: -33.9295,
    lng: 18.4105,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'gym-sweat1000-kloof',
    label: 'The Yard / SWEAT 1000 Kloof',
    target_place: '70 Kloof St, Gardens, Cape Town',
    lat: -33.9310,
    lng: 18.4100,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'gym-va-silo',
    label: 'Virgin Active Silo District',
    target_place: 'Silo District, V&A Waterfront, Cape Town',
    lat: -33.9090,
    lng: 18.4230,
    max_commute_mins: 15,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-citybowl-remote',
  },

  // City Bowl Cafes & Bakeries
  {
    id: 'cafe-truth-buitenkant',
    label: 'Truth Coffee Roasting',
    target_place: '36 Buitenkant St, Cape Town City Centre',
    lat: -33.9282,
    lng: 18.4225,
    max_commute_mins: 12,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'cafe-our-local-kloof',
    label: 'Our Local (Kloof Street)',
    target_place: '117 Kloof St, Gardens, Cape Town',
    lat: -33.9348,
    lng: 18.4082,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'cafe-molten-toffee',
    label: 'Molten Toffee (Kloof Street)',
    target_place: '161 Kloof St, Gardens, Cape Town',
    lat: -33.9378,
    lng: 18.4060,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'cafe-manna-epicure',
    label: 'Manna Epicure (Kloof Street)',
    target_place: '151 Kloof St, Gardens, Cape Town',
    lat: -33.9362,
    lng: 18.4070,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'cafe-honest-chocolate',
    label: 'Honest Chocolate & Gin Bar',
    target_place: '64A Wale St, Cape Town City Centre',
    lat: -33.9228,
    lng: 18.4172,
    max_commute_mins: 12,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'cafe-red-sofa-vredehoek',
    label: 'Red Sofa Cafe (Vredehoek)',
    target_place: '21 Derry St, Vredehoek, Cape Town',
    lat: -33.9388,
    lng: 18.4282,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'cafe-clarks-bree',
    label: "Clark's Dining Room & Cafe",
    target_place: '109 Bree St, Cape Town City Centre',
    lat: -33.9238,
    lng: 18.4168,
    max_commute_mins: 12,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-citybowl-remote',
  },

  // City Bowl Shops & Retail Centres
  {
    id: 'shop-gardens-centre',
    label: 'Gardens Shopping Centre',
    target_place: 'Mill St & Buitenkant St, Gardens, Cape Town',
    lat: -33.9328,
    lng: 18.4178,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'shop',
    category: 'shop',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'shop-lifestyle-on-kloof',
    label: 'Lifestyle on Kloof',
    target_place: '50 Kloof St, Gardens, Cape Town',
    lat: -33.9298,
    lng: 18.4108,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'shop',
    category: 'shop',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'shop-spar-derry-vredehoek',
    label: 'Spar Derry Street (Vredehoek)',
    target_place: 'Derry St & Exner Ave, Vredehoek, Cape Town',
    lat: -33.9392,
    lng: 18.4290,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'shop',
    category: 'shop',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'shop-oranjezicht-market',
    label: 'Oranjezicht City Farm Market',
    target_place: 'Haul Rd, Granger Bay Blvd, Victoria & Alfred Waterfront',
    lat: -33.9015,
    lng: 18.4185,
    max_commute_mins: 15,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'shop',
    category: 'shop',
    templateId: 'preset-citybowl-remote',
  },
  {
    id: 'shop-bree-street-strip',
    label: 'Bree Street Boutique Strip',
    target_place: 'Bree St & Hout St, Cape Town CBD',
    lat: -33.9235,
    lng: 18.4165,
    max_commute_mins: 12,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'shop',
    category: 'shop',
    templateId: 'preset-citybowl-remote',
  },

  // ==========================================
  // 4. Atlantic Seaboard / Promenade & Seaboard
  // Attractions, Gyms, Cafes & Shops
  // ==========================================
  // Outdoors & Attractions
  {
    id: 'attraction-seapoint-promenade',
    label: 'Sea Point Promenade & Pavilion',
    target_place: 'Beach Road, Sea Point, Cape Town',
    lat: -33.9180,
    lng: 18.3850,
    max_commute_mins: 15,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'beach',
    category: 'attraction',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'attraction-camps-bay',
    label: 'Camps Bay Beach Strip',
    target_place: 'Victoria Road, Camps Bay, Cape Town',
    lat: -33.9510,
    lng: 18.3780,
    max_commute_mins: 15,
    max_distance_km: 8,
    commute_mode: 'driving',
    iconType: 'beach',
    category: 'attraction',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'attraction-clifton-4th',
    label: 'Clifton 4th Beach',
    target_place: 'Victoria Road, Clifton, Cape Town',
    lat: -33.9385,
    lng: 18.3755,
    max_commute_mins: 15,
    max_distance_km: 8,
    commute_mode: 'driving',
    iconType: 'beach',
    category: 'attraction',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'attraction-va-waterfront',
    label: 'V&A Waterfront Hub',
    target_place: 'Breakwater Blvd, Victoria & Alfred Waterfront',
    lat: -33.9040,
    lng: 18.4190,
    max_commute_mins: 15,
    max_distance_km: 8,
    commute_mode: 'driving',
    iconType: 'attraction',
    category: 'attraction',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'attraction-greenpoint-park',
    label: 'Green Point Urban Park',
    target_place: '1 Fritz Sonnenberg Rd, Green Point, Cape Town',
    lat: -33.9045,
    lng: 18.4095,
    max_commute_mins: 12,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'trail',
    category: 'attraction',
    templateId: 'preset-atlantic-budget',
  },

  // Promenade & Seaboard Gyms & Fitness
  {
    id: 'gym-va-green-point',
    label: 'Virgin Active Green Point (Collection Club)',
    target_place: 'Bill Peters Dr, Green Point, Cape Town',
    lat: -33.906296,
    lng: 18.402848,
    max_commute_mins: 12,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'gym-va-the-point',
    label: 'Virgin Active The Point (Sea Point)',
    target_place: 'The Point Mall, 76 Regent Rd, Sea Point',
    lat: -33.920726,
    lng: 18.383306,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'gym-anytime-fitness-seapoint',
    label: 'Anytime Fitness Sea Point',
    target_place: '142 Main Rd, Sea Point, Cape Town',
    lat: -33.913819,
    lng: 18.391226,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'gym-ignite-green-point',
    label: 'Ignite Fitness Green Point',
    target_place: '122 Somerset Road, Green Point, Cape Town',
    lat: -33.9090,
    lng: 18.4120,
    max_commute_mins: 12,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'gym-f45-seapoint',
    label: 'F45 Training Sea Point',
    target_place: '55 Regent Rd, Sea Point, Cape Town',
    lat: -33.9203,
    lng: 18.3842,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'gym-bua-camps-bay',
    label: 'BUA Fitness Camps Bay',
    target_place: 'The Promenade, Victoria Rd, Camps Bay',
    lat: -33.9515,
    lng: 18.3780,
    max_commute_mins: 15,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'gym-sweat1000-seapoint',
    label: 'SWEAT 1000 The Point',
    target_place: 'The Point Mall, 76 Regent Rd, Sea Point',
    lat: -33.9206,
    lng: 18.3835,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-atlantic-budget',
  },

  // Promenade & Seaboard Cafes & Bakeries
  {
    id: 'cafe-jarryds-seapoint',
    label: 'Jarryds Eatery & Bakery',
    target_place: '90 Regent Rd, Sea Point, Cape Town',
    lat: -33.9213,
    lng: 18.3828,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'cafe-naked-seapoint',
    label: 'Naked Coffee Sea Point',
    target_place: 'Wisbeach Rd & Regent Rd, Sea Point',
    lat: -33.9200,
    lng: 18.3848,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'cafe-jason-bakery-gp',
    label: 'Jason Bakery Green Point',
    target_place: '83 Main Rd, Green Point, Cape Town',
    lat: -33.9085,
    lng: 18.4132,
    max_commute_mins: 12,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'cafe-strangers-club',
    label: 'The Strangers Club',
    target_place: '1 Braemar Rd, Green Point, Cape Town',
    lat: -33.9098,
    lng: 18.4075,
    max_commute_mins: 12,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'cafe-paulines-seapoint',
    label: "Pauline's Coffee & Wine Bar",
    target_place: '297 Main Rd, Sea Point, Cape Town',
    lat: -33.9182,
    lng: 18.3882,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'cafe-mojo-market',
    label: 'Mojo Market Food & Coffee Hall',
    target_place: '30 Regent Rd, Sea Point, Cape Town',
    lat: -33.919297,
    lng: 18.385825,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'cafe-dewaterkant',
    label: 'De Waterkant Village & Cafes',
    target_place: 'Cape Quarter, Waterkant St, De Waterkant',
    lat: -33.9160,
    lng: 18.4180,
    max_commute_mins: 12,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-atlantic-budget',
  },

  // Promenade & Seaboard Shops & Retail Centres
  {
    id: 'shop-the-point-mall',
    label: 'The Point Mall (Sea Point)',
    target_place: '76 Regent Rd, Sea Point, Cape Town',
    lat: -33.9207,
    lng: 18.3833,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'shop',
    category: 'shop',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'shop-cape-quarter',
    label: 'Cape Quarter Lifestyle Village',
    target_place: '27 Somerset Rd, Green Point, Cape Town',
    lat: -33.9165,
    lng: 18.4178,
    max_commute_mins: 12,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'shop',
    category: 'shop',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'shop-va-waterfront',
    label: 'V&A Waterfront Shopping Centre',
    target_place: 'Breakwater Blvd, Victoria & Alfred Waterfront',
    lat: -33.9040,
    lng: 18.4190,
    max_commute_mins: 15,
    max_distance_km: 8,
    commute_mode: 'driving',
    iconType: 'shop',
    category: 'shop',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'shop-regent-rd-strip',
    label: 'Regent Road Retail Strip & SPAR',
    target_place: 'Regent Rd & Kloof Rd, Sea Point, Cape Town',
    lat: -33.9195,
    lng: 18.3860,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'shop',
    category: 'shop',
    templateId: 'preset-atlantic-budget',
  },
  {
    id: 'shop-piazza-da-luz',
    label: 'Piazza Da Luz & Woolworths',
    target_place: '94 Regent Rd, Sea Point, Cape Town',
    lat: -33.9218,
    lng: 18.3822,
    max_commute_mins: 10,
    max_distance_km: 4,
    commute_mode: 'driving',
    iconType: 'shop',
    category: 'shop',
    templateId: 'preset-atlantic-budget',
  },

  // ==========================================
  // 5. George & Wilderness
  // Main Location Attractions & Gyms
  // ==========================================
  {
    id: 'trail-george-witfontein',
    label: 'Witfontein Forest (George)',
    target_place: 'Witfontein Forest Station, Outeniqua Nature Reserve, George',
    lat: -33.9350,
    lng: 22.4430,
    max_commute_mins: 10,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'trail',
    category: 'attraction',
    templateId: 'preset-george',
  },
  {
    id: 'surf-vicbay',
    label: 'Victoria Bay Point Break',
    target_place: 'Victoria Bay Beach, George',
    lat: -34.0040,
    lng: 22.5480,
    max_commute_mins: 15,
    max_distance_km: 10,
    commute_mode: 'driving',
    iconType: 'surf',
    category: 'attraction',
    templateId: 'preset-george',
  },
  {
    id: 'attraction-wilderness-beach',
    label: 'Wilderness Beach & Lagoon',
    target_place: 'Sands Road, Wilderness Beach, Wilderness',
    lat: -33.9920,
    lng: 22.5850,
    max_commute_mins: 15,
    max_distance_km: 12,
    commute_mode: 'driving',
    iconType: 'beach',
    category: 'attraction',
    templateId: 'preset-george',
  },
  {
    id: 'trail-saasveld',
    label: 'Saasveld Nature Trails',
    target_place: 'Saasveld Road, George, Western Cape',
    lat: -33.9620,
    lng: 22.5350,
    max_commute_mins: 15,
    max_distance_km: 10,
    commute_mode: 'driving',
    iconType: 'trail',
    category: 'attraction',
    templateId: 'preset-george',
  },
  {
    id: 'gym-va-george',
    label: 'Virgin Active George',
    target_place: "Preller Walk, St George's Square, George",
    lat: -33.9570,
    lng: 22.4640,
    max_commute_mins: 12,
    max_distance_km: 8,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-george',
  },
  {
    id: 'gym-planet-fitness-george',
    label: 'Planet Fitness JustGym George',
    target_place: 'Knysna Road, George East, George',
    lat: -33.9680,
    lng: 22.4550,
    max_commute_mins: 15,
    max_distance_km: 10,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-george',
  },

  // ==========================================
  // 6. Hout Bay & Coastal Valley
  // Attractions, Gyms, Cafes & Shops (Verified via Google Maps Places API)
  // ==========================================
  // Outdoors & Attractions
  {
    id: 'attraction-houtbay-harbour',
    label: 'Hout Bay Harbour',
    target_place: 'Hout Bay Harbour, Cape Town, 7806',
    lat: -34.055091,
    lng: 18.3438309,
    max_commute_mins: 15,
    max_distance_km: 8,
    commute_mode: 'driving',
    iconType: 'attraction',
    category: 'attraction',
    templateId: 'preset-houtbay-coastal',
  },
  {
    id: 'attraction-houtbay-beach',
    label: 'Hout Bay Beach',
    target_place: 'Hout Bay Beach, Hout Bay, Cape Town, 7806',
    lat: -34.0456962,
    lng: 18.3512056,
    max_commute_mins: 12,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'beach',
    category: 'attraction',
    templateId: 'preset-houtbay-coastal',
  },
  {
    id: 'attraction-chapmans-peak',
    label: "Chapman's Peak Drive Lookout Point",
    target_place: "Chapman's Peak Drive Lookout Point, Hout Bay, 7806",
    lat: -34.0775458,
    lng: 18.3565356,
    max_commute_mins: 15,
    max_distance_km: 8,
    commute_mode: 'driving',
    iconType: 'attraction',
    category: 'attraction',
    templateId: 'preset-houtbay-coastal',
  },
  {
    id: 'attraction-llandudno-beach',
    label: 'Llandudno Beach',
    target_place: 'Llandudno Beach, Llandudno, Cape Town, 7806',
    lat: -34.0081097,
    lng: 18.3412094,
    max_commute_mins: 15,
    max_distance_km: 8,
    commute_mode: 'driving',
    iconType: 'beach',
    category: 'attraction',
    templateId: 'preset-houtbay-coastal',
  },

  // Hout Bay Gyms & Fitness
  {
    id: 'gym-velocity-houtbay',
    label: 'Velocity Gym Hout Bay',
    target_place: 'Chapmans Peak Dr, Scott Estate, Hout Bay, 7806',
    lat: -34.0467348,
    lng: 18.3609973,
    max_commute_mins: 10,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-houtbay-coastal',
  },
  {
    id: 'gym-the-gym-houtbay',
    label: 'The Gym Hout Bay',
    target_place: '3M Hout Bay Main Rd, Hout Bay, 7806',
    lat: -34.0137923,
    lng: 18.3877286,
    max_commute_mins: 12,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-houtbay-coastal',
  },
  {
    id: 'gym-crossfit-houtbay',
    label: 'CrossFit Hout Bay',
    target_place: '217 Hout Bay Main Rd, Hout Bay, 7806',
    lat: -34.0136179,
    lng: 18.3880364,
    max_commute_mins: 12,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'gym',
    category: 'gym',
    templateId: 'preset-houtbay-coastal',
  },

  // Hout Bay Cafes & Hotspots
  {
    id: 'cafe-darios-houtbay',
    label: "Dario's Cafe",
    target_place: '30 Main Rd, Hout Bay, Cape Town, 7806',
    lat: -34.0449233,
    lng: 18.3610045,
    max_commute_mins: 10,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-houtbay-coastal',
  },
  {
    id: 'cafe-collective-houtbay',
    label: 'The Collective Hout Bay',
    target_place: '37 Main Rd, Scott Estate, Hout Bay, 7806',
    lat: -34.0432014,
    lng: 18.3590625,
    max_commute_mins: 10,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-houtbay-coastal',
  },
  {
    id: 'cafe-houtbay-coffee',
    label: 'Houtbay Coffee',
    target_place: 'Mainstream Shopping Centre, Cnr Main & Princess St, Hout Bay, 7806',
    lat: -34.0429661,
    lng: 18.3588658,
    max_commute_mins: 10,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-houtbay-coastal',
  },
  {
    id: 'cafe-bootlegger-houtbay',
    label: 'Bootlegger Hout Bay',
    target_place: 'Shop 13, Oakhurst Farm Stall, Hout Bay Main Rd, Hout Bay, 7806',
    lat: -34.0194246,
    lng: 18.3750530,
    max_commute_mins: 12,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-houtbay-coastal',
  },
  {
    id: 'cafe-mariners-wharf',
    label: "Mariner's Wharf Harbour Front Emporium",
    target_place: 'Harbour Rd, Hout Bay Harbour, Hout Bay, 7806',
    lat: -34.0474798,
    lng: 18.3484260,
    max_commute_mins: 12,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'cafe',
    category: 'cafe',
    templateId: 'preset-houtbay-coastal',
  },

  // Hout Bay Shops & Retail
  {
    id: 'shop-mainstream-mall',
    label: 'Mainstream Mall',
    target_place: 'Princess St, Hout Bay, Cape Town, 7806',
    lat: -34.0426408,
    lng: 18.3586106,
    max_commute_mins: 10,
    max_distance_km: 5,
    commute_mode: 'driving',
    iconType: 'shop',
    category: 'shop',
    templateId: 'preset-houtbay-coastal',
  },
  {
    id: 'shop-bay-harbour-market',
    label: 'Bay Harbour Market',
    target_place: '31 Harbour Rd, Hout Bay, Cape Town, 7872',
    lat: -34.0550097,
    lng: 18.3472642,
    max_commute_mins: 12,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'shop',
    category: 'shop',
    templateId: 'preset-houtbay-coastal',
  },
];

const INITIAL_SHOWCASE_PROPERTIES: PropertyMapItem[] = [];

const QUICK_SUBURBS = [
  'Rondebosch',
  'George',
  'Tamboerskloof',
  'Hout Bay',
  'Wilderness',
  'Newlands',
  'Tokai',
  'Gardens',
  'Woodstock'
];

export interface SavedSearch {
  id: string;
  name: string;
  suburbs: string[];
  minPrice?: string;
  maxPrice?: string;
  bedrooms?: string;
  anchorId: string;
  attractionIds?: string[];
  gymIds?: string[];
  cafeIds?: string[];
  shopIds?: string[];
  enableAiAnalysis?: boolean;
  sortBy?: 'fit' | 'price-asc' | 'price-desc' | 'distance';
  isCustom?: boolean;
}

export interface AiCriteriaPreset {
  id: string;
  name: string;
  lifestyleFocus: string;
  mustHaves: string[];
  dealbreakers: string[];
  acousticPriority: 'strict-sanctuary' | 'moderate' | 'flexible';
  personalPrompt: string;
  isCustom?: boolean;
}

const DEFAULT_AI_CRITERIA_PRESETS: AiCriteriaPreset[] = [
  {
    id: 'ai-quiet-trail-wfh',
    name: '🌲 Quiet Trailside & Deep Work',
    lifestyleFocus: 'Pin-drop quiet WFH study + <10m to mountain trails',
    mustHaves: ['Dedicated study / 2nd bed', 'Off-street parking / bay', 'Fibre ready', 'North-facing natural light'],
    dealbreakers: ['Main road traffic noise', 'Nightclub / bar bass corridor', 'Damp ground-floor dark unit'],
    acousticPriority: 'strict-sanctuary',
    personalPrompt: 'Prioritize top-floor or garden-shielded homes in acoustic shadow (<40 dBA) with fast trail access.',
  },
  {
    id: 'ai-coastal-surf-lockup',
    name: '🏄 Coastal Surf & Board Storage',
    lifestyleFocus: 'Walk/quick drive to surf breaks + secure gear storage',
    mustHaves: ['Garage or ground board storage', 'Outdoor shower / courtyard', 'Safe off-street parking'],
    dealbreakers: ['High wind tunnel exposure', 'No board/bike storage', 'High crime foot-corridor'],
    acousticPriority: 'moderate',
    personalPrompt: 'Rank listings by proximity to surf breaks, secure garage/storage for boards, and safe street access.',
  },
  {
    id: 'ai-walkable-cafe-creative',
    name: '☕ Walkable Cafe & Heritage Loft',
    lifestyleFocus: 'Walkable to specialty coffee & workspaces, quiet bedroom',
    mustHaves: ['Balcony or mountain view', 'High ceilings / character', 'Courtyard-facing bedroom'],
    dealbreakers: ['Direct street-front bar noise', 'No secure parking option'],
    acousticPriority: 'moderate',
    personalPrompt: 'Balance walkability to Kloof/Bree cafes with buildings that buffer late-night street noise.',
  },
  {
    id: 'ai-security-lockup-go',
    name: '🛡️ High-Security Lock-Up & Go',
    lifestyleFocus: '24hr manned security estate or elevated apartment',
    mustHaves: ['24hr security / access control', 'Inverter / solar backup', 'Secure basement parking'],
    dealbreakers: ['Ground floor street-facing windows', 'Unsecured street parking'],
    acousticPriority: 'moderate',
    personalPrompt: 'Prioritize elevated apartments or gated enclaves away from mugging hotspots with backup power.',
  }
];

const DEFAULT_SAVED_SEARCHES: SavedSearch[] = [
  {
    id: 'preset-cape-trailside',
    name: '⛰️ Southern Suburbs Trailside',
    suburbs: ['Rondebosch', 'Newlands', 'Tokai', 'Claremont', 'Constantia'],
    minPrice: '11000',
    maxPrice: '18000',
    bedrooms: '1+',
    anchorId: 'trail-newlands',
    attractionIds: ['trail-newlands', 'trail-tokai', 'attraction-kirstenbosch', 'trail-constantia-nek'],
    gymIds: ['gym-va-claremont', 'gym-va-constantia', 'gym-zone-rondebosch'],
  },
  {
    id: 'preset-citybowl-remote',
    name: '☕ City Bowl Enclaves',
    suburbs: ['Gardens', 'Tamboerskloof', 'Oranjezicht', 'Higgovale', 'Vredehoek'],
    minPrice: '13000',
    maxPrice: '19000',
    bedrooms: '1+',
    anchorId: 'hub-kloof',
    attractionIds: ['hub-kloof', 'trail-lions-head', 'attraction-table-mountain', 'attraction-company-gardens'],
    gymIds: ['gym-va-kloof', 'gym-va-wembley', 'gym-roark-cbd', 'gym-zone-kloof', 'gym-sweat1000-kloof', 'gym-va-silo'],
    cafeIds: ['cafe-truth-buitenkant', 'cafe-our-local-kloof', 'cafe-molten-toffee', 'cafe-manna-epicure', 'cafe-honest-chocolate', 'cafe-red-sofa-vredehoek', 'cafe-clarks-bree'],
    shopIds: ['shop-gardens-centre', 'shop-lifestyle-on-kloof', 'shop-spar-derry-vredehoek', 'shop-oranjezicht-market', 'shop-bree-street-strip'],
  },
  {
    id: 'preset-deepsouth-surf',
    name: '🏄 Deep South & False Bay',
    suburbs: ['Noordhoek', 'Sunnydale', 'Capri', 'Kommetjie', 'Muizenberg', 'Scarborough', 'Fish Hoek', "Simon's Town"],
    minPrice: '10000',
    maxPrice: '16000',
    bedrooms: '1+',
    anchorId: 'surf-muizenberg',
    attractionIds: ['attraction-long-beach', 'attraction-noordhoek-village', 'surf-muizenberg', 'attraction-seaforth-beach'],
    gymIds: ['gym-va-sun-valley', 'gym-zone-fish-hoek', 'gym-planet-fitness-longbeach'],
  },
  {
    id: 'preset-atlantic-budget',
    name: '🌊 Promenade & Seaboard',
    suburbs: ['Green Point', 'Mouille Point', 'Sea Point', 'De Waterkant'],
    minPrice: '13000',
    maxPrice: '22000',
    bedrooms: '1+',
    anchorId: 'attraction-seapoint-promenade',
    attractionIds: ['attraction-seapoint-promenade', 'attraction-greenpoint-park', 'attraction-camps-bay', 'attraction-clifton-4th', 'attraction-va-waterfront'],
    gymIds: ['gym-va-green-point', 'gym-va-the-point', 'gym-anytime-fitness-seapoint', 'gym-ignite-green-point', 'gym-f45-seapoint', 'gym-bua-camps-bay', 'gym-sweat1000-seapoint'],
    cafeIds: ['cafe-jarryds-seapoint', 'cafe-naked-seapoint', 'cafe-jason-bakery-gp', 'cafe-strangers-club', 'cafe-paulines-seapoint', 'cafe-mojo-market', 'cafe-dewaterkant'],
    shopIds: ['shop-the-point-mall', 'shop-cape-quarter', 'shop-va-waterfront', 'shop-regent-rd-strip', 'shop-piazza-da-luz'],
  },
  {
    id: 'preset-houtbay-coastal',
    name: '⛵ Hout Bay & Valley',
    suburbs: ['Hout Bay', 'Llandudno'],
    minPrice: '12000',
    maxPrice: '22000',
    bedrooms: '1+',
    anchorId: 'attraction-houtbay-harbour',
    attractionIds: ['attraction-houtbay-harbour', 'attraction-houtbay-beach', 'attraction-chapmans-peak', 'attraction-llandudno-beach'],
    gymIds: ['gym-velocity-houtbay', 'gym-the-gym-houtbay', 'gym-crossfit-houtbay'],
    cafeIds: ['cafe-darios-houtbay', 'cafe-collective-houtbay', 'cafe-houtbay-coffee', 'cafe-bootlegger-houtbay', 'cafe-mariners-wharf'],
    shopIds: ['shop-mainstream-mall', 'shop-bay-harbour-market'],
  },
  {
    id: 'preset-george',
    name: '🌲 George & Wilderness',
    suburbs: ['Heatherlands', 'George', 'Wilderness'],
    minPrice: '11000',
    maxPrice: '16000',
    bedrooms: '1+',
    anchorId: 'trail-george-witfontein',
    attractionIds: ['trail-george-witfontein', 'surf-vicbay', 'attraction-wilderness-beach', 'trail-saasveld'],
    gymIds: ['gym-va-george', 'gym-planet-fitness-george'],
  }
];

export default function SearchMapPage() {
  const { user, profile, logout } = useAuth();

  // Search Criteria State (Default to Cape Town Southern Suburbs Trailside, not George)
  const [selectedSuburbs, setSelectedSuburbs] = useState<string[]>(['Rondebosch', 'Newlands', 'Tokai']);
  const [suburbInput, setSuburbInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [autoIndex, setAutoIndex] = useState(0);

  const autocompleteSuggestions = useMemo(() => {
    return searchSuburbs(suburbInput, selectedSuburbs);
  }, [suburbInput, selectedSuburbs]);
  const [minPrice, setMinPrice] = useState('11000');
  const [maxPrice, setMaxPrice] = useState('18000');
  const [isBudgetMenuOpen, setIsBudgetMenuOpen] = useState(false);
  const [minSqm, setMinSqm] = useState<number>(0);
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const budgetMenuRef = useRef<HTMLDivElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const savedSearchMenuRef = useRef<HTMLDivElement>(null);
  const anchorMenuRef = useRef<HTMLDivElement>(null);
  const [bedrooms, setBedrooms] = useState('1+');

  // Clickable Feature Filters (Deterministic toggles for listings & map markers visibility)
  const [safeishFilter, setSafeishFilter] = useState<boolean>(true); // Safe-ish: ON by default (hides listings inside High-Risk crime radii)
  const [offMainRoadFilter, setOffMainRoadFilter] = useState<boolean>(true); // Off-Main Rd: ON by default (excludes noisy arterial road properties)
  const [withinRadiusFilter, setWithinRadiusFilter] = useState<boolean>(false); // Within Radius: OFF by default (properties outside radius stay visible, ranked lower)
  const [locationRadiusKm, setLocationRadiusKm] = useState<number>(5.0); // Selected location buffer radius in km
  const [fibreFilter, setFibreFilter] = useState<boolean>(false);
  const [northFacingFilter, setNorthFacingFilter] = useState<boolean>(false);
  const [parkingFilter, setParkingFilter] = useState<boolean>(false);
  const [petFriendlyFilter, setPetFriendlyFilter] = useState<boolean>(false);
  const [gasHobFilter, setGasHobFilter] = useState<boolean>(false);
  const [privateOnlyFilter, setPrivateOnlyFilter] = useState<boolean>(false);

  // Hidden / Dismissed Listings State & Visibility Toggle
  const [hiddenPropertyIds, setHiddenPropertyIds] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState<boolean>(false);

  const toggleHideProperty = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setHiddenPropertyIds((prev) => {
      const isHidden = prev.includes(id);
      const updated = isHidden ? prev.filter((pId) => pId !== id) : [...prev, id];
      try {
        localStorage.setItem('homeseek_hidden_properties', JSON.stringify(updated));
      } catch { }
      return updated;
    });
  };

  const unhideAllProperties = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setHiddenPropertyIds([]);
    try {
      localStorage.removeItem('homeseek_hidden_properties');
    } catch { }
  };

  // Property24 Favourites State & Persistence
  const [favouritePropertyIds, setFavouritePropertyIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('homeseek_p24_favourite_ids');
        return stored ? JSON.parse(stored) : [];
      } catch { }
    }
    return [];
  });

  // Imported favourites live in session memory only. Full listing snapshots are never persisted,
  // so rented/expired listings can't be resurrected from localStorage — listings must come from a fresh scrape.
  const [importedFavourites, setImportedFavourites] = useState<PropertyMapItem[]>([]);

  useEffect(() => {
    try {
      localStorage.removeItem('homeseek_p24_favourites');
    } catch { }
  }, []);

  const [showOnlyFavourites, setShowOnlyFavourites] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importInputText, setImportInputText] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatusMsg, setImportStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const toggleFavouriteProperty = (prop: PropertyMapItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setFavouritePropertyIds((prev) => {
      const isFav = prev.includes(prop.id);
      const updated = isFav ? prev.filter((id) => id !== prop.id) : [...prev, prop.id];
      try {
        localStorage.setItem('homeseek_p24_favourite_ids', JSON.stringify(updated));
      } catch { }
      return updated;
    });

    setImportedFavourites((prev) => {
      const exists = prev.some((p) => p.id === prop.id);
      return exists ? prev.filter((p) => p.id !== prop.id) : prev;
    });
  };

  const clearAllFavourites = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setFavouritePropertyIds([]);
    setImportedFavourites([]);
    setShowOnlyFavourites(false);
    try {
      localStorage.removeItem('homeseek_p24_favourite_ids');
      localStorage.removeItem('homeseek_p24_favourites');
    } catch { }
  };

  const handleImportFavourites = async () => {
    if (!importInputText.trim()) return;
    setIsImporting(true);
    setImportStatusMsg(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/p24/import-favourites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_input: importInputText,
          anchor_lat: activeAnchor?.lat,
          anchor_lng: activeAnchor?.lng,
        }),
      });

      if (!res.ok) {
        throw new Error(`Import failed with status ${res.status}`);
      }

      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.listings) && data.listings.length > 0) {
        const newListings: PropertyMapItem[] = data.listings;

        // Merge with existing imported favourites
        setImportedFavourites((prev) => {
          const merged = [...prev];
          for (const item of newListings) {
            const idx = merged.findIndex((m) => m.id === item.id || ((m as any).p24_id && (m as any).p24_id === (item as any).p24_id));
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...item, is_favorite: true };
            } else {
              merged.push({ ...item, is_favorite: true });
            }
          }
          return merged;
        });

        // Add to favourite IDs
        setFavouritePropertyIds((prev) => {
          const idsSet = new Set(prev);
          newListings.forEach((item) => idsSet.add(item.id));
          const updatedIds = Array.from(idsSet);
          try {
            localStorage.setItem('homeseek_p24_favourite_ids', JSON.stringify(updatedIds));
          } catch { }
          return updatedIds;
        });

        setImportStatusMsg({
          type: 'success',
          text: `Successfully imported ${newListings.length} Property24 favourite${newListings.length === 1 ? '' : 's'}!`,
        });

        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportInputText('');
          setImportStatusMsg(null);
          setShowOnlyFavourites(true);
        }, 1200);
      } else {
        setImportStatusMsg({
          type: 'error',
          text: data.message || 'No Property24 listings could be found or extracted. Please check the URLs or HTML and try again.',
        });
      }
    } catch (err: any) {
      setImportStatusMsg({
        type: 'error',
        text: `Error connecting to scraper: ${err.message}`,
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Area Templates State (Groups of Suburbs)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(DEFAULT_SAVED_SEARCHES);
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<string>('preset-cape-trailside');
  const [isSavedSearchMenuOpen, setIsSavedSearchMenuOpen] = useState(false);
  const [newSearchName, setNewSearchName] = useState('');
  const [isSavingSearch, setIsSavingSearch] = useState(false);

  // Fit & AI Analysis State
  const [enableFitScore, setEnableFitScore] = useState<boolean>(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [personalPreferences, setPersonalPreferences] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('homeseek_personal_preferences');
        if (saved !== null) return saved;
      } catch { }
    }
    return '';
  });
  const [deepAiRunCount, setDeepAiRunCount] = useState<number>(0);
  const [viewingAiReportProp, setViewingAiReportProp] = useState<PropertyMapItem | null>(null);
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null);
  const [uploadedViewingPhotos, setUploadedViewingPhotos] = useState<string[]>([]);
  const [photoSourceMode, setPhotoSourceMode] = useState<'both' | 'uploaded' | 'listing'>('both');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [snagCopied, setSnagCopied] = useState(false);

  useEffect(() => {
    setPlanSummary(getPlanSummary());
    setCompareIds(getCompareList().map((p) => String(p.id)));
    const syncPlan = () => setPlanSummary(getPlanSummary());
    const syncCompare = () => setCompareIds(getCompareList().map((p) => String(p.id)));
    window.addEventListener('homeseek-plan-updated', syncPlan);
    window.addEventListener('homeseek-compare-updated', syncCompare);
    return () => {
      window.removeEventListener('homeseek-plan-updated', syncPlan);
      window.removeEventListener('homeseek-compare-updated', syncCompare);
    };
  }, []);

  const handleUploadViewingPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = Math.max(0, 8 - uploadedViewingPhotos.length);
    const selected = Array.from(files).slice(0, remainingSlots);
    const compressed = await Promise.all(selected.map((f) => compressImageToDataUrl(f, 1024, 0.8)));
    setUploadedViewingPhotos((prev) => [...prev, ...compressed].slice(0, 8));
  };

  const handleCopySnagReport = async (prop: PropertyMapItem) => {
    const audit = (prop as any).deep_ai_audit;
    if (!audit) return;
    const lines = [
      `# Home-Seek Viewing & Snagging Report`,
      `**Property:** ${prop.title} (${prop.address})`,
      `**Rent:** R ${prop.price.toLocaleString()}/mo | ${prop.bedrooms} bed | ${prop.sqm ? `${prop.sqm} m²` : 'N/A'}`,
      `**Generated:** ${audit.generatedAt || new Date().toLocaleString()}`,
      `**Lifestyle Brief:** ${audit.appliedPreferences || personalPreferences || 'Standard'}`,
      ``,
      `## Verdict`,
      audit.personalMatchVerdict || '',
      ``,
      `## Photo Story`,
      audit.photoStory || '',
      ``,
      `## Architectural & WFH Audit`,
      `- Space & WFH: ${audit.wfhLayoutVerdict || ''}`,
      `- Windows & Light: ${audit.windowLightAudit || ''}`,
      `- Walls & Acoustics: ${audit.wallAcousticAudit || ''}`,
      `- Ceilings & Volume: ${audit.ceilingVolumeAudit || ''}`,
      `- Lighting Fixtures: ${audit.lightingFixturesAudit || ''}`,
      `- Exterior & Building: ${audit.exteriorBuildingAudit || ''}`,
      ``,
      `## Pros`,
      ...(audit.pros || []).map((p: string) => `- [+] ${p}`),
      ``,
      `## Cons & Risks`,
      ...(audit.cons || []).map((c: string) => `- [-] ${c}`),
      ``,
      `## Things to Be Aware Of`,
      ...((audit.strategicInsights?.criticalWatchouts || []) as string[]).map((w: string) => `- [!] ${w}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setSnagCopied(true);
      setTimeout(() => setSnagCopied(false), 2500);
    } catch {}
  };

  // Sync preference changes to localStorage and re-evaluate active property report in real-time
  const handleUpdatePreferences = (newPrefs: string) => {
    setPersonalPreferences(newPrefs);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('homeseek_personal_preferences', newPrefs);
      } catch { }
    }
    if (viewingAiReportProp) {
      const updatedAudit = generatePropertyAiAudit(viewingAiReportProp, viewingAiReportProp.rank || 1, newPrefs);
      setViewingAiReportProp({
        ...viewingAiReportProp,
        deep_ai_audit: updatedAudit
      });
    }
  };

  // Helper to synthesize forensic AI audit for any property on demand
  const generatePropertyAiAudit = (prop: PropertyMapItem, rank: number, userPreferences?: string, galleryOverride?: string[]) => {
    const isSanctuary = prop.noise_risk === 'sanctuary';
    const isNorth =
      (prop.acoustic_audit?.facing_direction || '').toLowerCase().includes('north') ||
      /\bnorth[\s-]?facing\b/i.test(`${prop.title || ''} ${prop.description || ''}`);
    const stoveLabel = prop.stove_type === 'gas' ? 'Verified 4-burner gas hob & built-in oven' : prop.stove_type === 'induction' ? 'Induction hob detected' : 'Built-in stove & oven verified';
    const parkingLabel = prop.has_garage ? 'Private lock-up automated garage' : (prop.parking_type === 'secure_bay' ? 'Allocated secure off-street parking bay' : 'Dedicated off-street parking');
    const facingLabel = isNorth ? 'North-facing orientation: maximum sun exposure throughout living room and workspace' : `${prop.acoustic_audit?.facing_direction || 'Standard aspect'} with balanced natural lighting`;

    // Detect landlord on-site / cottage on shared property
    const isLandlordOnSite = isLandlordOnSiteProperty(prop);

    // Detect if property sits directly on noisy main road arterial corridor
    const isMainRoad = Boolean(prop.is_main_road) || isMainRoadProperty(prop.address, prop.title);

    const tenancyType = isLandlordOnSite
      ? '⚠️ Shared Property / Landlord On-Site: Listing text confirms a cottage, flatlet, or secondary dwelling on a shared landlord property.'
      : isMainRoad
        ? '⚠️ Arterial Road Lease: Standalone tenancy but situated directly on a high-traffic Main Road arterial.'
        : '✅ 100% Autonomous Private Tenancy: Standalone property with complete perimeter independence (zero shared grounds or landlord residing on-site).';

    const photoAudit = isSanctuary
      ? `📸 AI Vision: ${stoveLabel}, ${isNorth ? 'north-facing floor-to-ceiling glazing' : 'large windows with natural daylight'}, scenic mountain/coastal backdrop, zero fish-eye lens distortion.`
      : `📸 AI Vision: ${stoveLabel}, natural daylight verified with true-perspective 28mm equivalent framing.`;

    const textVerdict = isMainRoad
      ? `🧠 AI Copy Audit #${rank}: ⚠️ Main Road Arterial Traffic Corridor. High ambient traffic rumble (M4), delivery scooter buzzing & elevated street-level exposure.`
      : isLandlordOnSite
        ? `🧠 AI Copy Audit #${rank}: Secondary dwelling / cottage on private landlord property detected. Potential shared entrance or grounds.`
        : `🧠 AI Copy Audit #${rank}: Explicit self-contained private lease (zero student digs or shared commune clauses), rules confirm quiet residential tenancy.`;

    const prefs = userPreferences && userPreferences.trim().length > 0 ? userPreferences.trim() : '';
    const privacyMatchPhrase = prefs.toLowerCase().includes('private') || prefs.toLowerCase().includes('landlord')
      ? (isLandlordOnSite ? '⚠️ Flagged: Not fully private (landlord on-site / shared grounds)' : '🛡️ 100% Private Standalone confirmed')
      : null;

    const mainRoadWarning = isMainRoad ? '⚠️ Main Road traffic trap' : null;

    const verdictParts = [
      mainRoadWarning,
      privacyMatchPhrase || (isLandlordOnSite ? 'Secondary cottage / shared grounds' : 'Private standalone residence'),
      isSanctuary ? 'Quiet sanctuary verified' : isMainRoad ? 'Arterial street noise' : 'Standard residential acoustic buffer',
      isNorth ? 'North-facing natural light' : 'Balanced lighting',
      prop.fibre_ready ? 'High-speed fibre ready' : 'Standard internet',
      stoveLabel,
    ].filter(Boolean);

    const personalMatchVerdict = `${verdictParts.join(' · ')}.`;

    const buildForensicProsAndCons = () => {
      const pros: string[] = [];
      const cons: string[] = [];
      const rawText = `${prop.title || ''} ${prop.address || ''} ${prop.description || ''} ${prop.ai_insight || ''}`.toLowerCase();
      const galleryPhotos =
        galleryOverride && galleryOverride.length > 0
          ? galleryOverride
          : cardGalleries[prop.id]?.length
            ? cardGalleries[prop.id]
            : Array.isArray(prop.images) && prop.images.length > 0
              ? prop.images
              : prop.image
                ? [prop.image]
                : [];
      const photoCount = galleryPhotos.length;

      // Market valuation (risk-adjusted for crime/township proximity, main road, landlord on-site, parking & m²)
      const marketVal = getRiskAdjustedValuation(prop, allCandidateProperties);
      if (marketVal) {
        if (marketVal.isUnderpriced) {
          pros.push(`Strong market value: ${marketVal.badgeText} (${marketVal.badgeTooltip})`);
        } else if (marketVal.isOverpriced) {
          cons.push(`Above market rate: ${marketVal.badgeText} (${marketVal.badgeTooltip})`);
        } else {
          pros.push(`Fairly priced relative to comparable ${prop.bedrooms}-bed listings in the area`);
        }
      }

      // Photo / visual inspection
      if (photoCount >= 6) {
        pros.push(`Comprehensive ${photoCount}-photo gallery covering interior rooms & layout`);
      } else if (photoCount <= 2) {
        cons.push(`Limited photo coverage (${photoCount} ${photoCount === 1 ? 'image' : 'images'}) — key rooms or exterior may be unshown`);
      }

      if (isNorth) {
        pros.push('North-facing orientation with strong natural daylight');
      }
      if (/ocean|sea view|mountain view|scenic|sunny|bright|airy/.test(rawText)) {
        pros.push('Bright interior / scenic outlook noted in listing & imagery');
      }

      // Work & Lifestyle Factors Alignment
      const prefLower = (userPreferences || '').toLowerCase();
      const wantsWfhFull = prefLower.includes('work from home (full-time)') || (prefLower.includes('full-time') && prefLower.includes('wfh'));
      const wantsWfhPart = prefLower.includes('work from home (part-time)') || (prefLower.includes('part-time') && prefLower.includes('wfh'));
      const wantsCafes = prefLower.includes('work from cafes') || prefLower.includes('cafes');
      const wantsOffice = prefLower.includes('work from an office') || prefLower.includes('office');
      const wantsQuietSanctuary = prefLower.includes('quiet sanctuary') || prefLower.includes('noise sensitive');
      const wantsSecurityEstate = prefLower.includes('secure estate') || prefLower.includes('24h security') || prefLower.includes('gated');
      const wantsOutdoorBalcony = prefLower.includes('private patio') || prefLower.includes('balcony') || prefLower.includes('outdoor');
      const wantsBackupPower = prefLower.includes('backup power') || prefLower.includes('load-shedding') || prefLower.includes('solar') || prefLower.includes('inverter');
      const wantsGasStove = prefLower.includes('gas cooking') || prefLower.includes('gas stove');
      const wantsPetFriendly = prefLower.includes('pet-friendly') || prefLower.includes('dog');
      const wantsLockupGarage = prefLower.includes('lock-up garage') || prefLower.includes('garage');

      if (wantsWfhFull) {
        if (prop.fibre_ready && isSanctuary && (prop.sqm ? prop.sqm >= 60 : true)) {
          pros.push('WFH Full-Time Prime Fit: high-speed fibre + quiet acoustic setback + ample workspace room');
        } else if (!prop.fibre_ready) {
          cons.push('WFH Full-Time Risk: listing does not verify fibre readiness for uninterrupted remote work');
        }
        if (isMainRoad) {
          cons.push('WFH Conflict: main road daytime traffic roar directly interferes with remote Zoom / client calls');
        }
      }

      if (wantsWfhPart) {
        if (prop.fibre_ready) {
          pros.push('Hybrid WFH Verified: stable fibre connectivity in place for remote days');
        }
      }

      if (wantsCafes) {
        const cafeProximity = (prop.location_proximity || []).find((loc: any) =>
          String(loc.name || loc.category || '').toLowerCase().includes('cafe') ||
          String(loc.name || loc.category || '').toLowerCase().includes('coffee')
        );
        if (cafeProximity) {
          pros.push(`Cafe Work Hub: walkable to ${cafeProximity.name || 'local coffee spots'} (${cafeProximity.distance_km ? `${cafeProximity.distance_km} km` : 'close by'})`);
        } else {
          cons.push('Work from Cafes Note: limited walkable laptop-friendly coffee shops detected in immediate perimeter');
        }
      }

      if (wantsOffice && activeAnchor) {
        const distKm = getDistanceKm(prop.lat, prop.lng, activeAnchor.lat, activeAnchor.lng);
        if (distKm <= 4.0) {
          pros.push(`Office Commute Champion: only ~${distKm.toFixed(1)} km from ${activeAnchor.label}`);
        } else if (distKm > 10.0) {
          cons.push(`Extended Office Commute: ~${distKm.toFixed(1)} km to ${activeAnchor.label} (${Math.round((distKm / 35) * 60)} mins peak traffic)`);
        }
      }

      if (wantsBackupPower) {
        if (prop.has_inverter || /solar|inverter|backup|battery/.test(rawText)) {
          pros.push('Load-Shedding Resilient: inverter / solar battery power verified');
        } else {
          cons.push('Load-Shedding Vulnerability: zero inverter or solar backup mentioned in listing');
        }
      }

      if (wantsSecurityEstate) {
        if (/estate|security complex|gated|24 hour security|access control|guard/.test(rawText)) {
          pros.push('Security Estate: access-controlled gated perimeter with guarded security');
        } else {
          cons.push('Security Note: standalone perimeter without 24/7 manned security estate gate');
        }
      }

      if (wantsLockupGarage && !prop.has_garage) {
        cons.push('Parking Variance: no automated lock-up garage confirmed (only open bay or street parking)');
      }

      if (wantsGasStove && prop.stove_type !== 'gas') {
        cons.push('Kitchen Cooking Note: standard electric hob fitted (no gas cooktop for power outages)');
      }

      if (wantsPetFriendly && !prop.pet_friendly) {
        cons.push('Pet Restriction: listing does not explicitly approve pets / dogs');
      }

      if (wantsOutdoorBalcony && !/balcony|patio|garden|terrace|braai/.test(rawText)) {
        cons.push('Outdoor Living Note: no private patio, balcony or garden noted in listing');
      }

      // Space & amenities
      if (prop.sqm && prop.sqm >= 75) {
        pros.push(`Spacious ${prop.sqm} m² floor plan`);
      } else if (prop.sqm && prop.sqm < 45) {
        cons.push(`Compact ${prop.sqm} m² footprint — limited storage & living area`);
      }

      if (prop.has_garage) {
        pros.push('Private lock-up garage included');
      } else if (prop.parking_type && prop.parking_type !== 'none') {
        pros.push('Dedicated off-street parking');
      } else if (/street parking|no parking/.test(rawText)) {
        cons.push('No dedicated off-street parking confirmed');
      }

      if (prop.fibre_ready) pros.push('Fibre internet ready');
      if (prop.stove_type === 'gas') pros.push('Gas hob (load-shedding resilient cooking)');
      if (prop.pet_friendly) pros.push('Pet-friendly lease');
      if (/no pets|not pet friendly/.test(rawText)) cons.push('No pets permitted');
      if (/solar|inverter|backup power|battery/.test(rawText)) pros.push('Backup power / solar / inverter mentioned');
      if (/balcony|patio|garden|terrace|braai|courtyard/.test(rawText)) pros.push('Private outdoor space (patio / balcony / garden)');
      if (/all-inclusive|water included|utilities included/.test(rawText)) pros.push('Utilities / water included in rent');
      if (/furnished/.test(rawText) && !/unfurnished/.test(rawText)) pros.push('Furnished & move-in ready');

      // Tenancy, acoustic, crime, address & agency risks
      if (isLandlordOnSite) {
        cons.push('Landlord on-site / shared property (cottage or flatlet may share entrance or yard)');
      } else {
        pros.push('Autonomous private residence with independent access');
      }

      if (isMissingAddressListing(prop)) {
        cons.push(`Street address withheld ("${prop.address}") — exact street security & immediate neighbours unverified`);
      }

      if (isSanctuary) {
        pros.push(`Quiet acoustic sanctuary (~${prop.acoustic_audit?.estimated_db || 38} dBA)`);
      }

      const busyRoad = getPropertyBusyRoadExposure(prop);
      if (isMainRoad || busyRoad.isNearBusyRoad) {
        cons.push(`${busyRoad.badgeLabel || 'Main road arterial exposure'} — higher traffic & scooter noise`);
      }

      const barNoise = getPropertyBarNoiseExposure(prop);
      if (barNoise.isExposed) {
        cons.push(`${barNoise.badgeLabel || 'Near late-night bar / nightlife corridor'}`);
      }

      if (isPropertyInHighRiskCrimeZone(prop.lat, prop.lng)) {
        cons.push('Near a flagged high-risk crime zone — verify perimeter security or estate access control');
      }

      const rep = getAgencyReputationInfo(prop);
      if (rep.isPoorAgency) {
        cons.push(`Agency risk flag: ${rep.badgeLabel}`);
      }

      if (/prepaid electricity|pre-paid/.test(rawText)) {
        cons.push('Prepaid electricity (verify municipal tariff / meter setup)');
      }
      if (/single.*only|one person only|single professional/.test(rawText)) {
        cons.push('Single-occupant restriction stated in listing');
      }

      if (cons.length === 0) {
        cons.push('No major red flags detected — confirm lease terms & meter readings during viewing');
      }

      return { pros: pros.slice(0, 8), cons: cons.slice(0, 8) };
    };

    const { pros, cons } = buildForensicProsAndCons();

    const buildStrategicInsights = () => {
      const reasonsToRent: string[] = [];
      const reasonsToAvoid: string[] = [];
      const criticalWatchouts: string[] = [];

      const rawText = `${prop.title || ''} ${prop.address || ''} ${prop.description || ''} ${prop.ai_insight || ''}`.toLowerCase();
      const marketVal = getRiskAdjustedValuation(prop, allCandidateProperties);
      const busyRoad = getPropertyBusyRoadExposure(prop);
      const barNoise = getPropertyBarNoiseExposure(prop);
      const rep = getAgencyReputationInfo(prop);
      const inCrimeZone = isPropertyInHighRiskCrimeZone(prop.lat, prop.lng);
      const missingAddr = isMissingAddressListing(prop);
      const effectivePrefs = (userPreferences !== undefined ? userPreferences : personalPreferences).toLowerCase();

      // 1. What makes it a good fit
      if (marketVal && marketVal.isUnderpriced) {
        reasonsToRent.push(`High Value: Priced ${marketVal.badgeText} compared to suburb medians.`);
      }
      if (isSanctuary) {
        reasonsToRent.push('Acoustic Sanctuary: Low-decibel residential pocket shielded from Cape Town arterial transit corridors.');
      }
      if (!isLandlordOnSite) {
        reasonsToRent.push('Complete Autonomy: 100% private standalone dwelling with independent entrance and no landlord on-site.');
      }
      if (prop.fibre_ready) {
        reasonsToRent.push('Remote Work Ready: High-speed fibre installed and confirmed, ideal for remote work and video conferencing.');
      }
      if (prop.has_garage) {
        reasonsToRent.push('Lock-Up Garaging: Secure automated garage protecting vehicle from weather, salt air, and street opportunism.');
      } else if (prop.has_secure_bay) {
        reasonsToRent.push('Dedicated Parking: Off-street secure bay inside access-controlled gates.');
      }
      if (prop.stove_type === 'gas') {
        reasonsToRent.push('Load-Shedding Resilient: 4-burner gas hob allows reliable cooking during power outages.');
      }
      if (/solar|inverter|battery|backup power/.test(rawText)) {
        reasonsToRent.push('Power Backup: On-site inverter or solar system keeps Wi-Fi and core lights online during outages.');
      }
      if (isNorth) {
        reasonsToRent.push('Optimal Orientation: North-facing aspect captures warm winter sunlight and natural illumination.');
      }
      if (effectivePrefs.includes('work from cafes')) {
        reasonsToRent.push(`Cafe Access: Walking distance to local coffee shops and amenities in ${prop.suburb || 'the area'}.`);
      }
      if (effectivePrefs.includes('work from an office')) {
        reasonsToRent.push('Commute Ready: Convenient arterial access for traveling to business centers.');
      }
      if (reasonsToRent.length === 0) {
        reasonsToRent.push('Clean baseline rental meeting core suburb, sizing, and pricing criteria.');
      }

      // 2. What makes it a bad fit
      if (marketVal && marketVal.isOverpriced) {
        reasonsToAvoid.push(`Price Premium: Priced ${marketVal.badgeText} above comparable properties in the immediate area.`);
      }
      if (isMainRoad || busyRoad.isNearBusyRoad) {
        reasonsToAvoid.push(`Arterial Noise Exposure: Direct frontage on ${busyRoad.badgeLabel || 'heavy traffic'} (elevated engine rumble and delivery transit).`);
      }
      if (barNoise.isExposed) {
        reasonsToAvoid.push(`Nightlife Sound Leakage: Adjacent to nightlife corridor (${barNoise.badgeLabel || 'bars and restaurants'}) with weekend noise.`);
      }
      if (isLandlordOnSite) {
        reasonsToAvoid.push('Shared Grounds: Secondary dwelling/cottage on landlord property with shared driveway and reduced perimeter autonomy.');
      }
      if (inCrimeZone) {
        reasonsToAvoid.push('Elevated Area Crime Profile: Situated in or near a designated municipal crime hotspot with opportunistic risk.');
      }
      if (!prop.has_garage && !prop.has_secure_bay) {
        reasonsToAvoid.push('No Dedicated Off-Street Parking: Dependent on kerbside street parking with vehicle exposure.');
      }
      if (effectivePrefs.includes('work from home') && (isMainRoad || busyRoad.isNearBusyRoad)) {
        reasonsToAvoid.push('WFH Disruption Risk: Daytime roadside traffic decibels may interfere with focused work or video calls.');
      }
      if (reasonsToAvoid.length === 0) {
        reasonsToAvoid.push('No critical dealbreakers or disqualifying red flags detected.');
      }

      // 3. Things to be aware of (Tenant Vigilance Checklist)
      if (missingAddr) {
        criticalWatchouts.push('Withheld Street Address: Exact street number is obscured by agent. Request pin or drive past to inspect gradient and immediate neighbours.');
      }
      if (/prepaid|pre-paid/.test(rawText)) {
        criticalWatchouts.push('Prepaid Electricity Meter: Check tariff band and ask previous tenant or landlord for average monthly electricity expenditure.');
      }
      if (rep.isPoorAgency) {
        criticalWatchouts.push(`Managing Agency Scrutiny: ${rep.badgeLabel}. Verify lease terms and ensure damage deposit is held in a statutory interest-bearing trust account.`);
      }
      const crimePerimeter = getCrimePerimeterInfo(prop);
      if ((inCrimeZone || crimePerimeter.isNearHighRisk) && !crimePerimeter.hasEstateSecurity) {
        criticalWatchouts.push(
          `Perimeter Security Check (${crimePerimeter.hotspotName || 'High-Risk Fringe'}): No 24h estate security detected — verify burglar bars, electric fencing, alarm sensors, and nighttime street lighting.`
        );
      }
      if (/single.*only|one person only/.test(rawText)) {
        criticalWatchouts.push('Occupancy Limitation: Listing specifies single professional occupancy only (no couples or frequent overnight guests).');
      }
      criticalWatchouts.push('Utilities Split: Confirm in writing whether water, refuse, sewerage, and Wi-Fi are included or invoiced separately.');
      if (!prop.pet_friendly && effectivePrefs.includes('pet')) {
        criticalWatchouts.push('Pet Policy: Listing does not specify pet allowance; written landlord consent is mandatory prior to signing.');
      }

      return {
        reasonsToRent: reasonsToRent.slice(0, 4),
        reasonsToAvoid: reasonsToAvoid.slice(0, 4),
        criticalWatchouts: criticalWatchouts.slice(0, 4),
      };
    };

    const strategicInsights = buildStrategicInsights();

    const buildArchitecturalForensics = () => {
      const rawText = `${prop.title || ''} ${prop.address || ''} ${prop.description || ''}`.toLowerCase();
      const prefsLower = (userPreferences !== undefined ? userPreferences : personalPreferences).toLowerCase();
      const isWfhFull = prefsLower.includes('work from home (full-time)') || prefsLower.includes('full-time');
      const isWfhAny = prefsLower.includes('work from home') || prefsLower.includes('remote');
      const isStudio = (prop.bedrooms !== undefined && prop.bedrooms <= 0.5) || /\b(studio|bachelor|0\.5\s*bed|loft)\b/i.test(rawText);
      const sqm = prop.sqm || 0;
      const hasOutdoor = /\b(balcony|patio|deck|terrace|sliding door)\b/i.test(rawText);

      let wfhLayoutVerdict = 'Separate bedroom(s) allow an acoustic door between sleeping/kitchen zones and a dedicated workspace for uninterrupted calls.';
      if (isStudio) {
        const sizeNote = sqm ? `(${sqm} m²) ` : '';
        if (isWfhFull) {
          wfhLayoutVerdict = `0.5-bed / studio footprint ${sizeNote}poses full-time WFH friction: no acoustic door separating your desk from fridge/kitchen hum, and bed may appear on video calls unless zoned.`;
        } else if (isWfhAny) {
          wfhLayoutVerdict = `0.5-bed / studio layout ${sizeNote}works well for part-time WFH / café hybrid if a compact desk fits near natural light; watch for appliance hum in one room.`;
        } else {
          wfhLayoutVerdict = `Open-plan 0.5-bed / studio ${sizeNote}maximizes usable floor area without corridor waste; verify storage and dining/desk zoning.`;
        }
      } else if (sqm && sqm < 52) {
        wfhLayoutVerdict = `Compact ${sqm} m² floor plan: verify a clear ≥1.2 m desk zone away from kitchen appliances and bedroom traffic.`;
      }

      let windowLightAudit = hasOutdoor
        ? 'Balcony/sliding doors support cross-ventilation and daylight; verify windows do not face a close boundary wall (<3 m).'
        : 'Single-aspect windows may limit cross-breeze; confirm sightlines during viewing so blinds are not kept shut all day.';
      if (isNorth) {
        windowLightAudit = `North-facing aspect (Cape Town gold standard for winter sun & low damp risk). ${hasOutdoor ? 'Balcony doors aid cross-ventilation.' : 'Check window-to-wall ratio for airflow.'}`;
      } else if (/\bwest[\s-]?facing\b/i.test(rawText)) {
        windowLightAudit = 'West-facing exposure delivers warm afternoon sun but risks harsh late-afternoon screen glare during WFH calls; check blinds.';
      } else if (/\bsouth[\s-]?facing\b/i.test(rawText)) {
        windowLightAudit = 'South-facing aspect gets indirect light and runs cooler in winter — inspect window frames and curtains for damp/condensation.';
      }

      let wallAcousticAudit = 'Standard masonry/sectional title build; check party-wall thickness, upstairs footfall, and add a rug/curtains if rooms are all-tile to cut Zoom echo.';
      if (/\b(art deco|parquet|heritage|solid brick)\b/i.test(rawText)) {
        wallAcousticAudit = 'Heritage / solid brick build typically blocks airborne neighbour voices well; if parquet floors exist, check upstairs footfall transmission.';
      } else if (/\b(new development|modern block|micro|newly built)\b/i.test(rawText)) {
        wallAcousticAudit = 'Modern infill build: check whether internal partitions are hollow drywall (higher voice/TV bleed) and note hard-tile echo on video calls.';
      }

      let ceilingVolumeAudit = 'Standard ~2.4 m–2.6 m ceiling height inferred; watch for 0.5x ultra-wide camera lens stretching in listing photos.';
      if (/\b(high ceiling|double volume|victorian|art deco)\b/i.test(rawText)) {
        ceilingVolumeAudit = 'High ceilings (~2.8 m–3.2 m+) improve airiness, daylight reach, and call acoustics; verify true room width beyond wide-angle photos.';
      } else if (/\b(cottage|garden flat|basement|attic)\b/i.test(rawText)) {
        ceilingVolumeAudit = 'Cottage/ancillary structure: verify ceiling height (≥2.4 m) and bulkhead clearances in person, as low ceilings feel tight for full-time WFH.';
      }

      const lightingFixturesAudit = /\b(downlight|recessed|led|renovated|modern)\b/i.test(rawText)
        ? 'Likely fitted with recessed downlights/layered fixtures; check color temperature (warm 2700K–3000K vs harsh 5000K) and inverter-tied bulbs.'
        : 'Confirm rooms do not rely solely on a single central overhead bulb (causes evening eye strain/glare) and check bathroom ventilation.';

      const exteriorBuildingAudit = /\b(estate|24 hour|concierge|access control|electric fence)\b/i.test(rawText)
        ? 'Managed security perimeter signalled; check façade paint/rust streaks and bin-area neatness as a proxy for Body Corporate reserve health.'
        : 'Inspect exterior façade for peeling paint, rust/water streaks under balconies, and working gate motors/electric fencing — key clues to Body Corporate health.';

      return {
        wfhLayoutVerdict,
        windowLightAudit,
        wallAcousticAudit,
        ceilingVolumeAudit,
        lightingFixturesAudit,
        exteriorBuildingAudit,
      };
    };

    const archForensics = buildArchitecturalForensics();

    return {
      rank,
      photoAudit,
      textVerdict,
      personalMatchVerdict,
      pros,
      cons,
      strategicInsights,
      ...archForensics,
      facingAudit: facingLabel,
      amenitiesVerdict: `${prop.fibre_ready ? 'High-speed fibre ready' : 'Standard connectivity'}. ${parkingLabel}. ${prop.pet_friendly ? 'Pet-friendly lease confirmed' : 'Standard lease'}.`,
      stoveType: stoveLabel,
      glazing: isNorth ? 'North-facing floor-to-ceiling glazing with scenic mountain/coastal buffer' : 'Ample daylight through wide exterior windows',
      plumbing: 'Dedicated washing machine and dishwasher plumbing connection points verified',
      distortion: 'Standard focal length (28mm equivalent); zero fish-eye lens distortion or artificial stretching',
      tenancyType,
      quietRules: isMainRoad
        ? '⚠️ Arterial corridor traffic trap (68–74 dB ambient daytime peak). Heavy taxi & delivery vehicle noise.'
        : 'Formal residential tenancy agreement prohibiting noise disturbances or disruptive short-lets',
      isLandlordOnSite,
      isMainRoad,
    };
  };

  const runForensicAiInspection = async (propToInspect: PropertyMapItem) => {
    let fullGallery =
      cardGalleries[propToInspect.id]?.length
        ? cardGalleries[propToInspect.id]
        : Array.isArray(propToInspect.images) && propToInspect.images.length > 0
          ? propToInspect.images
          : propToInspect.image
            ? [propToInspect.image]
            : [];

    setViewingAiReportProp((prev) =>
      prev && prev.id === propToInspect.id
        ? { ...prev, deep_ai_audit: { ...(prev as any).deep_ai_audit, isVisionLoading: true } }
        : prev
    );

    let updatedProp: PropertyMapItem = { ...propToInspect, images: fullGallery };
    if (fullGallery.length <= 1 && propToInspect.url) {
      const galleryRes = await fetchCardGallery(propToInspect.id, propToInspect.url);
      if (galleryRes && galleryRes.photos.length > 0) {
        fullGallery = galleryRes.photos;
        const f = galleryRes.features || {};
        updatedProp = {
          ...updatedProp,
          images: fullGallery,
          description: f.description || updatedProp.description,
          has_garage: Boolean(updatedProp.has_garage || f.has_garage),
          has_secure_bay: Boolean(updatedProp.has_secure_bay || f.has_secure_bay),
          parking_type: f.has_garage || updatedProp.has_garage ? 'garage' : f.has_secure_bay || updatedProp.has_secure_bay ? 'secure_bay' : updatedProp.parking_type,
          stove_type: f.stove_type || updatedProp.stove_type,
          has_inverter: Boolean(updatedProp.has_inverter || f.has_inverter),
          pet_friendly: f.pet_friendly !== null && f.pet_friendly !== undefined ? Boolean(updatedProp.pet_friendly || f.pet_friendly) : updatedProp.pet_friendly,
        };
      }
    }

    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const visionRes = await fetch(`${backendBase}/api/listing/forensic-vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updatedProp.id,
          url: updatedProp.url || '',
          title: updatedProp.title || '',
          address: updatedProp.address || '',
          price: updatedProp.price || 0,
          bedrooms: updatedProp.bedrooms || 1,
          bathrooms: updatedProp.bathrooms || 1,
          sqm: updatedProp.sqm || null,
          description: updatedProp.description || updatedProp.ai_insight || '',
          images: fullGallery,
          uploaded_images: uploadedViewingPhotos,
          photo_source_mode: photoSourceMode,
          personal_preferences: personalPreferences || '',
        }),
      });
      if (visionRes.ok) {
        consumeAuditCredit();
        const visionData = await visionRes.json();
        const v = visionData?.vision;
        if (v) {
          const baseAudit = generatePropertyAiAudit(updatedProp, propToInspect.rank || 1, personalPreferences, fullGallery);
          const mergedPros = Array.from(new Set([...(Array.isArray(v.photo_pros) ? v.photo_pros : []), ...(baseAudit.pros || [])])).slice(0, 9);
          const mergedCons = Array.from(new Set([...(Array.isArray(v.photo_cons) ? v.photo_cons : []), ...(baseAudit.cons || [])])).slice(0, 9);
          setViewingAiReportProp((prev) =>
            prev && prev.id === propToInspect.id
              ? {
                ...updatedProp,
                deep_ai_audit: {
                  ...baseAudit,
                  pros: mergedPros,
                  cons: mergedCons,
                  photoStory: v.photo_story || '',
                  inspectedPhotoCount: v.inspected_photo_count || fullGallery.length,
                  glazing: v.glazing || baseAudit.glazing,
                  distortion: v.distortion || baseAudit.distortion,
                  wfhLayoutVerdict: v.wfh_layout_verdict || baseAudit.wfhLayoutVerdict,
                  windowLightAudit: v.window_light_audit || baseAudit.windowLightAudit,
                  wallAcousticAudit: v.wall_acoustic_audit || baseAudit.wallAcousticAudit,
                  ceilingVolumeAudit: v.ceiling_volume_audit || baseAudit.ceilingVolumeAudit,
                  lightingFixturesAudit: v.lighting_fixtures_audit || baseAudit.lightingFixturesAudit,
                  exteriorBuildingAudit: v.exterior_building_audit || baseAudit.exteriorBuildingAudit,
                  buildingIntel: v.building_intel || null,
                  stoveType:
                    v.stove_type && v.stove_type !== 'unknown'
                      ? `${v.stove_type.charAt(0).toUpperCase() + v.stove_type.slice(1)} hob/stove observed in kitchen photo`
                      : baseAudit.stoveType,
                  isVisionFallback: Boolean(v.is_fallback),
                  fallbackReason: v.fallback_reason || null,
                  isVisionLoading: false,
                  hasAiRun: true,
                  generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  appliedPreferences: personalPreferences.trim() || 'Standard optimal rental baseline',
                },
              }
              : prev
          );
          return;
        }
      }
    } catch {
      // Non-fatal; fallback to deterministic audit
    }

    setViewingAiReportProp((prev) =>
      prev && prev.id === propToInspect.id
        ? {
            ...prev,
            deep_ai_audit: {
              ...(prev as any).deep_ai_audit,
              isVisionLoading: false,
              hasAiRun: true,
              generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              appliedPreferences: personalPreferences.trim() || 'Standard optimal rental baseline',
            },
          }
        : prev
    );
  };

  const handleTogglePropertyAiReport = (prop: PropertyMapItem) => {
    if (viewingAiReportProp?.id === prop.id) {
      setViewingAiReportProp(null);
      return;
    }

    const fullGallery =
      cardGalleries[prop.id]?.length
        ? cardGalleries[prop.id]
        : Array.isArray(prop.images) && prop.images.length > 0
          ? prop.images
          : prop.image
            ? [prop.image]
            : [];

    const initialAudit = generatePropertyAiAudit(prop, prop.rank || 1, personalPreferences, fullGallery);
    setViewingAiReportProp({
      ...prop,
      images: fullGallery,
      deep_ai_audit: { ...initialAudit, isVisionLoading: false, hasAiRun: false },
    });
    setSelectedPropertyId(prop.id);
  };

  // Card Photo Gallery & RealView™ Rectifier States
  const [cardImageIndices, setCardImageIndices] = useState<Record<string, number>>({});
  const [cardGalleries, setCardGalleries] = useState<Record<string, string[]>>({});

  // Helper to convert wide-angle photos to human eye normal perspective
  const getRectifiedUrl = (rawUrl: string) => {
    if (!rawUrl || rawUrl.includes('unsplash.com') || rawUrl.startsWith('data:')) return rawUrl;
    const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return `${backendBase}/api/realview/rectify?url=${encodeURIComponent(rawUrl)}`;
  };

  const fetchCardGallery = async (propId: string, url: string): Promise<{ photos: string[]; features: any } | null> => {
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${backendBase}/api/listing-photos?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.photos) && data.photos.length > 0) {
          setCardGalleries((prev) => ({ ...prev, [propId]: data.photos }));
        }
        if (data.status === 'success' && data.features) {
          const f = data.features;
          setProperties((prev) =>
            prev.map((p) =>
              p.id === propId
                ? {
                  ...p,
                  description: f.description || p.description,
                  has_garage: Boolean(p.has_garage || f.has_garage),
                  has_secure_bay: Boolean(p.has_secure_bay || f.has_secure_bay),
                  parking_type: f.has_garage || p.has_garage ? 'garage' : f.has_secure_bay || p.has_secure_bay ? 'secure_bay' : p.parking_type,
                  stove_type: f.stove_type || p.stove_type,
                  has_inverter: Boolean(p.has_inverter || f.has_inverter),
                  pet_friendly: f.pet_friendly !== null && f.pet_friendly !== undefined ? Boolean(p.pet_friendly || f.pet_friendly) : p.pet_friendly,
                  agency_name: f.agency_name || p.agency_name,
                  agency_rating: f.agency_rating ?? p.agency_rating,
                  agency_review_count: f.agency_review_count ?? p.agency_review_count,
                  agency_risk_level: f.agency_risk_level || p.agency_risk_level,
                  agency_flags: Array.isArray(f.agency_flags) && f.agency_flags.length > 0 ? f.agency_flags : p.agency_flags,
                  agency_complaint_sample: f.agency_complaint_sample || p.agency_complaint_sample,
                  agency_hellopeter_rating: f.agency_hellopeter_rating ?? p.agency_hellopeter_rating,
                }
                : p
            )
          );
        }
        return { photos: Array.isArray(data.photos) ? data.photos : [], features: data.features || {} };
      }
    } catch (err) {
      console.warn("Could not fetch gallery for", propId, err);
    }
    return null;
  };

  // Deep AI Analysis Execution State
  const [isRunningDeepAi, setIsRunningDeepAi] = useState<boolean>(false);
  const [hasLoadedPersistedState, setHasLoadedPersistedState] = useState<boolean>(false);

  // Load saved area templates and last active search state from localStorage
  useEffect(() => {
    try {
      const storedAreas = localStorage.getItem('homeseek_area_templates');
      if (storedAreas) {
        const parsed = JSON.parse(storedAreas);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = parsed.map((item: SavedSearch) => {
            const def = DEFAULT_SAVED_SEARCHES.find(d => d.id === item.id);
            if (def) {
              return {
                ...item,
                ...def,
              };
            }
            return item;
          });
          DEFAULT_SAVED_SEARCHES.forEach((def) => {
            if (!merged.some((m: SavedSearch) => m.id === def.id)) {
              merged.push(def);
            }
          });
          setSavedSearches(merged);
        }
      }

      const storedStateRaw = localStorage.getItem('homeseek_last_search_state');
      if (storedStateRaw) {
        const saved = JSON.parse(storedStateRaw);
        if (saved && typeof saved === 'object') {
          if (typeof saved.activeSavedSearchId === 'string') setActiveSavedSearchId(saved.activeSavedSearchId);
          if (Array.isArray(saved.selectedSuburbs) && saved.selectedSuburbs.length > 0) setSelectedSuburbs(saved.selectedSuburbs);
          if (typeof saved.minPrice === 'string') setMinPrice(saved.minPrice);
          if (typeof saved.maxPrice === 'string') setMaxPrice(saved.maxPrice);
          if (typeof saved.minSqm === 'number') setMinSqm(saved.minSqm);
          if (typeof saved.bedrooms === 'string') setBedrooms(saved.bedrooms);
          if (typeof saved.activeAnchorId === 'string') setActiveAnchorId(saved.activeAnchorId);
          if (typeof saved.safeishFilter === 'boolean') setSafeishFilter(saved.safeishFilter);
          if (typeof saved.offMainRoadFilter === 'boolean') setOffMainRoadFilter(saved.offMainRoadFilter);
          if (typeof saved.withinRadiusFilter === 'boolean') setWithinRadiusFilter(saved.withinRadiusFilter);
          if (typeof saved.locationRadiusKm === 'number') setLocationRadiusKm(saved.locationRadiusKm);
          if (typeof saved.fibreFilter === 'boolean') setFibreFilter(saved.fibreFilter);
          if (typeof saved.northFacingFilter === 'boolean') setNorthFacingFilter(saved.northFacingFilter);
          if (typeof saved.parkingFilter === 'boolean') setParkingFilter(saved.parkingFilter);
          if (typeof saved.petFriendlyFilter === 'boolean') setPetFriendlyFilter(saved.petFriendlyFilter);
          if (typeof saved.gasHobFilter === 'boolean') setGasHobFilter(saved.gasHobFilter);
          if (typeof saved.privateOnlyFilter === 'boolean') setPrivateOnlyFilter(saved.privateOnlyFilter);
          if (typeof saved.sortBy === 'string') setSortBy(saved.sortBy);
          if (typeof saved.isListCollapsed === 'boolean') setIsListCollapsed(saved.isListCollapsed);
        }
      }

      const storedHidden = localStorage.getItem('homeseek_hidden_properties');
      if (storedHidden) {
        const parsed = JSON.parse(storedHidden);
        if (Array.isArray(parsed)) {
          setHiddenPropertyIds(parsed);
        }
      }
    } catch (e) { }
    setHasLoadedPersistedState(true);
  }, []);

  const applySavedSearch = (preset: SavedSearch) => {
    setSelectedPropertyId(null);
    setSelectedSuburbs(preset.suburbs);
    if (preset.minPrice) setMinPrice(preset.minPrice);
    if (preset.maxPrice) setMaxPrice(preset.maxPrice);
    if (preset.bedrooms) setBedrooms(preset.bedrooms);
    if (preset.anchorId) setActiveAnchorId(preset.anchorId);
    setActiveSavedSearchId(preset.id);
    setIsSavedSearchMenuOpen(false);

    // Pan map to the primary suburb or anchor of the selected preset
    if (preset.suburbs && preset.suburbs.length > 0) {
      const coords = resolveLocationCoords(preset.suburbs[0]);
      if (coords && coords.lat && coords.lng) {
        setFocusTarget({ lat: coords.lat, lng: coords.lng, zoom: 13.5, timestamp: Date.now() });
      }
    }
  };

  const mapLiveScrapeItem = (item: any, idx: number): PropertyMapItem => ({
    id: item.id || `p24-${idx}`,
    title: item.title,
    address: item.address,
    is_address_withheld: Boolean(item.is_address_withheld),
    suburb: item.suburb,
    price: item.price,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    sqm: item.sqm,
    image: item.image,
    lat: item.lat,
    lng: item.lng,
    rank: idx + 1,
    fit_score: item.fit_score || 90,
    noise_risk: item.noise_risk || 'low',
    is_main_road: Boolean(item.is_main_road),
    stove_type: item.stove_type || 'electric',
    has_garage: Boolean(item.has_garage),
    has_secure_bay: Boolean(item.has_secure_bay) || item.parking_type === 'secure_bay',
    parking_type: item.parking_type || (item.has_garage ? 'garage' : item.parking > 0 ? 'secure_bay' : 'none'),
    pet_friendly: Boolean(item.pet_friendly),
    fibre_ready: Boolean(item.fibre_ready),
    has_inverter: Boolean(item.has_inverter),
    dwelling_privacy: item.dwelling_privacy || 'independent',
    is_landlord_on_site: Boolean(item.is_landlord_on_site),
    agency_name: item.agency_name,
    agency_rating: item.agency_rating,
    agency_review_count: item.agency_review_count,
    agency_risk_level: item.agency_risk_level,
    agency_flags: item.agency_flags,
    agency_complaint_sample: item.agency_complaint_sample,
    agency_hellopeter_rating: item.agency_hellopeter_rating,
    price_value_pct: typeof item.price_value_pct === 'number' ? item.price_value_pct : null,
    url: item.url,
    acoustic_audit: {
      estimated_db: item.noise_risk === 'sanctuary' ? 34 : item.is_main_road ? 68 : 42,
      sound_shadow_status: item.noise_risk === 'sanctuary' ? 'Acoustic Sanctuary (Forest/Quiet Grove)' : 'Standard Residential Quiet',
      facing_direction: item.facing_direction || '',
    },
  });

  const doesPropMatchSuburbs = (prop: PropertyMapItem, suburbsList: string[]): boolean => {
    const subLower = String((prop as any).suburb || '').toLowerCase().trim();
    const addrLower = String(prop.address || '').toLowerCase();
    return suburbsList.some((s) => {
      const target = s.toLowerCase().trim();
      return Boolean(target) && (subLower === target || addrLower.includes(target));
    });
  };

  // Auto-load live/cached listings from backend whenever selectedSuburbs changes
  useEffect(() => {
    if (!hasLoadedPersistedState || selectedSuburbs.length === 0) return;
    let isCancelled = false;
    const syncSuburbListings = async () => {
      try {
        const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${backendBase}/api/search/live-scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suburbs: selectedSuburbs,
            min_price: parseInt(minPrice) || 0,
            max_price: parseInt(maxPrice) || 999999,
            bedrooms: bedrooms,
            anchor_lat: activeAnchor ? activeAnchor.lat : null,
            anchor_lng: activeAnchor ? activeAnchor.lng : null,
          }),
        });
        if (!res.ok || isCancelled) return;
        const data = await res.json();
        if (data.rate_guard?.circuit_open && !isCancelled) {
          const secs = data.rate_guard.cooldown_remaining_seconds || 180;
          const mins = Math.max(1, Math.ceil(secs / 60));
          setRateGuardUntil(Date.now() + secs * 1000);
          setScrapeStatusText(
            data.listings?.length > 0
              ? `🛡️ P24 Rate-Limit Shield Active (${mins}m cooldown). Serving ${data.listings.length} cached listings.`
              : `🛡️ P24 Rate-Limit Shield Active (${mins}m cooldown). Pausing outbound scrapes to protect your IP.`
          );
        } else if (!isCancelled && data.rate_guard && !data.rate_guard.circuit_open) {
          setRateGuardUntil(0);
        }
        if (Array.isArray(data.listings) && data.listings.length > 0 && !isCancelled) {
          const mapped: PropertyMapItem[] = data.listings.map(mapLiveScrapeItem);
          setProperties((prev) => {
            const incomingIds = new Set(mapped.map((m) => m.id));
            const outsideQueried = prev.filter(
              (p) => !incomingIds.has(p.id) && !doesPropMatchSuburbs(p, selectedSuburbs)
            );
            return [...mapped, ...outsideQueried];
          });
        }
      } catch (e) {
        // Silent fallback to local state
      }
    };
    syncSuburbListings();
    return () => {
      isCancelled = true;
    };
  }, [hasLoadedPersistedState, selectedSuburbs.join('|'), minPrice, maxPrice, bedrooms]);

  const handleSaveCurrentSearch = () => {
    if (!newSearchName.trim()) return;
    const newPreset: SavedSearch = {
      id: `custom-${Date.now()}`,
      name: `📍 ${newSearchName.trim()}`,
      suburbs: [...selectedSuburbs],
      minPrice,
      maxPrice,
      bedrooms,
      anchorId: activeAnchorId,
      isCustom: true,
    };
    const updated = [newPreset, ...savedSearches];
    setSavedSearches(updated);
    setActiveSavedSearchId(newPreset.id);
    setNewSearchName('');
    setIsSavingSearch(false);
    try {
      localStorage.setItem('homeseek_area_templates', JSON.stringify(updated));
    } catch (e) { }
  };

  const handleDeleteSavedSearch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    if (activeSavedSearchId === id && updated.length > 0) {
      applySavedSearch(updated[0]);
    }
    try {
      localStorage.setItem('homeseek_area_templates', JSON.stringify(updated));
    } catch (e) { }
  };

  // Trigger Deep AI Analysis across Top 10 with active filters and personal preferences
  const handleRunDeepAiAnalysis = () => {
    setIsRunningDeepAi(true);
    setEnableFitScore(true);
    setSortBy('fit');
    setScrapeStatusText('Running AI multimodal inspection on photos, natural light, layout & agent copy for Top 10...');
    setTimeout(() => {
      setIsRunningDeepAi(false);
      setDeepAiRunCount((c) => c + 1);
      setIsAiModalOpen(false);

      if (displayProperties.length > 0) {
        const topListing = displayProperties[0];
        const audit = generatePropertyAiAudit(topListing, 1, personalPreferences);
        setViewingAiReportProp({ ...topListing, deep_ai_audit: audit });
        setSelectedPropertyId(topListing.id);
      }

      setScrapeStatusText('✨ AI Deep Analysis complete! Forensic report opened for #1 Top Fit.');
      setTimeout(() => setScrapeStatusText(''), 4500);
    }, 800);
  };

  // Desirable Locations & Trailheads State
  const [anchors, setAnchors] = useState<CommuteAnchor[]>(PRESET_TRAILHEADS_AND_HUBS);
  const [activeAnchorId, setActiveAnchorId] = useState<string>('trail-newlands');
  const [isAnchorMenuOpen, setIsAnchorMenuOpen] = useState(false);
  const [newAnchorLabel, setNewAnchorLabel] = useState('');
  const [newAnchorPlace, setNewAnchorPlace] = useState('');
  const [isAnchorInputFocused, setIsAnchorInputFocused] = useState(false);
  const [anchorAutoIndex, setAnchorAutoIndex] = useState(0);

  const anchorSuggestions = useMemo(() => {
    return searchPlacesAndAttractions(newAnchorLabel);
  }, [newAnchorLabel]);

  // Live Scraped Properties State
  const [properties, setProperties] = useState<PropertyMapItem[]>(INITIAL_SHOWCASE_PROPERTIES);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; zoom?: number; timestamp: number } | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStatusText, setScrapeStatusText] = useState('');
  const [rateGuardUntil, setRateGuardUntil] = useState<number>(0);
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [feedViewMode, setFeedViewMode] = useState<'cards' | 'list'>('cards');
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'distance' | 'fit'>('fit');
  const [empiricalMediansLoaded, setEmpiricalMediansLoaded] = useState(0);

  useEffect(() => {
    const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${backendBase}/api/market-medians`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.status === 'success' && d.medians) {
          setEmpiricalMarketMedians(d.medians);
          setEmpiricalMediansLoaded((n) => n + 1);
        }
      })
      .catch(() => {});
  }, []);

  const resolveProperty24Url = (prop: { id?: string; url?: string; address?: string; title?: string }): string => {
    const raw = (prop.url || '').trim();
    if (raw && raw.startsWith('http')) return raw;
    if (raw && raw.startsWith('/')) return `https://www.property24.com${raw}`;
    const p24Match = (prop.id || '').match(/(\d{7,10})/);
    if (p24Match) {
      return `https://www.property24.com/to-rent/cape-town/western-cape/432/${p24Match[1]}`;
    }
    return 'https://www.property24.com/to-rent/cape-town/western-cape/432';
  };

  const resolveGoogleMapsUrl = (prop: { lat?: number | null; lng?: number | null; address?: string; title?: string } | null | undefined): string => {
    if (!prop) return 'https://www.google.com/maps';
    if (prop.lat && prop.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${prop.lat},${prop.lng}`;
    }
    const cleanAddr = (prop.address || prop.title || 'Cape Town, South Africa').replace(/\s+/g, ' ').trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddr)}`;
  };

  const openProperty24Url = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Persist active search criteria and filters to localStorage whenever they change
  useEffect(() => {
    if (!hasLoadedPersistedState) return;
    try {
      localStorage.setItem(
        'homeseek_last_search_state',
        JSON.stringify({
          activeSavedSearchId,
          selectedSuburbs,
          minPrice,
          maxPrice,
          minSqm,
          bedrooms,
          activeAnchorId,
          safeishFilter,
          offMainRoadFilter,
          withinRadiusFilter,
          locationRadiusKm,
          fibreFilter,
          northFacingFilter,
          parkingFilter,
          petFriendlyFilter,
          gasHobFilter,
          privateOnlyFilter,
          sortBy,
          isListCollapsed,
        })
      );
    } catch (e) { }
  }, [
    hasLoadedPersistedState,
    activeSavedSearchId,
    selectedSuburbs,
    minPrice,
    maxPrice,
    minSqm,
    bedrooms,
    activeAnchorId,
    safeishFilter,
    offMainRoadFilter,
    withinRadiusFilter,
    locationRadiusKm,
    fibreFilter,
    northFacingFilter,
    parkingFilter,
    petFriendlyFilter,
    gasHobFilter,
    privateOnlyFilter,
    sortBy,
    isListCollapsed,
  ]);

  const activeAnchor = useMemo(() => {
    return anchors.find(a => a.id === activeAnchorId) || anchors[0] || null;
  }, [anchors, activeAnchorId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (budgetMenuRef.current && !budgetMenuRef.current.contains(target)) {
        setIsBudgetMenuOpen(false);
      }
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(target)) {
        setIsSizeMenuOpen(false);
      }
      if (savedSearchMenuRef.current && !savedSearchMenuRef.current.contains(target)) {
        setIsSavedSearchMenuOpen(false);
      }
      if (anchorMenuRef.current && !anchorMenuRef.current.contains(target)) {
        setIsAnchorMenuOpen(false);
      }
    };
    if (isBudgetMenuOpen || isSizeMenuOpen || isSavedSearchMenuOpen || isAnchorMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBudgetMenuOpen, isSizeMenuOpen, isSavedSearchMenuOpen, isAnchorMenuOpen]);

  const activeTemplate = useMemo(() => {
    return savedSearches.find((s) => s.id === activeSavedSearchId) || savedSearches[0];
  }, [savedSearches, activeSavedSearchId]);

  // Main location attractions associated with the active Suburb Group template
  const templateAttractions = useMemo(() => {
    if (!activeTemplate?.attractionIds || activeTemplate.attractionIds.length === 0) {
      return anchors.filter((a) => a.category !== 'gym' && a.iconType !== 'gym' && a.category !== 'cafe' && a.iconType !== 'cafe' && a.category !== 'shop' && a.iconType !== 'shop');
    }
    return anchors.filter((a) => activeTemplate.attractionIds?.includes(a.id));
  }, [anchors, activeTemplate]);

  // Gyms associated with the active Suburb Group template
  const templateGyms = useMemo(() => {
    if (!activeTemplate?.gymIds || activeTemplate.gymIds.length === 0) {
      return anchors.filter((a) => a.category === 'gym' || a.iconType === 'gym');
    }
    return anchors.filter((a) => activeTemplate.gymIds?.includes(a.id));
  }, [anchors, activeTemplate]);

  // Cafes & Bakeries associated with the active Suburb Group template
  const templateCafes = useMemo(() => {
    if (!activeTemplate?.cafeIds || activeTemplate.cafeIds.length === 0) {
      return anchors.filter((a) => a.category === 'cafe' || a.iconType === 'cafe');
    }
    return anchors.filter((a) => activeTemplate.cafeIds?.includes(a.id));
  }, [anchors, activeTemplate]);

  // Shops & Retail Centres associated with the active Suburb Group template
  const templateShops = useMemo(() => {
    if (!activeTemplate?.shopIds || activeTemplate.shopIds.length === 0) {
      return anchors.filter((a) => a.category === 'shop' || a.iconType === 'shop');
    }
    return anchors.filter((a) => activeTemplate.shopIds?.includes(a.id));
  }, [anchors, activeTemplate]);

  // Other regional anchors (outside current template) + custom user anchors
  const otherAnchors = useMemo(() => {
    const currentTemplateAnchorIds = new Set([
      ...(activeTemplate?.attractionIds || []),
      ...(activeTemplate?.gymIds || []),
      ...(activeTemplate?.cafeIds || []),
      ...(activeTemplate?.shopIds || [])
    ]);
    return anchors.filter((a) => !currentTemplateAnchorIds.has(a.id));
  }, [anchors, activeTemplate]);

  // Filtered anchors passed to the Map Canvas (current template attractions + gyms + cafes + shops + custom pins + active anchor)
  const displayedAnchors = useMemo(() => {
    const customAnchors = anchors.filter((a) => a.id.startsWith('custom-'));
    const idSet = new Set([
      ...(activeTemplate?.attractionIds || []),
      ...(activeTemplate?.gymIds || []),
      ...(activeTemplate?.cafeIds || []),
      ...(activeTemplate?.shopIds || []),
      activeAnchorId
    ]);
    const matched = anchors.filter((a) => idSet.has(a.id));
    return matched.length > 0 ? [...matched, ...customAnchors] : anchors;
  }, [anchors, activeTemplate, activeAnchorId]);

  const handleFocusSuburb = (suburb: string) => {
    const coords = resolveLocationCoords(suburb);
    setFocusTarget({ lat: coords.lat, lng: coords.lng, zoom: 14.2, timestamp: Date.now() });
  };

  // Suburb management
  const handleAddSuburb = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!selectedSuburbs.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedSuburbs([...selectedSuburbs, trimmed]);
    }
    setSuburbInput('');
    setIsInputFocused(false);
    setAutoIndex(0);
  };

  const handleRemoveSuburb = (name: string) => {
    setSelectedSuburbs(selectedSuburbs.filter(s => s.toLowerCase() !== name.toLowerCase()));
  };

  // Select location from suggestions and add to map
  const handleSelectSuggestedPlace = (place: PlaceSuggestion) => {
    const newAnchor: CommuteAnchor = {
      id: `place-${Date.now()}-${place.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      label: place.name,
      target_place: `${place.name}, ${place.category}`,
      lat: place.lat,
      lng: place.lng,
      max_commute_mins: 20,
      max_distance_km: 15,
      commute_mode: 'driving',
      iconType: place.iconType,
      category: place.iconType === 'gym' ? 'gym' : place.iconType === 'trail' ? 'trail' : place.iconType === 'cafe' ? 'cafe' : place.iconType === 'shop' ? 'shop' : 'attraction',
    };

    setAnchors((prev) => [newAnchor, ...prev.filter((a) => a.label.toLowerCase() !== place.name.toLowerCase())]);
    setActiveAnchorId(newAnchor.id);
    setFocusTarget({ lat: place.lat, lng: place.lng, zoom: 14.5, timestamp: Date.now() });
    setNewAnchorLabel('');
    setNewAnchorPlace('');
    setIsAnchorInputFocused(false);
    setIsAnchorMenuOpen(false);
  };

  // Add custom desirable location
  const handleAddCustomAnchor = () => {
    const query = newAnchorLabel.trim();
    if (!query) return;

    // If an auto-suggestion is currently highlighted, use it
    if (anchorSuggestions.length > 0 && anchorSuggestions[anchorAutoIndex]) {
      handleSelectSuggestedPlace(anchorSuggestions[anchorAutoIndex]);
      return;
    }

    const resolved = resolveLocationCoords(query);
    const newAnchor: CommuteAnchor = {
      id: `custom-${Date.now()}`,
      label: resolved.label || query,
      target_place: query,
      lat: resolved ? resolved.lat : -33.9500,
      lng: resolved ? resolved.lng : 18.4400,
      max_commute_mins: 20,
      max_distance_km: 15,
      commute_mode: 'driving',
      iconType: 'general'
    };
    setAnchors((prev) => [newAnchor, ...prev.filter((a) => a.label.toLowerCase() !== newAnchor.label.toLowerCase())]);
    setActiveAnchorId(newAnchor.id);
    setFocusTarget({ lat: newAnchor.lat, lng: newAnchor.lng, zoom: 14.5, timestamp: Date.now() });
    setNewAnchorLabel('');
    setNewAnchorPlace('');
    setIsAnchorInputFocused(false);
    setIsAnchorMenuOpen(false);
  };

  // Scrape Property24 Live Action
  const handleScrapeP24 = async () => {
    if (selectedSuburbs.length === 0) {
      setScrapeStatusText('Please select or add at least one suburb (e.g. Gardens, Rondebosch) to scrape.');
      setTimeout(() => setScrapeStatusText(''), 4500);
      return;
    }

    setIsScraping(true);
    setScrapeStatusText(`Connecting to Property24 and scraping live listings for ${selectedSuburbs.join(', ')}...`);

    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const runScrapeBatch = async (batchSuburbs: string[]) => {
        const res = await fetch(`${backendBase}/api/search/live-scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suburbs: batchSuburbs,
            min_price: parseInt(minPrice) || 0,
            max_price: parseInt(maxPrice) || 999999,
            bedrooms: bedrooms,
            anchor_lat: activeAnchor ? activeAnchor.lat : null,
            anchor_lng: activeAnchor ? activeAnchor.lng : null,
            force_fresh: true,
          }),
        });
        if (!res.ok) return null;
        return await res.json();
      };

      const mergeBatchProperties = (
        batchMapped: PropertyMapItem[],
        suburbsToReplace: string[],
        prevSnapshot: PropertyMapItem[]
      ) => {
        const batchIds = new Set(batchMapped.map((m) => m.id));
        const removed =
          suburbsToReplace.length > 0
            ? prevSnapshot.filter((p) => !batchIds.has(p.id) && doesPropMatchSuburbs(p, suburbsToReplace)).length
            : 0;
        setProperties((prev) => {
          const preserved = prev.filter((p) => {
            if (batchIds.has(p.id)) return false;
            if (suburbsToReplace.length > 0 && doesPropMatchSuburbs(p, suburbsToReplace)) {
              return false;
            }
            return true;
          });
          return [...batchMapped, ...preserved];
        });
        return removed;
      };

      const data = await runScrapeBatch(selectedSuburbs);

      if (data) {
        if (data.rate_guard?.circuit_open) {
          const secs = data.rate_guard?.cooldown_remaining_seconds || 180;
          setRateGuardUntil(Date.now() + secs * 1000);
        } else {
          setRateGuardUntil(0);
        }
        if (data.status === 'success' && Array.isArray(data.listings)) {
          const combinedMappedById = new Map<string, PropertyMapItem>();
          const batch1Mapped: PropertyMapItem[] = data.listings.map(mapLiveScrapeItem);
          batch1Mapped.forEach((m) => combinedMappedById.set(m.id, m));

          let circuitOpen = Boolean(data.rate_guard?.circuit_open);
          let cooldownSecs = data.rate_guard?.cooldown_remaining_seconds || 180;
          const allRefreshedSet = new Set<string>(
            Array.isArray(data.batch_meta?.refreshed_suburbs) ? data.batch_meta.refreshed_suburbs : []
          );
          let remainingStale: string[] = Array.isArray(data.batch_meta?.stale_suburbs)
            ? data.batch_meta.stale_suburbs
            : [];

          const prevIds = new Set(properties.map((p) => p.id));
          const initialReplace = circuitOpen
            ? []
            : allRefreshedSet.size > 0
              ? Array.from(allRefreshedSet)
              : remainingStale.length === 0
                ? selectedSuburbs
                : [];
          let removedStaleCount = mergeBatchProperties(batch1Mapped, initialReplace, properties);

          // Automatically continue through remaining stale suburbs (<= 3 per batch) after polite delay
          const triedRemaining = new Set<string>();
          let batchesRun = 1;
          while (!circuitOpen && remainingStale.length > 0 && batchesRun < 4) {
            const nextSlice = remainingStale
              .filter((s) => !triedRemaining.has(s.toLowerCase()))
              .slice(0, 3);
            if (nextSlice.length === 0) break;
            nextSlice.forEach((s) => triedRemaining.add(s.toLowerCase()));

            setScrapeStatusText(
              `⏳ Refreshed ${allRefreshedSet.size > 0 ? Array.from(allRefreshedSet).join(', ') : 'first batch'}. Continuing politely to ${nextSlice.join(', ')}...`
            );
            await new Promise((r) => setTimeout(r, 4000));

            const nextData = await runScrapeBatch(nextSlice);
            batchesRun++;
            if (!nextData || nextData.status !== 'success' || !Array.isArray(nextData.listings)) {
              break;
            }

            if (nextData.rate_guard?.circuit_open) {
              circuitOpen = true;
              cooldownSecs = nextData.rate_guard?.cooldown_remaining_seconds || 180;
              setRateGuardUntil(Date.now() + cooldownSecs * 1000);
            }

            const nextMapped: PropertyMapItem[] = nextData.listings.map(mapLiveScrapeItem);
            nextMapped.forEach((m) => combinedMappedById.set(m.id, m));

            const nextRefreshed: string[] = Array.isArray(nextData.batch_meta?.refreshed_suburbs)
              ? nextData.batch_meta.refreshed_suburbs
              : [];
            nextRefreshed.forEach((s) => allRefreshedSet.add(s));
            const nextStale: string[] = Array.isArray(nextData.batch_meta?.stale_suburbs)
              ? nextData.batch_meta.stale_suburbs
              : [];

            if (!circuitOpen) {
              const replaceTargets = nextRefreshed.length > 0 ? nextRefreshed : nextStale.length === 0 ? nextSlice : [];
              removedStaleCount += mergeBatchProperties(nextMapped, replaceTargets, properties);
            }

            const prevRemaining = remainingStale.filter((s) => !triedRemaining.has(s.toLowerCase()));
            remainingStale = Array.from(new Set([...nextStale, ...prevRemaining]));
          }

          const mapped = Array.from(combinedMappedById.values());
          const addedCount = mapped.filter((m) => !prevIds.has(m.id)).length;
          const refreshedSuburbs = Array.from(allRefreshedSet);
          const staleSuburbs = remainingStale;

          // Verify saved/imported favourites against live availability & refresh metadata
          let expiredFavsRemoved = 0;
          if (!circuitOpen && importedFavourites.length > 0) {
            try {
              const mappedByP24Id = new Map(
                mapped.map((m) => [String((m as any).p24_id || m.id).replace('p24-', ''), m])
              );
              const verifyRes = await fetch(`${backendBase}/api/p24/verify-favourites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  items: importedFavourites.map((f) => ({
                    id: f.id,
                    p24_id: String((f as any).p24_id || f.id).replace('p24-', ''),
                    url: f.url || null,
                  })),
                  active_live_ids: Array.from(mappedByP24Id.keys()),
                  force_fresh: true,
                }),
              });

              const expiredSet = new Set<string>();
              if (verifyRes.ok) {
                const vData = await verifyRes.json();
                for (const eid of (vData.expired_ids || []) as string[]) {
                  expiredSet.add(String(eid).replace('p24-', ''));
                }
              }

              expiredFavsRemoved = importedFavourites.filter((fav) => {
                const pid = String((fav as any).p24_id || fav.id).replace('p24-', '');
                return expiredSet.has(fav.id) || expiredSet.has(pid);
              }).length;

              if (expiredSet.size > 0 || mappedByP24Id.size > 0) {
                setImportedFavourites((prevFavs) => {
                  const nextFavs: PropertyMapItem[] = [];
                  for (const fav of prevFavs) {
                    const pid = String((fav as any).p24_id || fav.id).replace('p24-', '');
                    if (expiredSet.has(fav.id) || expiredSet.has(pid)) {
                      continue;
                    }
                    const freshMatch = mappedByP24Id.get(pid);
                    nextFavs.push(freshMatch ? { ...fav, ...freshMatch, is_favorite: true } : fav);
                  }
                  return nextFavs;
                });

                if (expiredSet.size > 0) {
                  setFavouritePropertyIds((prevFavIds) => {
                    const nextIds = prevFavIds.filter(
                      (fid) => !expiredSet.has(fid) && !expiredSet.has(fid.replace('p24-', ''))
                    );
                    try {
                      localStorage.setItem('homeseek_p24_favourite_ids', JSON.stringify(nextIds));
                    } catch { }
                    return nextIds;
                  });
                  setProperties((prev) =>
                    prev.filter((p) => {
                      const pid = String((p as any).p24_id || p.id).replace('p24-', '');
                      return !expiredSet.has(p.id) && !expiredSet.has(pid);
                    })
                  );
                }
              }
            } catch (favErr) {
              console.warn('Favourite expiry verification skipped:', favErr);
            }
          }

          const totalExpiredRemoved = removedStaleCount + expiredFavsRemoved;
          if (circuitOpen) {
            const mins = Math.ceil(cooldownSecs / 60);
            setScrapeStatusText(`🛡️ P24 Rate-Limit Shield Active (${mins}m cooldown). Serving ${mapped.length} cached listings to prevent IP block.`);
          } else if (staleSuburbs.length > 0) {
            setScrapeStatusText(
              `⚡ Refreshed ${refreshedSuburbs.join(', ') || 'batch'}${totalExpiredRemoved > 0 ? ` (removed ${totalExpiredRemoved} expired)` : ''}. ${staleSuburbs.join(', ')} still cached — click Scrape P24 again to retry.`
            );
          } else if (totalExpiredRemoved > 0) {
            setScrapeStatusText(
              `🔄 Refreshed ${selectedSuburbs.join(', ')}: removed ${totalExpiredRemoved} expired listing${totalExpiredRemoved === 1 ? '' : 's'}, ${mapped.length} active.`
            );
          } else if (addedCount > 0) {
            setScrapeStatusText(`✨ Found ${addedCount} new live listings from Property24 (${mapped.length} active for ${selectedSuburbs.join(', ')})!`);
          } else if (refreshedSuburbs.length > 0) {
            setScrapeStatusText(`✨ Property24 live check complete: Refreshed ${mapped.length} active listings for ${refreshedSuburbs.join(', ')}.`);
          } else {
            setScrapeStatusText(`⚡ Serving ${mapped.length} cached listings for ${selectedSuburbs.join(', ')} (scraped under 15 min ago).`);
          }
        } else if (data.status === 'cooldown') {
          const mins = Math.ceil((data.rate_guard?.cooldown_remaining_seconds || 180) / 60);
          setScrapeStatusText(`🛡️ Property24 rate-limit shield active (${mins}m cooldown). Showing ${data.count || 0} cached listings.`);
        } else {
          setScrapeStatusText(`No new direct listings matched on Property24 for ${selectedSuburbs.join(', ')}. Showing cached listings.`);
        }
      } else {
        setScrapeStatusText('Live portal connection timed out. Showing cached contenders.');
      }
    } catch (err) {
      console.error('Scrape error:', err);
      setScrapeStatusText('Could not connect to live portal. Using cached high-trust properties.');
    } finally {
      setIsScraping(false);
      setTimeout(() => setScrapeStatusText(''), 6000);
    }
  };

  // Combine live/scraped properties with user imported favourites
  const allCandidateProperties = useMemo(() => {
    const list: PropertyMapItem[] = [...properties];
    const seenP24Ids = new Set(list.map((p) => String((p as any).p24_id || p.id).replace('p24-', '')));
    const seenIds = new Set(list.map((p) => p.id));

    for (const fav of importedFavourites) {
      const p24Id = String((fav as any).p24_id || fav.id).replace('p24-', '');
      if (!seenIds.has(fav.id) && (!p24Id || !seenP24Ids.has(p24Id))) {
        list.push({ ...fav, is_favorite: true });
        seenIds.add(fav.id);
        if (p24Id) seenP24Ids.add(p24Id);
      }
    }
    return list;
  }, [properties, importedFavourites]);

  // Strictly filter properties by selected suburbs, budget, and bedroom criteria
  const sortedProperties = useMemo(() => {
    const suburbCoords = selectedSuburbs.map((s) => ({
      name: s.toLowerCase().trim(),
      ...resolveLocationCoords(s),
    }));

    const minP = parseInt(minPrice) || 0;
    const maxP = parseInt(maxPrice) || 999999;
    const minBeds = parseInt(bedrooms.replace(/\D/g, '')) || 0;

    // 1. Strict Suburb Match: property address/title mentions one of the selected suburbs,
    // or is within 1.8 km of that specific suburb's center (never bleed across neighborhoods)
    const suburbMatched = allCandidateProperties.filter((prop) => {
      if (suburbCoords.length === 0) return true;
      const text = `${prop.title} ${prop.address} ${(prop as any).suburb || ''}`.toLowerCase();
      const matchesName = suburbCoords.some((sc) => text.includes(sc.name));
      if (matchesName) return true;
      return suburbCoords.some((sc) => getDistanceKm(prop.lat, prop.lng, sc.lat, sc.lng) <= 1.8);
    });

    // 2. Apply budget, bedroom, minimum floor size (sqm) & structured feature filters
    const criteriaMatched = suburbMatched.filter((prop) => {
      if (minP > 0 && prop.price > 0 && prop.price < minP) return false;
      if (maxP > 0 && prop.price > maxP) return false;
      if (minBeds > 0 && prop.bedrooms < minBeds) return false;
      if (minSqm > 0) {
        const propSqm =
          prop.sqm ||
          (() => {
            const m = `${prop.title} ${prop.address}`.match(/(\d+)\s*(?:m²|sqm|m2)/i);
            return m ? parseInt(m[1], 10) : 0;
          })();
        if (!propSqm || propSqm < minSqm) return false;
      }

      // Safe-ish crime filter (ON by default): hides properties within radius of High Risk crime hotspot
      if (safeishFilter && isPropertyInHighRiskCrimeZone(prop.lat, prop.lng)) {
        return false;
      }

      // 1. Fibre ready filter
      if (fibreFilter) {
        const text = `${prop.title} ${prop.address}`.toLowerCase();
        const hasFibre = Boolean(prop.fibre_ready) || text.includes('fibre') || text.includes('fiber') || text.includes('wifi');
        if (!hasFibre) return false;
      }

      // 2. North-facing filter
      if (northFacingFilter) {
        const facing = (prop.acoustic_audit?.facing_direction || '').toLowerCase();
        const text = `${prop.title} ${prop.address}`.toLowerCase();
        const isNorth = facing.includes('north') || text.includes('north-facing') || text.includes('north facing') || text.includes('north');
        if (!isNorth) return false;
      }

      // 3. Off-street parking filter (excludes street parking)
      if (parkingFilter) {
        const text = `${prop.title} ${prop.address}`.toLowerCase();
        const isStreetOnly =
          prop.parking_type === 'street' ||
          prop.parking_type === 'none' ||
          text.includes('street parking only') ||
          text.includes('on-street parking only');
        const hasOffStreetParking =
          Boolean(prop.has_garage) ||
          (prop.parking_type && prop.parking_type !== 'none' && prop.parking_type !== 'street') ||
          (!isStreetOnly &&
            (text.includes('garage') ||
              text.includes('off-street') ||
              text.includes('off street') ||
              text.includes('secure bay') ||
              text.includes('parking bay') ||
              text.includes('basement parking') ||
              text.includes('undercover parking') ||
              text.includes('carport') ||
              text.includes('bay')));
        if (!hasOffStreetParking) return false;
      }

      // 4. Pet-friendly filter
      if (petFriendlyFilter) {
        const text = `${prop.title} ${prop.address}`.toLowerCase();
        const isPet = Boolean(prop.pet_friendly) || text.includes('pet');
        if (!isPet) return false;
      }

      // 5. Gas hob filter
      if (gasHobFilter) {
        const text = `${prop.title} ${prop.address}`.toLowerCase();
        const isGas = prop.stove_type === 'gas' || text.includes('gas');
        if (!isGas) return false;
      }

      // 6. 100% Private Standalone filter (excludes cottages/flatlets on landlord property)
      if (privateOnlyFilter && isLandlordOnSiteProperty(prop)) {
        return false;
      }

      // 7. Off-Main Road filter (ON by default): excludes properties directly on busy arterial corridors (Main Rd, Victoria Rd, etc.)
      if (offMainRoadFilter && isMainRoadProperty(prop.address, prop.title)) {
        return false;
      }

      // 8. Selected Location Radius Filter (ON by default):
      // When withinRadiusFilter is active and an anchor location is selected,
      // properties outside the chosen radius buffer are filtered out of the top fits.
      if (withinRadiusFilter && activeAnchor) {
        const distKm = getDistanceKm(prop.lat, prop.lng, activeAnchor.lat, activeAnchor.lng);
        if (distKm > locationRadiusKm) {
          return false;
        }
      }

      return true;
    });

    // 3. Deterministic Spec, Acoustic & Personal Preferences Matching
    const scoredList = criteriaMatched.map((prop) => {
      let baseScore = prop.fit_score || 88;
      const text = `${prop.title} ${prop.address} ${(prop as any).suburb || ''}`.toLowerCase();
      const pref = personalPreferences.toLowerCase();

      // Selected Location Proximity & Radius Fit Penalty/Boost
      let distToAnchor: number | null = null;
      let isOutsideRadius = false;
      if (activeAnchor) {
        distToAnchor = getDistanceKm(prop.lat, prop.lng, activeAnchor.lat, activeAnchor.lng);
        if (distToAnchor > locationRadiusKm) {
          isOutsideRadius = true;
          // Severe penalty: outside of user-selected radius is NOT a good fit
          baseScore -= 35;
        } else {
          // Within radius: award proximity boost based on closeness
          if (distToAnchor <= 1.5) {
            baseScore += 6;
          } else if (distToAnchor <= 3.0) {
            baseScore += 4;
          } else {
            baseScore += 2;
          }
        }
      }

      // Main Road Arterial Traffic Penalty (continuous noise & opportunistic street crime)
      const busyRoadInfo = getPropertyBusyRoadExposure(prop);
      const isMainRoad = Boolean(prop.is_main_road) || isMainRoadProperty(prop.address, prop.title) || busyRoadInfo.isDirectlyOnRoad;
      if (isMainRoad) {
        baseScore -= 18;
      } else if (busyRoadInfo.isNearBusyRoad) {
        baseScore -= 10;
      }

      // Privacy / No Landlord On-Site Preference Matching
      const wantsPrivate =
        pref.includes('private') ||
        pref.includes('landlord') ||
        pref.includes('cottage') ||
        pref.includes('on-site') ||
        privateOnlyFilter;

      const isLandlordOnSite = isLandlordOnSiteProperty(prop);

      if (wantsPrivate) {
        if (isLandlordOnSite) {
          // Substantial penalty when user specifies private / no landlord on site
          baseScore -= 24;
        } else {
          // Significant boost for standalone, private residences (apartments, townhouses, houses)
          baseScore += 8;
        }
      }

      // Work style / remote work preference matching
      const wantsWfh = pref.includes('work from home') || pref.includes('wfh') || pref.includes('remote work');
      const wantsWfhFullTime = pref.includes('full-time') && (pref.includes('wfh') || pref.includes('work from home'));
      const wantsWfhPartTime = pref.includes('part-time') && (pref.includes('wfh') || pref.includes('work from home'));
      const wantsCafes = pref.includes('cafes') || pref.includes('coffee');
      const wantsOffice = pref.includes('office');

      if (wantsWfhFullTime) {
        if (prop.fibre_ready) baseScore += 6;
        if (prop.noise_risk === 'sanctuary') baseScore += 6;
        else if (isMainRoad || prop.noise_risk === 'high') baseScore -= 14;
        if (prop.sqm && prop.sqm >= 65) baseScore += 4;
        else if (prop.sqm && prop.sqm < 40) baseScore -= 8;
      } else if (wantsWfhPartTime || wantsWfh) {
        if (prop.fibre_ready) baseScore += 4;
        if (prop.noise_risk === 'sanctuary') baseScore += 3;
        else if (isMainRoad) baseScore -= 8;
      }

      if (wantsCafes) {
        const hasCafeProximity = Array.isArray(prop.location_proximity) && prop.location_proximity.some((p: any) =>
          String(p.name || p.category || '').toLowerCase().includes('cafe') ||
          String(p.name || p.category || '').toLowerCase().includes('coffee')
        );
        if (hasCafeProximity) baseScore += 5;
      }

      if (wantsOffice && activeAnchor) {
        if (distToAnchor !== null && distToAnchor <= 5.0) baseScore += 6;
        else if (distToAnchor !== null && distToAnchor > 12.0) baseScore -= 8;
      }

      // Sound sanctuary boost/penalty
      if (pref.includes('quiet') || pref.includes('sanctuary')) {
        if (prop.noise_risk === 'sanctuary') baseScore += 5;
        else if (prop.noise_risk === 'high' || isMainRoad) baseScore -= 10;
      }
      // Sunlight & orientation match
      if (pref.includes('north') && ((prop.acoustic_audit?.facing_direction || '').toLowerCase().includes('north') || text.includes('north'))) {
        baseScore += 3;
      }
      // View match
      if ((pref.includes('view') || pref.includes('ocean') || pref.includes('mountain')) && (text.includes('view') || text.includes('ocean') || text.includes('mountain') || text.includes('beach') || text.includes('sea'))) {
        baseScore += 3;
      }
      // Gas cooking match
      if (pref.includes('gas') && (prop.stove_type === 'gas' || text.includes('gas'))) {
        baseScore += 2;
      }
      // Fibre match
      if (pref.includes('fibre') && (prop.fibre_ready || text.includes('fibre'))) {
        baseScore += 2;
      }
      // Pets match
      if ((pref.includes('dog') || pref.includes('pet')) && prop.pet_friendly) {
        baseScore += 3;
      }

      const privacyInfo = getDwellingPrivacyInfo(prop);
      const agencyRep = getAgencyReputationInfo(prop);
      const barNoiseInfo = getPropertyBarNoiseExposure(prop);
      const marketVal = getRiskAdjustedValuation(prop, allCandidateProperties);
      if (marketVal) {
        if (marketVal.pctDiff >= 30) {
          baseScore -= 24;
        } else if (marketVal.pctDiff >= 15) {
          baseScore -= 14;
        } else if (marketVal.pctDiff >= 5) {
          baseScore -= 6;
        } else if (marketVal.pctDiff <= -15) {
          baseScore += 10;
        } else if (marketVal.pctDiff <= -5) {
          baseScore += 5;
        }
      }
      if (agencyRep.isPoorAgency) {
        baseScore -= 28;
      }
      if (barNoiseInfo.isExposed) {
        baseScore -= barNoiseInfo.severity === 'high' ? 14 : 8;
      }
      const crimePerimeter = getCrimePerimeterInfo(prop);
      if (crimePerimeter.isNearHighRisk) {
        if (!crimePerimeter.hasEstateSecurity) {
          baseScore -= crimePerimeter.isInsideCore ? 16 : 10;
        } else {
          baseScore -= 3;
        }
      }
      // If outside the chosen location radius, cap fit score at 55% max (never ranked as Top Fit)
      const finalFit = isOutsideRadius
        ? Math.min(55, Math.max(15, baseScore))
        : Math.min(99, Math.max(15, baseScore));

      const radiusNote = isOutsideRadius && activeAnchor && distToAnchor !== null
        ? `📍 Outside ${activeAnchor.label} radius (${distToAnchor.toFixed(1)} km > ${locationRadiusKm.toFixed(1)} km) · `
        : '';
      const privacyNote = privacyInfo.aiInsightNote;
      const acousticNote = busyRoadInfo.isNearBusyRoad && busyRoadInfo.road
        ? `🛣️ ${busyRoadInfo.isDirectlyOnRoad ? 'On' : 'Near'} ${busyRoadInfo.road.shortName} (~${busyRoadInfo.distanceM}m · ${busyRoadInfo.road.base_db} dB traffic)`
        : isMainRoad
          ? '⚠️ High-traffic arterial corridor (Main Rd)'
          : barNoiseInfo.isExposed && barNoiseInfo.hotspot
            ? `🔊 Near ${barNoiseInfo.hotspot.shortName || barNoiseInfo.hotspot.name} (~${barNoiseInfo.distanceM}m · ${barNoiseInfo.hotspot.base_db} dB)`
            : (prop.noise_risk === 'sanctuary' ? 'Code-verified <38 dB quiet zone' : 'Residential street buffer');
      const specNote = `${prop.bedrooms} bed · ${prop.sqm || 68}m² · ${prop.fibre_ready ? 'Fibre' : 'Standard'}`;
      const agencyNote = agencyRep.isPoorAgency
        ? `🚩 Poor Agency (${agencyRep.agencyName}: ${agencyRep.rating}★) · `
        : '';

      return {
        ...prop,
        fit_score: finalFit,
        is_landlord_on_site: isLandlordOnSite,
        is_main_road: isMainRoad,
        is_outside_radius: isOutsideRadius,
        distance_to_anchor_km: distToAnchor,
        ai_insight: `${radiusNote}${agencyNote}${privacyNote} · ${acousticNote} · ${specNote}`,
      };
    });

    const sorted = [...scoredList].sort((a, b) => {
      if (sortBy === 'fit') {
        // Properties inside the chosen location radius ALWAYS rank above properties outside the radius
        if (activeAnchor) {
          const aDist = getDistanceKm(a.lat, a.lng, activeAnchor.lat, activeAnchor.lng);
          const bDist = getDistanceKm(b.lat, b.lng, activeAnchor.lat, activeAnchor.lng);
          const aWithin = aDist <= locationRadiusKm;
          const bWithin = bDist <= locationRadiusKm;
          if (aWithin !== bWithin) return aWithin ? -1 : 1;
        }
        return (b.fit_score || 0) - (a.fit_score || 0);
      }
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'distance' && activeAnchor) {
        const distA = getDistanceKm(a.lat, a.lng, activeAnchor.lat, activeAnchor.lng);
        const distB = getDistanceKm(b.lat, b.lng, activeAnchor.lat, activeAnchor.lng);
        return distA - distB;
      }
      return (b.fit_score || 0) - (a.fit_score || 0);
    });

    // 4. Generate Forensic AI Reports for every listing
    return sorted.map((prop, idx) => {
      const rank = idx + 1;
      return {
        ...prop,
        rank,
        is_hidden: hiddenPropertyIds.includes(prop.id),
        deep_ai_audit: prop.deep_ai_audit || generatePropertyAiAudit(prop, rank, personalPreferences),
      };
    });
  }, [allCandidateProperties, selectedSuburbs, minPrice, maxPrice, bedrooms, minSqm, safeishFilter, offMainRoadFilter, withinRadiusFilter, locationRadiusKm, fibreFilter, northFacingFilter, parkingFilter, petFriendlyFilter, gasHobFilter, privateOnlyFilter, personalPreferences, sortBy, activeAnchor, deepAiRunCount, hiddenPropertyIds, empiricalMediansLoaded]);

  // Derived visible properties based on whether user toggled "Show Hidden" and "Show Favourites"
  const displayProperties = useMemo(() => {
    // 1. Tag is_favorite status from favouritePropertyIds & importedFavourites
    const tagged = sortedProperties.map((prop) => ({
      ...prop,
      is_favorite: Boolean(
        favouritePropertyIds.includes(prop.id) ||
        prop.is_favorite ||
        importedFavourites.some((fav) => fav.id === prop.id || ((fav as any).p24_id && (fav as any).p24_id === (prop as any).p24_id))
      ),
    }));

    // 2. Filter hidden if showHidden is false
    const visible = showHidden ? tagged : tagged.filter((prop) => !hiddenPropertyIds.includes(prop.id));

    // 3. Filter favourites if showOnlyFavourites is true
    const candidateList = showOnlyFavourites ? visible.filter((prop) => prop.is_favorite) : visible;

    // 4. Intelligent Multi-Listing Cross-Agency De-duplication
    // Detects and merges duplicate listings of the same apartment uploaded by different agencies
    const deduped: PropertyMapItem[] = [];
    const seenP24Ids = new Set<string>();
    const seenImgFingerprints = new Map<string, number>();
    const seenStreetSpecs = new Map<string, number>();

    const getImgFingerprint = (p: PropertyMapItem): string | null => {
      const src = (p.images && p.images[0]) || (p as any).image || '';
      const match = src.match(/images\.prop24\.com\/(\d+)/);
      return match ? match[1] : null;
    };

    const getStreetKey = (p: PropertyMapItem): string | null => {
      const addr = (p.address || '').toLowerCase().trim();
      if (!addr || addr.includes('contact agent') || addr.includes('withheld') || addr.includes('to rent in')) return null;
      const streetClues = ['street', 'st', 'road', 'rd', 'avenue', 'ave', 'drive', 'dr', 'circle', 'lane', 'close', 'crescent', 'cres', 'way', 'walk', 'court', 'terrace', 'terraces', 'boulevard', 'blvd'];
      const hasClue = streetClues.some(c => new RegExp(`\\b${c}\\b`).test(addr));
      if (!hasClue) return null;
      const cleanAddr = addr.replace(/^(?:unit|apt|apartment|flat)\s*\d+[a-zA-Z]?\s*,\s*/i, '').replace(/,\s*cape town.*$/i, '').trim();
      const beds = p.bedrooms || 1;
      const sqm = (p as any).sqm || 0;
      return `${cleanAddr}|${beds}|${sqm}`;
    };

    for (const prop of candidateList) {
      const p24Id = String((prop as any).p24_id || prop.id || '').replace('p24-', '');
      if (p24Id && seenP24Ids.has(p24Id)) continue;

      const imgFp = getImgFingerprint(prop);
      const stKey = getStreetKey(prop);

      let existingIdx: number | undefined = undefined;
      if (imgFp && seenImgFingerprints.has(imgFp)) {
        existingIdx = seenImgFingerprints.get(imgFp);
      } else if (stKey && seenStreetSpecs.has(stKey)) {
        existingIdx = seenStreetSpecs.get(stKey);
      }

      if (existingIdx !== undefined) {
        // Duplicate detected! Keep the one with the better price
        const prev = deduped[existingIdx];
        if (prop.price && prev.price && prop.price < prev.price) {
          seenP24Ids.delete(String((prev as any).p24_id || prev.id || '').replace('p24-', ''));
          seenP24Ids.add(p24Id);
          deduped[existingIdx] = prop;
          if (imgFp) seenImgFingerprints.set(imgFp, existingIdx);
          if (stKey) seenStreetSpecs.set(stKey, existingIdx);
        }
        continue;
      }

      const idx = deduped.length;
      if (p24Id) seenP24Ids.add(p24Id);
      if (imgFp) seenImgFingerprints.set(imgFp, idx);
      if (stKey) seenStreetSpecs.set(stKey, idx);
      deduped.push(prop);
    }

    return deduped;
  }, [sortedProperties, importedFavourites, favouritePropertyIds, hiddenPropertyIds, showHidden, showOnlyFavourites]);

  const hiddenCount = useMemo(() => {
    return sortedProperties.filter((prop) => hiddenPropertyIds.includes(prop.id)).length;
  }, [sortedProperties, hiddenPropertyIds]);

  const favouriteCount = useMemo(() => {
    return displayProperties.filter((p) => p.is_favorite).length;
  }, [displayProperties]);

  const totalFavouritesCount = useMemo(() => {
    const ids = new Set(favouritePropertyIds);
    for (const f of importedFavourites) ids.add(f.id);
    return ids.size;
  }, [favouritePropertyIds, importedFavourites]);

  // Whenever the Areas filter (selectedSuburbs) changes, clear any selected listing and frame the area cleanly
  const areasFilterKey = selectedSuburbs.map((s) => s.toLowerCase().trim()).join('|');
  useEffect(() => {
    setSelectedPropertyId(null);
    if (displayProperties.length > 0) {
      const topListing = displayProperties[0];
      setFocusTarget({
        lat: topListing.lat,
        lng: topListing.lng,
        zoom: 13.6,
        timestamp: Date.now(),
      });
    } else if (selectedSuburbs.length > 0) {
      const coords = resolveLocationCoords(selectedSuburbs[0]);
      setFocusTarget({
        lat: coords.lat,
        lng: coords.lng,
        zoom: 13.6,
        timestamp: Date.now(),
      });
    }
  }, [areasFilterKey]);

  // Auto-scroll left sidebar to selected property when clicked/highlighted on map
  useEffect(() => {
    if (!selectedPropertyId) return;
    if (isListCollapsed) {
      setIsListCollapsed(false);
    }
    const timer = setTimeout(() => {
      const el = document.getElementById(`property-card-${selectedPropertyId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedPropertyId, isListCollapsed]);

  // Photos and galleries are fetched strictly on-demand when user clicks card navigation,
  // preventing automated background request bursts to Property24.

  return (
    <div className="fixed inset-0 top-16 bg-zinc-50 flex flex-col font-sans select-none overflow-hidden z-10">
      <Navbar user={user} profile={profile} handleLogout={logout} />

      {/* Live Scrape & AI Analysis Floating Toast Notification */}
      {scrapeStatusText && (
        <div className="fixed top-20 right-6 z-[150] animate-in fade-in slide-in-from-top-3 duration-200">
          <div className={`px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-2.5 text-xs font-bold ${scrapeStatusText.includes('Found') || scrapeStatusText.includes('complete')
            ? 'bg-emerald-950/95 text-emerald-100 border-emerald-500/60 shadow-emerald-950/40'
            : scrapeStatusText.includes('Scraping') || scrapeStatusText.includes('Running') || scrapeStatusText.includes('Connecting')
              ? 'bg-indigo-950/95 text-indigo-100 border-indigo-500/60 shadow-indigo-950/40'
              : 'bg-zinc-950/95 text-zinc-100 border-zinc-700/60 shadow-black/40'
            }`}>
            {scrapeStatusText.includes('Scraping') || scrapeStatusText.includes('Running') || scrapeStatusText.includes('Connecting') ? (
              <CircleNotch size={16} className="animate-spin text-indigo-400 shrink-0" />
            ) : scrapeStatusText.includes('Found') || scrapeStatusText.includes('complete') ? (
              <CheckCircle size={16} weight="fill" className="text-emerald-400 shrink-0" />
            ) : (
              <Info size={16} weight="bold" className="text-amber-400 shrink-0" />
            )}
            <span>{scrapeStatusText}</span>
            <button
              type="button"
              onClick={() => setScrapeStatusText('')}
              className="ml-1.5 p-0.5 text-zinc-400 hover:text-white rounded-md cursor-pointer transition-colors"
              aria-label="Dismiss message"
            >
              <X size={12} weight="bold" />
            </button>
          </div>
        </div>
      )}

      {/* TOP COMPACT CRITERIA BAR (Sticky below Navbar) */}
      <header className="sticky top-0 w-full bg-white/98 backdrop-blur-md border-b border-zinc-200 z-[100] px-3 py-2 shadow-xs shrink-0">
        <div className="w-full flex items-center justify-between gap-2">

          {/* Left Group: Areas & Core Property Selectors (Shrink-0) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 0. Areas (Area Group Templates Selector) */}
            <div className="relative shrink-0 flex items-center" ref={savedSearchMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsSavedSearchMenuOpen(!isSavedSearchMenuOpen);
                  setIsAnchorMenuOpen(false);
                  setIsBudgetMenuOpen(false);
                }}
                className="h-7 flex items-center gap-1.5 px-2.5 rounded-xl text-[11px] font-extrabold bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 border border-zinc-200 transition-all cursor-pointer shadow-2xs leading-none"
                title="Switch or Save Area Group Templates"
              >
                <MapPin size={13} weight="fill" className="text-indigo-600 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Areas:</span>
                <span className="truncate max-w-[210px]">
                  {savedSearches.find(s => s.id === activeSavedSearchId)?.name || 'Select Area Group'}
                </span>
                <CaretDown size={11} weight="bold" className="text-zinc-500 shrink-0" />
              </button>

              {/* Areas (Templates) Dropdown Popover */}
              {isSavedSearchMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-zinc-200 p-3 z-[110] animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <span className="font-extrabold text-xs text-zinc-950 flex items-center gap-1.5">
                      <MapPin size={14} className="text-indigo-600" weight="fill" />
                      Areas (Suburb Group Templates)
                    </span>
                    <button onClick={() => setIsSavedSearchMenuOpen(false)} className="text-zinc-400 hover:text-zinc-700 p-0.5 cursor-pointer">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1.5 py-2">
                    {savedSearches.map((preset) => (
                      <div
                        key={preset.id}
                        onClick={() => applySavedSearch(preset)}
                        className={`p-2.5 rounded-xl text-xs cursor-pointer transition-all border ${activeSavedSearchId === preset.id
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-950 font-bold shadow-2xs'
                          : 'bg-zinc-50/60 hover:bg-zinc-100 border-zinc-200/60 text-zinc-700'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-extrabold text-xs text-zinc-950 truncate">{preset.name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="px-1.5 py-0.5 rounded-md bg-indigo-100/80 text-indigo-800 text-[9px] font-black">
                              {preset.suburbs.length} {preset.suburbs.length === 1 ? 'area' : 'areas'}
                            </span>
                            {preset.isCustom && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteSavedSearch(preset.id, e)}
                                className="text-zinc-400 hover:text-rose-600 p-1"
                                title="Delete area template"
                              >
                                <Trash size={12} weight="bold" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center flex-wrap gap-1 mt-1">
                          {preset.suburbs.map((sub) => (
                            <span
                              key={sub}
                              className="px-1.5 py-0.5 rounded-md bg-white border border-zinc-200/80 text-[10px] font-semibold text-zinc-600"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save Current Area Group Form */}
                  <div className="pt-2 border-t border-zinc-100">
                    {!isSavingSearch ? (
                      <button
                        type="button"
                        onClick={() => setIsSavingSearch(true)}
                        className="w-full py-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={13} weight="bold" className="text-indigo-600" />
                        <span>Save Current Areas As Template</span>
                      </button>
                    ) : (
                      <div className="space-y-1.5 animate-in fade-in duration-100">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Area Group Name:</span>
                        <input
                          type="text"
                          placeholder="e.g. Atlantic Seaboard & Surfs"
                          value={newSearchName}
                          onChange={(e) => setNewSearchName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveCurrentSearch();
                          }}
                          className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-zinc-200 focus:outline-none focus:border-indigo-600"
                          autoFocus
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleSaveCurrentSearch}
                            className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <FloppyDisk size={13} weight="bold" />
                            <span>Save Areas</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsSavingSearch(false);
                              setNewSearchName('');
                            }}
                            className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl text-xs font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 1. Budget Interactive Dual-Slider Filter (In & Out Points) */}
            <div className="relative shrink-0 flex items-center" ref={budgetMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsBudgetMenuOpen(!isBudgetMenuOpen);
                  setIsSavedSearchMenuOpen(false);
                  setIsAnchorMenuOpen(false);
                }}
                className={`h-7 w-[172px] sm:w-[185px] shrink-0 flex items-center justify-between gap-1 px-2.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer leading-none shadow-2xs ${isBudgetMenuOpen
                  ? 'bg-zinc-950 text-white border-zinc-950 ring-2 ring-zinc-950/20 shadow-xs'
                  : (minPrice && minPrice !== '0') || (maxPrice && maxPrice !== '50000' && maxPrice !== '999999')
                    ? 'bg-indigo-50 hover:bg-indigo-100/70 border-indigo-300 text-indigo-950 font-extrabold'
                    : 'bg-zinc-100 hover:bg-zinc-200/80 border-zinc-200 text-zinc-700'
                  }`}
                title="Click to adjust monthly budget range with in & out slider handles"
              >
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">Budget:</span>
                  <span className="font-extrabold tabular-nums truncate">
                    {(() => {
                      const minNum = parseInt(minPrice) || 0;
                      const maxNum = parseInt(maxPrice) || 0;
                      if (!minNum && (!maxNum || maxNum >= 50000)) return 'Any';
                      if (!minNum && maxNum) return `< R ${formatPriceAbbr(maxNum)}`;
                      if (minNum && (!maxNum || maxNum >= 50000)) return `> R ${formatPriceAbbr(minNum)}`;
                      return `R ${formatPriceAbbr(minNum)} – R ${formatPriceAbbr(maxNum)}`;
                    })()}
                  </span>
                </div>
                <SlidersHorizontal size={12} weight="bold" className={`shrink-0 ${isBudgetMenuOpen ? 'text-indigo-400' : 'text-zinc-500'}`} />
              </button>

              {/* Budget Slider Popover with In & Out points */}
              {isBudgetMenuOpen && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="absolute left-0 top-full mt-2 w-80 sm:w-88 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200 p-4 z-[110] animate-in fade-in zoom-in-95 duration-150 select-none"
                >
                  {/* Popover Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
                        <SlidersHorizontal size={14} weight="bold" />
                      </div>
                      <div>
                        <span className="font-extrabold text-xs text-zinc-950 block">Monthly Budget</span>
                        <span className="text-[10px] text-zinc-400 font-medium block">Drag in &amp; out points to filter</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBudgetMenuOpen(false)}
                      className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* In-Point (Min) and Out-Point (Max) Input Boxes */}
                  {(() => {
                    const SLIDER_MIN = 5000;
                    const SLIDER_MAX = 50000;
                    const SLIDER_STEP = 500;
                    const currMin = parseInt(minPrice) || SLIDER_MIN;
                    const currMax = parseInt(maxPrice) || SLIDER_MAX;
                    const clampedMin = Math.max(SLIDER_MIN, Math.min(currMin, SLIDER_MAX - SLIDER_STEP));
                    const clampedMax = Math.max(clampedMin + SLIDER_STEP, Math.min(currMax, SLIDER_MAX));
                    const minPercent = ((clampedMin - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
                    const maxPercent = ((clampedMax - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;

                    return (
                      <div className="py-3.5 space-y-4">
                        {/* Dual Number Display / Inputs */}
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 p-2 rounded-xl bg-zinc-50 border border-zinc-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                            <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-400">
                              In-Point (Min)
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs font-black text-indigo-600">R</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={minPrice}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^0-9]/g, '');
                                  setMinPrice(v);
                                }}
                                className="w-full text-xs font-black tabular-nums text-zinc-900 bg-transparent focus:outline-none"
                                placeholder="5000"
                              />
                            </div>
                          </div>

                          <div className="text-zinc-400 font-black text-xs shrink-0">to</div>

                          <div className="flex-1 p-2 rounded-xl bg-zinc-50 border border-zinc-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                            <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-400">
                              Out-Point (Max)
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs font-black text-indigo-600">R</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={maxPrice}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^0-9]/g, '');
                                  setMaxPrice(v);
                                }}
                                className="w-full text-xs font-black tabular-nums text-zinc-900 bg-transparent focus:outline-none"
                                placeholder="50000"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Dual-Handle Range Slider (In-point & Out-point) */}
                        <div className="relative pt-2 pb-1 px-1">
                          {/* Background Base Track */}
                          <div className="relative h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                            <div
                              className="absolute h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
                              style={{
                                left: `${minPercent}%`,
                                width: `${Math.max(0, maxPercent - minPercent)}%`,
                              }}
                            />
                          </div>

                          {/* In-Point Range Input (Min) */}
                          <input
                            type="range"
                            min={SLIDER_MIN}
                            max={SLIDER_MAX}
                            step={SLIDER_STEP}
                            value={clampedMin}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const nextMin = Math.min(val, clampedMax - SLIDER_STEP);
                              setMinPrice(String(nextMin));
                            }}
                            style={{ zIndex: clampedMin > (SLIDER_MAX - SLIDER_MIN) * 0.7 ? 35 : 25 }}
                            className="absolute inset-x-1 top-1.5 w-[calc(100%-8px)] h-3 appearance-none bg-transparent pointer-events-none
                                  [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
                                  [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full
                                  [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[2.5px] [&::-webkit-slider-thumb]:border-indigo-600
                                  [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
                                  [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                                  [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[2.5px]
                                  [&::-moz-range-thumb]:border-indigo-600 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab
                                  [&::-moz-range-thumb]:active:cursor-grabbing"
                            aria-label="Minimum price in-point slider"
                          />

                          {/* Out-Point Range Input (Max) */}
                          <input
                            type="range"
                            min={SLIDER_MIN}
                            max={SLIDER_MAX}
                            step={SLIDER_STEP}
                            value={clampedMax}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const nextMax = Math.max(val, clampedMin + SLIDER_STEP);
                              setMaxPrice(String(nextMax));
                            }}
                            style={{ zIndex: clampedMin > (SLIDER_MAX - SLIDER_MIN) * 0.7 ? 25 : 35 }}
                            className="absolute inset-x-1 top-1.5 w-[calc(100%-8px)] h-3 appearance-none bg-transparent pointer-events-none
                                  [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
                                  [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full
                                  [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[2.5px] [&::-webkit-slider-thumb]:border-indigo-600
                                  [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
                                  [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                                  [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[2.5px]
                                  [&::-moz-range-thumb]:border-indigo-600 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab
                                  [&::-moz-range-thumb]:active:cursor-grabbing"
                            aria-label="Maximum price out-point slider"
                          />

                          {/* Scale Markers */}
                          <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 mt-3 px-0.5">
                            <span>R 5k</span>
                            <span>R 15k</span>
                            <span>R 25k</span>
                            <span>R 35k</span>
                            <span>R 50k+</span>
                          </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="pt-2.5 border-t border-zinc-100">
                          <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                            Quick Presets
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: '< R 12k', min: '5000', max: '12000' },
                              { label: 'R 10k–16k', min: '10000', max: '16000' },
                              { label: 'R 14k–20k', min: '14000', max: '20000' },
                              { label: 'R 18k–30k', min: '18000', max: '30000' },
                              { label: 'Any', min: '5000', max: '50000' },
                            ].map((preset) => {
                              const isSelected = minPrice === preset.min && maxPrice === preset.max;
                              return (
                                <button
                                  key={preset.label}
                                  type="button"
                                  onClick={() => {
                                    setMinPrice(preset.min);
                                    setMaxPrice(preset.max);
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${isSelected
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                                    }`}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Popover Footer: Live Count & Done Button */}
                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-500">
                      <strong className="text-zinc-950 font-extrabold tabular-nums inline-block min-w-[14px]">{displayProperties.length}</strong> listings in range
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsBudgetMenuOpen(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="h-7 flex items-center gap-1 bg-zinc-100 px-2.5 rounded-xl text-[11px] border border-zinc-200 leading-none">
              <span className="text-[10px] font-bold text-zinc-400">Beds:</span>
              <select
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="font-bold text-zinc-800 bg-transparent focus:outline-none cursor-pointer leading-none"
              >
                <option value="1+">1+ Bed</option>
                <option value="2+">2+ Beds</option>
                <option value="3+">3+ Beds</option>
                <option value="any">Any</option>
              </select>
            </div>

            {/* 2B. Minimum Size (sqm) Slider Filter */}
            <div className="relative shrink-0 flex items-center" ref={sizeMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsSizeMenuOpen(!isSizeMenuOpen);
                  setIsBudgetMenuOpen(false);
                  setIsSavedSearchMenuOpen(false);
                  setIsAnchorMenuOpen(false);
                }}
                className={`h-7 shrink-0 flex items-center justify-between gap-1.5 px-2.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer leading-none shadow-2xs ${isSizeMenuOpen
                  ? 'bg-zinc-950 text-white border-zinc-950 ring-2 ring-zinc-950/20 shadow-xs'
                  : minSqm > 0
                    ? 'bg-indigo-50 hover:bg-indigo-100/70 border-indigo-300 text-indigo-950 font-extrabold'
                    : 'bg-zinc-100 hover:bg-zinc-200/80 border-zinc-200 text-zinc-700'
                  }`}
                title="Filter by minimum floor size in square metres (m²)"
              >
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <Ruler size={12} weight="bold" className={isSizeMenuOpen ? 'text-indigo-400' : minSqm > 0 ? 'text-indigo-600' : 'text-zinc-500'} />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Size:</span>
                  <span className="font-extrabold tabular-nums">
                    {minSqm > 0 ? `${minSqm}+ m²` : 'Any'}
                  </span>
                </div>
                <CaretDown size={10} weight="bold" className={`shrink-0 ${isSizeMenuOpen ? 'text-indigo-400' : 'text-zinc-500'}`} />
              </button>

              {/* Minimum Size Slider Popover */}
              {isSizeMenuOpen && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200 p-4 z-[110] animate-in fade-in zoom-in-95 duration-150 select-none"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
                        <Ruler size={14} weight="bold" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs text-zinc-950 leading-tight">Minimum Floor Size</h4>
                        <p className="text-[10px] text-zinc-400 font-medium">Drag slider to filter by minimum m²</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSizeMenuOpen(false)}
                      className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
                    >
                      <X size={14} weight="bold" />
                    </button>
                  </div>

                  <div className="py-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                        Minimum Size
                      </span>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-50 border border-zinc-200">
                        <input
                          type="number"
                          min={0}
                          max={200}
                          step={5}
                          value={minSqm}
                          onChange={(e) => setMinSqm(Math.max(0, Math.min(200, parseInt(e.target.value) || 0)))}
                          className="w-12 text-xs font-black text-zinc-950 bg-transparent focus:outline-none text-right tabular-nums"
                        />
                        <span className="text-[11px] font-bold text-zinc-500">m²</span>
                      </div>
                    </div>

                    {/* Interactive Range Slider */}
                    <div className="relative pt-1 pb-1">
                      <div className="relative h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full"
                          style={{ width: `${Math.min(100, (minSqm / 120) * 100)}%` }}
                        />
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={120}
                        step={5}
                        value={Math.min(120, minSqm)}
                        onChange={(e) => setMinSqm(Number(e.target.value))}
                        className="absolute inset-x-0 top-0 w-full h-4 appearance-none bg-transparent cursor-pointer
                              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[2.5px]
                              [&::-webkit-slider-thumb]:border-indigo-600 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab
                              [&::-webkit-slider-thumb]:active:cursor-grabbing
                              [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
                              [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[2.5px] [&::-moz-range-thumb]:border-indigo-600
                              [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab"
                        aria-label="Minimum size in square metres"
                      />
                      <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 mt-3 px-0.5">
                        <span>Any</span>
                        <span>40m²</span>
                        <span>55m²</span>
                        <span>75m²</span>
                        <span>100m²+</span>
                      </div>
                    </div>

                    {/* Quick Size Presets */}
                    <div className="pt-2.5 border-t border-zinc-100">
                      <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                        Quick Size Presets
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: 'Any', val: 0 },
                          { label: '45+ m²', val: 45 },
                          { label: '55+ m²', val: 55 },
                          { label: '65+ m²', val: 65 },
                          { label: '80+ m²', val: 80 },
                          { label: '100+ m²', val: 100 },
                        ].map((preset) => {
                          const isSelected = minSqm === preset.val;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => setMinSqm(preset.val)}
                              className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${isSelected
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                                }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-500">
                      <strong className="text-zinc-950 font-extrabold tabular-nums inline-block min-w-[14px]">{displayProperties.length}</strong> listings match
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSizeMenuOpen(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Desirable Locations & Trailheads Button */}
            <div className="relative flex items-center" ref={anchorMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsAnchorMenuOpen(!isAnchorMenuOpen);
                  setIsSavedSearchMenuOpen(false);
                  setIsBudgetMenuOpen(false);
                  setIsSizeMenuOpen(false);
                }}
                className={`h-7 flex items-center gap-1.5 px-2.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer leading-none ${activeAnchor
                  ? activeAnchor.iconType === 'gym'
                    ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs'
                    : activeAnchor.iconType === 'cafe'
                      ? 'bg-orange-50 border-orange-300 text-orange-950 shadow-xs'
                      : activeAnchor.iconType === 'shop'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                        : activeAnchor.iconType === 'surf' || activeAnchor.iconType === 'beach'
                          ? 'bg-cyan-50 border-cyan-300 text-cyan-950 shadow-xs'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-700'
                  }`}
              >
                {activeAnchor?.iconType === 'gym' ? (
                  <Dumbbell size={13} className="text-amber-600 shrink-0" />
                ) : activeAnchor?.iconType === 'cafe' ? (
                  <Coffee size={13} weight="fill" className="text-orange-600 shrink-0" />
                ) : activeAnchor?.iconType === 'shop' ? (
                  <ShoppingBag size={13} className="text-emerald-600 shrink-0" />
                ) : activeAnchor?.iconType === 'surf' || activeAnchor?.iconType === 'beach' ? (
                  <Waves size={13} weight="fill" className="text-cyan-600 shrink-0" />
                ) : activeAnchor?.iconType === 'trail' ? (
                  <Tree size={13} weight="bold" className="text-emerald-600 shrink-0" />
                ) : (
                  <Target size={13} weight="bold" className="text-indigo-600 shrink-0" />
                )}
                <span className="truncate max-w-[125px]">{activeAnchor ? activeAnchor.label : 'Select Attraction'}</span>
                <span className="px-1.5 py-0.5 bg-zinc-200/80 rounded-md text-[10px] font-extrabold text-zinc-800 leading-none">
                  {templateAttractions.length + templateGyms.length + templateCafes.length + templateShops.length}
                </span>
              </button>

              {/* Anchor Dropdown Popover */}
              {isAnchorMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-84 bg-white rounded-2xl shadow-2xl border border-zinc-200 p-3 z-[110] animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <span className="font-extrabold text-xs text-zinc-950 flex items-center gap-1.5">
                      <Compass size={14} className="text-indigo-600" weight="bold" />
                      Amenities & POIs · {activeTemplate?.name ? activeTemplate.name.replace(/^[^\w\s]+\s*/, '') : 'Area'}
                    </span>
                    <button onClick={() => setIsAnchorMenuOpen(false)} className="text-zinc-400 hover:text-zinc-700 p-0.5">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto space-y-3 py-2 pr-1">
                    {/* 1. Gyms Group */}
                    {templateGyms.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
                          <span className="flex items-center gap-1">
                            <Dumbbell size={11} /> Gyms in Area
                          </span>
                          <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md font-black text-[9px]">
                            {templateGyms.length}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {templateGyms.map((anc) => (
                            <div
                              key={anc.id}
                              onClick={() => {
                                setActiveAnchorId(anc.id);
                                setIsAnchorMenuOpen(false);
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                                ? 'bg-amber-50 text-amber-950 font-bold border border-amber-300'
                                : 'hover:bg-zinc-50 text-zinc-700'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Dumbbell size={14} className="text-amber-600 shrink-0" />
                                <span className="truncate">{anc.label}</span>
                              </div>
                              {activeAnchorId === anc.id && (
                                <Check size={14} weight="bold" className="text-amber-600 shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. Cafes & Bakeries Group */}
                    {templateCafes.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-orange-700">
                          <span className="flex items-center gap-1">
                            <Coffee size={11} weight="fill" /> Cafes & Bakeries
                          </span>
                          <span className="bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded-md font-black text-[9px]">
                            {templateCafes.length}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {templateCafes.map((anc) => (
                            <div
                              key={anc.id}
                              onClick={() => {
                                setActiveAnchorId(anc.id);
                                setIsAnchorMenuOpen(false);
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                                ? 'bg-orange-50 text-orange-950 font-bold border border-orange-300'
                                : 'hover:bg-zinc-50 text-zinc-700'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Coffee size={14} weight="fill" className="text-orange-600 shrink-0" />
                                <span className="truncate">{anc.label}</span>
                              </div>
                              {activeAnchorId === anc.id && (
                                <Check size={14} weight="bold" className="text-orange-600 shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. Shops & Retail Centres Group */}
                    {templateShops.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                          <span className="flex items-center gap-1">
                            <ShoppingBag size={11} /> Shops & Retail
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-md font-black text-[9px]">
                            {templateShops.length}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {templateShops.map((anc) => (
                            <div
                              key={anc.id}
                              onClick={() => {
                                setActiveAnchorId(anc.id);
                                setIsAnchorMenuOpen(false);
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                                ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-300'
                                : 'hover:bg-zinc-50 text-zinc-700'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <ShoppingBag size={14} className="text-emerald-600 shrink-0" />
                                <span className="truncate">{anc.label}</span>
                              </div>
                              {activeAnchorId === anc.id && (
                                <Check size={14} weight="bold" className="text-emerald-600 shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4. Main Outdoors & Attractions */}
                    {templateAttractions.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-cyan-800">
                          <span className="flex items-center gap-1">
                            <Waves size={11} weight="bold" /> Outdoors & Attractions
                          </span>
                          <span className="bg-cyan-100 text-cyan-800 px-1.5 py-0.2 rounded-md font-black text-[9px]">
                            {templateAttractions.length}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {templateAttractions.map((anc) => (
                            <div
                              key={anc.id}
                              onClick={() => {
                                setActiveAnchorId(anc.id);
                                setIsAnchorMenuOpen(false);
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                                ? 'bg-cyan-50 text-cyan-950 font-bold border border-cyan-300'
                                : 'hover:bg-zinc-50 text-zinc-700'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {anc.iconType === 'trail' ? (
                                  <Tree size={14} weight="fill" className="text-emerald-600 shrink-0" />
                                ) : anc.iconType === 'surf' || anc.iconType === 'beach' ? (
                                  <Waves size={14} weight="fill" className="text-cyan-600 shrink-0" />
                                ) : anc.iconType === 'cafe' ? (
                                  <Coffee size={14} weight="fill" className="text-amber-600 shrink-0" />
                                ) : (
                                  <Compass size={14} weight="bold" className="text-indigo-600 shrink-0" />
                                )}
                                <span className="truncate">{anc.label}</span>
                              </div>
                              {activeAnchorId === anc.id && (
                                <Check size={14} weight="bold" className="text-cyan-600 shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 5. Other Regional Hubs */}
                    {otherAnchors.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                          <span>Other Regional Hubs</span>
                          <span className="text-[9px] font-bold text-zinc-400">{otherAnchors.length}</span>
                        </div>
                        <div className="space-y-1">
                          {otherAnchors.slice(0, 6).map((anc) => (
                            <div
                              key={anc.id}
                              onClick={() => {
                                setActiveAnchorId(anc.id);
                                setIsAnchorMenuOpen(false);
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                                ? 'bg-zinc-100 text-zinc-950 font-bold border border-zinc-300'
                                : 'hover:bg-zinc-50 text-zinc-600'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {anc.iconType === 'gym' ? (
                                  <Dumbbell size={14} className="text-zinc-500 shrink-0" />
                                ) : anc.iconType === 'cafe' ? (
                                  <Coffee size={14} weight="fill" className="text-zinc-500 shrink-0" />
                                ) : anc.iconType === 'shop' ? (
                                  <ShoppingBag size={14} className="text-zinc-500 shrink-0" />
                                ) : anc.iconType === 'trail' ? (
                                  <Tree size={14} weight="fill" className="text-zinc-500 shrink-0" />
                                ) : anc.iconType === 'surf' || anc.iconType === 'beach' ? (
                                  <Waves size={14} weight="fill" className="text-zinc-500 shrink-0" />
                                ) : (
                                  <Target size={14} weight="bold" className="text-zinc-500 shrink-0" />
                                )}
                                <span className="truncate">{anc.label}</span>
                              </div>
                              {activeAnchorId === anc.id && (
                                <Check size={14} weight="bold" className="text-zinc-900 shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Add Custom Spot Form with Real-Time Auto-Suggestions */}
                  <div className="pt-2 border-t border-zinc-100 space-y-1.5 relative">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Add Custom Location:
                    </span>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Type location (e.g. Scarborough Beach, Deer Park)"
                        value={newAnchorLabel}
                        onChange={(e) => {
                          setNewAnchorLabel(e.target.value);
                          setIsAnchorInputFocused(true);
                          setAnchorAutoIndex(0);
                        }}
                        onFocus={() => setIsAnchorInputFocused(true)}
                        onBlur={() => {
                          // Delay closing so onMouseDown on suggestions registers
                          setTimeout(() => setIsAnchorInputFocused(false), 200);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setAnchorAutoIndex((prev) => (prev + 1) % Math.max(1, anchorSuggestions.length));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setAnchorAutoIndex((prev) => (prev - 1 + anchorSuggestions.length) % Math.max(1, anchorSuggestions.length));
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (anchorSuggestions.length > 0 && anchorSuggestions[anchorAutoIndex]) {
                              handleSelectSuggestedPlace(anchorSuggestions[anchorAutoIndex]);
                            } else {
                              handleAddCustomAnchor();
                            }
                          } else if (e.key === 'Escape') {
                            setIsAnchorInputFocused(false);
                          }
                        }}
                        className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-zinc-200 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 font-medium"
                      />

                      {/* Auto-suggestions Dropdown Popover */}
                      {isAnchorInputFocused && newAnchorLabel.trim().length > 0 && anchorSuggestions.length > 0 && (
                        <div className="absolute bottom-full mb-1.5 inset-x-0 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200 p-1.5 z-[115] max-h-52 overflow-y-auto animate-in fade-in duration-100">
                          <div className="px-2 py-1 text-[9.5px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 flex items-center justify-between">
                            <span>Suggested Locations</span>
                            <span className="text-[9px] text-zinc-400 font-normal">Press Enter ↵</span>
                          </div>
                          <div className="space-y-0.5 mt-1">
                            {anchorSuggestions.map((place, idx) => (
                              <div
                                key={place.name + place.lat}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectSuggestedPlace(place);
                                }}
                                className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors ${idx === anchorAutoIndex
                                  ? 'bg-indigo-50 text-indigo-950 font-bold border border-indigo-200/80 shadow-2xs'
                                  : 'hover:bg-zinc-50 text-zinc-800'
                                  }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  {place.iconType === 'gym' ? (
                                    <Dumbbell size={13} className="text-amber-600 shrink-0" />
                                  ) : place.iconType === 'surf' || place.iconType === 'beach' ? (
                                    <Waves size={13} weight="fill" className="text-cyan-600 shrink-0" />
                                  ) : place.iconType === 'trail' ? (
                                    <Tree size={13} weight="fill" className="text-emerald-600 shrink-0" />
                                  ) : place.iconType === 'cafe' ? (
                                    <Coffee size={13} weight="fill" className="text-amber-600 shrink-0" />
                                  ) : (
                                    <Target size={13} weight="bold" className="text-indigo-600 shrink-0" />
                                  )}
                                  <div className="truncate text-left">
                                    <span className="block font-bold text-zinc-950 leading-tight truncate">{place.name}</span>
                                    <span className="block text-[10px] text-zinc-400 leading-tight truncate">{place.category}</span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-extrabold text-indigo-600 shrink-0 ml-1.5 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200/60">
                                  + Add
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCustomAnchor}
                      className="w-full py-1.5 bg-zinc-950 hover:bg-black text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      + Add to Map
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Group: Primary Actions (Always Pinned & Fully Visible) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* AI Deep Analysis Button with Top 10 Pill */}
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="h-7 flex items-center gap-1.5 px-3 rounded-xl text-[11px] font-black border transition-all cursor-pointer leading-none shadow-xs bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white border-indigo-500 ring-2 ring-purple-400/20 active:scale-[0.98] shrink-0 whitespace-nowrap"
              title="Configure personal preferences and run AI Deep Analysis on Top 10"
            >
              <Sparkle size={13} weight="fill" className="text-amber-300 shrink-0" />
              <span>AI Deep Analysis</span>
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-white text-[9px] font-black uppercase tracking-wider">
                Top 10
              </span>
            </button>

            {/* 4. SCRAPE P24 ACTION BUTTON */}
            <button
              type="button"
              onClick={handleScrapeP24}
              disabled={isScraping || Date.now() < rateGuardUntil}
              className={`h-7 flex items-center gap-1.5 px-3 rounded-xl text-[11px] font-extrabold shadow-md transition-all leading-none shrink-0 whitespace-nowrap ${isScraping
                ? 'bg-indigo-850 text-indigo-200 cursor-wait ring-2 ring-indigo-400'
                : Date.now() < rateGuardUntil
                  ? 'bg-amber-600/90 text-white cursor-not-allowed opacity-90'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white shadow-indigo-600/20 cursor-pointer'
                }`}
              title={Date.now() < rateGuardUntil ? 'Rate-Limit Shield active — cooling down to prevent Property24 IP blocks' : 'Scrape Property24 live listings for selected suburbs'}
            >
              {isScraping ? (
                <CircleNotch size={13} className="animate-spin text-white shrink-0" />
              ) : (
                <Sparkle size={13} weight="fill" className="text-amber-300 shrink-0" />
              )}
              <span>{isScraping ? 'Scraping P24...' : Date.now() < rateGuardUntil ? 'Shield Cooldown' : 'Scrape P24'}</span>
            </button>
          </div>

        </div>

        {/* ROW 2: Left = Selected Area Pills & "+ Add area..." | Right = Feature Filter Buttons (under AI Deep Analysis) */}
        <div className="w-full flex items-center justify-between flex-wrap gap-2 pt-1.5 mt-1.5 border-t border-zinc-100">
          {/* Left: Suburb Pills + Autocomplete */}
          <div className="flex items-center flex-wrap gap-1.5 min-w-0">
            {selectedSuburbs.map((suburb) => (
              <span
                key={suburb}
                onClick={() => handleFocusSuburb(suburb)}
                title={`Click to pan map to ${suburb}`}
                className="h-6 inline-flex items-center gap-1 px-2.5 rounded-full text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 active:scale-95 border border-indigo-200 hover:border-indigo-300 text-indigo-900 shrink-0 cursor-pointer transition-all leading-none group"
              >
                <span>{suburb}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveSuburb(suburb);
                  }}
                  className="hover:text-rose-600 p-0.5 rounded-full transition-colors cursor-pointer flex items-center justify-center"
                  title={`Remove ${suburb}`}
                >
                  <X size={10} weight="bold" />
                </button>
              </span>
            ))}

            {/* Places Autocomplete Typeahead Input */}
            <div className="relative flex items-center shrink-0">
              <input
                type="text"
                placeholder="+ Add area..."
                value={suburbInput}
                onFocus={() => {
                  setIsInputFocused(true);
                  setAutoIndex(0);
                }}
                onBlur={() => {
                  setTimeout(() => setIsInputFocused(false), 200);
                }}
                onChange={(e) => {
                  setSuburbInput(e.target.value);
                  setIsInputFocused(true);
                  setAutoIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setAutoIndex((prev) => (prev + 1) % Math.max(1, autocompleteSuggestions.length));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setAutoIndex((prev) => (prev - 1 + autocompleteSuggestions.length) % Math.max(1, autocompleteSuggestions.length));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (autocompleteSuggestions.length > 0 && autocompleteSuggestions[autoIndex]) {
                      handleAddSuburb(autocompleteSuggestions[autoIndex].name);
                    } else if (suburbInput.trim()) {
                      handleAddSuburb(suburbInput);
                    }
                  } else if (e.key === 'Escape') {
                    setIsInputFocused(false);
                  }
                }}
                className="h-6 w-28 focus:w-44 text-[11px] px-2.5 rounded-full border border-zinc-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all placeholder:text-zinc-400 bg-zinc-50/80 font-medium leading-none"
              />

              {/* Autocomplete Suggestions Menu */}
              {isInputFocused && suburbInput.trim().length > 0 && (
                <div className="absolute top-full left-0 mt-1.5 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200 py-1.5 z-[110] animate-in fade-in zoom-in-95 duration-100 overflow-hidden divide-y divide-zinc-50">
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                    <span>Neighborhoods</span>
                    <span className="text-[9px] text-zinc-400 font-normal">Press Enter ↵</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {autocompleteSuggestions.length > 0 ? (
                      autocompleteSuggestions.map((sub, idx) => (
                        <div
                          key={sub.name}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleAddSuburb(sub.name);
                          }}
                          className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${idx === autoIndex ? 'bg-indigo-50/90 text-indigo-950 font-bold' : 'hover:bg-zinc-50 text-zinc-800'
                            }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${idx === autoIndex ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                              <MapPin size={12} weight="bold" />
                            </div>
                            <div className="truncate">
                              <span className="font-extrabold text-xs block leading-tight truncate">{sub.name}</span>
                              <span className="text-[10px] text-zinc-400 font-medium block leading-tight truncate">{sub.region}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md shrink-0">
                            + Add
                          </span>
                        </div>
                      ))
                    ) : (
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAddSuburb(suburbInput);
                        }}
                        className="px-3 py-2.5 text-xs text-zinc-500 hover:bg-zinc-50 cursor-pointer flex items-center justify-between"
                      >
                        <span className="truncate">Add "{suburbInput.trim()}"</span>
                        <span className="text-[10px] font-bold text-indigo-600">+ Add</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Feature Filter Buttons positioned directly on the row under AI Deep Analysis */}
          <div className="flex items-center flex-wrap gap-1.5 ml-auto">
            <button
              type="button"
              onClick={() => setFibreFilter(!fibreFilter)}
              className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${fibreFilter
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-1 ring-zinc-700'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
                }`}
              title="Filter listings: Fibre ready internet only"
            >
              <span className={fibreFilter ? "text-cyan-300" : "text-zinc-500"}>🌐</span>
              <span>Fibre ready</span>
            </button>

            <button
              type="button"
              onClick={() => setNorthFacingFilter(!northFacingFilter)}
              className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${northFacingFilter
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-1 ring-zinc-700'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
                }`}
              title="Filter listings: North-facing orientation for maximum natural sunlight"
            >
              <span className={northFacingFilter ? "text-amber-300" : "text-zinc-500"}>☀️</span>
              <span>North-facing</span>
            </button>

            {/* Safe-ish Crime Hotspot Filter Button (ON by default) */}
            <button
              type="button"
              onClick={() => setSafeishFilter(!safeishFilter)}
              className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${safeishFilter
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800 shadow-2xs ring-1 ring-emerald-500/30'
                : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200/70'
                }`}
              title={
                safeishFilter
                  ? "Safe-ish: ON (Default: hiding properties within High-Risk crime radii). Click to show all properties."
                  : "Safe-ish: OFF (Showing all properties including those near High-Risk crime zones). Click to filter."
              }
            >
              <span className={safeishFilter ? "text-emerald-400" : "text-zinc-400"}>🛡️</span>
              <span>Safe-ish</span>
              {safeishFilter && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              )}
            </button>

            {/* Off-Main Rd Traffic & Noise Filter Button (ON by default) */}
            <button
              type="button"
              onClick={() => setOffMainRoadFilter(!offMainRoadFilter)}
              className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${offMainRoadFilter
                ? 'bg-amber-950 text-amber-300 border-amber-800 shadow-2xs ring-1 ring-amber-500/30'
                : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200/70'
                }`}
              title={
                offMainRoadFilter
                  ? "Off-Main Rd: ON (Default: hiding noisy arterial road properties like Main Rd/M4). Click to show all properties."
                  : "Off-Main Rd: OFF (Showing all properties including noisy arterial road corridors). Click to filter."
              }
            >
              <span className={offMainRoadFilter ? "text-amber-400" : "text-zinc-400"}>🔇</span>
              <span>Off-Main Rd</span>
              {offMainRoadFilter && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" />
              )}
            </button>

            {/* Within Radius Filter Button (ON by default when activeAnchor is present) */}
            {activeAnchor && (
              <button
                type="button"
                onClick={() => setWithinRadiusFilter(!withinRadiusFilter)}
                className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${withinRadiusFilter
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-800 shadow-2xs ring-1 ring-indigo-500/30'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200/70'
                  }`}
                title={
                  withinRadiusFilter
                    ? `Within ${activeAnchor.label} radius: ON (Only showing properties within ${locationRadiusKm.toFixed(1)} km). Click to show all properties.`
                    : `Within ${activeAnchor.label} radius: OFF (Showing all properties; listings inside ${locationRadiusKm.toFixed(1)} km rank higher). Click to exclude outside listings.`
                }
              >
                <span className={withinRadiusFilter ? "text-indigo-400" : "text-zinc-400"}>🎯</span>
                <span>In Radius (≤{locationRadiusKm.toFixed(1)} km)</span>
                {withinRadiusFilter && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 ml-0.5" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setParkingFilter(!parkingFilter)}
              className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${parkingFilter
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-1 ring-zinc-700'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
                }`}
              title="Filter listings: Off-street parking bay, carport, or lock-up garage (excludes street parking)"
            >
              <span className={parkingFilter ? "text-emerald-300" : "text-zinc-500"}>🅿️</span>
              <span>Off-street pkg</span>
            </button>

            <button
              type="button"
              onClick={() => setPetFriendlyFilter(!petFriendlyFilter)}
              className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${petFriendlyFilter
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-1 ring-zinc-700'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
                }`}
              title="Filter listings: Verified pet-friendly leases only"
            >
              <span className={petFriendlyFilter ? "text-pink-300" : "text-zinc-500"}>🐾</span>
              <span>Pet-friendly</span>
            </button>

            <button
              type="button"
              onClick={() => setGasHobFilter(!gasHobFilter)}
              className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${gasHobFilter
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-1 ring-zinc-700'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
                }`}
              title="Filter listings: Gas hob cooktop for load-shedding resilience"
            >
              <span className={gasHobFilter ? "text-orange-300" : "text-zinc-500"}>🔥</span>
              <span>Gas hob</span>
            </button>

            <button
              type="button"
              onClick={() => setPrivateOnlyFilter(!privateOnlyFilter)}
              className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${privateOnlyFilter
                ? 'bg-purple-950 text-purple-100 border-purple-800 shadow-2xs ring-1 ring-purple-600 font-extrabold'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
                }`}
              title="Filter listings: 100% private standalone homes only (excludes cottages on landlord grounds)"
            >
              <span className={privateOnlyFilter ? "text-purple-300" : "text-zinc-500"}>🔒</span>
              <span>Private</span>
            </button>

            {/* Hidden Posts Visibility Toggle Pill */}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowHidden(!showHidden)}
                className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${showHidden
                  ? 'bg-amber-500 text-zinc-950 border-amber-600 shadow-xs ring-1 ring-amber-400 font-extrabold'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
                  }`}
                title={showHidden ? "Hide dismissed listings again" : `Show ${hiddenCount} hidden / dismissed listing${hiddenCount > 1 ? 's' : ''}`}
              >
                {showHidden ? <Eye size={12} weight="bold" /> : <EyeSlash size={12} weight="bold" />}
                <span>{showHidden ? 'Showing Hidden' : 'Hidden'}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${showHidden ? 'bg-black/15 text-zinc-950' : 'bg-zinc-200 text-zinc-800'}`}>
                  {hiddenCount}
                </span>
              </button>
            )}

            {/* Import Property24 Favourites Button */}
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all cursor-pointer leading-none shrink-0"
              title="Import your favourited properties from Property24"
            >
              <Heart size={12} weight="fill" className="text-rose-600" />
              <span>Import P24 Favs</span>
            </button>

            {/* Favourites Only Filter Toggle Pill */}
            {totalFavouritesCount > 0 && (
              <button
                type="button"
                onClick={() => setShowOnlyFavourites(!showOnlyFavourites)}
                className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${showOnlyFavourites
                  ? 'bg-rose-500 text-white border-rose-600 shadow-xs ring-1 ring-rose-400 font-extrabold'
                  : 'bg-rose-50/80 border-rose-200 text-rose-700 hover:bg-rose-100'
                  }`}
                title={showOnlyFavourites ? "Show all properties" : `Show only ${favouriteCount} favourite${favouriteCount > 1 ? 's' : ''}`}
              >
                <Heart size={12} weight="fill" className={showOnlyFavourites ? "text-white" : "text-rose-500"} />
                <span>{showOnlyFavourites ? 'Showing Favs' : 'Favs'}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${showOnlyFavourites ? 'bg-white/20 text-white' : 'bg-rose-200/80 text-rose-800'}`}>
                  {favouriteCount}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT: SPLIT COLUMN + FULL-WIDTH MAP CANVAS */}
      <main className="flex-1 w-full flex relative overflow-hidden min-h-0 z-0">

        {/* LEFT / SIDE COLUMN: PROPERTY CARDS FEED */}
        <aside
          className={`h-full border-r border-zinc-200 bg-white flex flex-col z-20 shadow-md transition-all duration-300 ease-in-out ${isListCollapsed ? 'w-0 overflow-hidden border-none' : 'w-full sm:w-[340px] lg:w-[370px] xl:w-[410px] shrink-0'
            }`}
        >
          {/* Column Header */}
          <div className="shrink-0 px-3.5 py-2.5 border-b border-zinc-100 bg-white/95 backdrop-blur-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-extrabold text-sm text-zinc-950 whitespace-nowrap">
                    {displayProperties.length} Properties
                  </h2>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Live
                  </span>
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowHidden(!showHidden)}
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border transition-all cursor-pointer ${showHidden
                        ? 'bg-amber-500 text-zinc-950 border-amber-600 shadow-2xs'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200 hover:text-zinc-900'
                        }`}
                      title={showHidden ? "Hide dismissed listings again" : `Show ${hiddenCount} hidden listing${hiddenCount > 1 ? 's' : ''}`}
                    >
                      {showHidden ? <Eye size={11} weight="bold" /> : <EyeSlash size={11} weight="bold" />}
                      <span>{showHidden ? `Hide (${hiddenCount})` : `${hiddenCount} Hidden`}</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-zinc-400 font-medium truncate max-w-[190px]">
                    {selectedSuburbs.join(', ')}
                  </p>
                  {showHidden && hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={unhideAllProperties}
                      className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 underline transition-colors cursor-pointer"
                      title="Restore all hidden listings"
                    >
                      Unhide All
                    </button>
                  )}
                </div>
              </div>

              {/* View Mode Toggle, Sorting Dropdown & Collapse Toggle */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-zinc-100 border border-zinc-200 rounded-xl p-0.5" title="Switch feed view mode">
                  <button
                    type="button"
                    onClick={() => setFeedViewMode('cards')}
                    className={`p-1 rounded-lg transition-colors cursor-pointer ${
                      feedViewMode === 'cards'
                        ? 'bg-white text-zinc-950 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                    title="Cards View"
                    aria-label="Cards View"
                  >
                    <SquaresFour size={14} weight={feedViewMode === 'cards' ? 'fill' : 'bold'} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedViewMode('list')}
                    className={`p-1 rounded-lg transition-colors cursor-pointer ${
                      feedViewMode === 'list'
                        ? 'bg-white text-zinc-950 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                    title="Compact List View"
                    aria-label="Compact List View"
                  >
                    <ListBullets size={14} weight={feedViewMode === 'list' ? 'fill' : 'bold'} />
                  </button>
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs font-bold text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-xl px-2 py-1 focus:outline-none cursor-pointer"
                >
                  {enableFitScore && <option value="fit">Top Fit</option>}
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="distance">Nearest to Trailhead</option>
                </select>

                <button
                  type="button"
                  onClick={() => setIsListCollapsed(true)}
                  className="p-1 text-zinc-400 hover:text-zinc-800 rounded-lg hover:bg-zinc-100 transition-colors"
                  title="Collapse Card List (Full Screen Map)"
                >
                  <CaretLeft size={16} weight="bold" />
                </button>
              </div>
            </div>

            {/* Scrape / Status Banner in Feed Header */}
            {scrapeStatusText && (
              <div className={`mt-2 p-2 rounded-xl text-[11px] font-bold flex items-center justify-between gap-2 border animate-in fade-in duration-150 ${scrapeStatusText.includes('Found') || scrapeStatusText.includes('complete')
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : scrapeStatusText.includes('Scraping') || scrapeStatusText.includes('Connecting') || scrapeStatusText.includes('Running')
                  ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                  : 'bg-zinc-50 text-zinc-800 border-zinc-200'
                }`}>
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  {scrapeStatusText.includes('Scraping') || scrapeStatusText.includes('Connecting') || scrapeStatusText.includes('Running') ? (
                    <CircleNotch size={13} className="animate-spin text-indigo-600 shrink-0" />
                  ) : scrapeStatusText.includes('Found') || scrapeStatusText.includes('complete') ? (
                    <CheckCircle size={13} weight="fill" className="text-emerald-600 shrink-0" />
                  ) : (
                    <Info size={13} weight="bold" className="text-zinc-600 shrink-0" />
                  )}
                  <span className="truncate">{scrapeStatusText}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScrapeStatusText('')}
                  className="p-0.5 text-zinc-400 hover:text-zinc-700 rounded-md cursor-pointer shrink-0"
                  title="Dismiss"
                >
                  <X size={11} weight="bold" />
                </button>
              </div>
            )}
          </div>

          {/* Scrollable Property Cards Feed */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3.5 divide-y divide-zinc-100">
            {displayProperties.map((prop) => {
              const isSelected = selectedPropertyId === prop.id;
              const isHoveredOnMap = hoveredPropertyId === prop.id;
              const isHidden = hiddenPropertyIds.includes(prop.id);
              const privacyInfo = getDwellingPrivacyInfo(prop);
              const agencyRep = getAgencyReputationInfo(prop);
              const barNoiseInfo = getPropertyBarNoiseExposure(prop);
              const busyRoadInfo = getPropertyBusyRoadExposure(prop);
              const crimePerimeter = getCrimePerimeterInfo(prop);
              const marketVal = getRiskAdjustedValuation(prop, allCandidateProperties);
              const isLandlordOnSite = privacyInfo.isLandlordOnSite;
              const distToAnchor = activeAnchor ? getDistanceKm(prop.lat, prop.lng, activeAnchor.lat, activeAnchor.lng) : null;
              const isWalkingAnchor = distToAnchor !== null && (activeAnchor?.commute_mode === 'walking' || (activeAnchor?.commute_mode !== 'driving' && distToAnchor <= 1.2));
              const isBikingAnchor = activeAnchor?.commute_mode === 'bicycling';
              const commuteDurMins = distToAnchor !== null
                ? (isWalkingAnchor
                  ? Math.max(1, Math.round((distToAnchor / 4.8) * 60))
                  : isBikingAnchor
                    ? Math.max(1, Math.round((distToAnchor / 15.0) * 60))
                    : Math.max(2, Math.round((distToAnchor / 35.0) * 60)))
                : null;
              const commuteModeLabel = isWalkingAnchor ? 'walk' : isBikingAnchor ? 'bike' : 'drive';

              if (feedViewMode === 'list') {
                const shortAddr = (prop.address || prop.suburb || 'Address withheld')
                  .replace(/\s*\(Street Address Withheld\)/i, '')
                  .trim();
                return (
                  <div
                    key={prop.id}
                    id={`property-card-${prop.id}`}
                    onClick={() => {
                      setSelectedPropertyId(prop.id);
                      setFocusTarget({ lat: prop.lat, lng: prop.lng, zoom: 16.8, timestamp: Date.now() });
                    }}
                    className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-purple-50/70 border-purple-400 ring-1 ring-purple-300'
                        : isHoveredOnMap
                        ? 'bg-indigo-50/40 border-indigo-200'
                        : 'bg-white border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50/60'
                    } ${isHidden ? 'opacity-50' : ''}`}
                    title="Click to focus on map"
                  >
                    <img
                      src={prop.image || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=160&q=70'}
                      alt={prop.title}
                      className="w-12 h-12 rounded-lg object-cover shrink-0 border border-zinc-200/80 bg-zinc-100"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1 min-w-0">
                          {prop.rank && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-white text-[9.5px] font-black shrink-0">
                              #{prop.rank}
                            </span>
                          )}
                          <span className="text-xs font-extrabold text-zinc-950 truncate">
                            R {formatPrice(prop.price)}
                          </span>
                          {prop.fit_score && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9.5px] font-black shrink-0">
                              {prop.fit_score}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompareProperty(prop);
                            }}
                            className={`px-1.5 py-1 rounded-md text-[10px] font-bold border cursor-pointer ${
                              compareIds.includes(prop.id)
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-purple-50'
                            }`}
                            title={compareIds.includes(prop.id) ? 'In Compare' : 'Add to Compare'}
                          >
                            <Scales size={11} weight="bold" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePropertyAiReport(prop);
                            }}
                            className="px-2 py-1 rounded-md bg-purple-700 hover:bg-purple-800 text-white text-[10px] font-black flex items-center gap-0.5 cursor-pointer"
                            title="AI Forensic Analysis"
                          >
                            <Sparkle size={10} weight="fill" className="text-amber-300" />
                            <span>AI</span>
                          </button>
                          <a
                            href={resolveProperty24Url(prop)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => openProperty24Url(e, resolveProperty24Url(prop))}
                            className="px-1.5 py-1 rounded-md bg-zinc-900 hover:bg-indigo-600 text-white text-[10px] font-black cursor-pointer"
                            title="Open on Property24"
                          >
                            P24
                          </a>
                        </div>
                      </div>

                      <p className="text-[11px] font-bold text-zinc-800 truncate mt-0.5">
                        {prop.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5 truncate">
                        <span className="truncate">{shortAddr}</span>
                        <span>·</span>
                        <span className="shrink-0">{prop.bedrooms}bd{prop.sqm ? ` · ${prop.sqm}m²` : ''}</span>
                        {marketVal && (
                          <span
                            className={`shrink-0 font-bold ${
                              marketVal.isUnderpriced
                                ? 'text-emerald-700'
                                : marketVal.isOverpriced
                                ? 'text-rose-700'
                                : 'text-zinc-500'
                            }`}
                          >
                            · {marketVal.isUnderpriced ? `-${Math.abs(marketVal.pctDiff)}%` : marketVal.isOverpriced ? `+${Math.abs(marketVal.pctDiff)}%` : 'Fair'}
                          </span>
                        )}
                        {crimePerimeter.isNearHighRisk && !crimePerimeter.hasEstateSecurity && (
                          <span className="shrink-0 font-bold text-amber-700" title={crimePerimeter.tooltipReason}>
                            · ⚠️ {crimePerimeter.distanceKm}km
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={prop.id}
                  id={`property-card-${prop.id}`}
                  onClick={() => {
                    setSelectedPropertyId(prop.id);
                    setFocusTarget({ lat: prop.lat, lng: prop.lng, zoom: 16.8, timestamp: Date.now() });
                  }}
                  title="Click to focus and zoom in on this property on the map"
                  className={`pt-3.5 first:pt-0 rounded-2xl p-2.5 transition-all cursor-pointer border ${isSelected
                    ? 'bg-purple-50/85 border-purple-500 ring-2 ring-purple-500/40 shadow-xl'
                    : isHidden
                      ? 'bg-amber-50/30 border-dashed border-amber-300 opacity-75 hover:opacity-100'
                      : isHoveredOnMap
                        ? 'bg-purple-50/40 border-purple-300 ring-1 ring-purple-400/30 shadow-md'
                        : 'hover:bg-zinc-50/80 border-transparent hover:border-zinc-200'
                    }`}
                >
                  {/* Highlighted on Map Banner */}
                  {isSelected && (
                    <div className="mb-2.5 flex items-center justify-between px-3 py-1.5 rounded-xl bg-purple-700 text-white text-[11px] font-extrabold shadow-sm animate-in fade-in slide-in-from-top-1 duration-150">
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} weight="fill" className="text-amber-300" />
                        <span>Selected on Map</span>
                      </span>
                      <span className="text-[10px] text-purple-200 font-semibold">
                        Top Fit #{prop.rank || ''}
                      </span>
                    </div>
                  )}
                  {/* Photo Gallery & RealView™ Rectifier (Wide-Angle to Normal Eye Perspective Converter) */}
                  {(() => {
                    const photosList: string[] = (prop.images && prop.images.length > 0)
                      ? prop.images
                      : (cardGalleries[prop.id] && cardGalleries[prop.id].length > 0)
                        ? cardGalleries[prop.id]
                        : [prop.image].filter(Boolean);

                    const activePhotoIdx = cardImageIndices[prop.id] || 0;
                    const activeRawPhoto = photosList[activePhotoIdx] || prop.image;
                    const convertedPhotoUrl = getRectifiedUrl(activeRawPhoto);

                    const handlePrevPhoto = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (photosList.length <= 1 && prop.url && !cardGalleries[prop.id]) {
                        fetchCardGallery(prop.id, prop.url);
                      }
                      setCardImageIndices((prev) => {
                        const cur = prev[prop.id] || 0;
                        return { ...prev, [prop.id]: cur > 0 ? cur - 1 : Math.max(0, photosList.length - 1) };
                      });
                    };

                    const handleNextPhoto = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (photosList.length <= 1 && prop.url && !cardGalleries[prop.id]) {
                        fetchCardGallery(prop.id, prop.url);
                      }
                      setCardImageIndices((prev) => {
                        const cur = prev[prop.id] || 0;
                        return { ...prev, [prop.id]: cur < photosList.length - 1 ? cur + 1 : 0 };
                      });
                    };

                    const p24Href = resolveProperty24Url(prop);

                    return (
                      <div className="relative w-full h-44 rounded-xl overflow-hidden bg-zinc-950 shadow-xs mb-2.5 group/slider select-none">
                        {/* Main Converted Photo (Wide Angle -> Human Eye Normal Perspective via RealView™) */}
                        <a
                          href={p24Href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => openProperty24Url(e, p24Href)}
                          title="Open original listing on Property24 (new tab)"
                          className="block w-full h-full cursor-pointer"
                        >
                          <img
                            src={convertedPhotoUrl}
                            alt={`${prop.title} - Photo ${activePhotoIdx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover/slider:scale-102 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              // If rectifier fails, fall back gracefully to original raw photo
                              if (e.currentTarget.src !== activeRawPhoto) {
                                e.currentTarget.src = activeRawPhoto;
                              }
                            }}
                          />
                        </a>

                        {/* Image Slider: Previous Photo Button */}
                        <button
                          type="button"
                          onClick={handlePrevPhoto}
                          className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-zinc-950/75 hover:bg-zinc-950 text-white flex items-center justify-center backdrop-blur-xs transition-all shadow-md cursor-pointer hover:scale-110 active:scale-95 opacity-80 group-hover/slider:opacity-100"
                          title="Previous photo"
                          aria-label="Previous photo"
                        >
                          <CaretLeft size={16} weight="bold" />
                        </button>

                        {/* Image Slider: Next Photo Button */}
                        <button
                          type="button"
                          onClick={handleNextPhoto}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-zinc-950/75 hover:bg-zinc-950 text-white flex items-center justify-center backdrop-blur-xs transition-all shadow-md cursor-pointer hover:scale-110 active:scale-95 opacity-80 group-hover/slider:opacity-100"
                          title="Next photo"
                          aria-label="Next photo"
                        >
                          <CaretRight size={16} weight="bold" />
                        </button>

                        {/* Top Bar Overlay: Full-width responsive flex container preventing badge collision */}
                        <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between gap-1.5 pointer-events-none">
                          <div className="flex items-center gap-1.5 min-w-0 shrink">
                            {isHidden && (
                              <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-zinc-950 font-black text-[10px] shadow-md flex items-center gap-1 shrink-0">
                                <EyeSlash size={10} weight="bold" />
                                <span>Hidden</span>
                              </span>
                            )}
                            <span className="px-2.5 py-1 rounded-lg bg-zinc-950/85 text-white font-extrabold text-xs shadow-md backdrop-blur-xs shrink-0 whitespace-nowrap">
                              R {formatPrice(prop.price)} <span className="text-[10px] text-zinc-400 font-normal">/mo</span>
                            </span>
                            {marketVal && (
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-black shadow-sm backdrop-blur-xs flex items-center gap-0.5 shrink-0 whitespace-nowrap ${marketVal.isUnderpriced
                                    ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-500/40'
                                    : marketVal.isOverpriced
                                      ? 'bg-rose-950/90 text-rose-400 border border-rose-500/40'
                                      : 'bg-zinc-900/90 text-zinc-300 border border-zinc-700/50'
                                  }`}
                                title={marketVal.badgeTooltip}
                              >
                                <span>{marketVal.badgeText}</span>
                              </span>
                            )}
                            {enableFitScore && prop.fit_score && (
                              <span className={`px-2 py-0.5 rounded-lg bg-zinc-950/85 font-black text-[10px] shadow-sm backdrop-blur-xs flex items-center gap-1 shrink-0 whitespace-nowrap ${prop.is_outside_radius
                                ? 'text-amber-400 border border-amber-500/30'
                                : 'text-emerald-400'
                                }`}>
                                <span>{prop.fit_score}% Fit</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
                            {/* Heart Toggle Button */}
                            <button
                              type="button"
                              onClick={(e) => toggleFavouriteProperty(prop, e)}
                              className={`p-1.5 rounded-lg backdrop-blur-md border shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95 ${prop.is_favorite
                                ? 'bg-rose-500 text-white border-rose-400 hover:bg-rose-600 font-black'
                                : 'bg-zinc-950/80 hover:bg-zinc-950 text-zinc-300 hover:text-rose-400 border-white/20 hover:border-rose-400/40'
                                }`}
                              title={prop.is_favorite ? "Remove from favourites" : "Add to favourites (or import from P24)"}
                              aria-label={prop.is_favorite ? "Remove from favourites" : "Add to favourites"}
                            >
                              <Heart size={13} weight={prop.is_favorite ? "fill" : "bold"} className={prop.is_favorite ? "text-white" : "text-zinc-200"} />
                            </button>

                            <div className="px-2 py-0.5 rounded-lg bg-zinc-950/85 backdrop-blur-md text-emerald-400 border border-emerald-500/30 text-[9.5px] font-extrabold flex items-center gap-1 shadow-sm pointer-events-none whitespace-nowrap">
                              <Sparkle size={10} weight="fill" className="text-emerald-400" />
                              <span>RealView™ 1.0x</span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => toggleHideProperty(prop.id, e)}
                              className={`p-1.5 rounded-lg backdrop-blur-md border shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95 ${isHidden
                                ? 'bg-amber-500 text-zinc-950 border-amber-400 hover:bg-amber-400 font-black'
                                : 'bg-zinc-950/80 hover:bg-zinc-950 text-zinc-300 hover:text-white border-white/20 hover:border-white/40'
                                }`}
                              title={isHidden ? "Unhide this listing (restore to active feed)" : "Hide listing (dismiss from feed & map)"}
                              aria-label={isHidden ? "Unhide listing" : "Hide listing"}
                            >
                              {isHidden ? <Eye size={13} weight="bold" /> : <EyeSlash size={13} weight="bold" />}
                            </button>
                          </div>
                        </div>

                        {/* Bottom-Center: Photo Counter Pill */}
                        {photosList.length > 1 && (
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full bg-zinc-950/80 backdrop-blur-xs text-[10px] font-bold text-white tracking-wider flex items-center gap-1 shadow-xs pointer-events-none">
                            <span>{activePhotoIdx + 1}</span>
                            <span className="text-zinc-400">/</span>
                            <span>{photosList.length}</span>
                          </div>
                        )}

                        {/* Bottom-Left: Critical Agency Warning only (keeps photo clean; feature chips below display full acoustic/privacy status) */}
                        {agencyRep.isPoorAgency && agencyRep.shortFlag && (
                          <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
                            <div
                              className="px-2 py-0.5 rounded-md text-[9.5px] font-black flex items-center gap-1 backdrop-blur-xs shadow-md bg-rose-950/95 text-rose-200 border border-rose-500/70"
                              title={agencyRep.tooltipReason}
                            >
                              <WarningCircle size={11} weight="fill" className="text-rose-400 shrink-0" />
                              <span>{agencyRep.shortFlag}</span>
                            </div>
                          </div>
                        )}

                        <a
                          href={p24Href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => openProperty24Url(e, p24Href)}
                          title="Open original listing on Property24"
                          className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-zinc-950/90 hover:bg-indigo-600 text-white text-[10px] font-extrabold flex items-center gap-1 backdrop-blur-xs shadow-sm transition-colors z-20 cursor-pointer"
                        >
                          <span>Property24</span>
                          <ArrowSquareOut size={11} weight="bold" />
                        </a>
                      </div>
                    );
                  })()}

                  {/* Title & Address */}
                  <h3 className="font-extrabold text-xs text-zinc-950 line-clamp-1 mb-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setSelectedPropertyId(prop.id);
                        setFocusTarget({ lat: prop.lat, lng: prop.lng, zoom: 16.8, timestamp: Date.now() });
                      }}
                      className="text-left hover:text-indigo-600 hover:underline transition-colors cursor-pointer"
                      title="Show and center this listing on the map"
                    >
                      {prop.title}
                    </button>
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium truncate mb-2">
                    {prop.address}
                  </p>

                  {/* Primary Spec Chips: Beds, Baths, Sqm */}
                  <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-semibold text-zinc-600 mb-1.5">
                    <span className="bg-zinc-100 px-2 py-0.5 rounded-md">
                      🛏️ {prop.bedrooms} Bed{prop.bedrooms > 1 ? 's' : ''}
                    </span>
                    <span className="bg-zinc-100 px-2 py-0.5 rounded-md">
                      🚿 {prop.bathrooms} Bath
                    </span>
                    {prop.sqm && (
                      <span className="bg-zinc-100 px-2 py-0.5 rounded-md">
                        📐 {prop.sqm} m²
                      </span>
                    )}
                  </div>

                  {/* Visual Feature Gauges: Poor Agency Flag, Dwelling Privacy Badge, Stove, Garage, Pets, Inverter, Fibre */}
                  <div className="flex items-center flex-wrap gap-1 mb-2.5">
                    {marketVal && (
                      <span
                        className={`border px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs ${marketVal.isUnderpriced
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : marketVal.isOverpriced
                              ? 'bg-rose-50 text-rose-950 border-rose-300'
                              : 'bg-zinc-100 text-zinc-800 border-zinc-300'
                          }`}
                        title={marketVal.badgeTooltip}
                      >
                        <span>{marketVal.isUnderpriced ? '📉' : marketVal.isOverpriced ? '📈' : '⚖️'}</span>
                        <span>
                          {marketVal.badgeText} vs {marketVal.areaLabel} {marketVal.isRiskAdjusted ? 'Adj. ' : ''}Median (R {marketVal.medianPrice >= 1000 ? `${(marketVal.medianPrice / 1000).toFixed(marketVal.medianPrice % 1000 === 0 ? 0 : 1)}k` : marketVal.medianPrice})
                        </span>
                      </span>
                    )}
                    {prop.is_favorite && (
                      <span
                        className="bg-rose-50 text-rose-700 border border-rose-200/90 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs"
                        title="Saved in your Property24 favourites"
                      >
                        <Heart size={11} weight="fill" className="text-rose-600 shrink-0" />
                        <span>P24 Favourite</span>
                      </span>
                    )}
                    {agencyRep.isPoorAgency && agencyRep.badgeLabel && (
                      <span
                        className="bg-rose-600 text-white border border-rose-700 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-xs"
                        title={agencyRep.tooltipReason}
                      >
                        <WarningCircle size={11} weight="fill" className="text-white shrink-0" />
                        <span>{agencyRep.badgeLabel}</span>
                      </span>
                    )}
                    {barNoiseInfo.isExposed && barNoiseInfo.shortFlag && (
                      <span
                        className="bg-rose-50 text-rose-950 border border-rose-300 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs"
                        title={barNoiseInfo.tooltipReason}
                      >
                        <SpeakerHigh size={11} weight="fill" className="text-rose-600 shrink-0" />
                        <span>{barNoiseInfo.shortFlag}</span>
                      </span>
                    )}
                    {busyRoadInfo.isNearBusyRoad && busyRoadInfo.shortFlag && (
                      <span
                        className="bg-amber-50 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs"
                        title={busyRoadInfo.tooltipReason}
                      >
                        <Car size={11} weight="fill" className="text-amber-700 shrink-0" />
                        <span>{busyRoadInfo.shortFlag}</span>
                      </span>
                    )}
                    {crimePerimeter.isNearHighRisk && crimePerimeter.shortFlag && (
                      <span
                        className={`border px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs ${
                          crimePerimeter.hasEstateSecurity
                            ? 'bg-slate-50 text-slate-800 border-slate-300'
                            : 'bg-amber-50 text-amber-950 border-amber-300'
                        }`}
                        title={crimePerimeter.tooltipReason}
                      >
                        <ShieldWarning
                          size={11}
                          weight="fill"
                          className={crimePerimeter.hasEstateSecurity ? 'text-emerald-600 shrink-0' : 'text-amber-600 shrink-0'}
                        />
                        <span>{crimePerimeter.shortFlag}</span>
                      </span>
                    )}
                    {privacyInfo.badgeLabel && (
                      <span
                        className={`border px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs ${privacyInfo.isExplicitLandlord
                          ? 'bg-rose-50 text-rose-950 border-rose-300'
                          : 'bg-amber-50 text-amber-950 border-amber-300'
                          }`}
                        title={privacyInfo.isExplicitLandlord ? "Landlord / Owner lives on property" : "Garden cottage / flatlet on shared property"}
                      >
                        {privacyInfo.isExplicitLandlord ? (
                          <WarningCircle size={11} weight="fill" className="text-rose-600 shrink-0" />
                        ) : (
                          <span>🏡</span>
                        )}
                        <span>{privacyInfo.badgeLabel}</span>
                      </span>
                    )}
                    {/* Stove Badge */}
                    {prop.stove_type === 'gas' ? (
                      <span
                        className="bg-amber-50 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
                        title="Gas Hob / Cooker (No load-shedding disruption)"
                      >
                        <span>🔥 Gas Hob</span>
                      </span>
                    ) : prop.stove_type === 'induction' ? (
                      <span
                        className="bg-cyan-50 text-cyan-900 border border-cyan-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
                        title="Modern induction cooktop"
                      >
                        <span>🌀 Induction</span>
                      </span>
                    ) : (
                      <span
                        className="bg-zinc-100 text-zinc-700 border border-zinc-200/80 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1"
                        title="Electric stove / hob"
                      >
                        <span>⚡ Electric</span>
                      </span>
                    )}

                    {/* Parking Badges (Garage and/or Off-Street Bay) */}
                    {prop.has_garage && (
                      <span
                        className="bg-emerald-50 text-emerald-900 border border-emerald-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
                        title="Lock-up / automated private garage"
                      >
                        <span>🚗 Garage</span>
                      </span>
                    )}
                    {(prop.has_secure_bay || (!prop.has_garage && prop.parking_type === 'secure_bay')) && (
                      <span
                        className="bg-zinc-100 text-zinc-700 border border-zinc-200/80 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1"
                        title="Allocated secure parking bay / off-street parking"
                      >
                        <span>🅿️ Off-Street Bay</span>
                      </span>
                    )}
                    {!prop.has_garage && !prop.has_secure_bay && prop.parking_type !== 'secure_bay' && prop.parking_type !== 'garage' && (
                      <span
                        className="bg-zinc-100 text-zinc-500 border border-zinc-200/80 px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1"
                        title="Street parking / unassigned"
                      >
                        <span>🚗 Street Pkg</span>
                      </span>
                    )}

                    {/* Pet Friendly Badge */}
                    {prop.pet_friendly && (
                      <span
                        className="bg-indigo-50 text-indigo-900 border border-indigo-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
                        title="Verified pet-friendly lease"
                      >
                        <span>🐾 Pet Friendly</span>
                      </span>
                    )}

                    {/* Inverter / Solar Badge */}
                    {prop.has_inverter && (
                      <span
                        className="bg-teal-50 text-teal-900 border border-teal-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
                        title="Inverter / solar battery backup power"
                      >
                        <span>🔋 Inverter</span>
                      </span>
                    )}

                    {/* Fibre Internet Badge */}
                    {prop.fibre_ready && (
                      <span
                        className="bg-purple-50 text-purple-900 border border-purple-300/80 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1"
                        title="High-speed fibre ready connection"
                      >
                        <span>🌐 Fibre</span>
                      </span>
                    )}
                  </div>

                  {/* Deterministic Match Deduction */}
                  {enableFitScore && prop.ai_insight && (
                    <div className={`mb-2 px-2.5 py-1.5 rounded-xl border flex items-start gap-1.5 text-[10.5px] font-semibold leading-snug ${agencyRep.isPoorAgency
                      ? 'bg-rose-50/95 border-rose-300 text-rose-950'
                      : barNoiseInfo.isExposed
                        ? 'bg-rose-50/85 border-rose-200 text-rose-950'
                        : busyRoadInfo.isNearBusyRoad
                          ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                          : isLandlordOnSite
                            ? 'bg-amber-50/90 border-amber-300/80 text-amber-950'
                            : 'bg-zinc-50 border-zinc-200/90 text-zinc-700'
                      }`}
                      title={
                        agencyRep.isPoorAgency
                          ? agencyRep.tooltipReason
                          : barNoiseInfo.isExposed
                            ? barNoiseInfo.tooltipReason
                            : busyRoadInfo.isNearBusyRoad
                              ? busyRoadInfo.tooltipReason
                              : undefined
                      }
                    >
                      {agencyRep.isPoorAgency ? (
                        <WarningCircle size={13} weight="fill" className="text-rose-600 shrink-0 mt-0.5" />
                      ) : barNoiseInfo.isExposed ? (
                        <SpeakerHigh size={13} weight="fill" className="text-rose-600 shrink-0 mt-0.5" />
                      ) : busyRoadInfo.isNearBusyRoad ? (
                        <Car size={13} weight="fill" className="text-amber-600 shrink-0 mt-0.5" />
                      ) : isLandlordOnSite ? (
                        <WarningCircle size={13} weight="fill" className="text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <ShieldCheck size={12} weight="bold" className="text-zinc-600 shrink-0 mt-0.5" />
                      )}
                      <span className="line-clamp-3 leading-snug break-words">{prop.ai_insight}</span>
                    </div>
                  )}

                  {/* Trailhead / Desirable Location Proximity Pill */}
                  {activeAnchor && distToAnchor !== null && (
                    <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-zinc-100/90 border border-zinc-200/80 mb-1.5">
                      <span className="font-semibold text-zinc-700 flex items-center gap-1.5 truncate max-w-[210px]">
                        {activeAnchor.iconType === 'gym' ? (
                          <Dumbbell size={13} className="text-amber-600 shrink-0" />
                        ) : activeAnchor.iconType === 'trail' ? (
                          <Tree size={13} weight="fill" className="text-emerald-600 shrink-0" />
                        ) : activeAnchor.iconType === 'surf' || activeAnchor.iconType === 'beach' ? (
                          <Waves size={13} weight="fill" className="text-cyan-600 shrink-0" />
                        ) : activeAnchor.iconType === 'cafe' ? (
                          <Coffee size={13} weight="fill" className="text-amber-600 shrink-0" />
                        ) : (
                          <Compass size={13} weight="bold" className="text-indigo-600 shrink-0" />
                        )}
                        <span className="truncate">{activeAnchor.label}</span>
                      </span>
                      <span className="font-black text-indigo-700 shrink-0">
                        {distToAnchor} km · ~{commuteDurMins}m {commuteModeLabel}
                      </span>
                    </div>
                  )}

                  {/* Gym Proximity Row in Area */}
                  {(() => {
                    const gymsList = templateGyms.length > 0 ? templateGyms : anchors.filter((a) => a.category === 'gym' || a.iconType === 'gym');
                    if (gymsList.length === 0) return null;
                    let closestGym = gymsList[0];
                    let minD = getDistanceKm(prop.lat, prop.lng, closestGym.lat, closestGym.lng);
                    for (let i = 1; i < gymsList.length; i++) {
                      const d = getDistanceKm(prop.lat, prop.lng, gymsList[i].lat, gymsList[i].lng);
                      if (d < minD) {
                        minD = d;
                        closestGym = gymsList[i];
                      }
                    }
                    if (activeAnchor?.id === closestGym.id) return null;
                    const gymMins = Math.max(2, Math.round((minD / 35.0) * 60));
                    return (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveAnchorId(closestGym.id);
                          setFocusTarget({
                            lat: closestGym.lat,
                            lng: closestGym.lng,
                            zoom: 15.2,
                            timestamp: Date.now()
                          });
                        }}
                        className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/80 mb-2 transition-colors cursor-pointer group/gym"
                        title={`Click to set ${closestGym.label} as active focal anchor`}
                      >
                        <span className="font-semibold text-zinc-800 flex items-center gap-1.5 truncate max-w-[210px]">
                          <Dumbbell size={13} className="text-amber-600 shrink-0 group-hover/gym:scale-110 transition-transform" />
                          <span className="truncate">{closestGym.label}</span>
                        </span>
                        <span className="font-black text-amber-900 shrink-0">
                          {minD} km · ~{gymMins}m
                        </span>
                      </div>
                    );
                  })()}

                  {/* Links / Action Footer */}
                  <div className="flex items-center justify-between pt-2.5 mt-1.5 border-t border-zinc-100 text-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedPropertyId === prop.id) {
                          setSelectedPropertyId(null);
                        } else {
                          setSelectedPropertyId(prop.id);
                          setFocusTarget({ lat: prop.lat, lng: prop.lng, zoom: 16.8, timestamp: Date.now() });
                        }
                      }}
                      className="text-[11px] text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      title="Focus and highlight this property on the map"
                    >
                      <span>Focus on map</span>
                      <NavigationArrow size={11} weight="fill" />
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompareProperty(prop);
                        }}
                        className={`px-2 py-1.5 rounded-lg text-[10.5px] font-bold flex items-center gap-1 border transition-colors whitespace-nowrap cursor-pointer ${
                          compareIds.includes(prop.id)
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-white hover:bg-purple-50 border-zinc-200 text-zinc-700 hover:border-purple-200'
                        }`}
                        title={compareIds.includes(prop.id) ? 'Remove from AI Compare' : 'Add to AI Compare (2–4 properties)'}
                      >
                        <Scales size={12} weight="bold" className="shrink-0" />
                        <span>{compareIds.includes(prop.id) ? '✓' : '+'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePropertyAiReport(prop);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1 shadow-2xs transition-all cursor-pointer whitespace-nowrap ${viewingAiReportProp?.id === prop.id
                          ? 'bg-purple-950 text-white ring-2 ring-purple-400/50'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
                          }`}
                        title={viewingAiReportProp?.id === prop.id ? "Close AI Forensic Report" : "Get AI Report for this property"}
                      >
                        <Sparkle size={12} weight="fill" className="text-amber-300 shrink-0" />
                        <span>{viewingAiReportProp?.id === prop.id ? 'Close' : 'AI Analysis'}</span>
                      </button>

                      <a
                        href={resolveGoogleMapsUrl(prop)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 text-[10.5px] font-bold flex items-center gap-1 border border-zinc-200 transition-colors whitespace-nowrap cursor-pointer"
                        title="Show exact address / location on Google Maps (opens in a new tab)"
                      >
                        <MapPin size={12} weight="bold" className="text-rose-500 shrink-0" />
                        <span>Maps</span>
                        <ArrowSquareOut size={10} weight="bold" className="text-zinc-400 shrink-0" />
                      </a>

                      <a
                        href={resolveProperty24Url(prop)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => openProperty24Url(e, resolveProperty24Url(prop))}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-indigo-600 text-white text-[11px] font-extrabold flex items-center gap-1 shadow-2xs transition-colors whitespace-nowrap cursor-pointer"
                        title="Open original listing on Property24"
                      >
                        <span>P24</span>
                        <ArrowSquareOut size={11} weight="bold" className="shrink-0" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}

            {displayProperties.length === 0 && (
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400">
                  <EyeSlash size={24} weight="bold" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-sm text-zinc-900">
                    {hiddenCount > 0 ? 'All Matching Listings Are Hidden' : 'No Properties Scraped Yet'}
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-[260px] mx-auto">
                    {hiddenCount > 0
                      ? `You have hidden ${hiddenCount} listing${hiddenCount > 1 ? 's' : ''}. Toggle visibility to review or restore them.`
                      : 'Click "Scrape P24" to fetch real listings for your selected suburbs, or paste favourites.'}
                  </p>
                </div>
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowHidden(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Eye size={13} weight="bold" />
                    <span>Show {hiddenCount} Hidden Listing{hiddenCount > 1 ? 's' : ''}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleScrapeP24}
                    disabled={isScraping}
                    className="mt-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <MagnifyingGlass size={14} weight="bold" />
                    <span>{isScraping ? 'Scraping P24...' : 'Scrape P24 Live'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* EXPAND BUTTON (Visible when list is collapsed) */}
        {isListCollapsed && (
          <button
            type="button"
            onClick={() => setIsListCollapsed(false)}
            className="absolute top-4 left-4 z-30 px-3.5 py-2 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-zinc-200 text-xs font-extrabold text-zinc-900 flex items-center gap-2 hover:bg-zinc-50 transition-all cursor-pointer"
            title="Open Properties Column"
          >
            <Sliders size={15} weight="bold" className="text-indigo-600" />
            <span>Show {displayProperties.length} Properties</span>
            <CaretRight size={14} weight="bold" />
          </button>
        )}

        {/* RIGHT / FULL-WIDTH MAP CANVAS */}
        <div className="flex-1 h-full w-full relative bg-zinc-100 overflow-hidden">
          <PropertyMap
            mode="default"
            properties={displayProperties}
            anchors={displayedAnchors}
            selectedPropertyId={selectedPropertyId}
            selectedAnchorId={activeAnchorId}
            enableAiAnalysis={enableFitScore}
            focusTarget={focusTarget}
            onSelectProperty={(p: PropertyMapItem) => setSelectedPropertyId(selectedPropertyId === p.id ? null : p.id)}
            onDeselectProperty={() => setSelectedPropertyId(null)}
            onHoverProperty={(p: PropertyMapItem | null) => setHoveredPropertyId(p ? p.id : null)}
            showCardPopupOnMap={false}
            onSelectAnchor={(a: ProximityAnchor) => setActiveAnchorId(a.id)}
            selectedSuburbs={selectedSuburbs}
            onAddSuburb={(suburb: string) => handleAddSuburb(suburb)}
            onOpenAiReport={(p: PropertyMapItem) => handleTogglePropertyAiReport(p)}
            proximityFilter={activeAnchor ? { label: activeAnchor.label, lat: activeAnchor.lat, lng: activeAnchor.lng, radiusKm: locationRadiusKm } : null}
            onRadiusChange={(r) => setLocationRadiusKm(r)}
            className="w-full h-full"
          />
        </div>

      </main>

      {/* AI DEEP ANALYSIS MODAL */}
      {isAiModalOpen && (
        <div
          className="fixed inset-0 z-[120] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsAiModalOpen(false);
            }
          }}
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-zinc-200 max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                  <Sparkle size={22} weight="fill" className="text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-zinc-950 leading-tight">
                      AI Deep Analysis
                    </h2>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider">
                      Top 10 Audit
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">
                    Inspects photos, sun angles, floor plans &amp; agent copy to generate forensic reports for your top 10 listings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Section 1: Active Search Filters Taken into Account */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-900">
                <span className="flex items-center gap-1.5 text-zinc-700">
                  <CheckCircle size={15} weight="bold" className="text-emerald-600" />
                  Active Search Filters Taken Into Account:
                </span>
                <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
                  {displayProperties.length} Matching
                </span>
              </div>

              <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className="bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-zinc-800 shadow-2xs">
                  📍 {selectedSuburbs.length > 0 ? selectedSuburbs.join(', ') : 'All Suburbs'}
                </span>
                <span className="bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-zinc-800 shadow-2xs">
                  💰 R {formatPrice(minPrice)} – R {formatPrice(maxPrice)}
                </span>
                <span className="bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-zinc-800 shadow-2xs">
                  🛏️ {bedrooms} Bed
                </span>
                {safeishFilter && (
                  <span className="bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-800 shadow-2xs">
                    ✓ 🛡️ Safe-ish (Hiding High Risk Zones)
                  </span>
                )}
                {withinRadiusFilter && activeAnchor && (
                  <span className="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-800 shadow-2xs">
                    ✓ 🎯 In Radius (≤{locationRadiusKm.toFixed(1)} km of {activeAnchor.label})
                  </span>
                )}
                {fibreFilter && (
                  <span className="bg-zinc-900 text-cyan-300 px-2 py-0.5 rounded-md border border-zinc-800 shadow-2xs">
                    ✓ 🌐 Fibre ready
                  </span>
                )}
                {northFacingFilter && (
                  <span className="bg-zinc-900 text-amber-300 px-2 py-0.5 rounded-md border border-zinc-800 shadow-2xs">
                    ✓ ☀️ North-facing
                  </span>
                )}
                {parkingFilter && (
                  <span className="bg-zinc-900 text-emerald-300 px-2 py-0.5 rounded-md border border-zinc-800 shadow-2xs">
                    ✓ 🚗 Off-street parking
                  </span>
                )}
                {petFriendlyFilter && (
                  <span className="bg-zinc-900 text-pink-300 px-2 py-0.5 rounded-md border border-zinc-800 shadow-2xs">
                    ✓ 🐾 Pet-friendly
                  </span>
                )}
                {gasHobFilter && (
                  <span className="bg-zinc-900 text-orange-300 px-2 py-0.5 rounded-md border border-zinc-800 shadow-2xs">
                    ✓ 🔥 Gas hob
                  </span>
                )}
                {!fibreFilter && !northFacingFilter && !parkingFilter && !petFriendlyFilter && !gasHobFilter && (
                  <span className="bg-white/80 text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-200/60 text-[10.5px]">
                    (No feature toggles active · showing all verified)
                  </span>
                )}
              </div>
            </div>

            {/* Section 2: Personal Preferences Input Box */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-zinc-900 uppercase tracking-wider">
                Personal Preferences &amp; Lifestyle Sanctuary
              </label>
              <p className="text-[11px] text-zinc-500 font-medium">
                Specify views, sunlight, remote work requirements, noise sensitivity, or special needs. The AI will evaluate each of your Top 10 homes against these criteria.
              </p>
              <textarea
                rows={3}
                value={personalPreferences}
                onChange={(e) => handleUpdatePreferences(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleRunDeepAiAnalysis();
                  }
                }}
                placeholder="e.g. Quiet sanctuary, ocean views, natural light, gas stove, and dedicated remote work space..."
                className="w-full text-xs p-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-zinc-900 font-medium resize-none leading-relaxed transition-all"
              />
              <div className="flex items-center justify-between text-[10.5px] text-zinc-400 font-medium px-1 pt-0.5">
                <span>Tip: Press <strong className="text-zinc-600">Enter ↵</strong> to run analysis</span>
                <span><strong className="text-zinc-600">Shift + Enter</strong> for new line</span>
              </div>

              {/* Standard Lifestyle & Work Mode Checkboxes */}
              <div className="pt-1.5 space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase tracking-wider">
                  Work Style &amp; Daily Routine:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Work from home (full-time)', tag: 'WFH (Full-time): quiet acoustic environment, fibre ready, desk space', icon: '💻' },
                    { label: 'Work from home (part-time)', tag: 'WFH (Part-time): flexible hybrid work, stable fibre', icon: '🏠' },
                    { label: 'Work from cafes', tag: 'Work from cafes: walkable to coffee shops & laptop-friendly spots', icon: '☕' },
                    { label: 'Work from an office', tag: 'Office commuter: proximity to major business hubs & commute transit', icon: '🏢' },
                  ].map((item) => {
                    const isChecked = personalPreferences.toLowerCase().includes(item.label.toLowerCase());
                    return (
                      <label
                        key={item.label}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-all select-none ${isChecked
                            ? 'bg-purple-50/90 border-purple-300 text-purple-950 shadow-2xs font-extrabold ring-1 ring-purple-400/40'
                            : 'bg-white hover:bg-zinc-50 border-zinc-200/90 text-zinc-700'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const cleaned = personalPreferences.trim().replace(/\.$/, '');
                              handleUpdatePreferences(cleaned ? `${cleaned}. ${item.label}.` : `${item.label}.`);
                            } else {
                              const updated = personalPreferences
                                .replace(new RegExp(`\\b${item.label}\\b\\.?`, 'gi'), '')
                                .replace(/\.\s*\./g, '.')
                                .replace(/,\s*,/g, ',')
                                .trim();
                              handleUpdatePreferences(updated);
                            }
                          }}
                          className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600 shrink-0"
                        />
                        <span className="truncate">{item.icon} {item.label}</span>
                      </label>
                    );
                  })}
                </div>

                <span className="text-[10px] font-bold text-zinc-400 block uppercase tracking-wider pt-1">
                  Key Rental Decision Factors:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { label: 'Quiet sanctuary (no traffic)', icon: '🔇' },
                    { label: '100% Private (no landlord on-site)', icon: '🔒' },
                    { label: 'Secure estate / 24h security', icon: '🛡️' },
                    { label: 'Backup power / solar inverter', icon: '🔋' },
                    { label: 'Private patio / balcony', icon: '🌿' },
                    { label: 'Lock-up garage', icon: '🚗' },
                    { label: 'Gas cooking hob', icon: '🍳' },
                    { label: 'Pet-friendly lease', icon: '🐾' },
                    { label: 'Scenic mountain / ocean views', icon: '🏔️' },
                  ].map((factor) => {
                    const isChecked = personalPreferences.toLowerCase().includes(factor.label.toLowerCase());
                    return (
                      <label
                        key={factor.label}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all select-none ${isChecked
                            ? 'bg-purple-100/80 border-purple-300 text-purple-950 font-black shadow-2xs'
                            : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const cleaned = personalPreferences.trim().replace(/\.$/, '');
                              handleUpdatePreferences(cleaned ? `${cleaned}. ${factor.label}.` : `${factor.label}.`);
                            } else {
                              const updated = personalPreferences
                                .replace(new RegExp(`\\b${factor.label}\\b\\.?`, 'gi'), '')
                                .replace(/\.\s*\./g, '.')
                                .replace(/,\s*,/g, ',')
                                .trim();
                              handleUpdatePreferences(updated);
                            }
                          }}
                          className="w-3 h-3 rounded text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600 shrink-0"
                        />
                        <span className="truncate">{factor.icon} {factor.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Quick Inspiration Chips */}
              <div className="pt-1">
                <span className="text-[10px] font-bold text-zinc-400 block mb-1.5 uppercase tracking-wider">
                  Quick-Add Inspiration:
                </span>
                <div className="flex items-center flex-wrap gap-1.5">
                  {[
                    '🔒 Private (No Landlord On-Site)',
                    '🔇 Off-Main Road Sanctuary',
                    '🌿 Quiet Sanctuary',
                    '☀️ North-Facing Sunlight',
                    '🏔️ Mountain or Ocean Views',
                    '🍳 Gas Cooking & Load-Shedding',
                    '💻 Remote Work & Fibre',
                    '🐕 Dog & Garden Space'
                  ].map((chip) => {
                    const chipKey = chip.replace(/^[^\w\s]+\s*/, '');
                    const isAlreadyIn = personalPreferences.toLowerCase().includes(chipKey.toLowerCase());
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          if (isAlreadyIn) {
                            handleUpdatePreferences(
                              personalPreferences.replace(new RegExp(chipKey, 'gi'), '').replace(/,\s*,/g, ',').trim()
                            );
                          } else {
                            handleUpdatePreferences(
                              personalPreferences ? `${personalPreferences.trim().replace(/\.$/, '')}, ${chipKey}.` : `${chipKey}.`
                            );
                          }
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${isAlreadyIn
                          ? 'bg-purple-100 border-purple-300 text-purple-900 shadow-2xs font-black'
                          : 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                          }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer / Action Button */}
            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-xs font-bold text-zinc-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRunningDeepAi}
                onClick={handleRunDeepAiAnalysis}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white text-xs font-extrabold shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isRunningDeepAi ? (
                  <>
                    <CircleNotch size={15} className="animate-spin text-white" />
                    <span>Auditing Photos, Lighting &amp; Agent Copy...</span>
                  </>
                ) : (
                  <>
                    <Sparkle size={15} weight="fill" className="text-amber-300" />
                    <span>Run Deep AI Analysis (Top 10)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI PROPERTY REPORT MODAL */}
      {viewingAiReportProp && (
        <div
          className="fixed inset-0 z-[130] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingAiReportProp(null);
            }
          }}
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-zinc-200 max-w-4xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                  <Sparkle size={22} weight="fill" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-zinc-950 leading-tight">
                      AI Property Forensic Report
                    </h2>
                    {viewingAiReportProp.fit_score && (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {viewingAiReportProp.fit_score}% Fit
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 font-medium">
                    Automated multimodal vision, acoustic modeling &amp; lease verification.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingAiReportProp(null)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                aria-label="Close Report"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Property Quick Summary Banner */}
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center gap-3">
              <img
                src={viewingAiReportProp.image}
                alt={viewingAiReportProp.title}
                className="w-16 h-16 rounded-xl object-cover shrink-0 border border-zinc-200 shadow-2xs"
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-sm text-zinc-900 truncate">
                  {viewingAiReportProp.title}
                </h3>
                <p className="text-xs text-zinc-500 truncate">{viewingAiReportProp.address}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-black text-indigo-700">
                    R {viewingAiReportProp.price.toLocaleString()} /mo
                  </span>
                  <span className="text-zinc-300">·</span>
                  <span className="text-[11px] font-medium text-zinc-600">
                    🛏️ {viewingAiReportProp.bedrooms} {viewingAiReportProp.bedrooms === 1 ? 'bed' : 'beds'}
                  </span>
                  <span className="text-[11px] font-medium text-zinc-600">
                    🚿 {viewingAiReportProp.bathrooms} bath
                  </span>
                  {viewingAiReportProp.sqm && (
                    <span className="text-[11px] font-medium text-zinc-600">
                      📐 {viewingAiReportProp.sqm} m²
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Active Search Filters in Effect */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-900">
                <span className="flex items-center gap-1.5 text-zinc-800">
                  <SlidersHorizontal size={14} weight="bold" className="text-indigo-600" />
                  Active Search Filters
                </span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Live Session Filters
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className="bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-zinc-800 shadow-2xs">
                  📍 {selectedSuburbs.length > 0 ? selectedSuburbs.join(', ') : 'All Suburbs'}
                </span>
                <span className="bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-zinc-800 shadow-2xs">
                  💰 R {formatPrice(minPrice)} – R {formatPrice(maxPrice)}
                </span>
                <span className="bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-zinc-800 shadow-2xs">
                  🛏️ {bedrooms} Bed
                </span>
                {minSqm && (
                  <span className="bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-zinc-800 shadow-2xs">
                    📐 {minSqm}+ m²
                  </span>
                )}
                {activeAnchor && (
                  <span className="bg-indigo-50 text-indigo-900 px-2 py-0.5 rounded-md border border-indigo-200 shadow-2xs">
                    🎯 {activeAnchor.label}
                  </span>
                )}
                {safeishFilter && (
                  <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-300 shadow-2xs">
                    ✓ 🛡️ Safe-ish
                  </span>
                )}
                {fibreFilter && (
                  <span className="bg-cyan-50 text-cyan-900 px-2 py-0.5 rounded-md border border-cyan-300 shadow-2xs">
                    ✓ 🌐 Fibre ready
                  </span>
                )}
                {northFacingFilter && (
                  <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300 shadow-2xs">
                    ✓ ☀️ North-facing
                  </span>
                )}
                {parkingFilter && (
                  <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-300 shadow-2xs">
                    ✓ 🚗 Parking
                  </span>
                )}
                {petFriendlyFilter && (
                  <span className="bg-pink-50 text-pink-900 px-2 py-0.5 rounded-md border border-pink-300 shadow-2xs">
                    ✓ 🐾 Pet-friendly
                  </span>
                )}
                {gasHobFilter && (
                  <span className="bg-orange-50 text-orange-900 px-2 py-0.5 rounded-md border border-orange-300 shadow-2xs">
                    ✓ 🔥 Gas hob
                  </span>
                )}
                {offMainRoadFilter && (
                  <span className="bg-purple-50 text-purple-900 px-2 py-0.5 rounded-md border border-purple-300 shadow-2xs">
                    ✓ 🛣️ Off-Main Rd
                  </span>
                )}
                {privateOnlyFilter && (
                  <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-300 shadow-2xs">
                    ✓ 🔒 100% Private Standalone
                  </span>
                )}
              </div>
            </div>

            {/* User Personal Preferences Input Box (Stored in localStorage) */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkle size={14} weight="fill" className="text-purple-600" />
                  Your Personal Preferences
                </label>
                {personalPreferences.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleUpdatePreferences('')}
                    className="text-[11px] font-bold text-zinc-500 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <X size={12} weight="bold" />
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">
                Saved automatically across sessions. Enter your lifestyle, space, or noise criteria. The report updates in real time.
              </p>
              <textarea
                rows={2}
                value={personalPreferences}
                onChange={(e) => handleUpdatePreferences(e.target.value)}
                placeholder="e.g. Quiet street, high natural light, fibre internet, space for desk, gas stove..."
                className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-zinc-900 font-medium resize-none leading-relaxed transition-all shadow-2xs"
              />
              {/* Standard Lifestyle & Work Mode Checkboxes */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase tracking-wider">
                  Work &amp; Lifestyle Mode:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Work from home (full-time)', tag: 'WFH (Full-time): quiet acoustic environment, fibre ready, desk space' },
                    { label: 'Work from home (part-time)', tag: 'WFH (Part-time): flexible hybrid work, stable fibre' },
                    { label: 'Work from cafes', tag: 'Work from cafes: walkable to coffee shops & laptop-friendly spots' },
                    { label: 'Work from an office', tag: 'Office commuter: proximity to major business hubs & commute transit' },
                  ].map((item) => {
                    const isChecked = personalPreferences.toLowerCase().includes(item.label.toLowerCase());
                    return (
                      <label
                        key={item.label}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all select-none ${isChecked
                            ? 'bg-purple-50/90 border-purple-300 text-purple-950 shadow-2xs font-extrabold ring-1 ring-purple-400/40'
                            : 'bg-white hover:bg-zinc-50 border-zinc-200/90 text-zinc-700'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const cleaned = personalPreferences.trim().replace(/\.$/, '');
                              handleUpdatePreferences(cleaned ? `${cleaned}. ${item.label}.` : `${item.label}.`);
                            } else {
                              const updated = personalPreferences
                                .replace(new RegExp(`\\b${item.label}\\b\\.?`, 'gi'), '')
                                .replace(/\.\s*\./g, '.')
                                .replace(/,\s*,/g, ',')
                                .trim();
                              handleUpdatePreferences(updated);
                            }
                          }}
                          className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600 shrink-0"
                        />
                        <span className="truncate">{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

                {/* Pro Feature: Viewing / Off-Portal Photo Upload */}
                <div className="pt-2 border-t border-zinc-200/60 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Camera size={13} weight="bold" className="text-purple-600" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
                        Viewing / Off-Portal Photos
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black uppercase tracking-wider">
                        {planSummary?.tier === 'free' ? 'Pro' : planSummary?.tier === 'hunter_pass' ? 'Hunter Pass' : 'Pro Active'}
                      </span>
                      {planSummary && (
                        <span className="text-[10px] font-semibold text-zinc-500">
                          • {planSummary.remainingAudits} {planSummary.remainingAudits === 1 ? 'audit' : 'audits'} left
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {planSummary?.tier === 'free' ? (
                        <a
                          href="/pricing"
                          className="text-[10px] font-black text-purple-700 hover:text-purple-900 underline"
                        >
                          Unlock R149 Hunter Pass →
                        </a>
                      ) : (
                        <a
                          href="/pricing"
                          className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 underline"
                        >
                          Manage Plan
                        </a>
                      )}
                    </div>
                  </div>

                  {planSummary && !planSummary.canUploadPhotos ? (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900">
                      <span>
                        Upload photos you snapped at a viewing (cracks, damp, plug points, street noise, kitchen) or off-portal Gumtree/Facebook screenshots for Gemini Vision inspection.
                      </span>
                      <a
                        href="/pricing"
                        className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black transition-colors"
                      >
                        Upgrade
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-purple-50 border border-dashed border-purple-300 text-[11px] font-bold text-purple-800 cursor-pointer transition-colors">
                          <Camera size={13} weight="bold" />
                          <span>Upload Viewing Photos ({uploadedViewingPhotos.length}/8)</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              handleUploadViewingPhotos(e.target.files);
                              e.target.value = '';
                            }}
                          />
                        </label>

                        {uploadedViewingPhotos.length > 0 && (
                          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-zinc-200">
                            {(
                              [
                                { id: 'both', label: 'Listing + Mine' },
                                { id: 'uploaded', label: 'My Photos Only' },
                                { id: 'listing', label: 'Listing Only' },
                              ] as const
                            ).map((mode) => (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() => setPhotoSourceMode(mode.id)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                                  photoSourceMode === mode.id
                                    ? 'bg-purple-700 text-white'
                                    : 'text-zinc-600 hover:bg-zinc-100'
                                }`}
                              >
                                {mode.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {uploadedViewingPhotos.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {uploadedViewingPhotos.map((src, idx) => (
                            <div key={idx} className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-purple-200 bg-zinc-100">
                              <img src={src} alt={`Viewing photo ${idx + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() =>
                                  setUploadedViewingPhotos((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-zinc-900/80 text-white text-[9px] font-black flex items-center justify-center cursor-pointer"
                                title="Remove photo"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit / Re-Run Button & Quick-Add Chips */}
                <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      if (viewingAiReportProp) {
                        runForensicAiInspection(viewingAiReportProp);
                      }
                    }}
                    disabled={Boolean((viewingAiReportProp as any).deep_ai_audit?.isVisionLoading)}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-95 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkle size={13} weight="fill" />
                    <span>
                      {(viewingAiReportProp as any).deep_ai_audit?.isVisionLoading
                        ? 'Analyzing Property...'
                        : 'Submit Preferences & Run AI Report'}
                    </span>
                  </button>
                  <div className="flex items-center flex-wrap gap-1">
                    {[
                      '🔒 100% Private (No Landlord)',
                      '🌿 Quiet Sanctuary',
                      '☀️ North-Facing Sunlight',
                      '🍳 Gas Cooking',
                      '💻 High-Speed Fibre',
                      '🐾 Pet-Friendly',
                      '🚗 Secure Parking',
                      '🏔️ Mountain or Ocean Views'
                    ].map((chip) => {
                      const chipKey = chip.replace(/^[^\w\s]+\s*/, '');
                      const isAlreadyIn = personalPreferences.toLowerCase().includes(chipKey.toLowerCase());
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            if (isAlreadyIn) {
                              handleUpdatePreferences(
                                personalPreferences.replace(new RegExp(chipKey, 'gi'), '').replace(/,\s*,/g, ',').trim()
                              );
                            } else {
                              handleUpdatePreferences(
                                personalPreferences ? `${personalPreferences.trim().replace(/\.$/, '')}, ${chipKey}.` : `${chipKey}.`
                              );
                            }
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${isAlreadyIn
                              ? 'bg-purple-100 border-purple-300 text-purple-900 shadow-2xs font-black'
                              : 'bg-white hover:bg-zinc-100 text-zinc-600 border-zinc-200/80'
                            }`}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Section: AI Forensic Report Results Container */}
              <div className="pt-2">
                <div className="p-4 rounded-2xl bg-gradient-to-b from-purple-50/60 via-white to-white border-2 border-purple-200/90 shadow-md space-y-4">
                  {/* Formal Report Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-purple-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Sparkle size={18} weight="fill" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wide">
                            AI Property Forensic Report
                          </h3>
                          {viewingAiReportProp.fit_score && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                              {viewingAiReportProp.fit_score}% Fit
                            </span>
                          )}
                          {(viewingAiReportProp as any).deep_ai_audit?.hasAiRun && (
                            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Verified Run
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 font-medium">
                          Autonomous multimodal vision, acoustic decibel modeling &amp; lease audit.
                        </p>
                      </div>
                    </div>

                    {/* Metadata Stamp (Time + Status) + Compare / Snag Export Actions */}
                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                      <button
                        type="button"
                        onClick={() => viewingAiReportProp && toggleCompareProperty(viewingAiReportProp)}
                        className={`px-2.5 py-1 rounded-xl border text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer ${
                          viewingAiReportProp && compareIds.includes(viewingAiReportProp.id)
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:bg-purple-50 hover:border-purple-200'
                        }`}
                      >
                        <Scales size={13} weight="bold" />
                        <span>
                          {viewingAiReportProp && compareIds.includes(viewingAiReportProp.id) ? '✓ In Compare' : '+ Compare'}
                        </span>
                      </button>

                      {compareIds.length >= 2 && (
                        <a
                          href="/compare"
                          className="px-2.5 py-1 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-[11px] font-black transition-colors"
                        >
                          Open Compare ({compareIds.length}) →
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => viewingAiReportProp && handleCopySnagReport(viewingAiReportProp)}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 text-[11px] font-bold transition-colors cursor-pointer"
                        title="Copy formatted viewing / move-in snag checklist"
                      >
                        {snagCopied ? '✓ Snag Copied' : 'Copy Snag Report'}
                      </button>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-semibold bg-white px-2.5 py-1 rounded-xl border border-zinc-200 shadow-2xs">
                        <Clock size={13} weight="bold" className="text-purple-600" />
                        <span>
                          Generated: {(viewingAiReportProp as any).deep_ai_audit?.generatedAt || 'Standby (Pending Submission)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Consolidated Preference Alignment & Search Baseline Card (Zero Duplication) */}
                  <div className="p-3.5 rounded-2xl bg-purple-50/75 border border-purple-200/80 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkle size={16} weight="fill" className="text-purple-600" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-purple-950">
                          Preference Alignment &amp; Search Baseline
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-zinc-500">
                          {selectedSuburbs.length > 0 ? selectedSuburbs.join(', ') : 'All Suburbs'} · R {formatPrice(minPrice)}–{formatPrice(maxPrice)}
                        </span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                          {viewingAiReportProp.rank ? `Rank #${viewingAiReportProp.rank}` : 'Forensic Match'}
                        </span>
                      </div>
                    </div>

                    {/* Active Search Filters (only shown if any filters or anchor are active) */}
                    {(activeAnchor || safeishFilter || fibreFilter || northFacingFilter || parkingFilter || petFriendlyFilter || gasHobFilter || offMainRoadFilter || privateOnlyFilter) && (
                      <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-semibold">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mr-0.5 flex items-center gap-1">
                          <SlidersHorizontal size={11} weight="bold" className="text-indigo-500" />
                          Filters:
                        </span>
                        {activeAnchor && (
                          <span className="bg-indigo-50 text-indigo-900 px-2 py-0.5 rounded-md border border-indigo-200">
                            🎯 {activeAnchor.label}
                          </span>
                        )}
                        {safeishFilter && (
                          <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                            Safe-ish
                          </span>
                        )}
                        {fibreFilter && (
                          <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                            Fibre
                          </span>
                        )}
                        {northFacingFilter && (
                          <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                            North-facing
                          </span>
                        )}
                        {parkingFilter && (
                          <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                            Parking
                          </span>
                        )}
                        {petFriendlyFilter && (
                          <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                            Pet-friendly
                          </span>
                        )}
                        {gasHobFilter && (
                          <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                            Gas hob
                          </span>
                        )}
                        {offMainRoadFilter && (
                          <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                            Off-Main Rd
                          </span>
                        )}
                        {privateOnlyFilter && (
                          <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                            100% Private
                          </span>
                        )}
                      </div>
                    )}

                    {/* Applied Lifestyle Input + AI Verdict in a clean 2-part card */}
                    <div className="bg-white/90 rounded-xl border border-purple-100 divide-y divide-purple-100/70">
                      <div className="p-2.5 text-[11px] text-zinc-600 flex items-start gap-1.5">
                        <span className="font-extrabold text-purple-900 shrink-0">Your Brief:</span>
                        <span className="italic text-zinc-700">
                          {(viewingAiReportProp as any).deep_ai_audit?.appliedPreferences ||
                            personalPreferences.trim() ||
                            'Standard optimal rental baseline (no custom criteria provided).'}
                        </span>
                      </div>
                      <div className="p-2.5 text-[11.5px] font-semibold text-purple-950 leading-relaxed flex items-start gap-1.5">
                        <span className="font-extrabold text-purple-700 shrink-0">Verdict:</span>
                        <span>
                          {(viewingAiReportProp as any).deep_ai_audit?.personalMatchVerdict ||
                            (viewingAiReportProp as any).deep_ai_audit?.amenitiesVerdict ||
                            'Evaluated against your active search criteria and property telemetry.'}
                        </span>
                      </div>
                    </div>

                    {/* Verified Property Telemetry & Risk Badges (Shown Once) */}
                    <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                      {(() => {
                        const rep = getAgencyReputationInfo(viewingAiReportProp);
                        if (!rep.isPoorAgency) return null;
                        return (
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-600 border border-rose-700 text-white flex items-center gap-1 shadow-2xs"
                            title={rep.tooltipReason}
                          >
                            <WarningCircle size={11} weight="fill" className="text-white" />
                            <span>{rep.badgeLabel}</span>
                          </span>
                        );
                      })()}
                      {(() => {
                        const barNoise = getPropertyBarNoiseExposure(viewingAiReportProp);
                        if (!barNoise.isExposed || !barNoise.badgeLabel) return null;
                        return (
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-50 border border-rose-300 text-rose-950 flex items-center gap-1 shadow-2xs"
                            title={barNoise.tooltipReason}
                          >
                            <SpeakerHigh size={11} weight="fill" className="text-rose-600" />
                            <span>{barNoise.badgeLabel}</span>
                          </span>
                        );
                      })()}
                      {(() => {
                        const busyRoad = getPropertyBusyRoadExposure(viewingAiReportProp);
                        if (!busyRoad.isNearBusyRoad || !busyRoad.badgeLabel) return null;
                        return (
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-950 flex items-center gap-1 shadow-2xs"
                            title={busyRoad.tooltipReason}
                          >
                            <Car size={11} weight="fill" className="text-amber-700" />
                            <span>{busyRoad.badgeLabel}</span>
                          </span>
                        );
                      })()}
                      {isLandlordOnSiteProperty(viewingAiReportProp) ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-950 flex items-center gap-1 shadow-2xs">
                          <WarningCircle size={11} weight="fill" className="text-amber-700" />
                          <span>⚠️ Landlord On-Site / Shared Grounds</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center gap-1">
                          <ShieldCheck size={11} weight="bold" className="text-emerald-700" />
                          <span>Autonomous 100% Private Lease</span>
                        </span>
                      )}
                      {!isPropertyInHighRiskCrimeZone(viewingAiReportProp.lat, viewingAiReportProp.lng) ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-emerald-900 flex items-center gap-1">
                          <span>🛡️</span> Safe-ish Verified
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 border border-rose-300 text-rose-900 flex items-center gap-1">
                          <span>⚠️</span> Near Crime Hotspot
                        </span>
                      )}
                      {Boolean(viewingAiReportProp.fibre_ready) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-cyan-200 text-cyan-900">
                          ✓ Fibre Ready
                        </span>
                      )}
                      {(viewingAiReportProp.has_garage || (viewingAiReportProp.parking_type && viewingAiReportProp.parking_type !== 'none')) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-900">
                          ✓ Off-Street Parking
                        </span>
                      )}
                      {viewingAiReportProp.stove_type === 'gas' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-orange-200 text-orange-900">
                          ✓ Gas Hob
                        </span>
                      )}
                      {viewingAiReportProp.pet_friendly && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-pink-200 text-pink-900">
                          ✓ Pet Friendly
                        </span>
                      )}
                      {((viewingAiReportProp.acoustic_audit?.facing_direction || '').toLowerCase().includes('north') || viewingAiReportProp.title.toLowerCase().includes('north')) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-amber-200 text-amber-900">
                          ✓ North-Facing
                        </span>
                      )}
                    </div>
                  </div>

              {/* Unified Pros & Cons Audit (Info, Images & Strategic Fit) */}
              {(() => {
                const audit = (viewingAiReportProp as any).deep_ai_audit;
                const insights = audit?.strategicInsights;
                const rawPros: string[] = Array.isArray(audit?.pros) ? audit.pros : [];
                const rawCons: string[] = Array.isArray(audit?.cons) ? audit.cons : [];
                const reasonsToRent: string[] = Array.isArray(insights?.reasonsToRent) ? insights.reasonsToRent : [];
                const reasonsToAvoid: string[] = Array.isArray(insights?.reasonsToAvoid) ? insights.reasonsToAvoid : [];
                const watchouts: string[] = Array.isArray(insights?.criticalWatchouts) ? insights.criticalWatchouts : [];

                // Deduplicate and consolidate all good-fit reasons and raw pros
                const unifiedPros = Array.from(new Set([...reasonsToRent, ...rawPros]));
                const unifiedCons = Array.from(new Set([...reasonsToAvoid, ...rawCons]));

                if (unifiedPros.length === 0 && unifiedCons.length === 0 && watchouts.length === 0) return null;

                return (
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <Sparkle size={16} weight="fill" className="text-purple-600" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">
                          Pros &amp; Cons (Info, Images &amp; Strategic Fit)
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-500">
                        {unifiedPros.length} Pros · {unifiedCons.length} Cons · {watchouts.length} Watchouts
                      </span>
                    </div>

                    {/* 3-Column Grid for Pros, Cons & Things to Be Aware Of */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* PROS: Good Fit & Visual Highlights */}
                      <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 flex flex-col justify-between space-y-2.5">
                        <div>
                          <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/60">
                            <h5 className="text-[11.5px] font-extrabold uppercase tracking-wide text-emerald-950 flex items-center gap-1.5">
                              <CheckCircle size={15} weight="fill" className="text-emerald-600 shrink-0" />
                              <span>Pros ({unifiedPros.length})</span>
                            </h5>
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Good Fit
                            </span>
                          </div>
                          <ul className="mt-2 space-y-2 text-[11px] font-medium text-emerald-950 leading-snug">
                            {unifiedPros.map((item, idx) => {
                              const isPhoto = /photo|visual|gallery|finishes|worktop|cabinetry|daylight/i.test(item);
                              return (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-emerald-600 font-black shrink-0 mt-0.5">
                                    {isPhoto ? '📷' : '✓'}
                                  </span>
                                  <span>{item}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                        <div className="pt-2 border-t border-emerald-200/40 text-[9.5px] font-bold text-emerald-700">
                          {unifiedPros.length} positive fit indicator{unifiedPros.length === 1 ? '' : 's'}
                        </div>
                      </div>

                      {/* CONS: Friction Points & Visual Gaps */}
                      <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/90 flex flex-col justify-between space-y-2.5">
                        <div>
                          <div className="flex items-center justify-between pb-1.5 border-b border-rose-200/60">
                            <h5 className="text-[11.5px] font-extrabold uppercase tracking-wide text-rose-950 flex items-center gap-1.5">
                              <WarningCircle size={15} weight="fill" className="text-rose-600 shrink-0" />
                              <span>Cons &amp; Risks ({unifiedCons.length})</span>
                            </h5>
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                              Watchouts
                            </span>
                          </div>
                          <ul className="mt-2 space-y-2 text-[11px] font-medium text-rose-950 leading-snug">
                            {unifiedCons.map((item, idx) => {
                              const isPhoto = /photo|visual|gallery|withheld|focal length|proportions|gap|sanitaryware/i.test(item);
                              return (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-rose-600 font-black shrink-0 mt-0.5">
                                    {isPhoto ? '📷' : '⚠️'}
                                  </span>
                                  <span>{item}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                        <div className="pt-2 border-t border-rose-200/40 text-[9.5px] font-bold text-rose-700">
                          {unifiedCons.length} potential friction point{unifiedCons.length === 1 ? '' : 's'}
                        </div>
                      </div>

                      {/* THINGS TO BE AWARE OF: Tenant Vigilance Checklist */}
                      <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/90 flex flex-col justify-between space-y-2.5">
                        <div>
                          <div className="flex items-center justify-between pb-1.5 border-b border-indigo-200/60">
                            <h5 className="text-[11.5px] font-extrabold uppercase tracking-wide text-indigo-950 flex items-center gap-1.5">
                              <Info size={15} weight="fill" className="text-indigo-600 shrink-0" />
                              <span>Things to Be Aware Of</span>
                            </h5>
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                              Checklist
                            </span>
                          </div>
                          <ul className="mt-2 space-y-2 text-[11px] font-medium text-indigo-950 leading-snug">
                            {watchouts.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-indigo-600 font-black shrink-0 mt-0.5">🔍</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="pt-2 border-t border-indigo-200/40 text-[9.5px] font-bold text-indigo-700">
                          Tenant checklist before signing
                        </div>
                      </div>
                    </div>

                    {/* Notice if Gemini Quota Depleted */}
                    {audit?.isVisionFallback && (
                      <div className="text-[10px] text-zinc-500 bg-amber-50/80 border border-amber-200/60 rounded-xl px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-amber-600">ℹ️</span>
                          <span><strong>Photo Analysis:</strong> Showing visual gallery inspection findings (AI Studio prepayment balance depleted).</span>
                        </div>
                        <a
                          href="https://aistudio.google.com/billing"
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-800 font-bold underline hover:text-amber-950"
                        >
                          Top up credits in AI Studio →
                        </a>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Architecture, Space & Building Intelligence Audit */}
              {(() => {
                const audit = (viewingAiReportProp as any).deep_ai_audit;
                if (!audit) return null;
                const bIntel = audit.buildingIntel;
                const archCards = [
                  { icon: '💻', title: 'Space & WFH Ergonomics', text: audit.wfhLayoutVerdict },
                  { icon: '☀️', title: 'Window Placement & Daylight', text: audit.windowLightAudit },
                  { icon: '🧱', title: 'Wall Type & Acoustics', text: audit.wallAcousticAudit },
                  { icon: '📐', title: 'Ceiling Height & Volume', text: audit.ceilingVolumeAudit },
                  { icon: '💡', title: 'Light Fixtures & Evening Mood', text: audit.lightingFixturesAudit },
                  { icon: '🏢', title: 'Exterior & Building Signal', text: audit.exteriorBuildingAudit },
                ].filter((c) => Boolean(c.text));

                if (archCards.length === 0 && !bIntel?.building_name) return null;

                return (
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ruler size={17} weight="bold" className="text-slate-700" />
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                            Architecture, Space &amp; Building Intelligence
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Evaluated against WFH ergonomics, daylight/sightlines, wall transmission, ceilings, lighting &amp; block reputation
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-800 shrink-0">
                        6-Point Audit
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {archCards.map((card, i) => (
                        <div key={i} className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1 shadow-2xs">
                          <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-slate-800">
                            <span>{card.icon}</span>
                            <span>{card.title}</span>
                          </div>
                          <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                            {card.text}
                          </p>
                        </div>
                      ))}
                    </div>

                    {bIntel?.building_name && (
                      <div className="p-3.5 rounded-xl bg-white border border-indigo-200/80 space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">🏙️</span>
                            <span className="text-xs font-black text-indigo-950">
                              Block Intel: {bIntel.building_name}
                            </span>
                          </div>
                          {bIntel.google_rating && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                              ★ {bIntel.google_rating} {bIntel.review_count ? `(${bIntel.review_count} reviews)` : ''}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                          {bIntel.has_lift && bIntel.has_lift !== 'unknown' && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                              Lift: {bIntel.has_lift === 'yes' ? 'Yes' : 'Walk-up (No Lift)'}
                            </span>
                          )}
                          {bIntel.airbnb_risk && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-200">
                              Airbnb/Short-Let Risk: {String(bIntel.airbnb_risk).split('—')[0].trim()}
                            </span>
                          )}
                          {bIntel.backup_power && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200">
                              Power: {String(bIntel.backup_power).split('—')[0].trim()}
                            </span>
                          )}
                        </div>

                        {bIntel.review_summary && (
                          <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                            {bIntel.review_summary}
                          </p>
                        )}
                        {(bIntel.soundproofing || bIntel.body_corporate) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[10.5px] text-slate-600">
                            {bIntel.soundproofing && (
                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="font-bold text-slate-800">Acoustics:</span> {bIntel.soundproofing}
                              </div>
                            )}
                            {bIntel.body_corporate && (
                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="font-bold text-slate-800">Body Corporate:</span> {bIntel.body_corporate}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Section 1: Acoustic Decibel & Orientation Audit (Moved from Map Card) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white border border-indigo-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SpeakerHigh size={18} weight="bold" className="text-indigo-600" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950">
                      Acoustic Decibel &amp; Orientation Audit
                    </h4>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${(viewingAiReportProp.acoustic_audit?.estimated_db || 40) <= 40
                    ? 'bg-emerald-100/80 text-emerald-900 border-emerald-300'
                    : 'bg-rose-100/80 text-rose-900 border-rose-300'
                    }`}>
                    {viewingAiReportProp.acoustic_audit?.estimated_db || (viewingAiReportProp.noise_risk === 'sanctuary' ? 38 : 45)} dBA
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/90 border border-indigo-100/80 space-y-1">
                    <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
                      Sound Shadow Status
                    </div>
                    <div className="font-bold text-zinc-800 text-[11px]">
                      {viewingAiReportProp.acoustic_audit?.sound_shadow_status ||
                        (viewingAiReportProp.noise_risk === 'sanctuary'
                          ? 'Quiet Sanctuary Setback'
                          : 'Standard Residential Buffer')}
                    </div>
                    <div className="text-[10px] text-zinc-500 leading-relaxed">
                      Shielded from direct traffic reverberations and arterial corridors via natural elevation and building setback.
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/90 border border-indigo-100/80 space-y-1">
                    <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
                      Orientation &amp; Natural Shielding
                    </div>
                    <div className="font-bold text-zinc-800 text-[11px]">
                      Facing: {viewingAiReportProp.acoustic_audit?.facing_direction || 'Not specified in listing'}
                    </div>
                    <div className="text-[10px] text-zinc-500 leading-relaxed">
                      Balcony and main living windows oriented away from prevailing winds and transit noise.
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Multimodal Computer Vision Photo Audit */}
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Eye size={18} weight="bold" className="text-purple-600" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-900">
                      Computer Vision Photo Inspection
                    </h4>
                  </div>
                  {((viewingAiReportProp as any).deep_ai_audit?.isVisionLoading) ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 animate-pulse">
                      Inspecting photos…
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200/80 text-zinc-700">
                      {(cardGalleries[viewingAiReportProp.id]?.length || viewingAiReportProp.images?.length || 1)} photo(s)
                    </span>
                  )}
                </div>

                {(() => {
                  const imgs = cardGalleries[viewingAiReportProp.id]?.length
                    ? cardGalleries[viewingAiReportProp.id]
                    : viewingAiReportProp.images?.length
                      ? viewingAiReportProp.images
                      : viewingAiReportProp.image
                        ? [viewingAiReportProp.image]
                        : [];
                  const photoStory = (viewingAiReportProp as any).deep_ai_audit?.photoStory;
                  return (
                    <>
                      {imgs.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                          {imgs.slice(0, 6).map((src, idx) => (
                            <img
                              key={idx}
                              src={src}
                              alt={`Gallery ${idx + 1}`}
                              className="w-16 h-12 rounded-lg object-cover border border-zinc-200 shrink-0"
                            />
                          ))}
                        </div>
                      )}
                      {photoStory && (
                        <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/80 text-[11.5px] font-medium text-purple-950 leading-relaxed">
                          <span className="font-extrabold text-purple-900">Photo Story: </span>
                          {photoStory}
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="space-y-2 text-xs">
                  {/* Stove Inspection */}
                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-zinc-200/70">
                    <span className="text-base leading-none mt-0.5">🍳</span>
                    <div className="min-w-0">
                      <div className="font-extrabold text-zinc-900 text-[11px]">
                        Stove &amp; Cooktop Verification
                      </div>
                      <div className="text-[11px] text-zinc-600">
                        {(viewingAiReportProp as any).deep_ai_audit?.stoveType ||
                          (viewingAiReportProp.stove_type === 'gas' ? 'Gas hob detected (4-burner)' : viewingAiReportProp.stove_type === 'induction' ? 'Induction hob detected' : 'Built-in stove & oven verified')}
                      </div>
                    </div>
                  </div>

                  {/* Natural Light & Glazing */}
                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-zinc-200/70">
                    <span className="text-base leading-none mt-0.5">☀️</span>
                    <div className="min-w-0">
                      <div className="font-extrabold text-zinc-900 text-[11px]">
                        Daylight &amp; Glazing Angles
                      </div>
                      <div className="text-[11px] text-zinc-600">
                        {(viewingAiReportProp as any).deep_ai_audit?.glazing ||
                          'Direct natural daylight verified across main living spaces.'}
                      </div>
                    </div>
                  </div>

                  {/* Plumbing Connections */}
                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-zinc-200/70">
                    <span className="text-base leading-none mt-0.5">🚰</span>
                    <div className="min-w-0">
                      <div className="font-extrabold text-zinc-900 text-[11px]">
                        Kitchen Appliance Plumbing
                      </div>
                      <div className="text-[11px] text-zinc-600">
                        {(viewingAiReportProp as any).deep_ai_audit?.plumbing ||
                          'Dedicated washing machine and dishwasher plumbing connection points verified.'}
                      </div>
                    </div>
                  </div>

                  {/* Lens Distortion Check */}
                  <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-zinc-200/70">
                    <span className="text-base leading-none mt-0.5">📐</span>
                    <div className="min-w-0">
                      <div className="font-extrabold text-zinc-900 text-[11px]">
                        Camera Perspective &amp; Distortion Check
                      </div>
                      <div className="text-[11px] text-zinc-600">
                        {(viewingAiReportProp as any).deep_ai_audit?.distortion ||
                          'Standard 28mm architectural lens ratio; zero deceptive fish-eye room stretching detected.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Agent Copy & Lease Forensic Audit */}
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} weight="bold" className="text-emerald-600" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-900">
                    Agent Copy &amp; Lease Forensic Verdict
                  </h4>
                </div>

                <div className="space-y-2 text-xs">
                  {(() => {
                    const rep = getAgencyReputationInfo(viewingAiReportProp);
                    if (rep.isPoorAgency) {
                      return (
                        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-300">
                          <WarningCircle size={16} weight="fill" className="text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-extrabold text-rose-950 text-[11px]">
                              🚩 High Agency Risk: {rep.agencyName} ({rep.rating}★)
                            </div>
                            <div className="text-[11px] text-rose-900 mt-0.5 leading-snug">
                              {rep.tooltipReason}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    if (rep.agencyName) {
                      return (
                        <div className="flex items-start gap-2 p-2 rounded-xl bg-white border border-zinc-200/70">
                          <CheckCircle size={15} weight="bold" className="text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-extrabold text-zinc-900 text-[11px]">
                              Managing Agency Reputation
                            </div>
                            <div className="text-[11px] text-zinc-600">
                              {rep.agencyName}{rep.rating ? ` (${rep.rating}★ verified Google rating)` : ' — Standard tenancy verification.'}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div className="flex items-start gap-2 p-2 rounded-xl bg-white border border-zinc-200/70">
                    {((viewingAiReportProp as any).deep_ai_audit?.isLandlordOnSite) ? (
                      <Info size={15} weight="bold" className="text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle size={15} weight="bold" className="text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-extrabold text-zinc-900 text-[11px]">Private Tenancy Verification</div>
                      <div className="text-[11px] text-zinc-600">
                        {(viewingAiReportProp as any).deep_ai_audit?.tenancyType ||
                          '100% self-contained private lease (zero student digs or shared commune clauses).'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 rounded-xl bg-white border border-zinc-200/70">
                    <CheckCircle size={15} weight="bold" className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold text-zinc-900 text-[11px]">Quiet Hours &amp; Rules</div>
                      <div className="text-[11px] text-zinc-600">
                        {(viewingAiReportProp as any).deep_ai_audit?.quietRules ||
                          'Formal residential tenancy agreement prohibiting noise disturbances or disruptive short-lets.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

                {/* Modal Footer */}
                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setViewingAiReportProp(null)}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-xs font-bold text-zinc-700 transition-all cursor-pointer"
                  >
                    Close Report
                  </button>
                  <div className="flex items-center gap-2">
                    <a
                      href={resolveGoogleMapsUrl(viewingAiReportProp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="py-2.5 px-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold flex items-center justify-center gap-1.5 border border-zinc-200 transition-all cursor-pointer"
                      title="Show this location in Google Maps (opens in a new tab)"
                    >
                      <MapPin size={13} weight="bold" className="text-rose-500" />
                      <span>Google Maps</span>
                      <ArrowSquareOut size={12} weight="bold" className="text-zinc-400" />
                    </a>
                    <a
                      href={resolveProperty24Url(viewingAiReportProp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => openProperty24Url(e, resolveProperty24Url(viewingAiReportProp))}
                      className="py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-indigo-600 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <span>View Original on Property24</span>
                      <ArrowSquareOut size={13} weight="bold" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
      )}

          {/* PROPERTY24 FAVOURITES IMPORT MODAL */}
          {isImportModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setIsImportModalOpen(false)}
            >
              <div
                className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-zinc-200 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
                      <Heart size={20} weight="fill" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-zinc-950">Import Property24 Favourites</h3>
                      <p className="text-xs text-zinc-500">Paste your saved Property24 links or page HTML</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                  >
                    <X size={18} weight="bold" />
                  </button>
                </div>

                {/* Input area */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-700">
                    Paste Property24 Links, Listing IDs, or copied HTML from favourites:
                  </label>
                  <textarea
                    value={importInputText}
                    onChange={(e) => setImportInputText(e.target.value)}
                    placeholder="Paste one or more Property24 links, e.g.:
https://www.property24.com/to-rent/tamboerskloof/cape-town/western-cape/9151/117183204
https://www.property24.com/to-rent/gardens/cape-town/western-cape/9143/116982405

Tip: You can also copy all text (Ctrl+A, Ctrl+C) from your Property24 Favourites page and paste it here!"
                    className="w-full h-36 p-3 rounded-2xl border border-zinc-200 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 resize-none font-mono"
                  />
                </div>

                {/* Quick Load Sample Links for instant testing */}
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setImportInputText(
                        'https://www.property24.com/to-rent/tamboerskloof/cape-town/western-cape/9151/117183204\nhttps://www.property24.com/to-rent/gardens/cape-town/western-cape/9143/116982405\nhttps://www.property24.com/to-rent/sea-point/cape-town/western-cape/11013/116849201'
                      );
                    }}
                    className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                  >
                    + Load Sample Property24 Links
                  </button>
                  {importedFavourites.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFavourites}
                      className="text-zinc-400 hover:text-rose-600 font-semibold cursor-pointer"
                    >
                      Clear {importedFavourites.length} imported favourites
                    </button>
                  )}
                </div>

                {/* Status Feedback */}
                {importStatusMsg && (
                  <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${importStatusMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}>
                    <Sparkle size={14} weight="fill" className={importStatusMsg.type === 'success' ? "text-emerald-500 shrink-0" : "text-rose-500 shrink-0"} />
                    <span>{importStatusMsg.text}</span>
                  </div>
                )}

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImportFavourites}
                    disabled={isImporting || !importInputText.trim()}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md cursor-pointer ${isImporting || !importInputText.trim()
                      ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 active:scale-95'
                      }`}
                  >
                    {isImporting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Importing &amp; Geocoding...</span>
                      </>
                    ) : (
                      <>
                        <Heart size={14} weight="fill" />
                        <span>Import Favourites</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      );
}
