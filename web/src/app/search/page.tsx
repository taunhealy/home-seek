'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MagnifyingGlass, 
  MapPin, 
  Target, 
  ShieldCheck, 
  SlidersHorizontal, 
  House, 
  Buildings, 
  Car, 
  Plus, 
  Trash, 
  CheckCircle, 
  Bell, 
  DeviceMobile, 
  Envelope, 
  ArrowRight,
  Lightning,
  Dog,
  Lock,
  Sparkle,
  ArrowsClockwise,
  Info,
  X,
  SpeakerSimpleSlash,
  NavigationArrow,
  Ruler,
  Compass,
  CircleNotch
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { AreaPillsInput } from '@/components/AreaPillsInput';
import { PlaceAutocompleteInput, PlaceSuggestion } from '@/components/PlaceAutocompleteInput';
import { PropertyMap, PropertyMapItem, ProximityAnchor, ProximityFilterConfig } from '@/components/PropertyMap';
import { resolveLocationCoords, getDistanceKm } from '@/lib/geo';

interface CommuteAnchor {
  id: string;
  label: string;
  target_place: string;
  max_commute_mins: number;
  max_distance_km: number;
  commute_mode: 'driving' | 'transit' | 'walking' | 'bicycling';
}

const PRESET_ANCHORS = [
  { label: 'Work (Amazon River Club HQ)', place: 'Amazon River Club, Observatory', mins: 25, km: 15, mode: 'driving', icon: '💼' },
  { label: 'Kloof Street Cafes', place: 'Kloof Street, Gardens, Cape Town', mins: 10, km: 5, mode: 'walking', icon: '☕' },
  { label: 'Sea Point Promenade', place: 'Sea Point Promenade, Beach Road', mins: 12, km: 5, mode: 'bicycling', icon: '🌊' },
  { label: 'Cape Town CBD', place: 'Cape Town City Bowl', mins: 15, km: 8, mode: 'driving', icon: '🏙️' },
  { label: 'Virgin Active Kloof', place: 'Virgin Active, Kloof Street, Gardens', mins: 10, km: 3, mode: 'walking', icon: '🏋️' },
  { label: 'Camps Bay Beach', place: 'Camps Bay Beach, Cape Town', mins: 15, km: 8, mode: 'driving', icon: '🏖️' },
];

