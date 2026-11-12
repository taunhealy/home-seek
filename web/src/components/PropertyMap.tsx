'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  Minus,
  Compass,
  MapPin,
  NavigationArrow,
  Car,
  Bicycle,
  PersonSimpleWalk,
  House,
  Target,
  Sparkle,
  ArrowsOutCardinal,
  CheckCircle,
  CaretUp,
  CaretDown,
  MapTrifold,
  SpeakerHigh,
  ShieldCheck,
  ShieldWarning,
  Waveform,
  Stack,
  CircleDashed,
  SlidersHorizontal,
  ArrowSquareOut,
  X,
  Camera,
  CaretLeft,
  CaretRight,
  Tree,
  Waves
} from '@phosphor-icons/react';
import { Wine, Dumbbell, ShoppingBag, Coffee as CoffeeLucide } from 'lucide-react';
import { resolveLocationCoords, getPropertyMarketValuation } from '@/lib/geo';

export interface AcousticAudit {
  estimated_db: number;
  exposure_level: 'sanctuary' | 'moderate' | 'high' | string;
  exposure_label: string;
  is_shielded: boolean;
  sound_shadow_status: string;
  facing_direction: string;
  nearest_hotspot: string;
  distance_to_hotspot_m: number;
  hotspot_lat?: number;
  hotspot_lng?: number;
  hotspot_type?: string;
  decibel_reduction_db?: number;
  is_ground_entrance?: boolean;
  acoustic_quirks?: string[];
  verdict?: string;
}

export interface PropertyMapItem {
  id: string;
  title: string;
  address: string;
  price: number;
  currency?: string;
  bedrooms: number;
  bathrooms: number;
  sqm?: number;
  image: string;
  images?: string[];
  lat: number;
  lng: number;
  url?: string;
  source_platform?: string;
  is_favorite?: boolean;
  rank?: number;
  fit_score?: number;
  noise_risk?: string;
  noise_reason?: string | null;
  location_proximity?: any[];
  acoustic_audit?: Partial<AcousticAudit>;
  ai_insight?: string;
  agency_name?: string;
  agency_rating?: number;
  agency_hellopeter_rating?: number;
  agency_risk_level?: string;
  agency_flags?: string[];
  agency_complaint_sample?: string;
  p24_id?: string;
  is_main_road?: boolean;
  stove_type?: string;
  parking_type?: string;
  pet_friendly?: boolean;
  fibre_ready?: boolean;
  dwelling_privacy?: string;
  is_landlord_on_site?: boolean;
  has_garage?: boolean;
  has_secure_bay?: boolean;
  deep_ai_audit?: any;
  is_address_withheld?: boolean;
  price_value_pct?: number | null;
  [key: string]: any;
}

/**
 * Returns true when a listing lacks a verified street/building address
 * (e.g., Property24 withheld the street address and only provided a suburb/pocket name).
 */
export function isMissingAddressListing(prop?: PropertyMapItem | null): boolean {
  if (!prop) return false;
  if (!prop.lat || !prop.lng || !Number.isFinite(prop.lat) || !Number.isFinite(prop.lng)) return true;
  if (prop.is_address_withheld) return true;

  const addr = (prop.address || '').trim().toLowerCase();
  if (!addr) return true;
  if (/\b(withheld|unavailable|not provided|upon request|contact agent|unknown address)\b/i.test(addr)) return true;

  const hasStreetNumber = /^\s*\d{1,5}[a-z]?\s+/i.test(addr) || /,\s*\d{1,5}[a-z]?\s+/i.test(addr);
  const hasStreetSuffix = /\b(?:street|st|road|rd|avenue|ave|drive|dr|way|wy|lane|ln|close|cl|crescent|cres|circle|cir|boulevard|blvd|terrace|terraces|walk|row|place|pl)\b/i.test(addr);
  const hasNamedComplex = /\b(?:mews|court|mansions|heights|towers|manor|villas|lofts|residences|pavilion|square|quay|lodge|apartments|flats)\b/i.test(addr);
  return !(hasStreetNumber || hasStreetSuffix || hasNamedComplex);
}

export interface ProximityAnchor {
  id: string;
  label: string;
  target_place: string;
  lat: number;
  lng: number;
  max_commute_mins?: number;
  max_distance_km?: number;
  commute_mode?: 'driving' | 'transit' | 'walking' | 'bicycling' | string;
  iconType?: 'trail' | 'surf' | 'beach' | 'attraction' | 'cafe' | 'gym' | 'shop' | 'work' | 'general' | 'hub';
  category?: 'attraction' | 'gym' | 'hub' | 'trail' | 'cafe' | 'shop';
}

export interface ProximityFilterConfig {
  lat: number;
  lng: number;
  radiusKm: number;
  label: string;
}

export interface PropertyMapProps {
  properties: PropertyMapItem[];
  anchors: ProximityAnchor[];
  selectedPropertyId?: string | null;
  selectedAnchorId?: string | null;
  onSelectProperty?: (property: PropertyMapItem) => void;
  onSelectAnchor?: (anchor: ProximityAnchor) => void;
  proximityFilter?: ProximityFilterConfig | null;
  onRadiusChange?: (radiusKm: number) => void;
  className?: string;
  mode?: 'default' | 'search';
  selectedSuburbs?: string[];
  enableAiAnalysis?: boolean;
  focusTarget?: any;
  onDeselectProperty?: () => void;
  onHoverProperty?: (p: PropertyMapItem | null) => void;
  showCardPopupOnMap?: boolean;
  onAddSuburb?: (suburb: string) => void;
  onOpenAiReport?: (p: PropertyMapItem) => void;
  searchSummary?: {
    minPrice?: string | number;
    maxPrice?: string | number;
    bedrooms?: string;
    suburbsCount?: number;
  };
}

// Convert lat/lng to Web Mercator pixel coordinates
function project(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = n * ((lng + 180) / 360);
  const latRad = (lat * Math.PI) / 180;
  const y = (n * (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI)) / 2;
  return { x: x * 256, y: y * 256 };
}

// Haversine straight-line distance in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Deterministic number formatting to avoid SSR/client locale hydration mismatch
export function formatNumberDeterministic(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Topography-Aware Driving Distance & Duration Calculation
export function calculateDrivingDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const straight = calculateDistanceKm(lat1, lon1, lat2, lon2);

  // Cape Town topography check: Signal Hill / Lion's Head divides Atlantic Seaboard from City Bowl
  const isAtlantic1 = lon1 < 18.398 && lat1 > -33.955 && lat1 < -33.900;
  const isBowl1 = lon1 >= 18.400 && lat1 > -33.955 && lat1 < -33.915;
  const isAtlantic2 = lon2 < 18.398 && lat2 > -33.955 && lat2 < -33.900;
  const isBowl2 = lon2 >= 18.400 && lat2 > -33.955 && lat2 < -33.915;

  if ((isAtlantic1 && isBowl2) || (isBowl1 && isAtlantic2)) {
    // Must drive around Signal Hill via Helen Suzman / Buitengracht or Kloof Nek Pass (~2.7x)
    return Math.round(Math.max(5.4, straight * 2.7) * 10) / 10;
  }
  // Standard urban street road network factor (~1.38x)
  return Math.round(Math.max(0.6, straight * 1.38) * 10) / 10;
}

export function calculateDrivingDurationMins(drivingKm: number): number {
  return Math.max(2, Math.round((drivingKm / 32) * 60 + 2));
}

interface DrivingRouteData {
  distanceKm: number;
  durationMins: number;
  distanceText: string;
  durationText: string;
  points: [number, number][]; // [lat, lng] array
}

const drivingRouteCache = new Map<string, DrivingRouteData>();

// Cape Town Calibrated Noise Hotspots & Verified Sanctuary Enclaves
export const CAPE_TOWN_HOTSPOTS = [
  {
    id: 'sp_mojo_market_regent',
    name: 'Mojo Market & Regent Road (30 Regent Rd, Sea Point)',
    shortName: 'Mojo Market',
    lat: -33.919297,
    lng: 18.385825,
    base_db: 85,
    radius_m: 180,
    type: 'nightlife',
    desc: 'High-energy 7-days-a-week indoor market with live acoustic/DJ stages, craft beer bars & dense Regent Rd foot traffic.'
  },
  {
    id: 'sp_the_nines_rooftop',
    name: 'The Nines & Station House Rooftop (19 Kloof Rd, Sea Point)',
    shortName: 'The Nines',
    lat: -33.9189,
    lng: 18.3845,
    base_db: 82,
    radius_m: 140,
    type: 'nightlife',
    desc: 'Rooftop cocktail bar & dinner lounge overlooking Sea Point oceanfront.'
  },
  {
    id: 'sp_rockpool_beach_rd',
    name: 'Rockpool & Sea Point Promenade (205 Beach Rd, Sea Point)',
    shortName: 'Rockpool',
    lat: -33.909274,
    lng: 18.393433,
    base_db: 82,
    radius_m: 150,
    type: 'nightlife',
    desc: 'Beachfront cocktail terrace chatter and sunset dining traffic along Beach Road.'
  },
  {
    id: 'sp_hugo_social_club',
    name: 'Hugo Social Club Rooftop (2 Kings Rd, Sea Point)',
    shortName: 'Hugo Social Club',
    lat: -33.9142,
    lng: 18.3905,
    base_db: 82,
    radius_m: 140,
    type: 'nightlife',
    desc: 'Panoramic rooftop bar and pool club with evening DJ sets and skyline views.'
  },
  {
    id: 'gp_tigers_milk_main',
    name: "Tiger's Milk & Mano's (Green Point Main Rd)",
    shortName: "Tiger's Milk Green Point",
    lat: -33.908869,
    lng: 18.412098,
    base_db: 84,
    radius_m: 160,
    type: 'nightlife',
    desc: 'Vibrant sports bars, outdoor dining terrace crowds, and evening ride-share pickups.'
  },
  {
    id: 'somerset_greenpoint_strip',
    name: 'Somerset Road Bar & Dining Strip (Green Point)',
    shortName: 'Somerset Rd Strip',
    lat: -33.9090,
    lng: 18.4110,
    base_db: 83,
    radius_m: 220,
    type: 'nightlife',
    desc: 'Sports bars, outdoor patios & evening crowd buzz.'
  },
  {
    id: 'kloof_power_and_glory',
    name: 'The Power & The Glory (13D Kloof Nek Rd, Tamboerskloof)',
    shortName: 'The Power & The Glory',
    lat: -33.9317,
    lng: 18.4069,
    base_db: 84,
    radius_m: 160,
    type: 'nightlife',
    desc: 'Iconic corner bar with vibrant pavement crowd at 13D Kloof Nek Rd (cnr Carstens/Camp St).'
  },
  {
    id: 'kloof_yours_truly',
    name: 'Yours Truly & Up Yours Balcony Bar (73 Kloof St, Gardens)',
    shortName: 'Yours Truly',
    lat: -33.9300,
    lng: 18.4109,
    base_db: 84,
    radius_m: 155,
    type: 'nightlife',
    desc: 'Open-air balcony bar, live DJ sets & high-volume pavement spillover along Kloof St.'
  },
  {
    id: 'kloof_blondie_park_rd',
    name: 'Blondie & Park Road Bars (71 Kloof St, Gardens)',
    shortName: 'Blondie',
    lat: -33.9293,
    lng: 18.4114,
    base_db: 85,
    radius_m: 160,
    type: 'nightlife',
    desc: 'Packed pavement bar crowds at Blondie & Park Rd corner with late-night street spillover.'
  },
  {
    id: 'kloof_aruba_nightlife',
    name: 'Kloof & Malan St (Aruba, Paradiso)',
    shortName: 'Aruba & Paradiso',
    lat: -33.9323,
    lng: 18.4108,
    base_db: 84,
    radius_m: 220,
    type: 'nightlife',
    desc: 'Late-night DJ bass & patio crowds down Malan St waveguide.'
  },
  {
    id: 'bree_long_cbd',
    name: 'Bree & Long Street Clubs & Bars',
    shortName: 'Bree & Long St',
    lat: -33.9220,
    lng: 18.4175,
    base_db: 86,
    radius_m: 300,
    type: 'nightlife',
    desc: 'High-decibel clubs & street revellers until 03:00.'
  },
  {
    id: 'cb_cafe_caprice',
    name: 'Café Caprice (37 Victoria Rd, Camps Bay)',
    shortName: 'Café Caprice',
    lat: -33.9515,
    lng: 18.3780,
    base_db: 86,
    radius_m: 200,
    type: 'nightlife',
    desc: 'Sunset beachfront cocktail lounge, weekend DJ sessions & bustling sidewalk tables.'
  },
  // Hout Bay Bars & Nightlife Hotspots (Verified via Google Maps Places API)
  {
    id: 'hb_dunes_beach_bar',
    name: 'Dunes Beach Restaurant & Bar (1 Beach Cres, Scott Estate, Hout Bay)',
    shortName: 'Dunes Beach Bar',
    lat: -34.045568,
    lng: 18.358365,
    base_db: 83,
    radius_m: 170,
    type: 'nightlife',
    desc: 'Busy beachfront restaurant & sundowner bar overlooking Hout Bay Beach at 1 Beach Cres.'
  },
  {
    id: 'hb_beach_bar_scott',
    name: 'Beach Bar Hout Bay (Chapmans Peak Dr, Scott Estate, Hout Bay)',
    shortName: 'Beach Bar Hout Bay',
    lat: -34.0467565,
    lng: 18.3609681,
    base_db: 82,
    radius_m: 150,
    type: 'nightlife',
    desc: 'Coastal cocktail & burger bar terrace at Scott Estate near Chapman\'s Peak Drive.'
  },
  {
    id: 'hb_mexicola_locale',
    name: 'Mexicola Locale (The Promenade, Melkhout Cres, Scott Estate, Hout Bay)',
    shortName: 'Mexicola Locale',
    lat: -34.0454378,
    lng: 18.3593109,
    base_db: 81,
    radius_m: 140,
    type: 'nightlife',
    desc: 'Lively tequila bar & taco cantina along The Promenade in Scott Estate.'
  },
  {
    id: 'hb_pakalolo_main',
    name: 'Pakalolo Hout Bay (10 Main Rd, Hout Bay)',
    shortName: 'Pakalolo Hout Bay',
    lat: -34.0463979,
    lng: 18.3621000,
    base_db: 84,
    radius_m: 160,
    type: 'nightlife',
    desc: 'Late-night sports & cocktail pub near the Beach Crescent / Main Rd circle.'
  },
  {
    id: 'hb_woodcutters_arms',
    name: 'Woodcutters Arms (37 Main Rd, Hout Bay)',
    shortName: 'Woodcutters Arms',
    lat: -34.0432265,
    lng: 18.3591025,
    base_db: 83,
    radius_m: 150,
    type: 'nightlife',
    desc: 'Traditional village tavern, live sport screens & evening beer garden at 37 Main Rd.'
  },
  {
    id: 'hb_the_vic_bar',
    name: 'The Vic Restaurant and Bar (6 Victoria Ave, Hout Bay)',
    shortName: 'The Vic Bar',
    lat: -34.0434289,
    lng: 18.3507791,
    base_db: 82,
    radius_m: 145,
    type: 'nightlife',
    desc: 'Neighbourhood pub, live music nights & evening dining at 6 Victoria Ave.'
  },
  {
    id: 'hb_shirleys_bar',
    name: "Shirley's (36 Victoria Rd, Hout Bay)",
    shortName: "Shirley's Bar",
    lat: -34.0411857,
    lng: 18.3505785,
    base_db: 82,
    radius_m: 140,
    type: 'nightlife',
    desc: 'Classic late-night local pub along Victoria Road.'
  },
  {
    id: 'hb_the_lookout_harbour',
    name: 'The Lookout Hout Bay (65 Harbour Rd, Hout Bay Harbour)',
    shortName: 'The Lookout Deck',
    lat: -34.0501104,
    lng: 18.3459515,
    base_db: 83,
    radius_m: 170,
    type: 'nightlife',
    desc: 'High-volume harbour deck bar & seafood hotspot with weekend DJ sets and live music.'
  },
  {
    id: 'hb_urban_brewing',
    name: 'Urban Brewing Company (31 Harbour Rd, Hout Bay Harbour)',
    shortName: 'Urban Brewing Co.',
    lat: -34.0550000,
    lng: 18.3472222,
    base_db: 83,
    radius_m: 175,
    type: 'nightlife',
    desc: 'Craft brewery, taproom & live-band hotspot adjacent to Bay Harbour Market.'
  },
  {
    id: 'hb_kronendal_1713',
    name: 'Kronendal 1713 (140 Hout Bay Main Rd, Hout Bay)',
    shortName: 'Kronendal 1713',
    lat: -34.0325876,
    lng: 18.3565152,
    base_db: 79,
    radius_m: 130,
    type: 'nightlife',
    desc: 'Historic courtyard restaurant & evening cocktail bar at 140 Hout Bay Main Rd.'
  },
  {
    id: 'main_road_seapoint',
    name: 'Main Road Commercial Arterial (Sea Point)',
    shortName: 'Main Rd Arterial',
    lat: -33.9175,
    lng: 18.3880,
    base_db: 78,
    radius_m: 220,
    type: 'transit',
    desc: 'Buses, delivery scooters & late grocery traffic.'
  },
  {
    id: 'mill_buitenkant_transit',
    name: 'Mill St & Buitenkant Transit Canyon',
    shortName: 'Mill & Buitenkant',
    lat: -33.9305,
    lng: 18.4140,
    base_db: 77,
    radius_m: 190,
    type: 'transit',
    desc: 'Dual carriageway transit & 24hr petrol idling.'
  },
  {
    id: 'helen_suzman_blvd',
    name: 'Helen Suzman Blvd Highway',
    shortName: 'Helen Suzman Blvd',
    lat: -33.9050,
    lng: 18.4120,
    base_db: 76,
    radius_m: 160,
    type: 'highway',
    desc: 'Fast arterial road & stadium event traffic.'
  }
];

