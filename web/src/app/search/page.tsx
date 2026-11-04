'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { 
  MagnifyingGlass, 
  MapPin, 
  Target, 
  ShieldCheck, 
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
  ArrowSquareOut,
  Sliders,
  Tree,
  Waves,
  Coffee,
  Bicycle,
  Eye,
  Check
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { PropertyMap, PropertyMapItem, ProximityAnchor, ProximityFilterConfig } from '@/components/PropertyMap';
import { resolveLocationCoords, getDistanceKm } from '@/lib/geo';

// Deterministic number formatting to avoid SSR/client locale hydration mismatch
function formatPrice(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

interface CommuteAnchor extends ProximityAnchor {
  iconType?: 'trail' | 'surf' | 'cafe' | 'work' | 'general';
}

const PRESET_TRAILHEADS_AND_HUBS: CommuteAnchor[] = [
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
  },
  {
    id: 'trail-tokai',
    label: 'Tokai Forest MTB Trails',
    target_place: 'Tokai MTB Trail Centre, Tokai Forest',
    lat: -34.0580,
    lng: 18.4310,
    max_commute_mins: 20,
    max_distance_km: 12,
    commute_mode: 'driving',
    iconType: 'trail',
  },
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
  },
  {
    id: 'surf-muizenberg',
    label: 'Muizenberg Surfers Corner',
    target_place: 'Surfers Corner, Beach Road, Muizenberg',
    lat: -34.1080,
    lng: 18.4720,
    max_commute_mins: 25,
    max_distance_km: 15,
    commute_mode: 'driving',
    iconType: 'surf',
  },
  {
    id: 'hub-kloof',
    label: 'Kloof Street Cafes',
    target_place: 'Kloof Street, Gardens, Cape Town',
    lat: -33.9315,
    lng: 18.4110,
    max_commute_mins: 15,
    max_distance_km: 6,
    commute_mode: 'driving',
    iconType: 'cafe',
  },
];

const INITIAL_SHOWCASE_PROPERTIES: PropertyMapItem[] = [
  {
    id: 'p24-117112383',
    title: 'Character 2-Bed with Sunroom Study & Garage',
    address: '9 Highstead Rd, Upper Rondebosch',
    price: 15900,
    bedrooms: 2,
    bathrooms: 1,
    sqm: 78,
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80',
    lat: -33.9635,
    lng: 18.4720,
    rank: 1,
    fit_score: 98,
    noise_risk: 'sanctuary',
    url: 'https://www.property24.com/to-rent/rondebosch/cape-town/western-cape/8682/117112383',
    acoustic_audit: {
      estimated_db: 36,
      sound_shadow_status: 'Deep Acoustic Sanctuary (Shielded Garden Grove)',
      facing_direction: 'North / Mountain Foliage'
    }
  },
  {
    id: 'p24-117782499',
    title: 'Modern 1-Bed with 65m² Wrap-Around Balcony',
    address: 'A Block Woodstock Quarter, 187 Sir Lowry Road',
    price: 15000,
    bedrooms: 1,
    bathrooms: 1,
    sqm: 43,
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80',
    lat: -33.9310,
    lng: 18.4480,
    rank: 2,
    fit_score: 91,
    noise_risk: 'low',
    url: 'https://www.property24.com/to-rent/woodstock/cape-town/western-cape/10164/117782499',
    acoustic_audit: {
      estimated_db: 48,
      sound_shadow_status: 'Double Glazed Acoustic Insulation',
      facing_direction: 'North / City Skyline'
    }
  },
  {
    id: 'p24-117775782',
    title: 'Tokai Villas Mountain View Top-Floor Unit',
    address: '5 Tokai Road, Tokai',
    price: 11800,
    bedrooms: 1,
    bathrooms: 1,
    sqm: 40,
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80',
    lat: -34.0580,
    lng: 18.4310,
    rank: 3,
    fit_score: 95,
    noise_risk: 'sanctuary',
    url: 'https://www.property24.com/to-rent/tokai/cape-town/western-cape/9044/117775782',
    acoustic_audit: {
      estimated_db: 38,
      sound_shadow_status: 'Surrounded by Pine Trees & Greenbelts',
      facing_direction: 'West / Constantiaberg'
    }
  },
  {
    id: 'p24-george-1',
    title: 'Heatherlands Garden Residence with Double Garage',
    address: 'Heatherlands, Outeniqua Mountain Foothills, George',
    price: 13500,
    bedrooms: 2,
    bathrooms: 2,
    sqm: 95,
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
    lat: -33.9520,
    lng: 22.4510,
    rank: 4,
    fit_score: 99,
    noise_risk: 'sanctuary',
    url: 'https://www.property24.com/to-rent/george/western-cape/321',
    acoustic_audit: {
      estimated_db: 32,
      sound_shadow_status: 'Pristine Mountain Quiet (Pin-Drop Silence)',
      facing_direction: 'North / Outeniqua Peaks'
    }
  }
];

