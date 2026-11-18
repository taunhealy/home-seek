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

export interface GhostListingItem {
  id: string;
  p24_id?: string | null;
  title: string;
  address: string;
  suburb?: string;
  price: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqm?: number | null;
  lat: number;
  lng: number;
  url?: string;
  image?: string;
  first_seen_at?: number | null;
  last_seen_at?: number | null;
}

export interface PropertyMapProps {
  properties: PropertyMapItem[];
  ghostListings?: GhostListingItem[];
  anchors: ProximityAnchor[];
  selectedPropertyId?: string | null;
  selectedAnchorId?: string | null;
  onSelectProperty?: (property: PropertyMapItem) => void;
  onSelectAnchor?: (anchor: ProximityAnchor) => void;
  proximityFilter?: ProximityFilterConfig | null;
  onRadiusChange?: (radiusKm: number) => void;
  withinRadiusFilter?: boolean;
  onToggleWithinRadiusFilter?: (next: boolean) => void;
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
  commentCounts?: Record<string, number>;
  onOpenComments?: (p: PropertyMapItem) => void;
  searchSummary?: {
    minPrice?: string | number;
    maxPrice?: string | number;
    bedrooms?: string;
    suburbsCount?: number;
  };
}

// Convert lat/lng to Web Mercator pixel coordinates
export function project(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = n * ((lng + 180) / 360);
  const latRad = (lat * Math.PI) / 180;
  const y = (n * (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI)) / 2;
  return { x: x * 256, y: y * 256 };
}

// Haversine straight-line distance in km
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
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

export interface DrivingRouteData {
  distanceKm: number;
  durationMins: number;
  distanceText: string;
  durationText: string;
  points: [number, number][]; // [lat, lng] array
}

export const drivingRouteCache = new Map<string, DrivingRouteData>();

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
    lat: -33.918892,
    lng: 18.387432,
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
    lat: -33.922532,
    lng: 18.381131,
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
    lat: -33.929937,
    lng: 18.408129,
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
    name: 'Blondie & Park Road Bars (69 Kloof St, Gardens)',
    shortName: 'Blondie',
    lat: -33.930144,
    lng: 18.411004,
    base_db: 85,
    radius_m: 160,
    type: 'nightlife',
    desc: 'Packed pavement bar crowds at Blondie (69 Kloof St) & Park Rd corner with late-night street spillover.'
  },
  {
    id: 'kloof_aruba_nightlife',
    name: 'Aruba & Café Paradiso (108–110 Kloof St, off Derwent Rd)',
    shortName: 'Aruba & Paradiso',
    lat: -33.934103,
    lng: 18.407182,
    base_db: 84,
    radius_m: 220,
    type: 'nightlife',
    desc: 'Late-night DJ bass & patio crowds at Aruba (108 Kloof St) & Café Paradiso (110 Kloof St), right off Derwent Rd.'
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
    const fullShortName = (bar.shortName || '').toLowerCase().trim();
    // Only match by name if the full venue name appears in the listing text (never generic suburb words like "hout" or "beach")
    const hasNameMatch = fullShortName.length >= 6 && text.includes(fullShortName);

    let distM = 9999;
    if (prop.lat && prop.lng) {
      distM = Math.hypot(prop.lat - bar.lat, (prop.lng - bar.lng) * Math.cos(prop.lat * Math.PI / 180)) * 111320;
    }

    if (distM <= bar.radius_m || (!prop.lat && hasNameMatch)) {
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