export interface CrimeHotspot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  risk_level: 'High Risk' | 'Moderate Risk' | 'Caution' | string;
  incident_type: string;
}

export const CAPE_TOWN_CRIME_HOTSPOTS: CrimeHotspot[] = [
  // --- City Bowl & CBD ---
  {
    id: 'crime_long_street_nightlife',
    name: 'Long & Loop Street Nightlife Corridor',
    lat: -33.9220,
    lng: 18.4175,
    radius_m: 240,
    risk_level: 'High Risk',
    incident_type: 'Late-night phone snatchings, pickpocketing & bar-exit muggings'
  },
  {
    id: 'crime_greenmarket_square',
    name: 'Greenmarket Square / Shortmarket St',
    lat: -33.9225,
    lng: 18.4200,
    radius_m: 200,
    risk_level: 'High Risk',
    incident_type: 'Street harassment, opportunistic theft & ATM distraction scams'
  },
  {
    id: 'crime_cape_town_station',
    name: 'Cape Town Station & Grand Parade Taxi Rank',
    lat: -33.92364,
    lng: 18.42719,
    radius_m: 300,
    risk_level: 'High Risk',
    incident_type: 'Aggressive street muggings, commuter theft & pickpocketing'
  },
  {
    id: 'crime_kloof_street_late_corridor',
    name: 'Kloof St / Breda St Fringe (Late-Night)',
    lat: -33.9310,
    lng: 18.4120,
    radius_m: 180,
    risk_level: 'Moderate Risk',
    incident_type: 'Ride-share distraction muggings & pavement phone-snatching'
  },
  {
    id: 'crime_gardens_de_waal_park_perimeter',
    name: 'De Waal Park & Molteno Reservoir Outer Edge (Late-Night)',
    lat: -33.9385,
    lng: 18.4105,
    radius_m: 170,
    risk_level: 'Moderate Risk',
    incident_type: 'Dusk opportunistic muggings & car break-ins on unlit perimeters'
  },
  {
    id: 'crime_vredehoek_quarry_edge',
    name: 'Vredehoek Quarry / Mountain Footpath Trailhead',
    lat: -33.9392,
    lng: 18.4285,
    radius_m: 210,
    risk_level: 'Caution',
    incident_type: 'Isolated hiker/runner muggings on remote boundary paths'
  },
  {
    id: 'crime_tamboerskloof_military_road_trail',
    name: 'Lion\'s Head Military Rd & Signal Hill Parking',
    lat: -33.9315,
    lng: 18.4010,
    radius_m: 220,
    risk_level: 'Moderate Risk',
    incident_type: 'Sunset trail muggings & vehicle window-smashing at lookout parking'
  },

  // --- Atlantic Seaboard ---
  {
    id: 'crime_sea_point_promenade_late',
    name: 'Sea Point Pavilion & Beach Rd (Late Night)',
    lat: -33.9210,
    lng: 18.3810,
    radius_m: 200,
    risk_level: 'Caution',
    incident_type: 'Late-night phone snatching from parked cars & pavement revellers'
  },
  {
    id: 'crime_sea_point_main_rd_fringe',
    name: 'Sea Point Main Rd / Hall St Commercial Fringe',
    lat: -33.9165,
    lng: 18.3895,
    radius_m: 170,
    risk_level: 'Moderate Risk',
    incident_type: 'Opportunistic pickpocketing & outdoor dining bag snatching'
  },
  {
    id: 'crime_green_point_somerset_late',
    name: 'Green Point Somerset Rd & Stadium Subway Edge',
    lat: -33.9085,
    lng: 18.4115,
    radius_m: 190,
    risk_level: 'Moderate Risk',
    incident_type: 'Bar-closing altercation corridor & ride-share opportunistic theft'
  },
  {
    id: 'crime_camps_bay_strip_late',
    name: 'Camps Bay Victoria Rd Sunset Strip (Late Night)',
    lat: -33.9515,
    lng: 18.3775,
    radius_m: 220,
    risk_level: 'Caution',
    incident_type: 'Late-night beach car break-ins & distracted tourist phone snatching'
  },

  // --- Southern Suburbs & Urban Fringe ---
  {
    id: 'crime_woodstock_lower_main',
    name: 'Woodstock Lower Main Rd / Albert Rd Strip',
    lat: -33.9285,
    lng: 18.4480,
    radius_m: 260,
    risk_level: 'High Risk',
    incident_type: 'After-hours street robberies & vehicle window smashing'
  },
  {
    id: 'crime_salt_river_station',
    name: 'Salt River Station & Voortrekker Rd Corridor',
    lat: -33.92755,
    lng: 18.46469,
    radius_m: 320,
    risk_level: 'High Risk',
    incident_type: 'Transit interchange robberies, phone snatching & after-hours industrial fringe risk'
  },
  {
    id: 'crime_observatory_lower_main',
    name: 'Observatory Lower Main & Station Subway',
    lat: -33.93838,
    lng: 18.47151,
    radius_m: 240,
    risk_level: 'High Risk',
    incident_type: 'Nighttime student muggings, phone snatching & car prowling'
  },
  {
    id: 'crime_mowbray_interchange',
    name: 'Mowbray Taxi Rank & Main Rd Interchange',
    lat: -33.94801,
    lng: 18.47698,
    radius_m: 280,
    risk_level: 'High Risk',
    incident_type: 'Dense commuter transit hub — pickpocketing, bag snatching & evening muggings'
  },
  {
    id: 'crime_claremont_stadium_on_main',
    name: 'Claremont Main Rd & Station Taxi Terminus',
    lat: -33.98169,
    lng: 18.46703,
    radius_m: 260,
    risk_level: 'High Risk',
    incident_type: 'Aggressive street muggings, commuter theft & pickpocketing'
  },
  {
    id: 'crime_wynberg_station_terminus',
    name: 'Wynberg Station & Main Rd Taxi Terminus',
    lat: -34.00491,
    lng: 18.47118,
    radius_m: 320,
    risk_level: 'High Risk',
    incident_type: 'Major transit interchange — elevated street robbery, phone snatching & evening foot-traffic risk'
  },
  {
    id: 'crime_rondebosch_station_subway',
    name: 'Rondebosch Main Rd & Station Underpass',
    lat: -33.9635,
    lng: 18.4760,
    radius_m: 200,
    risk_level: 'Moderate Risk',
    incident_type: 'Evening student muggings & transit foot-traffic snatching'
  },

  // --- South Peninsula & Deep South ---
  {
    id: 'crime_hout_bay_hangberg',
    name: 'Hangberg Township & Mountain Slope (Adjacent to Northshore)',
    lat: -34.05252,
    lng: 18.34028,
    radius_m: 1050,
    risk_level: 'High Risk',
    incident_type: 'High-risk township fringe adjacent to Northshore & Harbour — elevated break-in, opportunistic mugging & perimeter risk outside secure estates'
  },
  {
    id: 'crime_hout_bay_imizamo_yethu',
    name: 'Imizamo Yethu Township & Mountain Slope (Hout Bay)',
    lat: -34.02874,
    lng: 18.36085,
    radius_m: 950,
    risk_level: 'High Risk',
    incident_type: 'High-density mountain-slope township — elevated burglary, trespass & evening foot-traffic mugging risk on unfenced neighbouring streets'
  },
  {
    id: 'crime_hout_bay_harbour_industrial',
    name: 'Hout Bay Harbour & Industrial Access Zone',
    lat: -34.05509,
    lng: 18.34383,
    radius_m: 450,
    risk_level: 'Caution',
    incident_type: 'Nighttime opportunist theft, vehicle break-ins & industrial fringe access'
  },
  {
    id: 'crime_vrygrond_capricorn',
    name: 'Vrygrond / Overcome Heights Township (Adjacent to Capricorn & Muizenberg)',
    lat: -34.08209,
    lng: 18.48547,
    radius_m: 1100,
    risk_level: 'High Risk',
    incident_type: 'High-density township bordering Capricorn & Marina da Gama — elevated burglary, opportunistic robbery & M5/Prince George Dr corridor risk'
  },
  {
    id: 'crime_muizenberg_station_subway',
    name: 'Muizenberg Station Subway & Atlantic Rd Strip',
    lat: -34.10963,
    lng: 18.46796,
    radius_m: 240,
    risk_level: 'Moderate Risk',
    incident_type: 'Subway commuter muggings, pickpocketing & parking lot theft'
  },
  {
    id: 'crime_kalk_bay_harbour_strip',
    name: 'Kalk Bay Main Rd & Railway Subway',
    lat: -34.1285,
    lng: 18.4485,
    radius_m: 160,
    risk_level: 'Caution',
    incident_type: 'Weekend tourist vehicle break-ins & fishing pier opportunism'
  },
  {
    id: 'crime_fish_hoek_station_dune',
    name: 'Fish Hoek Station & Coastal Dune Catwalk Edge',
    lat: -34.13717,
    lng: 18.43254,
    radius_m: 220,
    risk_level: 'Moderate Risk',
    incident_type: 'Commuter platform muggings & dune pathway robberies'
  },
  {
    id: 'crime_masiphumelele_township',
    name: 'Masiphumelele Township (Noordhoek / Kommetjie Corridor)',
    lat: -34.12920,
    lng: 18.37642,
    radius_m: 1100,
    risk_level: 'High Risk',
    incident_type: 'High-density township between Noordhoek, Sun Valley & Kommetjie — elevated perimeter burglary & Kommetjie Rd corridor risk'
  },
  {
    id: 'crime_ocean_view_township',
    name: 'Ocean View Township (Kommetjie / Red Hill Corridor)',
    lat: -34.14954,
    lng: 18.35343,
    radius_m: 950,
    risk_level: 'High Risk',
    incident_type: 'High-density township & mountain-pass fringe — elevated opportunistic robbery & perimeter risk outside gated complexes'
  }
];

export function getCrimeDepthTier(spot: CrimeHotspot): 'high' | 'moderate' | 'low' {
  const r = (spot.risk_level || '').toLowerCase();
  if (r.includes('high')) return 'high';
  if (r.includes('moderate') || r.includes('caution')) return 'moderate';
  return 'low';
}

export interface BusyRoadCorridor {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  roadName: string;
}

export const CAPE_TOWN_BUSY_ROADS: BusyRoadCorridor[] = [
  { id: 'road_kloof_nek_m62', name: 'Kloof Nek Rd (M62)', roadName: 'Kloof Nek Rd (M62)', lat: -33.9350, lng: 18.4040, radius_m: 60 },
  { id: 'road_main_rd_sea_point', name: 'Main Rd (M61) Sea Point', roadName: 'Main Rd (M61)', lat: -33.9160, lng: 18.3890, radius_m: 60 },
  { id: 'road_regent_rd_sea_point', name: 'Regent Rd Sea Point', roadName: 'Regent Rd', lat: -33.9200, lng: 18.3840, radius_m: 55 },
  { id: 'road_helen_suzman_blvd', name: 'Helen Suzman Blvd (M61)', roadName: 'Helen Suzman Blvd', lat: -33.9050, lng: 18.4120, radius_m: 70 },
  { id: 'road_buitengracht_m62', name: 'Buitengracht St (M62)', roadName: 'Buitengracht St', lat: -33.9210, lng: 18.4160, radius_m: 65 },
  { id: 'road_orange_street', name: 'Orange St / Grey\'s Pass', roadName: 'Orange St', lat: -33.9285, lng: 18.4130, radius_m: 55 },
  { id: 'road_victoria_rd_camps_bay', name: 'Victoria Rd (M6) Camps Bay', roadName: 'Victoria Rd (M6)', lat: -33.9515, lng: 18.3780, radius_m: 60 },
  { id: 'road_main_rd_muizenberg', name: 'Main Rd (M4) Muizenberg', roadName: 'Main Rd (M4)', lat: -34.1078, lng: 18.4679, radius_m: 55 },
];

export function getPropertyBusyRoadExposure(prop: any) {
  if (!prop) {
    return {
      isDirectlyOnRoad: false,
      isNearBusyRoad: false,
      roadName: '',
      distanceM: 0,
      shortFlag: null as string | null,
      badgeLabel: null as string | null,
      tooltipReason: '',
      road: null as { shortName: string; base_db: number } | null
    };
  }

  const text = `${prop.address || ''} ${prop.title || ''}`.toLowerCase();
  const roadMatch = text.match(/\b(kloof\s+nek(\s+r(oa)?d)?|main\s+r(oa)?d|regent\s+r(oa)?d|victoria\s+r(oa)?d|somerset\s+r(oa)?d|kloof\s+st(reet)?|buitengracht|orange\s+st(reet)?|helen\s+suzman|mill\s+st(reet)?|ou\s+kaapse\s+weg|m3|m4|m5|m6|m62)\b/i);

  if (roadMatch) {
    const rName = roadMatch[0].toUpperCase();
    return {
      isDirectlyOnRoad: true,
      isNearBusyRoad: true,
      roadName: rName,
      distanceM: 20,
      shortFlag: `🚗 On ${rName} (80 dB)`,
      badgeLabel: `🚗 On ${rName} (80 dB)`,
      tooltipReason: `High-frequency vehicular traffic & peak hour delivery idling along ${rName}.`,
      road: { shortName: rName, base_db: 80 }
    };
  }

  if (prop.lat && prop.lng) {
    for (const r of CAPE_TOWN_BUSY_ROADS) {
      const d = Math.hypot(prop.lat - r.lat, (prop.lng - r.lng) * Math.cos(prop.lat * Math.PI / 180)) * 111320;
      if (d <= r.radius_m) {
        const roundedD = Math.round(d);
        return {
          isDirectlyOnRoad: d <= 30,
          isNearBusyRoad: true,
          roadName: r.roadName,
          distanceM: roundedD,
          shortFlag: `🚗 On ${r.roadName} (80 dB)`,
          badgeLabel: `🚗 On ${r.roadName} (80 dB)`,
          tooltipReason: `Within ${roundedD}m of ${r.roadName} traffic corridor.`,
          road: { shortName: r.roadName, base_db: 80 }
        };
      }
    }
  }

  return {
    isDirectlyOnRoad: false,
    isNearBusyRoad: false,
    roadName: '',
    distanceM: 0,
    shortFlag: null as string | null,
    badgeLabel: null as string | null,
    tooltipReason: '',
    road: null as { shortName: string; base_db: number } | null
  };
}

export function getPropertyBarNoiseExposure(prop: any) {
  if (!prop) {
    return {
      isExposed: false,
      severity: 'none' as const,
      distanceMeters: 9999,
      distanceM: 9999,
      shortFlag: null as string | null,
      badgeLabel: null as string | null,
      tooltipReason: '',
      hotspot: null as { name: string; shortName: string; base_db: number } | null
    };
  }

  const text = `${prop.address || ''} ${prop.title || ''}`.toLowerCase();
  for (const bar of CAPE_TOWN_HOTSPOTS) {
    if (bar.type !== 'nightlife') continue;
    const nameKeywords = (bar.shortName || bar.name).toLowerCase().split(/[\s,&()]+/);
    const hasNameMatch = nameKeywords.some(kw => kw.length > 3 && text.includes(kw));
    
    let distM = 9999;
    if (prop.lat && prop.lng) {
      distM = Math.hypot(prop.lat - bar.lat, (prop.lng - bar.lng) * Math.cos(prop.lat * Math.PI / 180)) * 111320;
    }

    if (hasNameMatch || distM <= bar.radius_m) {
      const isClose = distM <= bar.radius_m * 0.6 || hasNameMatch;
      const severity = isClose ? ('high' as const) : ('moderate' as const);
      const bName = bar.shortName || bar.name.split('(')[0].trim();
      const distStr = distM < 999 ? ` (~${Math.round(distM)}m)` : '';
      const roundedD = Math.round(distM);
      return {
        isExposed: true,
        severity,
        distanceMeters: roundedD,
        distanceM: roundedD,
        shortFlag: `🍻 ${bName} (${bar.base_db} dB)`,
        badgeLabel: `🍻 ${bName}${distStr} (${bar.base_db} dB)`,
        tooltipReason: `${bName}: ${bar.desc} (${bar.base_db} dB peak late-night noise).`,
        hotspot: {
          name: bar.name,
          shortName: bar.shortName || bName,
          base_db: bar.base_db
        }
      };
    }
  }

  return {
    isExposed: false,
    severity: 'none' as const,
    distanceMeters: 9999,
    distanceM: 9999,
    shortFlag: null as string | null,
    badgeLabel: null as string | null,
    tooltipReason: '',
    hotspot: null as { name: string; shortName: string; base_db: number } | null
  };
}

