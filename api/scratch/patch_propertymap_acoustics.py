import re

path = 'web/src/components/PropertyMap.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update phosphor-icons import
if 'SpeakerHigh' not in content:
    content = content.replace(
        "  MapTrifold\n} from '@phosphor-icons/react';",
        "  MapTrifold,\n  SpeakerHigh,\n  ShieldCheck,\n  ShieldWarning,\n  Waveform\n} from '@phosphor-icons/react';"
    )

# 2. Add AcousticAudit interface and update PropertyMapItem
if 'export interface AcousticAudit' not in content:
    acoustic_interface = """export interface AcousticAudit {
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
  lat: number;
  lng: number;
  source_platform?: string;
  is_favorite?: boolean;
  rank?: number;
  fit_score?: number;
  noise_risk?: string;
  noise_reason?: string | null;
  location_proximity?: any[];
  acoustic_audit?: AcousticAudit;
}"""
    target = """export interface PropertyMapItem {
  id: string;
  title: string;
  address: string;
  price: number;
  currency?: string;
  bedrooms: number;
  bathrooms: number;
  sqm?: number;
  image: string;
  lat: number;
  lng: number;
  source_platform?: string;
  is_favorite?: boolean;
  rank?: number;
  fit_score?: number;
  noise_risk?: string;
  noise_reason?: string | null;
  location_proximity?: any[];
}"""
    content = content.replace(target, acoustic_interface)

# 3. Add Calibrated Hotspots & Sanctuaries constants before component
constants = """// Cape Town Calibrated Noise Hotspots & Verified Sanctuary Enclaves
export const CAPE_TOWN_HOTSPOTS = [
  {
    id: 'kloof_aruba_nightlife',
    name: 'Kloof & Malan St (Aruba, Paradiso)',
    lat: -33.9323,
    lng: 18.4108,
    base_db: 84,
    radius_m: 220,
    type: 'nightlife',
    desc: 'Late-night DJ bass & patio crowds down Malan St waveguide'
  },
  {
    id: 'somerset_greenpoint_strip',
    name: 'Somerset Road Strip (Green Point)',
    lat: -33.9090,
    lng: 18.4110,
    base_db: 82,
    radius_m: 250,
    type: 'nightlife',
    desc: 'Sports bars, outdoor patios & evening crowd buzz'
  },
  {
    id: 'main_road_seapoint',
    name: 'Main Road Commercial (Sea Point)',
    lat: -33.9175,
    lng: 18.3880,
    base_db: 78,
    radius_m: 220,
    type: 'transit',
    desc: 'Buses, delivery scooters & late grocery traffic'
  },
  {
    id: 'bree_long_cbd',
    name: 'Bree & Long Street Spine',
    lat: -33.9220,
    lng: 18.4175,
    base_db: 86,
    radius_m: 300,
    type: 'nightlife',
    desc: 'High-decibel clubs & street revellers until 03:00'
  },
  {
    id: 'mill_buitenkant_transit',
    name: 'Mill St & Buitenkant Transit Canyon',
    lat: -33.9305,
    lng: 18.4140,
    base_db: 77,
    radius_m: 190,
    type: 'transit',
    desc: 'Dual carriageway transit & 24hr petrol idling'
  },
  {
    id: 'helen_suzman_blvd',
    name: 'Helen Suzman Blvd Highway',
    lat: -33.9050,
    lng: 18.4120,
    base_db: 76,
    radius_m: 160,
    type: 'highway',
    desc: 'Fast arterial road & stadium event traffic'
  }
];

export const CAPE_TOWN_SANCTUARIES = [
  {
    id: 'upper_tamboerskloof',
    name: 'Upper Tamboerskloof (Lion\\'s Head)',
    lat: -33.9365,
    lng: 18.4015,
    radius_m: 450,
    ambient_db: 36,
    desc: 'Cul-de-sacs behind Lion\\'s Head ridge with zero bar noise'
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
"""

if 'export const CAPE_TOWN_HOTSPOTS' not in content:
    content = content.replace("export const PropertyMap: React.FC<PropertyMapProps> = ({", constants + "\nexport const PropertyMap: React.FC<PropertyMapProps> = ({")

# 4. Add state for showNoiseRadar
if 'showNoiseRadar' not in content:
    content = content.replace(
        "  const [showRadius, setShowRadius] = useState(true);",
        "  const [showRadius, setShowRadius] = useState(true);\n  const [showNoiseRadar, setShowNoiseRadar] = useState(true);"
    )

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Stage 1 PropertyMap patch applied.")