const DEFAULT_SAMPLE_PROPERTIES: PropertyMapItem[] = [
  {
    id: 'prop-gp-1',
    title: '1 Bedroom Apartment in Green Point',
    address: 'Somerset Road, Green Point, Cape Town',
    price: 16500,
    bedrooms: 1,
    bathrooms: 1,
    sqm: 55,
    image: 'https://images.prop24.com/389341421/Crop600x400',
    lat: -33.9085,
    lng: 18.4090,
    rank: 1,
    fit_score: 98,
    noise_risk: 'low'
  },
  {
    id: 'prop-sp-1',
    title: 'Modern Regent Road Apartment',
    address: 'Regent Road, Sea Point, Cape Town',
    price: 16000,
    bedrooms: 1,
    bathrooms: 1,
    sqm: 52,
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80',
    lat: -33.9180,
    lng: 18.3880,
    rank: 2,
    fit_score: 87,
    noise_risk: 'low'
  },
  {
    id: 'prop-kloof-1',
    title: 'Kloof Street Panoramic Flat',
    address: '82 Kloof Street, Gardens, Cape Town',
    price: 17500,
    bedrooms: 1,
    bathrooms: 1,
    sqm: 58,
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80',
    lat: -33.9315,
    lng: 18.4105,
    rank: 3,
    fit_score: 85,
    noise_risk: 'moderate'
  },
  {
    id: 'prop-tb-1',
    title: 'Derwent Road Mountain Haven',
    address: 'Derwent Road, Tamboerskloof, Cape Town',
    price: 18000,
    bedrooms: 1,
    bathrooms: 1,
    sqm: 62,
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80',
    lat: -33.9338,
    lng: 18.4055,
    rank: 4,
    fit_score: 92,
    noise_risk: 'sanctuary'
  },
  {
    id: 'prop-sp-2',
    title: '203 Ocean View Drive',
    address: '203 Ocean View Drive, Sea Point, Cape Town',
    price: 18000,
    bedrooms: 2,
    bathrooms: 1,
    sqm: 65,
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80',
    lat: -33.9160,
    lng: 18.3920,
    rank: 5,
    fit_score: 81,
    noise_risk: 'low'
  },
  {
    id: 'prop-dw-1',
    title: 'De Waterkant Heritage Loft',
    address: 'Waterkant Street, De Waterkant, Cape Town',
    price: 17000,
    bedrooms: 1,
    bathrooms: 1,
    sqm: 50,
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80',
    lat: -33.9160,
    lng: 18.4180,
    rank: 6,
    fit_score: 79,
    noise_risk: 'moderate'
  },
  {
    id: 'prop-or-1',
    title: 'Montrose Avenue Upper Suite',
    address: 'Montrose Ave, Oranjezicht, Cape Town',
    price: 16500,
    bedrooms: 1,
    bathrooms: 1,
    sqm: 54,
    image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&auto=format&fit=crop&q=80',
    lat: -33.9400,
    lng: 18.4190,
    rank: 7,
    fit_score: 88,
    noise_risk: 'sanctuary'
  },
  {
    id: 'prop-cb-1',
    title: '14 Victoria Road Coastal Flat',
    address: '14 Victoria Road, Camps Bay, Cape Town',
    price: 18500,
    bedrooms: 1,
    bathrooms: 1,
    sqm: 48,
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80',
    lat: -33.9515,
    lng: 18.3780,
    rank: 8,
    fit_score: 76,
    noise_risk: 'low'
  }
];