export const CAPE_TOWN_SANCTUARIES = [
  {
    id: 'upper_tamboerskloof',
    name: 'Upper Tamboerskloof (Lion\'s Head)',
    lat: -33.9365,
    lng: 18.4015,
    radius_m: 450,
    ambient_db: 36,
    desc: 'Cul-de-sacs behind Lion\'s Head ridge with zero bar noise'
  },
  {
    id: 'higgovale_enclave',
    name: 'Higgovale Mountain Sanctuary',
    lat: -33.9410,
    lng: 18.4030,
    radius_m: 500,
    ambient_db: 34,
    desc: 'Ultra-quiet indigenous forest under Table Mountain'
  },
  {
    id: 'upper_oranjezicht',
    name: 'Upper Oranjezicht & Deer Park',
    lat: -33.9430,
    lng: 18.4250,
    radius_m: 480,
    ambient_db: 35,
    desc: 'Pine forest boundary & quiet tree-lined avenues'
  },
  {
    id: 'fresnaye_slopes',
    name: 'Upper Fresnaye Slopes',
    lat: -33.9240,
    lng: 18.3815,
    radius_m: 420,
    ambient_db: 36,
    desc: 'High-elevation wind-sheltered avenues above Sea Point'
  }
];

export const SUBURB_ABBREVIATIONS: Record<string, string> = {
  'tamboerskloof': 'TK',
  'oranjezicht': 'OZ',
  'gardens': 'GD',
  'green point': 'GP',
  'sea point': 'SP',
  'camps bay': 'CB',
  'vredehoek': 'VH',
  'higgovale': 'HV',
  'bo-kaap': 'BK',
  'de waterkant': 'DW',
  'mouille point': 'MP',
  'fresnaye': 'FR',
  'bantry bay': 'BB',
  'clifton': 'CF',
  'bakoven': 'BO',
  'hout bay': 'HB',
  'observatory': 'OB',
  'woodstock': 'WS',
  'salt river': 'SR',
  'rondebosch': 'RB',
  'newlands': 'NL',
  'claremont': 'CM',
  'constantia': 'CS',
  'century city': 'CC',
  'kalk bay': 'KB',
  'simons town': 'ST',
  "simon's town": 'ST',
  'fish hoek': 'FH',
  'muizenberg': 'MB',
  'pinelands': 'PL',
  'durbanville': 'DV',
  'bellville': 'BV',
  'blouberg': 'BB',
  'table view': 'TV',
};