const QUICK_SUBURBS = [
  'Rondebosch',
  'George',
  'Tamboerskloof',
  'Wilderness',
  'Newlands',
  'Tokai',
  'Gardens',
  'Woodstock'
];

export default function SearchMapPage() {
  const { user, profile, logout } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Search Criteria State
  const [selectedSuburbs, setSelectedSuburbs] = useState<string[]>(['Rondebosch', 'George']);
  const [suburbInput, setSuburbInput] = useState('');
  const [minPrice, setMinPrice] = useState('11000');
  const [maxPrice, setMaxPrice] = useState('18000');
  const [bedrooms, setBedrooms] = useState('1+');

  // Desirable Locations & Trailheads State
  const [anchors, setAnchors] = useState<CommuteAnchor[]>(PRESET_TRAILHEADS_AND_HUBS);
  const [activeAnchorId, setActiveAnchorId] = useState<string>('trail-newlands');
  const [isAnchorMenuOpen, setIsAnchorMenuOpen] = useState(false);
  const [newAnchorLabel, setNewAnchorLabel] = useState('');
  const [newAnchorPlace, setNewAnchorPlace] = useState('');

  // Live Scraped Properties State
  const [properties, setProperties] = useState<PropertyMapItem[]>(INITIAL_SHOWCASE_PROPERTIES);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>('p24-117112383');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStatusText, setScrapeStatusText] = useState('');
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'distance' | 'fit'>('fit');

  const activeAnchor = useMemo(() => {
    return anchors.find(a => a.id === activeAnchorId) || anchors[0] || null;
  }, [anchors, activeAnchorId]);

  // Suburb management
  const handleAddSuburb = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!selectedSuburbs.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedSuburbs([...selectedSuburbs, trimmed]);
    }
    setSuburbInput('');
  };

  const handleRemoveSuburb = (name: string) => {
    setSelectedSuburbs(selectedSuburbs.filter(s => s.toLowerCase() !== name.toLowerCase()));
  };

  // Add custom desirable location
  const handleAddCustomAnchor = () => {
    if (!newAnchorLabel.trim()) return;
    const resolved = resolveLocationCoords(newAnchorPlace || newAnchorLabel);
    const newAnchor: CommuteAnchor = {
      id: `custom-${Date.now()}`,
      label: newAnchorLabel.trim(),
      target_place: newAnchorPlace.trim() || newAnchorLabel.trim(),
      lat: resolved ? resolved.lat : -33.9500,
      lng: resolved ? resolved.lng : 18.4400,
      max_commute_mins: 20,
      max_distance_km: 12,
      commute_mode: 'driving',
      iconType: 'general'
    };
    setAnchors([newAnchor, ...anchors]);
    setActiveAnchorId(newAnchor.id);
    setNewAnchorLabel('');
    setNewAnchorPlace('');
    setIsAnchorMenuOpen(false);
  };

  // Scrape Property24 Live Action
  const handleScrapeP24 = async () => {
    if (selectedSuburbs.length === 0) {
      alert('Please select at least one suburb to scrape.');
      return;
    }

    setIsScraping(true);
    setScrapeStatusText(`Scraping Property24 live for ${selectedSuburbs.join(', ')}...`);

    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const payload = {
        suburbs: selectedSuburbs,
        min_price: parseInt(minPrice) || 0,
        max_price: parseInt(maxPrice) || 999999,
        bedrooms: bedrooms,
        anchor_lat: activeAnchor ? activeAnchor.lat : null,
        anchor_lng: activeAnchor ? activeAnchor.lng : null
      };

      const res = await fetch(`${backendBase}/api/search/live-scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.listings) && data.listings.length > 0) {
          const mapped: PropertyMapItem[] = data.listings.map((item: any, idx: number) => ({
            id: item.id || `p24-${idx}`,
            title: item.title,
            address: item.address,
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
            url: item.url,
            acoustic_audit: {
              estimated_db: item.noise_risk === 'sanctuary' ? 34 : 45,
              sound_shadow_status: item.noise_risk === 'sanctuary' ? 'Acoustic Sanctuary (Forest/Quiet Grove)' : 'Standard Residential Quiet',
              facing_direction: 'North / Scenic'
            }
          }));

          setProperties(mapped);
          setSelectedPropertyId(mapped[0].id);
          setScrapeStatusText(`Found ${mapped.length} live listings from Property24!`);
        } else {
          setScrapeStatusText('No direct listings matched the price window. Showing curated selections.');
        }
      } else {
        setScrapeStatusText('Live portal connection timed out. Showing cached contenders.');
      }
    } catch (err) {
      console.error('Scrape error:', err);
      setScrapeStatusText('Offline mode: Using cached high-trust properties.');
    } finally {
      setIsScraping(false);
      setTimeout(() => setScrapeStatusText(''), 4500);
    }
  };

  // Sort properties
  const sortedProperties = useMemo(() => {
    return [...properties].sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'fit') return (b.fit_score || 0) - (a.fit_score || 0);
      if (sortBy === 'distance' && activeAnchor) {
        const distA = getDistanceKm(a.lat, a.lng, activeAnchor.lat, activeAnchor.lng);
        const distB = getDistanceKm(b.lat, b.lng, activeAnchor.lat, activeAnchor.lng);
        return distA - distB;
      }
      return 0;
    });
  }, [properties, sortBy, activeAnchor]);

  return (
    <div className="h-screen bg-zinc-50 flex flex-col font-sans select-none overflow-hidden pt-16">
      <Navbar user={user} profile={profile} handleLogout={logout} />

      {/* TOP COMPACT CRITERIA BAR */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-zinc-200 z-30 px-4 py-2.5 shadow-xs shrink-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* 1. Suburb Filter Pills & Quick-Select */}
          <div className="flex items-center flex-wrap gap-1.5 min-w-0 flex-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mr-1 flex items-center gap-1">
              <MapPin size={13} weight="bold" className="text-indigo-600" />
              Areas:
            </span>

            {selectedSuburbs.map((suburb) => (
              <span 
                key={suburb}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-900 group"
              >
                {suburb}
                <button
                  type="button"
                  onClick={() => handleRemoveSuburb(suburb)}
                  className="hover:text-rose-600 p-0.5 rounded-full transition-colors cursor-pointer"
                  title={`Remove ${suburb}`}
                >
                  <X size={12} weight="bold" />
                </button>
              </span>
            ))}

            {/* Quick Add Dropdown / Input */}
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="+ Add area..."
                value={suburbInput}
                onChange={(e) => setSuburbInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddSuburb(suburbInput);
                  }
                }}
                className="w-28 focus:w-36 text-xs px-2.5 py-1 rounded-full border border-zinc-200 focus:border-indigo-600 focus:outline-none transition-all placeholder:text-zinc-400 bg-zinc-50/60"
              />
            </div>

            {/* Quick Pills for rapid toggling */}
            <div className="hidden lg:flex items-center gap-1 ml-2 border-l border-zinc-200 pl-2">
              {QUICK_SUBURBS.filter(s => !selectedSuburbs.includes(s)).slice(0, 3).map((qs) => (
                <button
                  key={qs}
                  type="button"
                  onClick={() => handleAddSuburb(qs)}
                  className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-zinc-500 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 transition-all cursor-pointer"
                >
                  +{qs}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Budget & Beds Criteria */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-zinc-100 px-2 py-1 rounded-xl text-xs border border-zinc-200">
              <span className="text-[10px] font-bold text-zinc-400">Budget:</span>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-14 text-center font-bold text-zinc-800 bg-transparent focus:outline-none"
                placeholder="Min"
                step="500"
              />
              <span className="text-zinc-400">−</span>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-14 text-center font-bold text-zinc-800 bg-transparent focus:outline-none"
                placeholder="Max"
                step="500"
              />
            </div>

            <div className="flex items-center gap-1 bg-zinc-100 px-2 py-1 rounded-xl text-xs border border-zinc-200">
              <span className="text-[10px] font-bold text-zinc-400">Beds:</span>
              <select
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="font-bold text-zinc-800 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="1+">1+ Bed</option>
                <option value="2+">2+ Beds</option>
                <option value="3+">3+ Beds</option>
                <option value="any">Any</option>
              </select>
            </div>
          </div>

          {/* 3. Desirable Locations & Trailheads Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAnchorMenuOpen(!isAnchorMenuOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activeAnchor ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs' : 'bg-zinc-100 border-zinc-200 text-zinc-700'
              }`}
            >
              <Tree size={15} weight="bold" className="text-emerald-600" />
              <span className="truncate max-w-[140px]">{activeAnchor ? activeAnchor.label : 'Select Trailhead / Spot'}</span>
              <span className="px-1.5 py-0.2 bg-emerald-200/80 rounded-md text-[10px] font-extrabold text-emerald-900">
                {anchors.length}
              </span>
            </button>

            {/* Anchor Dropdown Popover */}
            {isAnchorMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-zinc-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <span className="font-extrabold text-xs text-zinc-950 flex items-center gap-1.5">
                    <Tree size={14} className="text-emerald-600" weight="bold" />
                    Trailheads & Desirable Spots
                  </span>
                  <button onClick={() => setIsAnchorMenuOpen(false)} className="text-zinc-400 hover:text-zinc-700 p-0.5">
                    <X size={14} />
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 py-2">
                  {anchors.map((anc) => (
                    <div
                      key={anc.id}
                      onClick={() => {
                        setActiveAnchorId(anc.id);
                        setIsAnchorMenuOpen(false);
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                        activeAnchorId === anc.id ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200' : 'hover:bg-zinc-50 text-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {anc.iconType === 'trail' ? (
                          <Tree size={15} weight="fill" className="text-emerald-600 shrink-0" />
                        ) : anc.iconType === 'surf' ? (
                          <Waves size={15} weight="fill" className="text-cyan-600 shrink-0" />
                        ) : anc.iconType === 'cafe' ? (
                          <Coffee size={15} weight="fill" className="text-amber-600 shrink-0" />
                        ) : (
                          <Target size={15} weight="bold" className="text-indigo-600 shrink-0" />
                        )}
                        <span className="truncate">{anc.label}</span>
                      </div>
                      {activeAnchorId === anc.id && (
                        <Check size={14} weight="bold" className="text-emerald-600 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Custom Spot Form */}
                <div className="pt-2 border-t border-zinc-100 space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Add Custom Location:</span>
                  <input
                    type="text"
                    placeholder="Name (e.g. Deer Park, Constantia Nek)"
                    value={newAnchorLabel}
                    onChange={(e) => setNewAnchorLabel(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-zinc-200 focus:outline-none focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomAnchor}
                    className="w-full py-1.5 bg-zinc-950 hover:bg-black text-white rounded-xl text-xs font-bold transition-all"
                  >
                    + Add to Map
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. SCRAPE P24 ACTION BUTTON */}
          <div>
            <button
              type="button"
              onClick={handleScrapeP24}
              disabled={isScraping}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              {isScraping ? (
                <CircleNotch size={15} className="animate-spin text-white" />
              ) : (
                <Sparkle size={15} weight="fill" className="text-amber-300" />
              )}
              <span>{isScraping ? 'Scraping P24...' : 'Scrape P24 Listings'}</span>
            </button>
          </div>

        </div>

        {/* Live Status Toast */}
        {scrapeStatusText && (
          <div className="max-w-7xl mx-auto mt-1.5 flex items-center gap-2 text-[11px] font-bold text-indigo-700 bg-indigo-50/80 px-3 py-1 rounded-lg border border-indigo-200/80 animate-in fade-in duration-150">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping shrink-0" />
            <span>{scrapeStatusText}</span>
          </div>
        )}
      </header>

      {/* MAIN VIEWPORT: SPLIT COLUMN + FULL-WIDTH MAP CANVAS */}
      <main className="flex-1 w-full flex relative overflow-hidden min-h-0">
        
        {/* LEFT / SIDE COLUMN: PROPERTY CARDS FEED */}
        <aside 
          className={`h-full border-r border-zinc-200 bg-white flex flex-col z-20 shadow-md transition-all duration-300 ease-in-out ${
            isListCollapsed ? 'w-0 overflow-hidden border-none' : 'w-full sm:w-[380px] lg:w-[420px] shrink-0'
          }`}
        >
          {/* Column Header */}
          <div className="p-3.5 border-b border-zinc-100 flex items-center justify-between gap-2 bg-white/90 backdrop-blur-xs">
            <div>
              <h2 className="font-extrabold text-sm text-zinc-950 flex items-center gap-1.5">
                <span>{properties.length} Properties</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Live
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400 font-medium truncate max-w-[220px]">
                {selectedSuburbs.join(', ')}
              </p>
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-1.5">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs font-bold text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-xl px-2.5 py-1 focus:outline-none cursor-pointer"
              >
                <option value="fit">Top Fit</option>
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

          {/* Scrollable Property Cards Feed */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3.5 divide-y divide-zinc-100">
            {sortedProperties.map((prop) => {
              const isSelected = selectedPropertyId === prop.id;
              const distToAnchor = activeAnchor ? getDistanceKm(prop.lat, prop.lng, activeAnchor.lat, activeAnchor.lng) : null;
              const driveDurMins = distToAnchor ? Math.max(2, Math.round((distToAnchor / 35.0) * 60)) : null;

              return (
                <div
                  key={prop.id}
                  onClick={() => setSelectedPropertyId(prop.id)}
                  className={`pt-3.5 first:pt-0 rounded-2xl p-2.5 transition-all cursor-pointer border ${
                    isSelected 
                      ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-md' 
                      : 'hover:bg-zinc-50/80 border-transparent hover:border-zinc-200'
                  }`}
                >
                  {/* Photo & Top Badges */}
                  <div className="relative w-full h-44 rounded-xl overflow-hidden bg-zinc-100 shadow-xs mb-2.5">
                    <img
                      src={prop.image}
                      alt={prop.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg bg-zinc-950/85 text-white font-extrabold text-xs shadow-md backdrop-blur-xs">
                        R {formatPrice(prop.price)} <span className="text-[10px] text-zinc-400 font-normal">/mo</span>
                      </span>
                      {prop.fit_score && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white font-black text-[10px] shadow-sm">
                          {prop.fit_score}% Fit
                        </span>
                      )}
                    </div>

                    {prop.noise_risk === 'sanctuary' && (
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-200 text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs">
                        <ShieldCheck size={12} weight="bold" className="text-emerald-400" />
                        <span>Acoustic Sanctuary</span>
                      </div>
                    )}
                  </div>

                  {/* Title & Address */}
                  <h3 className="font-extrabold text-xs text-zinc-950 line-clamp-1 mb-0.5">
                    {prop.title}
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium truncate mb-2">
                    {prop.address}
                  </p>

                  {/* Spec Chips: Beds, Baths, Sqm, Parking */}
                  <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-semibold text-zinc-600 mb-2.5">
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
                    <span className="bg-zinc-100 px-2 py-0.5 rounded-md text-emerald-700 font-bold">
                      🚗 Garage / Pkg
                    </span>
                  </div>

                  {/* Trailhead / Desirable Location Proximity Pill */}
                  {activeAnchor && distToAnchor !== null && (
                    <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-zinc-100/90 border border-zinc-200/80">
                      <span className="font-semibold text-zinc-700 flex items-center gap-1.5 truncate max-w-[210px]">
                        {activeAnchor.iconType === 'trail' ? (
                          <Tree size={13} weight="fill" className="text-emerald-600 shrink-0" />
                        ) : activeAnchor.iconType === 'surf' ? (
                          <Waves size={13} weight="fill" className="text-cyan-600 shrink-0" />
                        ) : (
                          <Target size={13} weight="bold" className="text-indigo-600 shrink-0" />
                        )}
                        <span className="truncate">{activeAnchor.label}</span>
                      </span>
                      <span className="font-black text-indigo-700 shrink-0">
                        {distToAnchor} km · ~{driveDurMins}m
                      </span>
                    </div>
                  )}

                  {/* Links / Action */}
                  <div className="flex items-center justify-between pt-2 text-xs">
                    <span className="text-[11px] text-indigo-600 font-bold hover:underline flex items-center gap-1">
                      Focus on map <NavigationArrow size={11} weight="fill" />
                    </span>
                    {prop.url && (
                      <a
                        href={prop.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] font-bold text-zinc-400 hover:text-zinc-950 flex items-center gap-1 hover:underline"
                      >
                        <span>View P24</span>
                        <ArrowSquareOut size={12} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
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
            <span>Show {properties.length} Properties</span>
            <CaretRight size={14} weight="bold" />
          </button>
        )}

        {/* RIGHT / FULL-WIDTH MAP CANVAS */}
        <div className="flex-1 h-full w-full relative bg-zinc-100 overflow-hidden">
          <PropertyMap
            mode="default"
            properties={properties}
            anchors={anchors}
            selectedPropertyId={selectedPropertyId}
            selectedAnchorId={activeAnchorId}
            onSelectProperty={(p) => setSelectedPropertyId(p.id)}
            onSelectAnchor={(a) => setActiveAnchorId(a.id)}
            className="w-full h-full"
          />
        </div>

      </main>
    </div>
  );
}