export default function SearchPage() {
  const router = useRouter();
  const { user, profile, loading, login, logout } = useAuth();

  // Search Criteria State - Area Filter Pills
  const [selectedAreas, setSelectedAreas] = useState<string[]>([
    'Green Point', 
    'Sea Point', 
    'Gardens', 
    'Camps Bay'
  ]);
  const locationQuery = selectedAreas.join(', ');

  const [minPrice, setMinPrice] = useState('12000');
  const [maxPrice, setMaxPrice] = useState('18000');
  const [bedrooms, setBedrooms] = useState('1+');
  const [bathrooms, setBathrooms] = useState('1+');

  // Focal Proximity Location & Distance Radius Slider
  const [proximityLocation, setProximityLocation] = useState('Kloof Street, Gardens');
  const [proximityRadiusKm, setProximityRadiusKm] = useState<number>(5.0);

  // Proximity Anchors List
  const [anchors, setAnchors] = useState<CommuteAnchor[]>([
    {
      id: 'anchor-1',
      label: 'Work (Amazon River Club HQ)',
      target_place: 'Amazon River Club, Observatory',
      max_commute_mins: 30,
      max_distance_km: 15,
      commute_mode: 'driving',
    },
    {
      id: 'anchor-2',
      label: 'Kloof Street Cafes',
      target_place: 'Kloof Street, Gardens, Cape Town',
      max_commute_mins: 15,
      max_distance_km: 5,
      commute_mode: 'walking',
    },
  ]);

  const [newAnchorLabel, setNewAnchorLabel] = useState('');
  const [newAnchorPlace, setNewAnchorPlace] = useState('');
  const [newAnchorMins, setNewAnchorMins] = useState('25');
  const [newAnchorMode, setNewAnchorMode] = useState<'driving' | 'walking' | 'bicycling' | 'transit'>('driving');

  // AI Lifestyle & Desires State
  const [aiPrompt, setAiPrompt] = useState(
    "Remote web designer working from home. I enjoy mountain biking, trail running, walking on the beach, flying my FPV drone, and working from a cafe twice a week. I'd like to date and have spontaneous chats with interesting people, occasionally have a friend over, and listen to/make music."
  );
  const [aiPersonalTastes, setAiPersonalTastes] = useState(
    "Acoustic privacy for music, safe storage for my mountain bike, unpretentious vibe, easy walk to lively Kloof Street cafes, decent natural light."
  );

  // Living Autonomy & Privacy Shield Checkboxes
  const [requireIndependentLiving, setRequireIndependentLiving] = useState(true);
  const [requirePrivateEntrance, setRequirePrivateEntrance] = useState(true);
  const [requirePrivateGarden, setRequirePrivateGarden] = useState(false);
  const [excludeLandlordOnSite, setExcludeLandlordOnSite] = useState(true);
  const [excludeSharedHouse, setExcludeSharedHouse] = useState(true);
  const [requireNoOneAbove, setRequireNoOneAbove] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Must-Haves
  const [mustInverter, setMustInverter] = useState(true);
  const [mustFibre, setMustFibre] = useState(true);
  const [mustParking, setMustParking] = useState(true);
  const [mustPets, setMustPets] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [properties, setProperties] = useState<PropertyMapItem[]>(DEFAULT_SAMPLE_PROPERTIES);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(DEFAULT_SAMPLE_PROPERTIES[0].id);

  // Load saved criteria and any existing scouted listings on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('homeseek_search_criteria');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.locationQuery && typeof parsed.locationQuery === 'string') {
          const loadedAreas = parsed.locationQuery.split(',').map((s: string) => s.trim()).filter(Boolean);
          if (loadedAreas.length > 0) setSelectedAreas(loadedAreas);
        }
        if (parsed.minPrice) setMinPrice(parsed.minPrice);
        if (parsed.maxPrice) setMaxPrice(parsed.maxPrice);
        if (parsed.bedrooms) setBedrooms(parsed.bedrooms);
        if (parsed.bathrooms) setBathrooms(parsed.bathrooms);
        if (parsed.proximityLocation) setProximityLocation(parsed.proximityLocation);
        if (parsed.proximityRadiusKm) setProximityRadiusKm(parsed.proximityRadiusKm);
        if (Array.isArray(parsed.anchors) && parsed.anchors.length > 0) setAnchors(parsed.anchors);
      }
    } catch (e) {}

    // Fetch user's latest report properties if available to populate map
    const fetchLatestListings = async () => {
      try {
        const uid = profile?.id || user?.uid || 'taun_test_user';
        const res = await fetch(`http://127.0.0.1:8000/reports/${uid}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && Array.isArray(data.reports) && data.reports.length > 0) {
            const latest = data.reports.find((r: any) => r.ranked_listings && r.ranked_listings.length > 0);
            if (latest && Array.isArray(latest.ranked_listings)) {
              const mapped: PropertyMapItem[] = latest.ranked_listings.map((item: any, idx: number) => {
                const geo = resolveLocationCoords(item.address || item.area || 'Cape Town');
                return {
                  id: item.id || item.listing_id || String(idx),
                  title: item.title,
                  address: item.address,
                  price: item.price || 16500,
                  bedrooms: item.bedrooms || 1,
                  bathrooms: item.bathrooms || 1,
                  sqm: item.sqm || 55,
                  image: item.image || (item.images && item.images[0]) || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&auto=format&fit=crop&q=80',
                  lat: item.lat || geo.lat,
                  lng: item.lng || geo.lng,
                  rank: idx + 1,
                  fit_score: item.fit_score || 88,
                  noise_risk: item.noise_risk || 'low'
                };
              });
              setProperties(mapped);
              if (mapped.length > 0) setSelectedPropertyId(mapped[0].id);
            }
          }
        }
      } catch (err) {}
    };

    fetchLatestListings();
  }, [profile?.id, user?.uid]);

  // Compute geocoded coordinates for chosen proximity location
  const proximityCoords = useMemo(() => {
    return resolveLocationCoords(proximityLocation);
  }, [proximityLocation]);

  // Proximity filter configuration passed to PropertyMap
  const proximityFilterConfig: ProximityFilterConfig = useMemo(() => {
    return {
      lat: proximityCoords.lat,
      lng: proximityCoords.lng,
      radiusKm: proximityRadiusKm,
      label: proximityCoords.label || proximityLocation.split(',')[0].trim() || 'Focal Destination'
    };
  }, [proximityCoords, proximityRadiusKm, proximityLocation]);

  // Filter properties by proximity to chosen location
  const filteredProperties = useMemo(() => {
    return properties.filter((prop) => {
      const dist = getDistanceKm(prop.lat, prop.lng, proximityCoords.lat, proximityCoords.lng);
      return dist <= proximityRadiusKm;
    });
  }, [properties, proximityCoords, proximityRadiusKm]);

  // Convert commute anchors to map anchors
  const mapAnchors: ProximityAnchor[] = useMemo(() => {
    return anchors.map((a, idx) => {
      const geo = resolveLocationCoords(a.target_place || a.label);
      return {
        id: a.id || `anchor-${idx}`,
        label: a.label,
        target_place: a.target_place,
        lat: geo.lat,
        lng: geo.lng,
        max_commute_mins: a.max_commute_mins,
        max_distance_km: a.max_distance_km || 15,
        commute_mode: a.commute_mode
      };
    });
  }, [anchors]);

  // Save criteria and navigate
  const handleSaveAndExplore = async (destination: 'properties' | 'alerts' | 'reports' = 'reports') => {
    setIsSaving(true);
    const uid = profile?.id || user?.uid || 'taun_test_user';

    const criteria = {
      locationQuery,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      proximityLocation,
      proximityRadiusKm,
      privacy: {
        requireIndependentLiving,
        requirePrivateEntrance,
        requirePrivateGarden,
        excludeLandlordOnSite,
        excludeSharedHouse,
        requireNoOneAbove,
      },
      anchors,
      mustInverter,
      mustFibre,
      mustParking,
      mustPets,
    };
    try {
      localStorage.setItem('homeseek_search_criteria', JSON.stringify(criteria));
    } catch (e) {}

    try {
      const primaryArea = locationQuery.split(',')[0].trim() || 'Cape Town';
      const alertPayload = {
        user_id: uid,
        target_area: primaryArea,
        search_query: `AI Radar: ${locationQuery} (${bedrooms} Beds, max R${maxPrice}, ${proximityRadiusKm}km from ${proximityLocation})`,
        max_price: parseInt(maxPrice) || 30000,
        min_bedrooms: [parseInt(bedrooms.replace("+", "")) || 1],
        property_type: 'Apartment',
        require_verified_sea_view: /\b(sea\s+view|ocean\s+view|water\s+view)\b/i.test(`${aiPrompt} ${aiPersonalTastes}`),
        require_independent_living: requireIndependentLiving,
        require_private_entrance: requirePrivateEntrance,
        require_private_garden: requirePrivateGarden,
        exclude_landlord_on_site: excludeLandlordOnSite,
        exclude_shared_house: excludeSharedHouse,
        require_no_one_above: requireNoOneAbove,
        pet_friendly: mustPets,
        commute_anchors: anchors,
        proximity_location: proximityLocation,
        max_distance_km: proximityRadiusKm,
        prompt: aiPrompt,
        personal_tastes: aiPersonalTastes,
        areas: selectedAreas,
        alert_enabled: true,
        is_active: true,
        trigger_initial_scan: true,
      };

      await fetchWithAuth('/save-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertPayload),
      });
    } catch (err) {
      console.warn('Backend alert save warning:', err);
    } finally {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => {
        if (destination === 'reports') {
          router.push('/reports');
        } else if (destination === 'alerts') {
          router.push('/alerts');
        } else {
          router.push(`/properties?search=${encodeURIComponent(locationQuery.split(',')[0].trim())}`);
        }
      }, 500);
    }
  };

  const addAnchor = () => {
    if (!newAnchorLabel.trim() || !newAnchorPlace.trim()) return;
    const newAnchor: CommuteAnchor = {
      id: `anchor-${Date.now()}`,
      label: newAnchorLabel,
      target_place: newAnchorPlace,
      max_commute_mins: parseInt(newAnchorMins) || 30,
      max_distance_km: proximityRadiusKm || 15,
      commute_mode: newAnchorMode,
    };
    setAnchors([...anchors, newAnchor]);
    setNewAnchorLabel('');
    setNewAnchorPlace('');
  };

  const removeAnchor = (id: string) => {
    setAnchors(anchors.filter((a) => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd] text-zinc-900 font-sans flex flex-col pt-16">
      <Navbar 
        user={user} 
        profile={profile} 
        loading={loading}
        handleLogin={login} 
        handleLogout={logout} 
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header with Quick Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-xs font-semibold">
              <Target size={14} weight="bold" className="text-indigo-600" />
              <span>Search Radar & Proximity Setup</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
              Define Your Search Criteria
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 max-w-2xl leading-relaxed">
              Configure your target locations, proximity distance radius, and privacy rules. 
              The live map on the right plots your radius buffer zone in real time.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleSaveAndExplore('reports')}
              disabled={isSaving}
              className="px-5 py-2.5 bg-zinc-950 hover:bg-black text-white text-xs font-bold rounded-2xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer active:scale-98"
            >
              {isSaving ? <CircleNotch size={14} className="animate-spin" /> : <Sparkle size={14} weight="fill" className="text-amber-400" />}
              <span>Save & View Reports</span>
            </button>
          </div>
        </div>

        {/* 2-Column Responsive Layout: Form on Left, Sticky Map on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
          
          {/* LEFT COLUMN: CRITERIA FORM SECTIONS */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-6">
            
            {/* 1. Target Locations & Budget */}
            <section className="bg-white border border-zinc-200/90 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xs">
              <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <MapPin size={18} weight="bold" className="text-zinc-800" />
                <span>Target Suburbs & Budget Window</span>
              </h2>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      Target Suburbs
                    </label>
                    <span className="text-[11px] text-zinc-500 font-medium">
                      {selectedAreas.length} selected
                    </span>
                  </div>
                  <AreaPillsInput
                    selectedAreas={selectedAreas}
                    onChange={setSelectedAreas}
                    placeholder="Type suburb (e.g. Green Point, Sea Point)..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                      Min Price (ZAR)
                    </label>
                    <input
                      type="number"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="12000"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-950 focus:bg-white transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                      Max Price (ZAR)
                    </label>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="18000"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-950 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                      Bedrooms
                    </label>
                    <div className="flex gap-2">
                      {['1+', '2+', '3+', '4+'].map((b) => {
                        const isSelected = bedrooms === b || bedrooms === b.replace('+', '');
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setBedrooms(b)}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs font-bold'
                                : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                            }`}
                          >
                            {b}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                      Bathrooms
                    </label>
                    <div className="flex gap-2">
                      {['1+', '2+', '3+'].map((bath) => {
                        const isSelected = bathrooms === bath || bathrooms === bath.replace('+', '');
                        return (
                          <button
                            key={bath}
                            type="button"
                            onClick={() => setBathrooms(bath)}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs font-bold'
                                : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                            }`}
                          >
                            {bath}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. PROXIMITY LOCATION & DISTANCE RADIUS SLIDER (CORE FEATURE) */}
            <section className="bg-white border-2 border-indigo-500/30 rounded-3xl p-6 sm:p-7 space-y-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                    <Target size={20} weight="bold" className="text-indigo-600" />
                    <span>Proximity to Location & Distance Radius</span>
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Choose a focal landmark, workplace or beach and slide the radius. The interactive map plots your buffer zone in real time.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-xs shrink-0 border border-indigo-200">
                  {proximityRadiusKm} km Buffer
                </span>
              </div>

              {/* Location Input with Google Maps Autocomplete */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                  Focal Location (Destination / Workplace / Landmark)
                </label>
                <PlaceAutocompleteInput
                  value={proximityLocation}
                  onChange={(val) => setProximityLocation(val)}
                  onSelectSuggestion={(s) => {
                    setProximityLocation(s.description);
                  }}
                  placeholder="Type address or landmark (e.g. Kloof St, Sea Point Promenade)..."
                />

                {/* Popular Location Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className="text-zinc-500 text-[11px] font-semibold mr-1">Quick Select:</span>
                  {PRESET_ANCHORS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setProximityLocation(preset.place);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 hover:text-zinc-950 text-[11px] font-medium transition-all cursor-pointer shadow-2xs"
                    >
                      <span>{preset.icon}</span>
                      <span>{preset.label.split('(')[0].trim()}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Distance Radius Slider */}
              <div className="space-y-3 pt-3 border-t border-zinc-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Ruler size={14} weight="bold" className="text-indigo-600" />
                    <span>Distance Radius Slider</span>
                  </span>
                  <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                    Within {proximityRadiusKm} km
                  </span>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={proximityRadiusKm}
                    onChange={(e) => setProximityRadiusKm(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 h-2 bg-zinc-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-zinc-400 px-0.5">
                    <span>1 km</span>
                    <span>5 km</span>
                    <span>10 km</span>
                    <span>15 km</span>
                    <span>20 km</span>
                  </div>
                </div>

                {/* Radius Quick Presets */}
                <div className="flex items-center gap-2 pt-1">
                  {[2, 3, 5, 8, 12, 15].map((km) => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => setProximityRadiusKm(km)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        proximityRadiusKm === km
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                      }`}
                    >
                      {km} km
                    </button>
                  ))}
                </div>

                {/* Live Real-Time Match Counter */}
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs text-indigo-950 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle size={15} weight="bold" className="text-indigo-600" />
                    <span>Live Proximity Filter:</span>
                  </span>
                  <span className="font-extrabold bg-white px-2.5 py-0.5 rounded-lg border border-indigo-200 shadow-2xs">
                    {filteredProperties.length} properties inside {proximityRadiusKm} km ring
                  </span>
                </div>
              </div>
            </section>

            {/* 3. Additional Commute Anchors */}
            <section className="bg-white border border-zinc-200/90 rounded-3xl p-6 sm:p-7 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                    <Compass size={18} weight="bold" className="text-zinc-800" />
                    <span>Commute Time Anchors</span>
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Secondary destinations plotted on the map with estimated driving & walking duration.
                  </p>
                </div>
              </div>

              {/* Anchors List */}
              <div className="space-y-2">
                {anchors.map((anchor) => (
                  <div
                    key={anchor.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/90 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold">
                        <Target size={14} weight="bold" />
                      </div>
                      <div>
                        <span className="font-bold text-zinc-950 block">{anchor.label}</span>
                        <span className="text-[11px] text-zinc-500 block truncate max-w-xs">{anchor.target_place}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-zinc-600 font-semibold text-[11px]">
                        ~{anchor.max_commute_mins} mins
                      </span>
                      <button
                        onClick={() => removeAnchor(anchor.id)}
                        className="p-1 text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Remove anchor"
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Anchor */}
              <div className="pt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Add label (e.g. Gym, Client Office)..."
                  value={newAnchorLabel}
                  onChange={(e) => setNewAnchorLabel(e.target.value)}
                  className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950"
                />
                <input
                  type="text"
                  placeholder="Address or suburb..."
                  value={newAnchorPlace}
                  onChange={(e) => setNewAnchorPlace(e.target.value)}
                  className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950"
                />
                <button
                  type="button"
                  onClick={addAnchor}
                  className="px-4 py-2 bg-zinc-950 hover:bg-black text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
                >
                  Add Anchor
                </button>
              </div>
            </section>

            {/* 4. Living Autonomy & Privacy Shield */}
            <section className="bg-white border border-zinc-200/90 rounded-3xl p-6 sm:p-7 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <ShieldCheck size={18} weight="bold" className="text-zinc-800" />
                  <span>Living Autonomy & Acoustic Privacy</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setIsPrivacyModalOpen(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  Learn how this works
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="flex items-center gap-2.5 p-3 rounded-2xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireIndependentLiving}
                    onChange={(e) => setRequireIndependentLiving(e.target.checked)}
                    className="w-4 h-4 rounded text-zinc-950 accent-zinc-950 cursor-pointer"
                  />
                  <span className="font-bold text-zinc-900">Independent Living Only</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeLandlordOnSite}
                    onChange={(e) => setExcludeLandlordOnSite(e.target.checked)}
                    className="w-4 h-4 rounded text-zinc-950 accent-zinc-950 cursor-pointer"
                  />
                  <span className="font-bold text-zinc-900">No Landlord On-Site</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeSharedHouse}
                    onChange={(e) => setExcludeSharedHouse(e.target.checked)}
                    className="w-4 h-4 rounded text-zinc-950 accent-zinc-950 cursor-pointer"
                  />
                  <span className="font-bold text-zinc-900">Exclude Communes & Digs</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requirePrivateEntrance}
                    onChange={(e) => setRequirePrivateEntrance(e.target.checked)}
                    className="w-4 h-4 rounded text-zinc-950 accent-zinc-950 cursor-pointer"
                  />
                  <span className="font-bold text-zinc-900">Private Entrance</span>
                </label>
              </div>
            </section>

            {/* Save & Trigger Radar Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleSaveAndExplore('reports')}
                disabled={isSaving}
                className="w-full py-4 bg-zinc-950 hover:bg-black text-white text-sm font-extrabold rounded-2xl transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isSaving ? <CircleNotch size={18} className="animate-spin" /> : <Sparkle size={18} weight="fill" className="text-amber-400" />}
                <span>Save Radar & Launch Executive Intelligence Report</span>
                <ArrowRight size={16} weight="bold" />
              </button>
            </div>

          </div>

          {/* RIGHT COLUMN: STICKY INTERACTIVE MAP (SEARCH CRITERIA RADAR MODE) */}
          <div className="w-full lg:col-span-6 xl:col-span-5 sticky top-24 h-[calc(100vh-120px)] rounded-3xl overflow-hidden border border-zinc-200 shadow-md bg-zinc-100 flex flex-col">
            <PropertyMap
              mode="search"
              selectedSuburbs={selectedAreas}
              searchSummary={{
                minPrice,
                maxPrice,
                bedrooms,
                suburbsCount: selectedAreas.length,
              }}
              properties={[]}
              anchors={mapAnchors}
              proximityFilter={proximityFilterConfig}
              onRadiusChange={setProximityRadiusKm}
              className="w-full h-full rounded-3xl"
            />
          </div>

        </div>
      </main>

      {/* Privacy Info Modal */}
      {isPrivacyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2 text-zinc-950 font-black text-sm">
                <ShieldCheck size={18} className="text-indigo-600" weight="bold" />
                <span>Forensic Living Autonomy Protocol</span>
              </div>
              <button
                onClick={() => setIsPrivacyModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              HomeSeek analyzes listing wording, photos, floor plans, and architectural elevation to ensure you are not placed in a shared house, under a noisy landlord, or in a compromised room.
            </p>
            <button
              onClick={() => setIsPrivacyModalOpen(false)}
              className="w-full py-2.5 bg-zinc-950 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