export function getSuburbAbbr(name: string): string {
  const clean = name.toLowerCase().trim();
  if (SUBURB_ABBREVIATIONS[clean]) return SUBURB_ABBREVIATIONS[clean];
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export const PropertyMap: React.FC<PropertyMapProps> = ({
  properties,
  anchors,
  selectedPropertyId,
  selectedAnchorId,
  onSelectProperty,
  onSelectAnchor,
  proximityFilter = null,
  onRadiusChange,
  className = '',
  mode = 'default',
  selectedSuburbs = [],
  searchSummary,
  focusTarget
}) => {
  const isSearchMode = mode === 'search';
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const [zoom, setZoom] = useState(14.5);
  const targetZoomRef = useRef(14.5);
  const animFrameRef = useRef<number | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: -33.9300,
    lng: 18.4100,
  });

  // Local proximity radius ring state (in km)
  const [localRadiusKm, setLocalRadiusKm] = useState<number>(() => {
    return proximityFilter?.radiusKm || 5.0;
  });

  useEffect(() => {
    if (proximityFilter?.radiusKm !== undefined) {
      setLocalRadiusKm(proximityFilter.radiusKm);
    }
  }, [proximityFilter?.radiusKm]);

  const effectiveRadiusKm = proximityFilter?.radiusKm ?? localRadiusKm;

  const handleRadiusChange = (newRadius: number) => {
    setLocalRadiusKm(newRadius);
    if (onRadiusChange) {
      onRadiusChange(newRadius);
    }
  };

  // Map Basemap Style: 'canvas' (Esri Gray Canvas) or 'osm' (OpenStreetMap)
  const [mapStyle, setMapStyle] = useState<'canvas' | 'osm'>('canvas');

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  // Active Road Driving Route State
  const [activeDrivingRoute, setActiveDrivingRoute] = useState<DrivingRouteData | null>(null);


  const hasDraggedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const [hoveredProperty, setHoveredProperty] = useState<PropertyMapItem | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handlePropertyMouseEnter = useCallback((prop: PropertyMapItem) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredProperty(prop);
  }, []);

  const handlePropertyMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredProperty(null);
    }, 160);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);
  const [showAnchors, setShowAnchors] = useState(true);
  const [showRadius, setShowRadius] = useState(true);
  const [showNoiseRadar, setShowNoiseRadar] = useState(mode !== 'search');
  const [showCrimeRadar, setShowCrimeRadar] = useState(true);
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);
  const [isSearchRadarCollapsed, setIsSearchRadarCollapsed] = useState(false);
  const [isRadiusCollapsed, setIsRadiusCollapsed] = useState(false);
  const [isMissingAddressCollapsed, setIsMissingAddressCollapsed] = useState(false);

  // Resolve effective coordinates for all properties, placing missing-address listings
  // at the center of their known general area (with a tiny radial spread if multiple share the same area center)
  const resolvedPropertyCoords = React.useMemo(() => {
    const map = new Map<string, { lat: number; lng: number; isApproximateArea: boolean }>();
    const approxBuckets = new Map<string, PropertyMapItem[]>();

    for (const p of properties) {
      const approx = isMissingAddressListing(p);
      if (!approx) {
        if (Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0)) {
          map.set(p.id, { lat: p.lat, lng: p.lng, isApproximateArea: false });
        }
        continue;
      }

      const areaQuery = (p.address || p.suburb || '').trim();
      const resolved = areaQuery ? resolveLocationCoords(areaQuery) : null;
      const hasValidBackendCoords =
        Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0);
      const isOnlyGenericParentMatch =
        resolved &&
        p.suburb &&
        resolved.label.toLowerCase() === p.suburb.toLowerCase() &&
        areaQuery.toLowerCase() !== p.suburb.toLowerCase();
      const hasSpecificResolvedArea =
        resolved &&
        (resolved.label.toLowerCase() !== 'cape town' || areaQuery.toLowerCase().includes('cape town')) &&
        !(hasValidBackendCoords && isOnlyGenericParentMatch);

      let baseLat = p.lat;
      let baseLng = p.lng;
      if (hasSpecificResolvedArea && resolved) {
        baseLat = resolved.lat;
        baseLng = resolved.lng;
      }

      if (Number.isFinite(baseLat) && Number.isFinite(baseLng) && (baseLat !== 0 || baseLng !== 0)) {
        const bucketKey = `${baseLat.toFixed(4)},${baseLng.toFixed(4)}`;
        const list = approxBuckets.get(bucketKey) || [];
        list.push(p);
        approxBuckets.set(bucketKey, list);
        map.set(p.id, { lat: baseLat, lng: baseLng, isApproximateArea: true });
      }
    }

    // Apply a subtle deterministic ring offset (~45m) when multiple approximate-area listings
    // share the exact same suburb center so their markers remain individually clickable
    for (const list of approxBuckets.values()) {
      if (list.length <= 1) continue;
      const radiusDeg = 0.00045;
      list.forEach((p, idx) => {
        const entry = map.get(p.id);
        if (!entry) return;
        const angle = (2 * Math.PI * idx) / list.length - Math.PI / 2;
        map.set(p.id, {
          lat: entry.lat + Math.sin(angle) * radiusDeg,
          lng: entry.lng + Math.cos(angle) * radiusDeg,
          isApproximateArea: true,
        });
      });
    }

    return map;
  }, [properties]);

  const mappableProperties = React.useMemo(
    () => properties.filter((p) => resolvedPropertyCoords.has(p.id)),
    [properties, resolvedPropertyCoords]
  );
  const missingAddressProperties = React.useMemo(
    () => properties.filter((p) => isMissingAddressListing(p)),
    [properties]
  );

  // Venue / Place Details & Photos Popover State (Google Places API for Bars, Cafes, Gyms, Shops)
  const [inspectedPlace, setInspectedPlace] = useState<any | null>(null);
  const [placeDetailsCache, setPlaceDetailsCache] = useState<Record<string, any>>({});
  const [isLoadingPlaceDetails, setIsLoadingPlaceDetails] = useState(false);
  const [placeActivePhotoIdx, setPlaceActivePhotoIdx] = useState<number>(0);

  const resolvePlacePhotoUrl = useCallback((url?: string) => {
    if (!url) return '';
    if (url.startsWith('/api/')) {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      return `${backendBase}${url}`;
    }
    return url;
  }, []);

  const fetchPlaceDetails = useCallback(async (place: any) => {
    if (!place) return;
    const placeKey = place.id || place.label || place.name;
    if (placeDetailsCache[placeKey]) return;
    setIsLoadingPlaceDetails(true);
    setPlaceActivePhotoIdx(0);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const rawName = place.label || place.shortName || place.name || place.target_place || '';
      const cleanQuery = rawName.split('(')[0].replace(/·.*$/, '').trim();
      const res = await fetch(`${backendBase}/api/places/details?query=${encodeURIComponent(cleanQuery)}&lat=${place.lat}&lng=${place.lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.place) {
          setPlaceDetailsCache((prev) => ({ ...prev, [placeKey]: data.place }));
        }
      }
    } catch (err) {
      console.warn('[Places] Failed to fetch place details:', err);
    } finally {
      setIsLoadingPlaceDetails(false);
    }
  }, [placeDetailsCache]);

  // Click-to-activate map focus (prevents page scroll hijacking)
  const [isMapActive, setIsMapActive] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Outside click listener to deactivate map focus
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsMapActive(false);
        setShowScrollHint(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, []);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 600,
          height: containerRef.current.clientHeight || 600,
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Center map & calculate smart initial zoom on load
  useEffect(() => {
    const focusPool = mappableProperties.length > 0 ? mappableProperties : properties;
    if (!isSearchMode && focusPool.length > 0) {
      const lats = focusPool.map(p => p.lat);
      const lngs = focusPool.map(p => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const avgLat = (minLat + maxLat) / 2;
      const avgLng = (minLng + maxLng) / 2;
      setCenter({ lat: avgLat, lng: avgLng });
      const span = Math.max(maxLat - minLat, maxLng - minLng);
      const targetZ = span < 0.015 ? 15.2 : span < 0.035 ? 14.5 : span < 0.08 ? 13.8 : 13.0;
      setZoom(targetZ);
      targetZoomRef.current = targetZ;
    }
  }, [mappableProperties, properties, isSearchMode]);

  // Auto-center & frame in Search Mode when criteria change
  useEffect(() => {
    if (isSearchMode) {
      const points: { lat: number; lng: number }[] = [];
      if (proximityFilter) {
        points.push({ lat: proximityFilter.lat, lng: proximityFilter.lng });
      }
      if (selectedSuburbs && selectedSuburbs.length > 0) {
        selectedSuburbs.forEach((suburb) => {
          const geo = resolveLocationCoords(suburb);
          points.push({ lat: geo.lat, lng: geo.lng });
        });
      }
      if (anchors && anchors.length > 0) {
        anchors.forEach((a) => points.push({ lat: a.lat, lng: a.lng }));
      }
      if (points.length > 0 && !isDraggingRef.current) {
        let minLat = points[0].lat;
        let maxLat = points[0].lat;
        let minLng = points[0].lng;
        let maxLng = points[0].lng;
        points.forEach((pt) => {
          if (pt.lat < minLat) minLat = pt.lat;
          if (pt.lat > maxLat) maxLat = pt.lat;
          if (pt.lng < minLng) minLng = pt.lng;
          if (pt.lng > maxLng) maxLng = pt.lng;
        });
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        setCenter({ lat: centerLat, lng: centerLng });
        const span = Math.max(maxLat - minLat, maxLng - minLng);
        const targetZ = span < 0.02 ? 14.6 : span < 0.06 ? 13.8 : span < 0.12 ? 12.8 : 12.0;
        setZoom(targetZ);
        targetZoomRef.current = targetZ;
      }
    }
  }, [isSearchMode, proximityFilter?.lat, proximityFilter?.lng, selectedSuburbs, anchors]);

  // Center map when a property with coordinates (verified or approximate area) is selected
  useEffect(() => {
    if (selectedPropertyId && !isDraggingRef.current) {
      const coords = resolvedPropertyCoords.get(selectedPropertyId);
      if (coords) {
        setCenter({ lat: coords.lat, lng: coords.lng });
        if (targetZoomRef.current < 15.0) {
          targetZoomRef.current = 15.2;
          setZoom(15.2);
        }
      }
    }
  }, [selectedPropertyId, resolvedPropertyCoords]);

  // Navigate map when focusTarget is explicitly triggered (e.g., clicking a listing card or anchor)
  useEffect(() => {
    if (!focusTarget || isDraggingRef.current) return;
    const selectedCoords = selectedPropertyId ? resolvedPropertyCoords.get(selectedPropertyId) : null;
    const targetLat = selectedCoords ? selectedCoords.lat : focusTarget.lat;
    const targetLng = selectedCoords ? selectedCoords.lng : focusTarget.lng;
    if (Number.isFinite(targetLat) && Number.isFinite(targetLng)) {
      setCenter({ lat: targetLat, lng: targetLng });
      if (typeof focusTarget.zoom === 'number' && Number.isFinite(focusTarget.zoom)) {
        targetZoomRef.current = focusTarget.zoom;
        setZoom(focusTarget.zoom);
      }
    }
  }, [focusTarget]);

  // Unified Drag Handlers attached to window (zero drift, zero coordinate lag, rAF throttled)
  const startDrag = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = { x: clientX, y: clientY };
    setIsDragging(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left mouse button only
    startDrag(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  useEffect(() => {
    let rafId: number | null = null;
    let accumulatedDx = 0;
    let accumulatedDy = 0;

    const applyMove = () => {
      rafId = null;
      if (accumulatedDx === 0 && accumulatedDy === 0) return;
      const dx = accumulatedDx;
      const dy = accumulatedDy;
      accumulatedDx = 0;
      accumulatedDy = 0;

      setCenter((prevCenter) => {
        const centerP = project(prevCenter.lat, prevCenter.lng, zoom);
        const newCenterP = { x: centerP.x - dx, y: centerP.y - dy };

        const n = Math.pow(2, zoom);
        const newLng = (newCenterP.x / 256 / n) * 360 - 180;
        const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * newCenterP.y) / 256 / n)));
        const newLat = (latRad * 180) / Math.PI;

        return { lat: newLat, lng: newLng };
      });
    };

    const handleMove = (clientX: number, clientY: number) => {
      if (!isDraggingRef.current) return;
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        hasDraggedRef.current = true;
      }
      dragStartRef.current = { x: clientX, y: clientY };
      accumulatedDx += dx;
      accumulatedDy += dy;

      if (rafId === null) {
        rafId = requestAnimationFrame(applyMove);
      }
    };

    const handleEnd = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        applyMove();
      }
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        // Clear drag flag right after the current click event cycle so overlay panels never get stuck
        setTimeout(() => {
          hasDraggedRef.current = false;
        }, 0);
      }
    };

    const onWindowMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onWindowMouseUp = () => handleEnd();
    const onWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onWindowTouchEnd = () => handleEnd();

    window.addEventListener('mousemove', onWindowMouseMove, { passive: true });
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('touchmove', onWindowTouchMove, { passive: true });
    window.addEventListener('touchend', onWindowTouchEnd);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
    };
  }, [zoom]);

  // Fluid Easy-Ease Fractional Zoom Controller with Exponential Damping
  const smoothZoomTo = useCallback((target: number) => {
    const clamped = Math.max(9.5, Math.min(18.5, Math.round(target * 100) / 100));
    targetZoomRef.current = clamped;

    if (animFrameRef.current !== null) return;

    const animate = () => {
      setZoom((current) => {
        const diff = targetZoomRef.current - current;
        if (Math.abs(diff) < 0.005) {
          animFrameRef.current = null;
          return targetZoomRef.current;
        }
        // Smooth exponential ease-out curve (~18% of distance closed per frame)
        const next = current + diff * 0.18;
        animFrameRef.current = requestAnimationFrame(animate);
        return next;
      });
    };
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Wheel zoom - fine fluid fractional increments with easy-ease animation
  const handleWheel = (e: React.WheelEvent) => {
    if (!isMapActive) {
      // Don't intercept scroll; allow smooth page scrolling
      setShowScrollHint(true);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = setTimeout(() => setShowScrollHint(false), 1600);
      return;
    }

    e.preventDefault();
    const absDelta = Math.abs(e.deltaY);
    // Dynamic fine sensitivity: 0.16 to 0.38 per wheel tick
    const step = Math.min(0.38, Math.max(0.16, absDelta * 0.0016));
    const nextTarget = targetZoomRef.current + (e.deltaY < 0 ? step : -step);
    smoothZoomTo(nextTarget);
  };

  // Double click to zoom into point
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const centerP = project(center.lat, center.lng, zoom);
    const targetPx = centerP.x + (clickX - dimensions.width / 2);
    const targetPy = centerP.y + (clickY - dimensions.height / 2);

    const n = Math.pow(2, zoom);
    const targetLng = (targetPx / 256 / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * targetPy) / 256 / n)));
    const targetLat = (latRad * 180) / Math.PI;

    setCenter({ lat: targetLat, lng: targetLng });
    smoothZoomTo(targetZoomRef.current + 0.75);
  };

  // Convert lat/lng to screen pixel position
  const getScreenPos = useCallback(
    (lat: number, lng: number) => {
      const centerP = project(center.lat, center.lng, zoom);
      const markerP = project(lat, lng, zoom);
      return {
        x: dimensions.width / 2 + (markerP.x - centerP.x),
        y: dimensions.height / 2 + (markerP.y - centerP.y),
      };
    },
    [center, zoom, dimensions]
  );

  // Calculate visible tiles for Free tile providers (Fractional zoom continuous scaling)
  const tileZoom = Math.floor(zoom);
  const tileScale = Math.pow(2, zoom - tileZoom);
  const tileSize = 256 * tileScale;

  const centerP = project(center.lat, center.lng, zoom);
  const startTileX = Math.floor((centerP.x - dimensions.width / 2) / tileSize);
  const endTileX = Math.floor((centerP.x + dimensions.width / 2) / tileSize);
  const startTileY = Math.floor((centerP.y - dimensions.height / 2) / tileSize);
  const endTileY = Math.floor((centerP.y + dimensions.height / 2) / tileSize);

  const tiles: Array<{
    key: string;
    baseTileUrl: string;
    refTileUrl?: string;
    left: number;
    top: number;
    width: number;
    height: number;
  }> = [];

  const maxTile = Math.pow(2, tileZoom);
  for (let x = startTileX; x <= endTileX; x++) {
    for (let y = startTileY; y <= endTileY; y++) {
      if (y >= 0 && y < maxTile) {
        const wrappedX = ((x % maxTile) + maxTile) % maxTile;
        const left = x * tileSize - (centerP.x - dimensions.width / 2);
        const top = y * tileSize - (centerP.y - dimensions.height / 2);

        let baseTileUrl = '';
        let refTileUrl: string | undefined = undefined;

        // Free Worldwide Basemap Layer (Zero API Key Required, Zero Watermarks)
        if (mapStyle === 'osm') {
          // OpenStreetMap Standard - 100% Free open-source map
          baseTileUrl = `https://tile.openstreetmap.org/${tileZoom}/${wrappedX}/${y}.png`;
        } else {
          // Esri World Street Map (Full zoom 0-19 worldwide, no API key required)
          baseTileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${tileZoom}/${y}/${wrappedX}`;
        }

        tiles.push({
          key: `${mapStyle}-${tileZoom}-${x}-${y}`,
          baseTileUrl,
          refTileUrl,
          left,
          top,
          width: tileSize + 0.5,
          height: tileSize + 0.5,
        });
      }
    }
  }

  // Selected property & active proximity anchor
  const selectedProp = isSearchMode
    ? null
    : (properties.find((p) => p.id === selectedPropertyId) || mappableProperties[0] || properties[0] || null);
  const activeAnchor =
    anchors.find((a) => a.id === selectedAnchorId) || anchors[0] || null;

  const locationLabel = proximityFilter?.label
    || activeAnchor?.label
    || (anchors.length > 0 ? anchors[0].label : 'Location Radius');

  // Selected prop map position (verified street address or approximate area center)
  const selectedPropCoords = selectedProp ? resolvedPropertyCoords.get(selectedProp.id) : null;
  const propPos = selectedPropCoords
    ? getScreenPos(selectedPropCoords.lat, selectedPropCoords.lng)
    : null;

  const lastRenderedPositionsRef = useRef<Record<string, { isCompact: boolean }>>({});

  // Smart Anti-Collision Level-of-Detail (LOD) Engine:
  // Detects overlapping pins in screen pixel space and condenses crowded pins into sleek micro-dots
  const renderedPositions = React.useMemo(() => {
    // While dragging, freeze the LOD layout so pins never pop or nudge mid-drag
    if (isDraggingRef.current && Object.keys(lastRenderedPositionsRef.current).length > 0) {
      return lastRenderedPositionsRef.current;
    }

    const result: Record<string, { isCompact: boolean }> = {};
    const placed: { x: number; y: number }[] = [];

    // If anchor is rendered with full pill, mark its footprint
    if (activeAnchor && zoom >= 13.8) {
      const aPos = getScreenPos(activeAnchor.lat, activeAnchor.lng);
      placed.push({ x: aPos.x, y: aPos.y });
    }

    // Sort: selected property first, then hovered, then rank #1, then rest
    const sorted = [...mappableProperties].sort((a, b) => {
      if (a.id === selectedPropertyId) return -1;
      if (b.id === selectedPropertyId) return 1;
      if (a.id === hoveredProperty?.id) return -1;
      if (b.id === hoveredProperty?.id) return 1;
      return (a.rank || 99) - (b.rank || 99);
    });

    for (const prop of sorted) {
      const coords = resolvedPropertyCoords.get(prop.id);
      const pos = getScreenPos(coords ? coords.lat : prop.lat, coords ? coords.lng : prop.lng);
      const isSelected = prop.id === selectedPropertyId;
      const isHovered = prop.id === hoveredProperty?.id;

      if (isHovered) {
        result[prop.id] = { isCompact: false };
        placed.push({ x: pos.x, y: pos.y });
        continue;
      }

      // If map is zoomed out (< 13.5), only selected property can be an expanded pill,
      // all other properties condense to micro-pins with rank number
      if (zoom < 13.5 && !isSelected) {
        result[prop.id] = { isCompact: true };
        placed.push({ x: pos.x, y: pos.y });
        continue;
      }

      // At very low zoom (< 12.0), condense ALL properties including selected to prevent huge pills blocking cities
      if (zoom < 12.0) {
        result[prop.id] = { isCompact: true };
        placed.push({ x: pos.x, y: pos.y });
        continue;
      }

      if (isSelected) {
        result[prop.id] = { isCompact: false };
        placed.push({ x: pos.x, y: pos.y });
        continue;
      }

      // Check collision with already-placed badges: wide pill needs ~70px X, ~30px Y
      const hasCollision = placed.some((other) => {
        const dx = Math.abs(pos.x - other.x);
        const dy = Math.abs(pos.y - other.y);
        return dx < 70 && dy < 30;
      });

      if (hasCollision) {
        result[prop.id] = { isCompact: true };
      } else {
        result[prop.id] = { isCompact: false };
      }
      placed.push({ x: pos.x, y: pos.y });
    }

    lastRenderedPositionsRef.current = result;
    return result;
  }, [mappableProperties, properties, selectedPropertyId, hoveredProperty, center, zoom, dimensions, activeAnchor]);


  // Nearest Noise Hotspot and Sound Shadow calculations for Selected Property
  // Cap waveguide ray distance to 600m so noise vectors only connect to genuinely local sources
  // and never span kilometres across Cape Town (e.g. Hout Bay to Camps Bay/CBD).
  const nearestHotspot = React.useMemo(() => {
    if (!selectedProp) return null;
    const MAX_ACOUSTIC_RAY_M = 600;
    let closest: (typeof CAPE_TOWN_HOTSPOTS)[number] | null = null;
    let minDist = Infinity;
    for (const h of CAPE_TOWN_HOTSPOTS) {
      const d = calculateDistanceKm(selectedProp.lat, selectedProp.lng, h.lat, h.lng) * 1000;
      if (d < minDist) {
        minDist = d;
        closest = h;
      }
    }
    if (!closest || minDist > MAX_ACOUSTIC_RAY_M) return null;
    return { ...closest, distanceM: Math.round(minDist) };
  }, [selectedProp]);

  const isPropShielded = React.useMemo(() => {
    if (!selectedProp) return true;
    const audit = selectedProp.acoustic_audit;
    if (audit && typeof audit.is_shielded === 'boolean') {
      return audit.is_shielded;
    }
    const text = `${selectedProp.title} ${selectedProp.address}`.toLowerCase();
    if (text.includes('4 derwent') || text.includes('roberta')) return false; // direct Aruba waveguide
    if (text.includes('derwent')) return true; // around corner into sound shadow
    if (audit && typeof audit.estimated_db === 'number') {
      if (audit.estimated_db >= 60) return false;
      if (audit.estimated_db <= 52) return true;
    }
    if (selectedProp.noise_risk === 'high' || selectedProp.noise_risk === 'moderate') {
      return false;
    }
    if (!nearestHotspot) return true;
    return nearestHotspot.distanceM > Math.max(nearestHotspot.radius_m || 180, 180);
  }, [selectedProp, nearestHotspot]);


  // Fetch real-time OSRM Driving Route along actual street network
  useEffect(() => {
    if (!selectedProp || !activeAnchor) {
      setActiveDrivingRoute(null);
      return;
    }

    const routeKey = `${selectedProp.lat.toFixed(4)},${selectedProp.lng.toFixed(4)}::${activeAnchor.lat.toFixed(4)},${activeAnchor.lng.toFixed(4)}`;

    if (drivingRouteCache.has(routeKey)) {
      setActiveDrivingRoute(drivingRouteCache.get(routeKey)!);
      return;
    }

    // Immediate topography-aware fallback while fetching road network
    const fallbackDist = calculateDrivingDistanceKm(selectedProp.lat, selectedProp.lng, activeAnchor.lat, activeAnchor.lng);
    const fallbackDur = calculateDrivingDurationMins(fallbackDist);
    const fallbackData: DrivingRouteData = {
      distanceKm: fallbackDist,
      durationMins: fallbackDur,
      distanceText: `${fallbackDist} km`,
      durationText: `~${fallbackDur} mins`,
      points: [[selectedProp.lat, selectedProp.lng], [activeAnchor.lat, activeAnchor.lng]]
    };
    setActiveDrivingRoute(fallbackData);

    let isMounted = true;
    const fetchOsrmRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${selectedProp.lng},${selectedProp.lat};${activeAnchor.lng},${activeAnchor.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.routes && json.routes.length > 0) {
            const r = json.routes[0];
            const distKm = Math.round((r.distance / 1000) * 10) / 10;
            const durMins = Math.max(1, Math.round(r.duration / 60));
            // GeoJSON coordinates are [lon, lat] -> convert to [lat, lng]
            const coords: [number, number][] = r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);

            const routeData: DrivingRouteData = {
              distanceKm: distKm,
              durationMins: durMins,
              distanceText: `${distKm} km`,
              durationText: `~${durMins} mins`,
              points: coords
            };
            drivingRouteCache.set(routeKey, routeData);
            if (isMounted) {
              setActiveDrivingRoute(routeData);
            }
          }
        }
      } catch (e) {
        // keep fallback
      }
    };

    fetchOsrmRoute();
    return () => {
      isMounted = false;
    };
  }, [selectedProp?.lat, selectedProp?.lng, activeAnchor?.lat, activeAnchor?.lng, activeAnchor?.id]);

  const resetView = () => {
    const focusPool = mappableProperties.length > 0 ? mappableProperties : properties;
    if (focusPool.length > 0) {
      const lats = focusPool.map(p => p.lat);
      const lngs = focusPool.map(p => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      setCenter({ lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 });
      const span = Math.max(maxLat - minLat, maxLng - minLng);
      const targetZ = span < 0.015 ? 15.2 : span < 0.035 ? 14.5 : span < 0.08 ? 13.8 : 13.0;
      smoothZoomTo(targetZ);
    }
  };

  const formatPricePill = (price: number, currency?: string) => {
    if (currency === 'AUD' || price > 100000) {
      if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
      if (price >= 1000) return `$${Math.round(price / 1000)}k`;
      return `$${price}`;
    }
    // Rental ZAR
    if (price >= 1000) return `R ${(price / 1000).toFixed(price % 1000 === 0 ? 0 : 1)}k`;
    return `R ${price}`;
  };

  const renderHoverMiniCard = (property: PropertyMapItem) => {
    const photoContent = (
      <>
        <img
          src={property.image}
          alt={property.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover/photo:scale-105"
        />
        <div className="absolute top-2 left-2 flex items-center gap-1">
          {property.rank && (
            <span className="bg-zinc-950/90 text-white text-[10px] font-black px-2 py-0.5 rounded-full backdrop-blur-xs">
              #{property.rank}
            </span>
          )}
          {property.fit_score && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full backdrop-blur-xs ${property.fit_score >= 75 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
              }`}>
              {property.fit_score}% Fit
            </span>
          )}
        </div>
        {property.url && (
          <div className="absolute top-2 right-2 bg-zinc-950/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center gap-1">
            <span>P24</span>
            <ArrowSquareOut size={11} weight="bold" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1.5 pointer-events-none">
          {(() => {
            const mVal = getPropertyMarketValuation(property);
            if (!mVal) return <span />;
            return (
              <span
                className={`text-[9.5px] font-black px-2 py-0.5 rounded-md backdrop-blur-md shadow-xs flex items-center gap-0.5 whitespace-nowrap ${
                  mVal.isUnderpriced
                    ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-500/50'
                    : mVal.isOverpriced
                    ? 'bg-rose-950/90 text-rose-400 border border-rose-500/50'
                    : 'bg-zinc-900/90 text-zinc-300 border border-zinc-700/50'
                }`}
                title={mVal.badgeTooltip}
              >
                <span>{mVal.badgeText}</span>
              </span>
            );
          })()}
          <div className="bg-zinc-950/80 backdrop-blur-md text-white font-extrabold text-xs px-2.5 py-0.5 rounded-lg shadow-sm whitespace-nowrap ml-auto">
            {formatPricePill(property.price, property.currency)}
          </div>
        </div>
      </>
    );

    return (
      <div className="w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-zinc-200 p-2.5 animate-in fade-in zoom-in-95 duration-150">
        {property.url ? (
          <a
            href={property.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open Property24 listing in new tab"
            className="group/photo relative block w-full h-28 rounded-xl overflow-hidden mb-2 bg-zinc-100 cursor-pointer"
          >
            {photoContent}
          </a>
        ) : (
          <div className="group/photo relative w-full h-28 rounded-xl overflow-hidden mb-2 bg-zinc-100">
            {photoContent}
          </div>
        )}

        <p className="text-xs font-bold text-zinc-950 truncate">{property.title}</p>
        <p className="text-[11px] text-zinc-500 truncate mt-0.5">{property.address}</p>
        {isMissingAddressListing(property) && (
          <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-dashed border-amber-300 text-[10px] font-bold text-amber-800">
            <span>~</span>
            <span>Approximate area center · Address unknown</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 text-[11px] font-semibold text-zinc-700">
          <span>{property.bedrooms} bed • {property.bathrooms} bath</span>
          {property.sqm ? <span>{property.sqm} m²</span> : <span>Verified Unit</span>}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-[#f1f2f4] border border-zinc-200 transition-shadow duration-200 ${isMapActive
        ? 'cursor-grab active:cursor-grabbing ring-2 ring-indigo-500/25'
        : 'cursor-pointer'
        } ${className}`}
      onClick={() => {
        setIsMapActive(true);
        setShowScrollHint(false);
      }}
      onMouseDown={(e) => {
        setIsMapActive(true);
        setShowScrollHint(false);
        handleMouseDown(e);
      }}
      onMouseLeave={() => {
        setIsMapActive(false);
        setShowScrollHint(false);
      }}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      {/* Scroll Hint Overlay (informs user that clicking activates zoom) */}
      {showScrollHint && !isMapActive && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 py-1.5 rounded-full bg-zinc-950/90 backdrop-blur-md text-white text-[11px] font-bold shadow-xl border border-white/20 flex items-center gap-1.5">
            <NavigationArrow size={12} weight="bold" className="text-emerald-400" />
            <span>Click map to control zoom</span>
          </div>
        </div>
      )}
      {/* 1. Map Tiles Layer (Free Map APIs - No Watermarks) */}
      <div className={`absolute inset-0 pointer-events-none transition-[filter] duration-300 ${mapStyle === 'canvas' ? 'grayscale-[85%] contrast-[92%] brightness-[102%]' : ''}`}>
        {tiles.map((tile) => (
          <React.Fragment key={tile.key}>
            <img
              src={tile.baseTileUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute select-none pointer-events-none transition-opacity duration-300"
              style={{
                left: `${tile.left}px`,
                top: `${tile.top}px`,
                width: `${tile.width}px`,
                height: `${tile.height}px`,
              }}
            />
            {tile.refTileUrl && (
              <img
                src={tile.refTileUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute select-none pointer-events-none opacity-85 transition-opacity duration-300"
                style={{
                  left: `${tile.left}px`,
                  top: `${tile.top}px`,
                  width: `${tile.width}px`,
                  height: `${tile.height}px`,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* 2. SVG Vector Layer (Commute lines, Anchor radius circles) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.15" />
          </filter>
          <radialGradient id="hotspot-radial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#f97316" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sanctuary-radial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
            <stop offset="55%" stopColor="#059669" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="crime-radial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#09090b" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#09090b" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#09090b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Noise Radar Layer: Calibrated Noise Hotspots & Mountain Sanctuary Zones */}
        {showNoiseRadar && (
          <g id="noise-radar-svg-layer">
            {/* Sanctuary Enclaves (Emerald Calm Zones) */}
            {CAPE_TOWN_SANCTUARIES.map((s) => {
              const sPos = getScreenPos(s.lat, s.lng);
              const metersPerPixel = (156543.03392 * Math.cos((s.lat * Math.PI) / 180)) / Math.pow(2, zoom);
              const radiusPx = Math.max(30, s.radius_m / metersPerPixel);

              return (
                <g key={`sanctuary-circle-${s.id}`}>
                  <circle
                    cx={sPos.x}
                    cy={sPos.y}
                    r={radiusPx}
                    fill="url(#sanctuary-radial)"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    opacity="0.85"
                  />
                  <circle
                    cx={sPos.x}
                    cy={sPos.y}
                    r={radiusPx * 0.45}
                    fill="rgba(16, 185, 129, 0.08)"
                    stroke="#059669"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                </g>
              );
            })}

            {/* Noise Hotspots (Red / Amber High Decibel Dispersion Corridors) */}
            {CAPE_TOWN_HOTSPOTS.map((h) => {
              const hPos = getScreenPos(h.lat, h.lng);
              const metersPerPixel = (156543.03392 * Math.cos((h.lat * Math.PI) / 180)) / Math.pow(2, zoom);
              const radiusPx = Math.max(25, h.radius_m / metersPerPixel);

              return (
                <g key={`hotspot-circle-${h.id}`}>
                  {/* Outer sound diffusion zone */}
                  <circle
                    cx={hPos.x}
                    cy={hPos.y}
                    r={radiusPx}
                    fill="url(#hotspot-radial)"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="5 3"
                    opacity="0.9"
                  />
                  {/* Mid acoustic pressure zone */}
                  <circle
                    cx={hPos.x}
                    cy={hPos.y}
                    r={radiusPx * 0.52}
                    fill="rgba(239, 68, 68, 0.16)"
                    stroke="#f97316"
                    strokeWidth="1.2"
                    strokeDasharray="3 2"
                  />
                  {/* Epicenter noise source core */}
                  <circle
                    cx={hPos.x}
                    cy={hPos.y}
                    r={12}
                    fill="#dc2626"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                </g>
              );
            })}

            {/* Selected Apartment Acoustic Ray / Shield Arc */}
            {propPos && nearestHotspot && (() => {
              const hPos = getScreenPos(nearestHotspot.lat, nearestHotspot.lng);
              return (
                <g key="selected-prop-acoustic-propagation">
                  {isPropShielded ? (
                    // In Sound Shadow: Subtle diffracted ray + Green Shield Ring
                    <g>
                      <line
                        x1={hPos.x}
                        y1={hPos.y}
                        x2={propPos.x}
                        y2={propPos.y}
                        stroke="#10b981"
                        strokeWidth="1.8"
                        strokeDasharray="4 4"
                        opacity="0.45"
                      />
                      <circle
                        cx={propPos.x}
                        cy={propPos.y}
                        r={28}
                        fill="rgba(16, 185, 129, 0.18)"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeDasharray="6 3"
                      />
                    </g>
                  ) : (
                    // Direct Line-of-sight exposure: Crimson Sound Waveguide
                    <g>
                      <line
                        x1={hPos.x}
                        y1={hPos.y}
                        x2={propPos.x}
                        y2={propPos.y}
                        stroke="#ffffff"
                        strokeWidth="5"
                        opacity="0.9"
                      />
                      <line
                        x1={hPos.x}
                        y1={hPos.y}
                        x2={propPos.x}
                        y2={propPos.y}
                        stroke="#ef4444"
                        strokeWidth="3"
                        strokeDasharray="6 4"
                      />
                      <circle
                        cx={propPos.x}
                        cy={propPos.y}
                        r={28}
                        fill="rgba(239, 68, 68, 0.2)"
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                      />
                    </g>
                  )}
                </g>
              );
            })()}
          </g>
        )}

        {/* Crime Hotspots Layer: Depth Layers of Low (Light Gray), Medium (Medium Gray/Black), High (Black) */}
        {showCrimeRadar && (
          <g id="crime-hotspots-svg-layer">
            {CAPE_TOWN_CRIME_HOTSPOTS.map((c) => {
              const cPos = getScreenPos(c.lat, c.lng);
              const metersPerPixel = (156543.03392 * Math.cos((c.lat * Math.PI) / 180)) / Math.pow(2, zoom);
              const radiusPx = Math.min(280, Math.max(16, c.radius_m / metersPerPixel));
              const depthTier = getCrimeDepthTier(c);

              return (
                <g key={`crime-circle-${c.id}`}>
                  {/* Layer 1 (Low Depth - Outer Light Gray Buffer) */}
                  <circle
                    cx={cPos.x}
                    cy={cPos.y}
                    r={radiusPx}
                    fill="rgba(9, 9, 11, 0.09)"
                    stroke={depthTier === 'low' ? 'rgba(9, 9, 11, 0.25)' : 'rgba(9, 9, 11, 0.16)'}
                    strokeWidth="0.8"
                    strokeDasharray="3 3"
                  />

                  {/* Layer 2 (Medium Depth - Middle Charcoal Layer for Medium & High hotspots) */}
                  {(depthTier === 'moderate' || depthTier === 'high') && (
                    <circle
                      cx={cPos.x}
                      cy={cPos.y}
                      r={radiusPx * 0.66}
                      fill="rgba(9, 9, 11, 0.22)"
                      stroke="rgba(9, 9, 11, 0.38)"
                      strokeWidth="0.9"
                      strokeDasharray={depthTier === 'moderate' ? '3 2' : undefined}
                    />
                  )}

                  {/* Layer 3 (High Depth - Deep Black Core for High hotspots) */}
                  {depthTier === 'high' && (
                    <circle
                      cx={cPos.x}
                      cy={cPos.y}
                      r={radiusPx * 0.36}
                      fill="rgba(9, 9, 11, 0.46)"
                      stroke="rgba(9, 9, 11, 0.72)"
                      strokeWidth="1.1"
                    />
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* Proximity Anchor Radius Rings & Dynamic Distance Filter Zone */}
        {showRadius && (
          <g id="proximity-radius-rings">
            {/* 1. Dynamic Illustrative Proximity Filter Zone */}
            {proximityFilter && (() => {
              const pPos = getScreenPos(proximityFilter.lat, proximityFilter.lng);
              const metersPerPixel = (156543.03392 * Math.cos((proximityFilter.lat * Math.PI) / 180)) / Math.pow(2, zoom);
              const radiusPixels = (effectiveRadiusKm * 1000) / metersPerPixel;

              return (
                <g key="dynamic-proximity-filter-svg">
                  {/* Outer illustrative radar halo */}
                  <circle
                    cx={pPos.x}
                    cy={pPos.y}
                    r={radiusPixels}
                    fill="rgba(79, 70, 229, 0.08)"
                    stroke="#4f46e5"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                  />
                  {/* Inner soft buffer zone */}
                  <circle
                    cx={pPos.x}
                    cy={pPos.y}
                    r={radiusPixels * 0.45}
                    fill="rgba(79, 70, 229, 0.04)"
                    stroke="#818cf8"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    opacity="0.8"
                  />
                </g>
              );
            })()}

            {/* 2. Anchor Radius Rings */}
            {showAnchors &&
              anchors.map((anchor) => {
                const isTarget = activeAnchor?.id === anchor.id;
                // Only render radius ring for the actively selected target anchor to keep map clean
                if (!isTarget) return null;

                const pos = getScreenPos(anchor.lat, anchor.lng);
                const metersPerPixel = (156543.03392 * Math.cos((anchor.lat * Math.PI) / 180)) / Math.pow(2, zoom);
                const radiusMeters = !proximityFilter
                  ? (effectiveRadiusKm * 1000)
                  : (anchor.max_distance_km ? anchor.max_distance_km * 1000 : 5000);
                const radiusPixels = radiusMeters / metersPerPixel;

                return (
                  <g key={`radius-${anchor.id}`}>
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={Math.max(15, radiusPixels)}
                      fill="rgba(79, 70, 229, 0.04)"
                      stroke="#4f46e5"
                      strokeWidth="1.8"
                      strokeDasharray="4 3"
                    />
                  </g>
                );
              })}
          </g>
        )}

        {/* Selected Property Proximity Lines & Driving Road Route */}
        {propPos && showAnchors && (
          <g>
            {anchors.map((anchor) => {
              const aPos = getScreenPos(anchor.lat, anchor.lng);
              const isTarget = activeAnchor?.id === anchor.id;

              // Only connect route line to the active target anchor!
              if (!isTarget) return null;

              // If this is the active target anchor and we have multi-point road geometry, render actual road path
              if (activeDrivingRoute && activeDrivingRoute.points.length > 2) {
                const polylinePoints = activeDrivingRoute.points
                  .map(p => {
                    const sp = getScreenPos(p[0], p[1]);
                    return `${sp.x},${sp.y}`;
                  })
                  .join(' ');

                return (
                  <g key={`driving-route-${anchor.id}`}>
                    {/* Road highlight halo */}
                    <polyline
                      points={polylinePoints}
                      stroke="#ffffff"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      opacity="0.9"
                    />
                    {/* Road driving path */}
                    <polyline
                      points={polylinePoints}
                      stroke="#4f46e5"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    {/* Inner dash accent */}
                    <polyline
                      points={polylinePoints}
                      stroke="#a5b4fc"
                      strokeWidth="1.5"
                      strokeDasharray="4 6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </g>
                );
              }

              // Fallback connection line to target anchor while road network resolves
              return (
                <g key={`line-${anchor.id}`}>
                  <line
                    x1={propPos.x}
                    y1={propPos.y}
                    x2={aPos.x}
                    y2={aPos.y}
                    stroke="#ffffff"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <line
                    x1={propPos.x}
                    y1={propPos.y}
                    x2={aPos.x}
                    y2={aPos.y}
                    stroke="#4f46e5"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* Floating Noise Hotspot & Sanctuary Labels on Map (Level of Detail LOD) */}
      {showNoiseRadar && (
        <div id="noise-radar-html-labels">
          {/* Sanctuary Labels - Icon Only, Hover reveals Title */}
          {CAPE_TOWN_SANCTUARIES.map((s) => {
            const pos = getScreenPos(s.lat, s.lng);
            if (pos.x < -100 || pos.x > dimensions.width + 100 || pos.y < -100 || pos.y > dimensions.height + 100) return null;
            return (
              <div
                key={`label-sanctuary-${s.id}`}
                className="absolute z-15 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto group/sanctuary cursor-pointer"
                style={{ left: `${pos.x}px`, top: `${pos.y - 6}px` }}
              >
                <div className="relative">
                  <div className="w-6 h-6 rounded-full bg-emerald-600/90 text-white shadow-md border-2 border-white flex items-center justify-center hover:scale-120 transition-transform">
                    <ShieldCheck size={12} weight="bold" />
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-xl bg-zinc-950 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/sanctuary:opacity-100 pointer-events-none shadow-xl transition-opacity z-50 border border-emerald-400/30">
                    {s.name} ({s.ambient_db} dB)
                  </div>
                </div>
              </div>
            );
          })}

          {/* Hotspot Labels & Clickable Bars - Icon Only, Hover reveals Title */}
          {CAPE_TOWN_HOTSPOTS.map((h) => {
            const pos = getScreenPos(h.lat, h.lng);
            if (pos.x < -100 || pos.x > dimensions.width + 100 || pos.y < -100 || pos.y > dimensions.height + 100) return null;
            return (
              <div
                key={`label-hotspot-${h.id}`}
                className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group/bar"
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setCenter({ lat: h.lat, lng: h.lng });
                  setInspectedPlace({ ...h, isBar: true });
                  fetchPlaceDetails(h);
                }}
              >
                <div className="relative">
                  <div
                    className="w-6 h-6 rounded-full bg-rose-600/95 hover:bg-rose-700 text-white shadow-md border-2 border-white flex items-center justify-center transition-all hover:scale-125"
                    title={`${h.name} (${h.base_db} dB)`}
                  >
                    <Wine size={12} className="text-white" />
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-xl bg-zinc-950 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/bar:opacity-100 pointer-events-none shadow-xl transition-opacity z-50 border border-rose-500/30">
                    {h.shortName || h.name} · {h.base_db} dB
                  </div>
                </div>
              </div>
            );
          })}

          {/* Mid-Ray Acoustic Propagation Badge for Selected Property (Only when space permits) */}
          {propPos && nearestHotspot && (() => {
            const hPos = getScreenPos(nearestHotspot.lat, nearestHotspot.lng);
            const screenDist = Math.hypot(propPos.x - hPos.x, propPos.y - hPos.y);
            // Hide badge if property and hotspot are less than 95px apart on screen
            if (screenDist < 95) return null;

            const midX = (propPos.x + hPos.x) / 2;
            const midY = (propPos.y + hPos.y) / 2;
            if (midX < -50 || midX > dimensions.width + 50 || midY < -50 || midY > dimensions.height + 50) return null;
            return (
              <div
                key="mid-ray-acoustic-badge"
                className="absolute z-35 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${midX}px`, top: `${midY}px` }}
                title={isPropShielded ? 'Acoustic Shadow: -14 dB Shielded' : `Direct Waveguide: ~${selectedProp?.acoustic_audit?.estimated_db || 73} dB`}
              >
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-black shadow-lg border flex items-center gap-1 backdrop-blur-md ${isPropShielded
                  ? 'bg-emerald-950/90 text-emerald-100 border-emerald-400/60 shadow-emerald-950/20'
                  : 'bg-rose-950/90 text-rose-100 border-rose-500/70 shadow-rose-950/20'
                  }`}>
                  {isPropShielded ? (
                    <>
                      <ShieldCheck size={12} weight="bold" className="text-emerald-400 shrink-0" />
                      <span>{zoom >= 15.2 ? 'Acoustic Shadow: -14 dB Shielded' : '-14 dB'}</span>
                    </>
                  ) : (
                    <>
                      <SpeakerHigh size={12} weight="bold" className="text-rose-400 shrink-0" />
                      <span>{zoom >= 15.2 ? `Direct Waveguide: ~${selectedProp?.acoustic_audit?.estimated_db || 73} dB` : `~${selectedProp?.acoustic_audit?.estimated_db || 73} dB`}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Minimal Low-Hierarchy Crime Hotspot Pins with Skeleton Emoji 💀 (Blackness Opacity = Low / Medium / High Depth) */}
      {showCrimeRadar && (
        <div id="crime-hotspots-html-labels">
          {CAPE_TOWN_CRIME_HOTSPOTS.map((c) => {
            const pos = getScreenPos(c.lat, c.lng);
            if (pos.x < -60 || pos.x > dimensions.width + 60 || pos.y < -60 || pos.y > dimensions.height + 60) return null;
            const depthTier = getCrimeDepthTier(c);

            // Blackness opacity determines depth: Black = High, Medium Gray = Medium, Light Gray = Low
            const pinDepthClass =
              depthTier === 'high'
                ? 'bg-black/95 group-hover/crime:bg-black border-zinc-700 shadow-sm'
                : depthTier === 'moderate'
                ? 'bg-black/58 group-hover/crime:bg-black/85 border-white/80 shadow-xs'
                : 'bg-black/28 group-hover/crime:bg-black/65 border-white/90 shadow-2xs';

            const badgeDepthClass =
              depthTier === 'high'
                ? 'bg-black text-white border-zinc-600'
                : depthTier === 'moderate'
                ? 'bg-zinc-700 text-zinc-100 border-zinc-500'
                : 'bg-zinc-300 text-zinc-900 border-zinc-400';

            const depthLabel =
              depthTier === 'high'
                ? 'HIGH RISK'
                : depthTier === 'moderate'
                ? 'MEDIUM RISK'
                : 'LOW RISK';

            return (
              <div
                key={`label-crime-${c.id}`}
                className="absolute z-15 hover:z-[55] transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto group/crime"
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setCenter({ lat: c.lat, lng: c.lng });
                }}
              >
                {/* Minimal low-hierarchy skeleton pin shaded by blackness depth */}
                <div className={`w-5 h-5 rounded-full text-white border flex items-center justify-center cursor-pointer transition-all duration-150 group-hover/crime:scale-125 text-[11px] leading-none select-none ${pinDepthClass}`}>
                  <span role="img" aria-label="Crime Hotspot">💀</span>
                </div>

                {/* Hover Tooltip: Crime Hotspot Name + Depth Tier + Incident Type */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-950/95 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/crime:opacity-100 pointer-events-none shadow-xl transition-opacity duration-150 z-50 border border-zinc-700 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs leading-none">💀</span>
                    <span>{c.name}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-black border ${badgeDepthClass}`}>
                      {depthLabel}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-zinc-400">{c.incident_type}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Single Floating Commute Badge for the Active Target Anchor */}
      {selectedProp && propPos && showAnchors && activeAnchor && (() => {
        const aPos = getScreenPos(activeAnchor.lat, activeAnchor.lng);
        const driveData = activeDrivingRoute;

        const distKm = driveData
          ? driveData.distanceKm
          : calculateDrivingDistanceKm(selectedProp.lat, selectedProp.lng, activeAnchor.lat, activeAnchor.lng);

        const isWalking = activeAnchor.commute_mode === 'walking' || (activeAnchor.commute_mode !== 'driving' && distKm <= 1.2);
        const isBiking = activeAnchor.commute_mode === 'bicycling';
        const modeText = isWalking ? 'walk' : isBiking ? 'cycle' : 'drive';

        const durMins = (driveData && !isWalking && !isBiking)
          ? driveData.durationMins
          : isWalking
            ? Math.max(1, Math.round((distKm / 4.8) * 60))
            : isBiking
              ? Math.max(1, Math.round((distKm / 15.0) * 60))
              : calculateDrivingDurationMins(distKm);

        const distText = `${distKm} km`;
        const durText = `~${durMins} min${durMins === 1 ? '' : 's'}`;

        const dx = aPos.x - propPos.x;
        const dy = aPos.y - propPos.y;
        const totalPixels = Math.hypot(dx, dy);

        // Only render if anchor and property have sufficient breathing room AND zoom is sufficient
        if (zoom < 13.2 || totalPixels < 90) return null;

        // Position badge along route midpoint (t = 0.5) to avoid overlapping the property pin or anchor
        let badgeX = propPos.x + dx * 0.5;
        let badgeY = propPos.y + dy * 0.5;

        if (activeDrivingRoute && activeDrivingRoute.points.length > 5) {
          const targetIndex = Math.min(activeDrivingRoute.points.length - 1, Math.max(1, Math.floor(activeDrivingRoute.points.length * 0.5)));
          const roadPoint = activeDrivingRoute.points[targetIndex];
          const roadScreen = getScreenPos(roadPoint[0], roadPoint[1]);
          badgeX = roadScreen.x;
          badgeY = roadScreen.y;
        }

        return (
          <div
            key={`badge-active-${activeAnchor.id}`}
            className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${badgeX}px`, top: `${badgeY}px` }}
          >
            <div className="px-3 py-1 rounded-full shadow-lg border-2 flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap backdrop-blur-md bg-indigo-600 text-white border-white ring-4 ring-indigo-500/25 shadow-indigo-950/20">
              {isWalking ? (
                <PersonSimpleWalk size={13} weight="bold" className="text-amber-300" />
              ) : isBiking ? (
                <Bicycle size={13} weight="bold" className="text-amber-300" />
              ) : (
                <Car size={13} weight="fill" className="text-amber-300" />
              )}
              <span className="font-extrabold">{durText}</span>
              <span className="text-indigo-200 font-bold">·</span>
              <span className="text-indigo-100 font-semibold">{distText} {modeText}</span>
            </div>
          </div>
        );
      })()}

      {/* 4. Proximity Anchor Markers Layer (Clean LOD: active expanded, inactive compact) */}
      {showAnchors &&
        anchors.map((anchor) => {
          const pos = getScreenPos(anchor.lat, anchor.lng);
          const isSelected = activeAnchor?.id === anchor.id;

          if (pos.x < -100 || pos.x > dimensions.width + 100 || pos.y < -100 || pos.y > dimensions.height + 100) {
            return null;
          }

          return (
            <div
              key={anchor.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-none ${isSelected ? 'z-35' : 'z-20'
                }`}
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
              onClick={(e) => {
                e.stopPropagation();
                if (hasDraggedRef.current) return;
                if (onSelectAnchor) onSelectAnchor(anchor);
                setCenter({ lat: anchor.lat, lng: anchor.lng });
                setInspectedPlace({ ...anchor, isAnchor: true });
                fetchPlaceDetails(anchor);
              }}
              title={anchor.label}
            >
              <div className="relative group flex flex-col items-center">
                {isSelected ? (
                  <div className="relative group/anchor">
                    <div className="w-8 h-8 rounded-full bg-zinc-950 text-white ring-2 ring-indigo-400 shadow-xl flex items-center justify-center hover:scale-110 transition-transform">
                      {anchor.iconType === 'gym' ? (
                        <Dumbbell size={15} className="text-amber-400" />
                      ) : anchor.iconType === 'cafe' ? (
                        <CoffeeLucide size={15} className="text-orange-400" />
                      ) : anchor.iconType === 'shop' ? (
                        <ShoppingBag size={15} className="text-emerald-400" />
                      ) : anchor.iconType === 'beach' || anchor.iconType === 'surf' ? (
                        <Waves size={15} weight="fill" className="text-cyan-400" />
                      ) : anchor.iconType === 'trail' ? (
                        <Tree size={15} weight="fill" className="text-emerald-400" />
                      ) : (
                        <Target size={15} weight="bold" className="text-indigo-400" />
                      )}
                    </div>
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-xl bg-zinc-950 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/anchor:opacity-100 pointer-events-none shadow-xl transition-opacity z-50 border border-indigo-400/40">
                      {anchor.label}
                    </div>
                  </div>
                ) : (
                  <div className="relative group/anchor">
                    <div
                      className={`w-7 h-7 rounded-full shadow-md flex items-center justify-center hover:scale-115 transition-all border-2 ${
                        anchor.iconType === 'gym'
                          ? 'bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-500'
                          : anchor.iconType === 'cafe'
                          ? 'bg-orange-50 text-orange-800 border-orange-300 hover:border-orange-500'
                          : anchor.iconType === 'shop'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:border-emerald-500'
                          : anchor.iconType === 'beach' || anchor.iconType === 'surf'
                          ? 'bg-cyan-50 text-cyan-800 border-cyan-300 hover:border-cyan-500'
                          : anchor.iconType === 'trail'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:border-emerald-500'
                          : 'bg-white text-zinc-800 border-zinc-300 hover:border-zinc-800'
                      }`}
                    >
                      {anchor.iconType === 'gym' ? (
                        <Dumbbell size={13} className="text-amber-700" />
                      ) : anchor.iconType === 'cafe' ? (
                        <CoffeeLucide size={13} className="text-orange-700" />
                      ) : anchor.iconType === 'shop' ? (
                        <ShoppingBag size={13} className="text-emerald-700" />
                      ) : anchor.iconType === 'beach' || anchor.iconType === 'surf' ? (
                        <Waves size={13} weight="fill" className="text-cyan-700" />
                      ) : anchor.iconType === 'trail' ? (
                        <Tree size={13} weight="fill" className="text-emerald-700" />
                      ) : (
                        <Target size={13} weight="bold" className="text-zinc-700" />
                      )}
                    </div>
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/anchor:opacity-100 pointer-events-none shadow-lg transition-opacity z-50 border border-white/10">
                      {anchor.label}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

      {/* 4b. Dynamic Chosen Proximity Location Beacon & Radius Distance Label */}
      {proximityFilter && (() => {
        const pPos = getScreenPos(proximityFilter.lat, proximityFilter.lng);
        const metersPerPixel = (156543.03392 * Math.cos((proximityFilter.lat * Math.PI) / 180)) / Math.pow(2, zoom);
        const radiusPixels = (effectiveRadiusKm * 1000) / metersPerPixel;

        return (
          <div key="dynamic-proximity-filter-elements" className="pointer-events-none">
            {/* Center Beacon */}
            <div
              className="absolute z-40 transform -translate-x-1/2 -translate-y-1/2 transition-none pointer-events-auto"
              style={{ left: `${pPos.x}px`, top: `${pPos.y}px` }}
            >
              <div className="relative flex flex-col items-center group/focal">
                {zoom < 13.8 ? (
                  /* Compact Target Icon for Zoomed-Out View */
                  <>
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white ring-2 ring-white shadow-xl flex items-center justify-center hover:scale-110 transition-transform cursor-pointer">
                      <Target size={15} weight="bold" />
                    </div>
                    {/* Tooltip on Hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-xl bg-zinc-950 text-white text-[11px] font-extrabold whitespace-nowrap opacity-0 group-hover/focal:opacity-100 pointer-events-none shadow-xl border border-white/10 z-50 transition-opacity">
                      Focal Hub: {proximityFilter.label}
                    </div>
                  </>
                ) : (
                  /* Expanded Luxury Pill for Zoomed-In View */
                  <>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-950 text-white font-extrabold text-xs shadow-2xl ring-2 ring-indigo-400 ring-offset-2 ring-offset-white whitespace-nowrap">
                      <Target size={14} weight="bold" className="text-indigo-400" />
                      <span>{proximityFilter.label}</span>
                    </div>
                    <div className="w-2 h-2 rotate-45 -mt-1 shadow-2xs bg-zinc-950" />
                  </>
                )}
              </div>
            </div>

            {/* Perimeter Distance Badge */}
            {radiusPixels > 30 && showRadius && (
              <div
                className="absolute z-35 transform -translate-x-1/2 -translate-y-full mb-1 transition-none"
                style={{ left: `${pPos.x}px`, top: `${pPos.y - radiusPixels}px` }}
              >
                <div className="px-2.5 py-0.5 rounded-full bg-indigo-600/95 text-white text-[10px] font-black shadow-md border border-white/50 backdrop-blur-md whitespace-nowrap">
                  {effectiveRadiusKm.toFixed(1)} km radius
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 4c. Active Anchor Perimeter Distance Badge (when no custom proximity filter is active) */}
      {!proximityFilter && showRadius && showAnchors && activeAnchor && (() => {
        const aPos = getScreenPos(activeAnchor.lat, activeAnchor.lng);
        const metersPerPixel = (156543.03392 * Math.cos((activeAnchor.lat * Math.PI) / 180)) / Math.pow(2, zoom);
        const radiusPixels = (effectiveRadiusKm * 1000) / metersPerPixel;

        if (radiusPixels <= 30) return null;
        return (
          <div
            key={`anchor-perimeter-badge-${activeAnchor.id}`}
            className="absolute z-35 transform -translate-x-1/2 -translate-y-full mb-1 pointer-events-none transition-none"
            style={{ left: `${aPos.x}px`, top: `${aPos.y - radiusPixels}px` }}
          >
            <div className="px-2.5 py-0.5 rounded-full bg-indigo-600/95 text-white text-[10px] font-black shadow-md border border-white/50 backdrop-blur-md whitespace-nowrap">
              {effectiveRadiusKm.toFixed(1)} km radius
            </div>
          </div>
        );
      })()}

      {/* 5A. Target Suburb Pins (Search Mode: Dynamic Level-of-Detail & Anti-Collision) */}
      {isSearchMode && selectedSuburbs && (() => {
        const placedMarkers: { x: number; y: number }[] = [];
        if (proximityFilter) {
          const fp = getScreenPos(proximityFilter.lat, proximityFilter.lng);
          placedMarkers.push({ x: fp.x, y: fp.y });
        }

        return selectedSuburbs.map((suburb) => {
          const coords = resolveLocationCoords(suburb);
          const rawPos = getScreenPos(coords.lat, coords.lng);
          if (rawPos.x < -100 || rawPos.x > dimensions.width + 100 || rawPos.y < -100 || rawPos.y > dimensions.height + 100) {
            return null;
          }

          const abbr = getSuburbAbbr(suburb);
          const isZoomedOut = zoom < 13.8;
          let renderCompact = isZoomedOut;

          if (!renderCompact) {
            // Check collision for full 110px pill against previously placed markers
            const collides = placedMarkers.some(
              (p) => Math.abs(p.x - rawPos.x) < 85 && Math.abs(p.y - rawPos.y) < 28
            );
            if (collides) {
              renderCompact = true;
            }
          }

          // Anti-overlap displacement: if even the compact circles collide (< 26px), micro-nudge slightly
          let posX = rawPos.x;
          let posY = rawPos.y;
          const pointCollision = placedMarkers.find(
            (p) => Math.hypot(p.x - posX, p.y - posY) < 26
          );
          if (pointCollision) {
            const angle = Math.atan2(posY - pointCollision.y, posX - pointCollision.x) || Math.PI / 4;
            posX = pointCollision.x + Math.cos(angle) * 28;
            posY = pointCollision.y + Math.sin(angle) * 28;
          }

          placedMarkers.push({ x: posX, y: posY });

          return (
            <div
              key={suburb}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-35 pointer-events-auto cursor-pointer select-none transition-none group/suburb"
              style={{ left: `${posX}px`, top: `${posY}px` }}
            >
              <div className="relative flex flex-col items-center">
                {renderCompact ? (
                  /* Compact Geo Icon & Abbreviation Dot for Zoomed-Out View */
                  <>
                    <div className="w-6 h-6 rounded-full bg-zinc-950 text-white border-2 border-indigo-400 shadow-lg flex items-center justify-center text-[10px] font-black tracking-tight hover:scale-125 transition-transform">
                      {abbr}
                    </div>
                    {/* Tooltip on Hover showing full suburb name */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-xl bg-zinc-950 text-white text-[11px] font-extrabold whitespace-nowrap opacity-0 group-hover/suburb:opacity-100 pointer-events-none shadow-xl border border-white/10 z-50 transition-opacity">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} weight="fill" className="text-indigo-400" />
                        <span>{suburb}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Expanded Full Luxury Pill for Zoomed-In View */
                  <>
                    <div className="px-3 py-1.5 rounded-2xl text-xs font-black bg-zinc-950 text-white shadow-xl border border-white/20 flex items-center gap-1.5 whitespace-nowrap hover:scale-105 transition-transform">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                      <span>{suburb}</span>
                    </div>
                    <div className="w-2.5 h-2.5 rotate-45 -mt-1 bg-zinc-950 border-r border-b border-white/20 shadow-xs" />
                  </>
                )}
              </div>
            </div>
          );
        });
      })()}

      {/* 5B. Property Markers Layer (Results / Default Mode) */}
      {!isSearchMode && mappableProperties.map((property) => {
        const coords = resolvedPropertyCoords.get(property.id);
        const pos = getScreenPos(coords ? coords.lat : property.lat, coords ? coords.lng : property.lng);
        const isApproxArea = Boolean(coords?.isApproximateArea);
        const isSelected = (selectedPropertyId ? selectedPropertyId === property.id : selectedProp?.id === property.id);
        const isHovered = hoveredProperty?.id === property.id;
        const isTopMatch = property.rank === 1;
        const isNoiseWarning = property.noise_risk === 'high' || (property.fit_score && property.fit_score < 50);
        const isCompact = !isSelected && !isHovered && renderedPositions[property.id]?.isCompact;

        if (pos.x < -80 || pos.x > dimensions.width + 80 || pos.y < -80 || pos.y > dimensions.height + 80) {
          return null;
        }

        return (
          <div
            key={property.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-none ${isHovered ? 'z-[60]' : isSelected ? 'z-[45]' : isCompact ? 'z-20' : 'z-30'
              }`}
            style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            onClick={(e) => {
              e.stopPropagation();
              if (hasDraggedRef.current) return;
              if (onSelectProperty) onSelectProperty(property);
            }}
            onMouseEnter={() => handlePropertyMouseEnter(property)}
            onMouseLeave={handlePropertyMouseLeave}
          >
            <div className="relative group">
              {/* Approximate-area dashed zone halo */}
              {isApproxArea && (
                <span
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed pointer-events-none ${
                    isSelected
                      ? 'w-16 h-16 border-amber-400 bg-amber-400/15'
                      : 'w-12 h-12 border-amber-500/60 bg-amber-400/10'
                  }`}
                />
              )}

              {/* Compact Round Pin vs Full Luxury Price Badge */}
              {isCompact ? (
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-md transition-transform group-hover:scale-125 ${
                    isApproxArea
                      ? 'border-2 border-dashed border-amber-400 bg-amber-950/90 text-amber-200 ring-1 ring-amber-400/40'
                      : isTopMatch
                      ? 'bg-amber-400 text-zinc-950 border-2 border-white ring-1 ring-amber-400/50'
                      : 'bg-zinc-900 text-white border-2 border-white hover:bg-zinc-800'
                  }`}
                  title={
                    isApproxArea
                      ? `~Approx. Area (${property.address}) · #${property.rank} - ${formatPricePill(property.price, property.currency)}`
                      : `#${property.rank} - ${formatPricePill(property.price, property.currency)}`
                  }
                >
                  {isApproxArea ? `~${property.rank || ''}` : property.rank || ''}
                </div>
              ) : (
                <div>
                  <div
                    className={`${zoom < 14.5 && !isSelected && !isHovered ? 'px-2 py-0.5 text-[11px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5'} rounded-full font-bold transition-all flex items-center shadow-md whitespace-nowrap ${
                      isApproxArea
                        ? isSelected
                          ? 'bg-zinc-900/95 text-amber-100 border-2 border-dashed border-amber-400 ring-2 ring-amber-400/40 ring-offset-2 ring-offset-white shadow-xl'
                          : 'bg-amber-50/95 text-zinc-900 border-2 border-dashed border-amber-500/80 hover:border-amber-600 hover:bg-amber-100/95 hover:shadow-lg'
                        : isSelected
                        ? 'bg-zinc-950 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-white shadow-xl'
                        : 'bg-white text-zinc-900 border border-zinc-200/90 hover:border-zinc-950 hover:bg-zinc-50 hover:shadow-lg'
                    }`}
                    title={isApproxArea ? `Approximate area center (${property.address}) — exact street address unknown` : undefined}
                  >
                    {property.rank && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${
                        isApproxArea
                          ? isSelected
                            ? 'bg-amber-400 text-zinc-950'
                            : 'bg-amber-200/90 text-amber-950'
                          : isSelected
                          ? 'bg-emerald-400 text-zinc-950'
                          : isTopMatch
                          ? 'bg-amber-400 text-zinc-950'
                          : 'bg-zinc-100 text-zinc-800'
                      }`}>
                        {isTopMatch && <Sparkle size={9} weight="fill" />}
                        #{property.rank}
                      </span>
                    )}

                    {isApproxArea && (zoom >= 15.2 || isSelected || isHovered) && (
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-1 py-0.5 rounded ${
                          isSelected
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                            : 'bg-amber-200/70 text-amber-900'
                        }`}
                      >
                        ~Area
                      </span>
                    )}

                    {isNoiseWarning && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Acoustic Noise Risk Flagged" />
                    )}

                    <span className={isSelected ? 'font-black' : 'font-extrabold'}>
                      {isApproxArea ? `~${formatPricePill(property.price, property.currency)}` : formatPricePill(property.price, property.currency)}
                    </span>
                  </div>

                  <div
                    className={`w-2 h-2 rotate-45 -mt-1 mx-auto shadow-2xs transition-colors ${
                      isApproxArea
                        ? isSelected
                          ? 'bg-zinc-900 border-r border-b border-dashed border-amber-400'
                          : 'bg-amber-50 border-r border-b border-dashed border-amber-500/80'
                        : isSelected
                        ? 'bg-zinc-950 ring-1 ring-emerald-400/50'
                        : 'bg-white border-r border-b border-zinc-300 group-hover:bg-zinc-50'
                    }`}
                  />
                </div>
              )}

              {/* Hover Mini-Card Tooltip (Floating Micro-Dossier with invisible hover bridge) */}
              {isHovered && !isSelected && (
                <div
                  className="absolute bottom-full left-1/2 transform -translate-x-1/2 pb-2 z-50 pointer-events-auto"
                  onMouseEnter={() => handlePropertyMouseEnter(property)}
                  onMouseLeave={handlePropertyMouseLeave}
                >
                  {renderHoverMiniCard(property)}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 5C. Missing Address Listings Container (Top Right) */}
      {!isSearchMode && missingAddressProperties.length > 0 && (
        <div
          className="absolute top-4 right-4 z-40 pointer-events-auto flex flex-col items-end"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="relative">
            {hoveredProperty && isMissingAddressListing(hoveredProperty) && !resolvedPropertyCoords.has(hoveredProperty.id) && (
              <div
                className="absolute top-0 right-full pr-2.5 z-50 pointer-events-auto"
                onMouseEnter={() => handlePropertyMouseEnter(hoveredProperty)}
                onMouseLeave={handlePropertyMouseLeave}
              >
                {renderHoverMiniCard(hoveredProperty)}
              </div>
            )}

            <div className="w-52 sm:w-56 bg-white/95 backdrop-blur-md border border-zinc-200/90 rounded-2xl shadow-lg overflow-hidden">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMissingAddressCollapsed((prev) => !prev);
                }}
                className="w-full px-3 py-2 flex items-center justify-between gap-2 bg-zinc-50/80 hover:bg-zinc-100/80 border-b border-zinc-200/70 transition-colors cursor-pointer"
                title="Listings without an exact street address on Property24"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin size={13} weight="fill" className="text-amber-500 shrink-0" />
                  <span className="text-[11px] font-bold text-zinc-800 truncate">
                    No Street Address
                  </span>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                    {missingAddressProperties.length}
                  </span>
                </div>
                {isMissingAddressCollapsed ? (
                  <CaretDown size={13} weight="bold" className="text-zinc-500 shrink-0" />
                ) : (
                  <CaretUp size={13} weight="bold" className="text-zinc-500 shrink-0" />
                )}
              </button>

              {!isMissingAddressCollapsed && (
                <div className="max-h-[340px] overflow-y-auto p-1.5 flex flex-col gap-1.5">
                  {missingAddressProperties.map((property) => {
                    const isSelected = selectedPropertyId
                      ? selectedPropertyId === property.id
                      : selectedProp?.id === property.id;
                    const isTopMatch = property.rank === 1;
                    const isNoiseWarning =
                      property.noise_risk === 'high' || (property.fit_score && property.fit_score < 50);
                    const shortLocation = (property.address || property.title || 'Address withheld')
                      .replace(/\s*\(Street Address Withheld\)/i, '')
                      .split(',')[0]
                      .trim();

                    return (
                      <button
                        key={`missing-addr-${property.id}`}
                        type="button"
                        onMouseEnter={() => handlePropertyMouseEnter(property)}
                        onMouseLeave={handlePropertyMouseLeave}
                        onClick={(e) => {
                          e.stopPropagation();
                          hasDraggedRef.current = false;
                          const coords = resolvedPropertyCoords.get(property.id);
                          if (coords) {
                            setCenter({ lat: coords.lat, lng: coords.lng });
                            const nextZoom = Math.max(targetZoomRef.current, 15.5);
                            targetZoomRef.current = nextZoom;
                            setZoom(nextZoom);
                          }
                          if (!isSelected) {
                            onSelectProperty?.(property);
                          }
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${isSelected
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm ring-1 ring-emerald-400/50'
                          : 'bg-white hover:bg-zinc-50 text-zinc-900 border-zinc-200 hover:border-zinc-300 shadow-2xs'
                          }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {property.rank && (
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5 ${isTopMatch
                                ? 'bg-amber-400 text-zinc-950'
                                : isSelected
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-zinc-100 text-zinc-800'
                                }`}
                            >
                              {isTopMatch && <Sparkle size={8} weight="fill" />}
                              #{property.rank}
                            </span>
                          )}
                          {isNoiseWarning && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"
                              title="Acoustic Noise Risk Flagged"
                            />
                          )}
                          <span
                            className={`text-[10px] font-medium truncate ${isSelected ? 'text-zinc-300' : 'text-zinc-500'
                              }`}
                          >
                            {shortLocation}
                          </span>
                        </div>
                        <span className="text-[11px] font-extrabold shrink-0">
                          {formatPricePill(property.price, property.currency)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* 6. Active Property & Proximity HUD Header (Top Left) */}
      {isSearchMode ? (
        <div className="absolute top-4 left-4 z-40 max-w-sm pointer-events-auto">
          {isSearchRadarCollapsed ? (
            <div
              onClick={() => setIsSearchRadarCollapsed(false)}
              className="px-3.5 py-2 flex items-center gap-2.5 cursor-pointer hover:bg-zinc-50/90 rounded-2xl bg-white/95 backdrop-blur-xl border border-zinc-200/90 shadow-xl text-xs transition-all select-none group"
              title="Expand Search Filter Radar"
            >
              <div className="w-6 h-6 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-bold shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <SlidersHorizontal size={13} weight="bold" className="text-indigo-400" />
              </div>
              <span className="font-extrabold text-zinc-950 truncate max-w-[170px]">
                Search Radar ({selectedSuburbs && selectedSuburbs.length > 0 ? `${selectedSuburbs.length} Suburbs` : 'All City'})
              </span>
              <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[10px] shrink-0">
                {effectiveRadiusKm.toFixed(1)} km
              </span>
              <CaretDown size={14} weight="bold" className="text-zinc-500 shrink-0" />
            </div>
          ) : (
            <div className="bg-white/95 backdrop-blur-xl border border-zinc-200/90 rounded-3xl shadow-xl text-xs p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-2xl bg-zinc-950 text-white flex items-center justify-center font-bold shadow-xs">
                    <SlidersHorizontal size={16} weight="bold" className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-zinc-950 text-xs">Search Filter Radar</h3>
                    <p className="text-[10px] text-zinc-500 font-medium">Real-time criteria footprint</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-black uppercase tracking-wider">
                    Search Mode
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSearchRadarCollapsed(true)}
                    className="p-1 text-zinc-400 hover:text-zinc-800 transition-colors rounded-lg hover:bg-zinc-100 cursor-pointer"
                    title="Collapse Search Filter Radar"
                    aria-label="Collapse Search Filter Radar"
                  >
                    <CaretUp size={15} weight="bold" />
                  </button>
                </div>
              </div>

              {/* Active Criteria Summary */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                  <span className="font-semibold text-zinc-600 flex items-center gap-1.5">
                    <MapPin size={14} weight="bold" className="text-indigo-600" />
                    Target Suburbs
                  </span>
                  <span className="font-extrabold text-zinc-950">
                    {selectedSuburbs && selectedSuburbs.length > 0
                      ? `${selectedSuburbs.length} Selected`
                      : 'All Cape Town'}
                  </span>
                </div>

                {proximityFilter && (
                  <div className="flex items-center justify-between text-[11px] p-2.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/70">
                    <span className="font-semibold text-indigo-900 flex items-center gap-1.5 truncate max-w-[160px]">
                      <Target size={14} weight="bold" className="text-indigo-600 shrink-0" />
                      {locationLabel}
                    </span>
                    <span className="font-black text-indigo-700 shrink-0">
                      {effectiveRadiusKm.toFixed(1)} km buffer
                    </span>
                  </div>
                )}

                {searchSummary && (searchSummary.minPrice || searchSummary.maxPrice) && (
                  <div className="flex items-center justify-between text-[11px] p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                    <span className="font-semibold text-zinc-600">Budget Window</span>
                    <span className="font-extrabold text-zinc-950">
                      R {formatNumberDeterministic(searchSummary.minPrice || 0)} – R {formatNumberDeterministic(searchSummary.maxPrice || 0)}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-1.5 text-[10px] text-zinc-400 font-medium leading-relaxed border-t border-zinc-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                <span>Map reflects your live filters. Properties are ranked when you launch the report.</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        selectedProp && (
          <div className="absolute top-4 left-4 z-40 bg-white/95 backdrop-blur-xl border border-zinc-200/90 rounded-2xl shadow-xl text-xs max-w-sm pointer-events-auto transition-all duration-200">
            {/* Collapsed Pill State */}
            {isHudCollapsed ? (
              <div
                onClick={() => setIsHudCollapsed(false)}
                className="px-3.5 py-2 flex items-center gap-2 cursor-pointer hover:bg-zinc-50/80 rounded-2xl transition-colors"
              >
                <img
                  src={selectedProp.image}
                  alt=""
                  className="w-6 h-6 rounded-lg object-cover border border-zinc-200 shrink-0"
                />
                <span className="font-extrabold text-zinc-950 truncate max-w-[150px]">
                  #{selectedProp.rank} {selectedProp.title}
                </span>
                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px] shrink-0">
                  {formatPricePill(selectedProp.price, selectedProp.currency)}
                </span>
                <CaretDown size={14} weight="bold" className="text-zinc-500 shrink-0" />
              </div>
            ) : (
              /* Expanded Full Inspector State */
              <div className="p-3.5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={selectedProp.image}
                      alt={selectedProp.title}
                      className="w-12 h-12 rounded-xl object-cover border border-zinc-200 shrink-0 shadow-2xs"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="bg-zinc-950 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                          #{selectedProp.rank}
                        </span>
                        <span className="font-extrabold text-zinc-950 text-xs truncate max-w-[140px]">
                          {selectedProp.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate max-w-[160px] mt-0.5">{selectedProp.address}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-black text-indigo-700 text-xs">
                          {formatPricePill(selectedProp.price, selectedProp.currency)}
                          <span className="text-[10px] font-normal text-zinc-500"> /mo</span>
                        </span>
                        {selectedProp.fit_score && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${selectedProp.fit_score >= 70 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                            {selectedProp.fit_score}% Fit
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsHudCollapsed(true)}
                    className="p-1 text-zinc-400 hover:text-zinc-800 transition-colors rounded-lg hover:bg-zinc-100 cursor-pointer shrink-0"
                    title="Collapse Inspector"
                    aria-label="Collapse Inspector"
                  >
                    <CaretUp size={15} weight="bold" />
                  </button>
                </div>


                {/* Acoustic Decibel & Orientation Rating */}
                <div className="pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    <span>Acoustic Decibel &amp; Orientation</span>
                    <span className={isPropShielded ? 'text-emerald-600 font-extrabold' : 'text-rose-600 font-extrabold'}>
                      {selectedProp.acoustic_audit?.estimated_db || (isPropShielded ? 40 : 73)} dBA
                    </span>
                  </div>
                  <div className={`p-2 rounded-xl text-xs flex items-center gap-2 border ${isPropShielded
                    ? 'bg-emerald-50/80 text-emerald-950 border-emerald-200/80'
                    : 'bg-rose-50/80 text-rose-950 border-rose-200/80'
                    }`}>
                    {isPropShielded ? (
                      <ShieldCheck size={18} weight="bold" className="text-emerald-600 shrink-0" />
                    ) : (
                      <SpeakerHigh size={18} weight="bold" className="text-rose-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-extrabold text-[11px] truncate">
                        {selectedProp.acoustic_audit?.sound_shadow_status || (isPropShielded ? 'In Acoustic Shadow (Shielded)' : 'Direct Unbuffered Exposure')}
                      </div>
                      <div className="text-[10px] text-zinc-600 truncate mt-0.5">
                        Facing: {selectedProp.acoustic_audit?.facing_direction || (isPropShielded ? 'West / Mountain' : 'East / Malan St')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desired Locations Proximity Section */}
                {anchors.length > 0 && (
                  <div className="space-y-1.5 pt-2.5 border-t border-zinc-100">
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      <span>Commute & Proximity</span>
                      <span className="text-zinc-400 font-normal">Click to focus</span>
                    </div>

                    {anchors.map((a) => {
                      const isSelectedAnchor = activeAnchor?.id === a.id;
                      const driveData = (isSelectedAnchor && activeDrivingRoute) ? activeDrivingRoute : null;
                      const distKm = driveData
                        ? driveData.distanceKm
                        : calculateDrivingDistanceKm(selectedProp.lat, selectedProp.lng, a.lat, a.lng);
                      const isWalking = a.commute_mode === 'walking' || (a.commute_mode !== 'driving' && distKm <= 1.2);
                      const isBiking = a.commute_mode === 'bicycling';
                      const durMins = (driveData && !isWalking && !isBiking)
                        ? driveData.durationMins
                        : isWalking
                          ? Math.max(1, Math.round((distKm / 4.8) * 60))
                          : isBiking
                            ? Math.max(1, Math.round((distKm / 15.0) * 60))
                            : calculateDrivingDurationMins(distKm);
                      const modeLabel = isWalking ? 'walk' : isBiking ? 'bike' : 'drive';
                      const dist = `${distKm} km`;
                      const dur = `~${durMins} min${durMins === 1 ? '' : 's'}`;

                      return (
                        <div
                          key={a.id}
                          onClick={() => {
                            if (onSelectAnchor) onSelectAnchor(a);
                            setCenter({ lat: a.lat, lng: a.lng });
                            setInspectedPlace({ ...a, isAnchor: true });
                            fetchPlaceDetails(a);
                          }}
                          className={`flex items-center justify-between text-[11px] font-medium px-2.5 py-1.5 rounded-xl cursor-pointer transition-all ${isSelectedAnchor
                            ? 'bg-zinc-950 text-white shadow-sm'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200/60'
                            }`}
                        >
                          <span className="truncate max-w-[130px] font-semibold flex items-center gap-1.5">
                            <Target size={12} className={isSelectedAnchor ? 'text-emerald-400' : 'text-zinc-500'} />
                            {a.label}
                          </span>
                          <span className={`font-black shrink-0 ${isSelectedAnchor ? 'text-emerald-400' : 'text-indigo-600'}`}>
                            {dur} ({modeLabel}) • {dist}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Jump to listing card button */}
                <button
                  onClick={() => {
                    const el = document.getElementById(`listing-card-${selectedProp.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="w-full py-1.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200/90 text-zinc-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Scroll to Full Dossier</span>
                  <NavigationArrow size={12} weight="bold" className="text-zinc-600" />
                </button>
              </div>
            )}
          </div>
        )
      )}

      {/* Map Zoom & Action Controls (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-40 flex flex-col gap-2 pointer-events-auto items-end">
        <div className="bg-white/95 backdrop-blur-md border border-zinc-200/90 rounded-2xl shadow-xl overflow-hidden flex flex-col p-0.5">
          <button
            onClick={() => smoothZoomTo(targetZoomRef.current + 0.65)}
            className="p-2.5 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 rounded-xl transition-colors cursor-pointer"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <Plus size={15} weight="bold" />
          </button>
          <div className="h-px bg-zinc-100 mx-2" />
          <button
            onClick={() => smoothZoomTo(targetZoomRef.current - 0.65)}
            className="p-2.5 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 rounded-xl transition-colors cursor-pointer"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <Minus size={15} weight="bold" />
          </button>
          <div className="h-px bg-zinc-100 mx-2" />
          <button
            onClick={resetView}
            className="p-2.5 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 rounded-xl transition-colors cursor-pointer"
            title="Fit All Properties"
            aria-label="Fit All Properties"
          >
            <ArrowsOutCardinal size={15} weight="bold" />
          </button>
        </div>

        {/* Free Map Attribution */}
        <div className="px-2.5 py-1 rounded-lg bg-white/85 backdrop-blur-md text-[10px] font-medium text-zinc-500 border border-zinc-200/70 shadow-2xs">
          {mapStyle === 'osm' ? '© OpenStreetMap' : '© Esri · OpenStreetMap'}
        </div>
      </div>

      {/* Bottom Left Dock: Dynamic Location Radius Slider + Layer Visibility Toolbar */}
      <div
        className="absolute bottom-6 left-6 z-40 flex flex-col items-start gap-2 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Dynamic Radius Ring Slider (Directly above the toggle visibility switches) */}
        {showRadius && (proximityFilter || (showAnchors && (activeAnchor || anchors.length > 0))) && (
          isRadiusCollapsed ? (
            <div
              onClick={() => setIsRadiusCollapsed(false)}
              className="w-64 sm:w-72 px-3.5 py-2 rounded-2xl bg-white/95 backdrop-blur-xl border border-zinc-200/90 shadow-xl flex items-center justify-between gap-2 cursor-pointer hover:bg-zinc-50/90 transition-all select-none group"
              title="Expand Radius Slider"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Target size={14} weight="bold" className="text-indigo-600 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-zinc-800 truncate" title={locationLabel}>
                  {locationLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-extrabold text-[11px] whitespace-nowrap">
                  {effectiveRadiusKm.toFixed(1)} km
                </span>
                <CaretUp size={14} weight="bold" className="text-zinc-500 shrink-0" />
              </div>
            </div>
          ) : (
            <div className="w-64 sm:w-72 p-3 rounded-2xl bg-white/95 backdrop-blur-xl border border-zinc-200/90 shadow-xl transition-all duration-200 select-none animate-in fade-in duration-150">
              {/* Header: Location Label & Radius Pill */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Target size={14} weight="bold" className="text-indigo-600 shrink-0" />
                  <span className="text-xs font-bold text-zinc-800 truncate" title={locationLabel}>
                    {locationLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-extrabold text-[11px] whitespace-nowrap shrink-0">
                    {effectiveRadiusKm.toFixed(1)} km
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRadiusCollapsed(true)}
                    className="p-1 text-zinc-400 hover:text-zinc-800 transition-colors rounded-lg hover:bg-zinc-100 cursor-pointer"
                    title="Collapse Radius Slider"
                    aria-label="Collapse Radius Slider"
                  >
                    <CaretDown size={14} weight="bold" />
                  </button>
                </div>
              </div>

              {/* Slider Track */}
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                value={effectiveRadiusKm}
                onChange={(e) => handleRadiusChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                aria-label="Location Radius Ring Slider"
              />

              {/* Scale & Quick Presets */}
              <div className="flex items-center justify-between mt-1 text-[10px] font-semibold text-zinc-400">
                <span>1 km</span>
                <div className="flex items-center gap-1">
                  {[2, 5, 10, 15].map((km) => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => handleRadiusChange(km)}
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${Math.abs(effectiveRadiusKm - km) < 0.25
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                        }`}
                    >
                      {km}k
                    </button>
                  ))}
                </div>
                <span>20 km</span>
              </div>
            </div>
          )
        )}

        {/* Layer Visibility Toolbar (Gray Container with Title & Tooltips) */}
        <div className="flex items-center p-1.5 rounded-2xl bg-zinc-200/90 backdrop-blur-xl border border-zinc-300/80 shadow-xl gap-1.5">
          {/* Title */}
          <div className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-zinc-600 border-r border-zinc-300/90 select-none">
            <Stack size={14} weight="bold" className="text-zinc-700" />
            <span>Layers</span>
          </div>

          {/* 1. Basemap Switcher */}
          <div className="relative group/layer-btn">
            <button
              onClick={() => setMapStyle(mapStyle === 'canvas' ? 'osm' : 'canvas')}
              className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150 ${mapStyle === 'osm'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-400/30'
                : 'bg-white/95 hover:bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-300/80 shadow-2xs hover:shadow-xs'
                }`}
              aria-label={`Switch Basemap (Current: ${mapStyle === 'canvas' ? 'Clean Canvas' : 'Detailed Streets'})`}
            >
              <MapTrifold size={16} weight={mapStyle === 'osm' ? 'fill' : 'bold'} />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-xl bg-zinc-950/95 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/layer-btn:opacity-100 pointer-events-none shadow-xl transition-all duration-150 z-50 border border-white/10">
              Basemap: {mapStyle === 'canvas' ? 'Clean Canvas' : 'Detailed Streets'}
            </div>
          </div>

          {/* 2. Noise Radar Heatmap Toggle */}
          <div className="relative group/layer-btn">
            <button
              onClick={() => setShowNoiseRadar(!showNoiseRadar)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150 ${showNoiseRadar
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-400/30'
                : 'bg-white/95 hover:bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-300/80 shadow-2xs hover:shadow-xs'
                }`}
              aria-label="Toggle Noise Radar Layer"
            >
              <SpeakerHigh size={16} weight={showNoiseRadar ? 'fill' : 'bold'} />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-xl bg-zinc-950/95 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/layer-btn:opacity-100 pointer-events-none shadow-xl transition-all duration-150 z-50 border border-white/10">
              Noise Radar: {showNoiseRadar ? 'Visible' : 'Hidden'}
            </div>
          </div>

          {/* 3. Crime Hotspots Layer Toggle */}
          <div className="relative group/layer-btn">
            <button
              onClick={() => setShowCrimeRadar(!showCrimeRadar)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150 ${showCrimeRadar
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25 ring-2 ring-rose-400/30'
                : 'bg-white/95 hover:bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-300/80 shadow-2xs hover:shadow-xs'
                }`}
              aria-label="Toggle Crime Hotspots Layer"
            >
              <ShieldWarning size={16} weight={showCrimeRadar ? 'fill' : 'bold'} />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-xl bg-zinc-950/95 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/layer-btn:opacity-100 pointer-events-none shadow-xl transition-all duration-150 z-50 border border-white/10">
              Crime Hotspots: {showCrimeRadar ? 'Visible' : 'Hidden'}
            </div>
          </div>

          {/* 4. Proximity Anchors Toggle */}
          <div className="relative group/layer-btn">
            <button
              onClick={() => setShowAnchors(!showAnchors)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150 ${showAnchors
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-400/30'
                : 'bg-white/95 hover:bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-300/80 shadow-2xs hover:shadow-xs'
                }`}
              aria-label="Toggle Proximity Anchors Layer"
            >
              <Target size={16} weight={showAnchors ? 'fill' : 'bold'} />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-xl bg-zinc-950/95 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/layer-btn:opacity-100 pointer-events-none shadow-xl transition-all duration-150 z-50 border border-white/10">
              Commute Anchors: {showAnchors ? 'Visible' : 'Hidden'}
            </div>
          </div>

          {/* 4. Radius Buffer Ring Toggle */}
          {showAnchors && (
            <div className="relative group/layer-btn">
              <button
                onClick={() => setShowRadius(!showRadius)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150 ${showRadius
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-400/30'
                  : 'bg-white/95 hover:bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-300/80 shadow-2xs hover:shadow-xs'
                  }`}
                aria-label="Toggle Radius Buffer Ring"
              >
                <CircleDashed size={16} weight={showRadius ? 'fill' : 'bold'} />
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-xl bg-zinc-950/95 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/layer-btn:opacity-100 pointer-events-none shadow-xl transition-all duration-150 z-50 border border-white/10">
                Radius Ring: {showRadius ? 'Visible' : 'Hidden'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inspected Venue / Place Rich Card with Google API Images Gallery */}
      {inspectedPlace && (() => {
        const pPos = getScreenPos(inspectedPlace.lat, inspectedPlace.lng);
        const cardX = Math.max(180, Math.min(dimensions.width - 180, pPos.x));
        const isNearTop = pPos.y < 360;
        const isNearLeft = cardX < 210;
        const isNearRight = cardX > dimensions.width - 210;

        const verticalClass = isNearTop ? 'top-6' : 'bottom-6';
        const horizontalClass = isNearLeft ? 'left-6' : isNearRight ? 'right-6' : 'left-1/2 -translate-x-1/2';

        const placeKey = inspectedPlace.id || inspectedPlace.label || inspectedPlace.name;
        const details = placeDetailsCache[placeKey] || null;
        const rawPhotos: string[] = Array.isArray(details?.photo_urls)
          ? details.photo_urls
          : (details?.photo_url ? [details.photo_url] : []);
        const photos = rawPhotos.map(resolvePlacePhotoUrl);
        const currentPhoto = photos[placeActivePhotoIdx] || (photos.length > 0 ? photos[0] : null);

        const isBar = inspectedPlace.isBar || inspectedPlace.base_db !== undefined;
        const iconType = inspectedPlace.iconType || (isBar ? 'bar' : (inspectedPlace.category || 'general'));
        const isCafe = iconType === 'cafe';
        const isGym = iconType === 'gym';
        const isShop = iconType === 'shop';
        const isBeach = iconType === 'beach' || iconType === 'surf';
        const isTrail = iconType === 'trail';

        const categoryTitle = isBar
          ? 'Bar & Dining Hotspot'
          : isCafe
          ? 'Cafe & Bakery'
          : isGym
          ? 'Fitness & Gym'
          : isShop
          ? 'Shopping & Retail'
          : isBeach
          ? 'Beach & Coastal Spot'
          : isTrail
          ? 'Trailhead & Scenic Walk'
          : 'Location Amenity';

        const placeThemeBorder = isBar
          ? 'border-rose-500/35'
          : isCafe
          ? 'border-orange-500/35'
          : isGym
          ? 'border-amber-500/35'
          : isShop
          ? 'border-emerald-500/35'
          : isBeach
          ? 'border-cyan-500/35'
          : 'border-indigo-500/35';

        const placeBadgeClass = isBar
          ? 'border-rose-500/40 text-rose-300'
          : isCafe
          ? 'border-orange-500/40 text-orange-300'
          : isGym
          ? 'border-amber-500/40 text-amber-300'
          : isShop
          ? 'border-emerald-500/40 text-emerald-300'
          : isBeach
          ? 'border-cyan-500/40 text-cyan-300'
          : 'border-indigo-500/40 text-indigo-300';

        const placeName = details?.name || inspectedPlace.label || inspectedPlace.shortName || inspectedPlace.name;
        const placeAddress = details?.formatted_address || inspectedPlace.target_place || inspectedPlace.label || inspectedPlace.name;

        return (
          <div
            key={`place-preview-${placeKey}`}
            className={`absolute z-[95] ${verticalClass} ${horizontalClass} w-84 sm:w-96 rounded-2xl bg-zinc-950/95 backdrop-blur-xl text-white border ${placeThemeBorder} shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header / Hero Photo Carousel */}
            <div className="relative h-48 w-full bg-zinc-900 overflow-hidden group/gallery">
              {isLoadingPlaceDetails && !currentPhoto ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 gap-2">
                  <div className={`w-6 h-6 border-2 ${isBar ? 'border-rose-500' : isCafe ? 'border-orange-500' : isGym ? 'border-amber-500' : 'border-indigo-500'} border-t-transparent rounded-full animate-spin`} />
                  <span className="text-[11px] font-semibold text-zinc-400">Loading Google Place Photos...</span>
                </div>
              ) : currentPhoto ? (
                <>
                  <img
                    src={currentPhoto}
                    alt={placeName}
                    className="w-full h-full object-cover transition-all duration-300 group-hover/gallery:scale-105"
                  />
                  {/* Photo Counter Pill */}
                  {photos.length > 1 && (
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-black/75 backdrop-blur-md border border-white/20 text-white flex items-center gap-1.5 z-10 shadow-md">
                      <Camera size={12} className={isBar ? 'text-rose-400' : isCafe ? 'text-orange-400' : isGym ? 'text-amber-400' : 'text-indigo-400'} />
                      <span>{placeActivePhotoIdx + 1} / {photos.length} Google Photos</span>
                    </div>
                  )}

                  {/* Carousel Left / Right Arrows */}
                  {photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlaceActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer shadow-lg hover:scale-110 opacity-80 hover:opacity-100 z-10"
                        title="Previous photo"
                      >
                        <CaretLeft size={16} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlaceActivePhotoIdx((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer shadow-lg hover:scale-110 opacity-80 hover:opacity-100 z-10"
                        title="Next photo"
                      >
                        <CaretRight size={16} weight="bold" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-zinc-900 via-zinc-900 to-zinc-950 text-zinc-400">
                  {isBar ? (
                    <Wine size={38} className="text-rose-400/70 mb-1" />
                  ) : isCafe ? (
                    <CoffeeLucide size={38} className="text-orange-400/70 mb-1" />
                  ) : isGym ? (
                    <Dumbbell size={38} className="text-amber-400/70 mb-1" />
                  ) : isShop ? (
                    <ShoppingBag size={38} className="text-emerald-400/70 mb-1" />
                  ) : isBeach ? (
                    <Waves size={38} weight="fill" className="text-cyan-400/70 mb-1" />
                  ) : isTrail ? (
                    <Tree size={38} weight="fill" className="text-emerald-400/70 mb-1" />
                  ) : (
                    <Target size={38} weight="bold" className="text-indigo-400/70 mb-1" />
                  )}
                  <span className="text-xs font-semibold">{placeName}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent pointer-events-none" />

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setInspectedPlace(null)}
                className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer shadow-lg hover:scale-110 z-10"
                title="Close place card"
              >
                <X size={14} weight="bold" />
              </button>

              {/* Category Badge */}
              <div className={`absolute bottom-2.5 left-3 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/80 backdrop-blur-md border ${placeBadgeClass} z-10`}>
                {isBar ? (
                  <Wine size={11} className="text-rose-400" />
                ) : isCafe ? (
                  <CoffeeLucide size={11} className="text-orange-400" />
                ) : isGym ? (
                  <Dumbbell size={11} className="text-amber-400" />
                ) : isShop ? (
                  <ShoppingBag size={11} className="text-emerald-400" />
                ) : isBeach ? (
                  <Waves size={11} weight="fill" className="text-cyan-400" />
                ) : isTrail ? (
                  <Tree size={11} weight="fill" className="text-emerald-400" />
                ) : (
                  <Target size={11} weight="bold" className="text-indigo-400" />
                )}
                <span>{categoryTitle}</span>
              </div>

              {/* Star Rating Badge */}
              {details?.rating && (
                <div className="absolute bottom-2.5 right-3 flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black bg-amber-400 text-zinc-950 shadow-md z-10">
                  <span>★</span>
                  <span>{details.rating}</span>
                  {details.user_ratings_total && (
                    <span className="text-[9px] font-bold opacity-80">({details.user_ratings_total.toLocaleString()})</span>
                  )}
                </div>
              )}
            </div>

            {/* Thumbnail Strip (if multiple photos) */}
            {photos.length > 1 && (
              <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 overflow-x-auto scrollbar-none bg-zinc-950/60 border-b border-white/5">
                {photos.slice(0, 8).map((p, idx) => (
                  <button
                    key={`place-thumb-${idx}`}
                    type="button"
                    onClick={() => setPlaceActivePhotoIdx(idx)}
                    className={`relative w-12 h-9 rounded-lg overflow-hidden shrink-0 border transition-all cursor-pointer ${idx === placeActivePhotoIdx ? `${isBar ? 'border-rose-400 ring-rose-500/50' : isCafe ? 'border-orange-400 ring-orange-500/50' : 'border-indigo-400 ring-indigo-500/50'} ring-2 scale-105` : 'border-white/10 opacity-60 hover:opacity-100'}`}
                  >
                    <img src={p} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Venue Details Body */}
            <div className="p-3.5 space-y-2.5">
              <div>
                <h4 className="text-base font-extrabold text-white leading-snug tracking-tight">
                  {placeName}
                </h4>
                <p className="text-[12px] text-zinc-300 line-clamp-2 mt-0.5 leading-relaxed flex items-start gap-1">
                  <MapPin size={13} className={isBar ? 'text-rose-400' : isCafe ? 'text-orange-400' : isGym ? 'text-amber-400' : 'text-indigo-400'} />
                  <span>{placeAddress}</span>
                </p>
              </div>

              {/* Acoustic & Noise Context OR Commute Proximity */}
              {isBar && inspectedPlace.base_db !== undefined ? (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-950/40 border border-rose-500/30 text-[11px]">
                  <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-black text-[10px] shrink-0">
                    {inspectedPlace.base_db} dB
                  </span>
                  <span className="text-zinc-300 text-[11px] leading-snug">
                    {inspectedPlace.desc || `${inspectedPlace.radius_m || 100}m acoustic dispersion zone`}
                  </span>
                </div>
              ) : selectedProp ? (() => {
                const distKm = calculateDrivingDistanceKm(selectedProp.lat, selectedProp.lng, inspectedPlace.lat, inspectedPlace.lng);
                const isWalking = inspectedPlace.commute_mode === 'walking' || (inspectedPlace.commute_mode !== 'driving' && distKm <= 1.2);
                const durMins = isWalking
                  ? Math.max(1, Math.round((distKm / 4.8) * 60))
                  : calculateDrivingDurationMins(distKm);
                const modeLabel = isWalking ? 'walk' : 'drive';

                return (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900 border border-white/10 text-[11px]">
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-bold text-[10px] shrink-0 flex items-center gap-1">
                      {isWalking ? <PersonSimpleWalk size={12} weight="bold" /> : <Car size={12} weight="fill" />}
                      <span>~{durMins} mins {modeLabel}</span>
                    </span>
                    <span className="text-zinc-300 text-[11px] leading-snug truncate">
                      {distKm} km from #{selectedProp.rank || ''} {selectedProp.title}
                    </span>
                  </div>
                );
              })() : null}

              {/* Opening Hours / Status */}
              {details?.opening_hours && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold bg-emerald-950/50 border border-emerald-500/25 px-2.5 py-1.5 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="truncate">{details.opening_hours}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-1.5 flex items-center gap-2 border-t border-white/10">
                <a
                  href={details?.google_maps_url || `https://maps.google.com/?q=${encodeURIComponent(`${placeName} Cape Town`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-white/10 hover:border-white/25 active:scale-95 shadow-sm"
                  title="View on Google Maps"
                >
                  <ArrowSquareOut size={13} weight="bold" />
                  <span>View on Google Maps</span>
                </a>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PropertyMap;
