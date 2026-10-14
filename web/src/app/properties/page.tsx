'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  MagnifyingGlass, 
  Heart, 
  Sliders, 
  MapPin, 
  Bed, 
  Bathtub, 
  Ruler, 
  Lightbulb, 
  CaretRight, 
  X, 
  Car, 
  CheckCircle, 
  ShieldCheck, 
  WarningCircle, 
  ArrowSquareOut,
  SlidersHorizontal,
  Target,
  Sparkle
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { PropertyMap, PropertyMapItem, ProximityAnchor } from '@/components/PropertyMap';
import { fetchWithAuth } from '@/lib/api';

// Initial Curated Listings matching the user's reference mockup and real intelligence
const INITIAL_PROPERTIES: (PropertyMapItem & {
  timeAgo: string;
  sourceDomain: string;
  isSuggested?: boolean;
  privacyVerified?: boolean;
  privacyDetails?: {
    independentLiving: boolean;
    privateEntrance: boolean;
    privateGarden: boolean;
    noLandlordOnSite: boolean;
    privateHouse: boolean;
  };
  description?: string;
  commuteNotes?: string;
})[] = [
  // 1. From User's Reference Screenshot
  {
    id: 'prop-coral-way',
    title: '203/7 Coral Way',
    address: '203/7 Coral Way, Brisbane, QLD 4000',
    price: 1200000,
    currency: 'AUD',
    bedrooms: 4,
    bathrooms: 3,
    sqm: 100,
    image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
    lat: -27.4698,
    lng: 153.0251,
    timeAgo: '4 hours ago',
    sourceDomain: 'australianhomes.com.au',
    isSuggested: false,
    privacyVerified: true,
    privacyDetails: {
      independentLiving: true,
      privateEntrance: true,
      privateGarden: true,
      noLandlordOnSite: true,
      privateHouse: true,
    },
    description: 'Beautiful modern family home with lush private perimeter, sun-drenched timber deck, and 4 spacious bedrooms.',
    commuteNotes: '12 mins drive to Brisbane Central Office',
  },
  {
    id: 'prop-elm-street',
    title: '12/45 Elm Street',
    address: '12/45 Elm Street, Melbourne, VIC 3000',
    price: 1500000,
    currency: 'AUD',
    bedrooms: 2,
    bathrooms: 2,
    sqm: 70,
    image: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80',
    lat: -37.8136,
    lng: 144.9631,
    timeAgo: '4 hours ago',
    sourceDomain: 'australianproperties.com.au',
    isSuggested: false,
    is_favorite: true,
    privacyVerified: true,
    privacyDetails: {
      independentLiving: true,
      privateEntrance: true,
      privateGarden: false,
      noLandlordOnSite: true,
      privateHouse: false,
    },
    description: 'Designer inner-city apartment featuring high ceilings, double glazed acoustic windows, and sweeping skyline views.',
    commuteNotes: '8 mins walk to Flinders Street Hub',
  },
  {
    id: 'prop-maple-drive',
    title: '5/22 Maple Drive',
    address: '5/22 Maple Drive, Sydney, NSW 2000',
    price: 1800000,
    currency: 'AUD',
    bedrooms: 6,
    bathrooms: 4,
    sqm: 200,
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
    lat: -33.8688,
    lng: 151.2093,
    timeAgo: '5 hours ago',
    sourceDomain: 'domain.com.au',
    isSuggested: true,
    privacyVerified: true,
    privacyDetails: {
      independentLiving: true,
      privateEntrance: true,
      privateGarden: true,
      noLandlordOnSite: true,
      privateHouse: true,
    },
    description: 'Grand executive estate with expansive gardens, complete private perimeter fencing, and dual lock-up garage.',
    commuteNotes: '16 mins driving to Sydney Tech Precinct',
  },

  // 2. South African Intelligence Properties (HomeSeek Core Radar)
  {
    id: 'prop-camps-bay',
    title: '14 Victoria Road',
    address: '14 Victoria Road, Camps Bay, Cape Town 8005',
    price: 28000,
    currency: 'ZAR',
    bedrooms: 3,
    bathrooms: 2,
    sqm: 135,
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    lat: -33.9515,
    lng: 18.3780,
    timeAgo: '2 hours ago',
    sourceDomain: 'property24.com',
    isSuggested: true,
    privacyVerified: true,
    privacyDetails: {
      independentLiving: true,
      privateEntrance: true,
      privateGarden: true,
      noLandlordOnSite: true,
      privateHouse: true,
    },
    description: 'Spectacular Atlantic coastline residence with private pool, unshared garden, high security access, and load shedding inverter.',
    commuteNotes: '18 mins drive to Amazon River Club HQ via Kloof Nek',
  },
  {
    id: 'prop-kloof-st',
    title: '82 Kloof Street',
    address: '82 Kloof Street, Gardens, Cape Town 8001',
    price: 19500,
    currency: 'ZAR',
    bedrooms: 2,
    bathrooms: 2,
    sqm: 85,
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    lat: -33.9325,
    lng: 18.4110,
    timeAgo: '3 hours ago',
    sourceDomain: 'property24.com',
    isSuggested: false,
    privacyVerified: true,
    privacyDetails: {
      independentLiving: true,
      privateEntrance: true,
      privateGarden: false,
      noLandlordOnSite: true,
      privateHouse: false,
    },
    description: 'Ultra-convenient top-floor apartment with panoramic Table Mountain views, secure underground bay, and fibre internet.',
    commuteNotes: '12 mins drive to Amazon River Club HQ',
  },
  {
    id: 'prop-hout-bay',
    title: 'Main Road Nutec Cottage',
    address: 'Main Road, Hout Bay Central, Western Cape 7806',
    price: 16500,
    currency: 'ZAR',
    bedrooms: 2,
    bathrooms: 1,
    sqm: 75,
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80',
    lat: -34.0450,
    lng: 18.3580,
    timeAgo: 'Just now',
    sourceDomain: 'property24.com',
    isSuggested: false,
    privacyVerified: false,
    privacyDetails: {
      independentLiving: false,
      privateEntrance: false,
      privateGarden: false,
      noLandlordOnSite: false,
      privateHouse: false,
    },
    description: 'Cozy cottage situated behind main residence. Shared driveway and garden with main homeowner.',
    commuteNotes: '32 mins drive to Observatory HQ',
  },
  {
    id: 'prop-obs-river',
    title: '7 Liesbeek Avenue',
    address: '7 Liesbeek Avenue, Observatory, Cape Town 7925',
    price: 15500,
    currency: 'ZAR',
    bedrooms: 2,
    bathrooms: 1,
    sqm: 68,
    image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80',
    lat: -33.9370,
    lng: 18.4720,
    timeAgo: '1 day ago',
    sourceDomain: 'privateproperty.co.za',
    isSuggested: true,
    privacyVerified: true,
    privacyDetails: {
      independentLiving: true,
      privateEntrance: true,
      privateGarden: true,
      noLandlordOnSite: true,
      privateHouse: true,
    },
    description: 'Charming Victorian semi-detached home with private courtyard garden, walking distance to River Club tech campus.',
    commuteNotes: '4 mins walk (600m) to Amazon River Club HQ!',
  },
  {
    id: 'prop-sea-point',
    title: '203 Ocean View Drive',
    address: '203 Ocean View Drive, Sea Point, Cape Town 8005',
    price: 23000,
    currency: 'ZAR',
    bedrooms: 2,
    bathrooms: 2,
    sqm: 92,
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
    lat: -33.9160,
    lng: 18.3920,
    timeAgo: '6 hours ago',
    sourceDomain: 'property24.com',
    isSuggested: false,
    privacyVerified: true,
    privacyDetails: {
      independentLiving: true,
      privateEntrance: true,
      privateGarden: false,
      noLandlordOnSite: true,
      privateHouse: false,
    },
    description: 'Sleek modern apartment on the slopes of Signal Hill. Large covered balcony with sunset ocean views.',
    commuteNotes: '15 mins drive to Cape Town CBD',
  }
];

// User Desired Proximity Locations (Life Anchors)
const DEFAULT_ANCHORS: ProximityAnchor[] = [
  {
    id: 'anchor-riverclub',
    label: 'Work (Amazon River Club HQ)',
    target_place: 'Amazon River Club, Observatory',
    lat: -33.9340,
    lng: 18.4770,
    max_commute_mins: 30,
    max_distance_km: 25,
    commute_mode: 'driving',
  },
  {
    id: 'anchor-cbd',
    label: 'Cape Town CBD / Foreshore',
    target_place: 'Cape Town City Bowl',
    lat: -33.9220,
    lng: 18.4230,
    max_commute_mins: 25,
    max_distance_km: 20,
    commute_mode: 'driving',
  },
  {
    id: 'anchor-campsbay',
    label: 'Camps Bay Beach',
    target_place: 'Camps Bay Promenade',
    lat: -33.9510,
    lng: 18.3770,
    max_commute_mins: 20,
    max_distance_km: 15,
    commute_mode: 'driving',
  },
  {
    id: 'anchor-brisbane',
    label: 'Brisbane Central HQ',
    target_place: 'Brisbane QLD',
    lat: -27.4680,
    lng: 153.0240,
    max_commute_mins: 25,
    max_distance_km: 20,
    commute_mode: 'driving',
  },
];

export default function PropertiesPage() {
  const { user, profile, loading, login, logout, refreshProfile } = useAuth();
  
  // State
  const [properties, setProperties] = useState(INITIAL_PROPERTIES);
  const [anchors, setAnchors] = useState<ProximityAnchor[]>(DEFAULT_ANCHORS);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({
    'prop-elm-street': true,
  });

  // Filters
  const [minBedrooms, setMinBedrooms] = useState<number | 'all'>('all');
  const [maxPrice, setMaxPrice] = useState<number | 'all'>('all');
  const [onlyPrivacyShield, setOnlyPrivacyShield] = useState(false);
  const [activeRegion, setActiveRegion] = useState<'all' | 'za' | 'au'>('all');

  // Selected State
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(properties[0]?.id || null);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(anchors[0]?.id || null);
  const [modalProperty, setModalProperty] = useState<typeof INITIAL_PROPERTIES[0] | null>(null);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('homeseek_favorites');
      if (saved) {
        setFavorites(JSON.parse(saved));
      }
    } catch (e) {
      // fallback
    }
  }, []);

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem('homeseek_favorites', JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
  };

  // Filtered Properties
  const filteredProperties = useMemo(() => {
    return properties.filter(prop => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery = 
          prop.title.toLowerCase().includes(q) ||
          prop.address.toLowerCase().includes(q) ||
          prop.sourceDomain.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      // Favorites filter
      if (onlyFavorites && !favorites[prop.id]) {
        return false;
      }

      // Bedrooms filter
      if (minBedrooms !== 'all' && prop.bedrooms < minBedrooms) {
        return false;
      }

      // Max price filter
      if (maxPrice !== 'all') {
        if (prop.currency === 'ZAR' && prop.price > maxPrice) return false;
        if (prop.currency === 'AUD' && prop.price > maxPrice * 70) return false;
      }

      // Privacy Shield filter
      if (onlyPrivacyShield && !prop.privacyVerified) {
        return false;
      }

      // Region filter
      if (activeRegion === 'za' && prop.currency !== 'ZAR') return false;
      if (activeRegion === 'au' && prop.currency !== 'AUD') return false;

      return true;
    });
  }, [properties, searchQuery, onlyFavorites, favorites, minBedrooms, maxPrice, onlyPrivacyShield, activeRegion]);

  const selectedProp = properties.find(p => p.id === selectedPropertyId) || filteredProperties[0] || null;

  const formatPriceBadge = (price: number, currency?: string) => {
    if (currency === 'AUD') {
      return `${price.toLocaleString()} AUD`;
    }
    return `R ${price.toLocaleString()} / mo`;
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

      {/* Main Split Layout: Left Feed / Right Map */}
      <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden">
        
        {/* ==================== LEFT COLUMN: LISTINGS FEED ==================== */}
        <div className="w-full lg:w-[54%] xl:w-[50%] flex flex-col h-full bg-white border-r border-zinc-200">
          
          {/* Top Bar: Search History Input & Favorites Button (Exact Screenshot UX) */}
          <div className="p-4 sm:p-5 border-b border-zinc-200 space-y-3.5 bg-white shrink-0">
            <div className="flex items-center gap-3">
              
              {/* Search History Bar */}
              <div className="relative flex-1">
                <MagnifyingGlass 
                  size={18} 
                  weight="bold" 
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" 
                />
                <input
                  type="text"
                  placeholder="Search history"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-2xl pl-10 pr-9 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all shadow-2xs"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Favorites Pill Button */}
              <button
                onClick={() => setOnlyFavorites(!onlyFavorites)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-semibold transition-all shadow-2xs shrink-0 ${
                  onlyFavorites
                    ? 'bg-zinc-950 text-white border-zinc-950'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-950'
                }`}
              >
                <Heart 
                  size={18} 
                  weight={onlyFavorites ? "fill" : "regular"} 
                  className={onlyFavorites ? "text-red-500" : "text-zinc-500"} 
                />
                <span>Favorites</span>
                {Object.values(favorites).filter(Boolean).length > 0 && (
                  <span className={`text-xs px-1.5 py-0.2 rounded-full ${onlyFavorites ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-700'}`}>
                    {Object.values(favorites).filter(Boolean).length}
                  </span>
                )}
              </button>

            </div>

            {/* Quick Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                onClick={() => {
                  setMinBedrooms('all');
                  setMaxPrice('all');
                  setOnlyPrivacyShield(false);
                  setActiveRegion('all');
                  setOnlyFavorites(false);
                  setSearchQuery('');
                }}
                className="px-3 py-1.5 rounded-full border border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition-colors whitespace-nowrap font-medium"
              >
                Reset
              </button>

              <button
                onClick={() => setOnlyPrivacyShield(!onlyPrivacyShield)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap ${
                  onlyPrivacyShield
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                <ShieldCheck size={14} weight="bold" />
                <span>Privacy Shield Verified</span>
              </button>

              <button
                onClick={() => setMinBedrooms(minBedrooms === 2 ? 'all' : 2)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap ${
                  minBedrooms === 2
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                2+ Beds
              </button>

              <button
                onClick={() => setMinBedrooms(minBedrooms === 4 ? 'all' : 4)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap ${
                  minBedrooms === 4
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                4+ Beds
              </button>

              <button
                onClick={() => setActiveRegion(activeRegion === 'za' ? 'all' : 'za')}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap ${
                  activeRegion === 'za'
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                Cape Town
              </button>

              <button
                onClick={() => setActiveRegion(activeRegion === 'au' ? 'all' : 'au')}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap ${
                  activeRegion === 'au'
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                Australia Presets
              </button>
            </div>

            {/* Results Count & Match Status */}
            <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
              <span>Showing <strong className="text-zinc-900 font-semibold">{filteredProperties.length}</strong> listings</span>
              <span className="flex items-center gap-1.5 text-zinc-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Live criteria sync
              </span>
            </div>
          </div>

          {/* Listings Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 custom-scrollbar">
            {filteredProperties.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                  <MagnifyingGlass size={24} />
                </div>
                <h3 className="font-bold text-zinc-900 text-base">No matching properties found</h3>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                  Try adjusting your search criteria, clearing the favorites filter, or resetting bedrooms and price.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setOnlyFavorites(false);
                    setMinBedrooms('all');
                    setMaxPrice('all');
                    setOnlyPrivacyShield(false);
                    setActiveRegion('all');
                  }}
                  className="mt-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              filteredProperties.map((prop) => {
                const isSelected = selectedPropertyId === prop.id;
                const isFav = !!favorites[prop.id];

                return (
                  <div
                    key={prop.id}
                    onClick={() => setSelectedPropertyId(prop.id)}
                    className={`p-4 sm:p-5 flex gap-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-zinc-50/80 ring-1 ring-inset ring-zinc-300'
                        : 'hover:bg-zinc-50/50'
                    }`}
                  >
                    {/* Left Thumbnail (Rounded corner, shadow, exact screenshot layout) */}
                    <div className="relative shrink-0">
                      <img
                        src={prop.image}
                        alt={prop.title}
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-zinc-200/80 shadow-2xs"
                      />
                      {prop.privacyVerified && (
                        <div 
                          title="Privacy Shield Verified"
                          className="absolute -top-1.5 -left-1.5 bg-zinc-950 text-white p-1 rounded-full shadow-sm"
                        >
                          <ShieldCheck size={12} weight="bold" />
                        </div>
                      )}
                    </div>

                    {/* Right Property Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      
                      {/* Top Row: Address + Time Ago */}
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm sm:text-base text-zinc-950 truncate leading-snug">
                          {prop.address}
                        </h4>
                        <span className="text-xs text-zinc-400 shrink-0 whitespace-nowrap font-normal">
                          {prop.timeAgo}
                        </span>
                      </div>

                      {/* Middle Row: Pills (Price, Bedrooms, Bathrooms, Sqm) */}
                      <div className="flex flex-wrap items-center gap-1.5 my-2">
                        {/* Price Pill */}
                        <span className="px-3 py-1 rounded-full text-xs font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200/90 whitespace-nowrap shadow-2xs">
                          {formatPriceBadge(prop.price, prop.currency)}
                        </span>

                        {/* Bedroom Pill */}
                        <span className="px-3 py-1 rounded-full text-xs font-medium text-zinc-700 bg-zinc-50 border border-zinc-200/90 whitespace-nowrap">
                          {prop.bedrooms} {prop.bedrooms === 1 ? 'bedroom' : 'bedrooms'}
                        </span>

                        {/* Bathroom Pill */}
                        <span className="px-3 py-1 rounded-full text-xs font-medium text-zinc-700 bg-zinc-50 border border-zinc-200/90 whitespace-nowrap">
                          {prop.bathrooms} {prop.bathrooms === 1 ? 'bathroom' : 'bathrooms'}
                        </span>

                        {/* Sqm Pill */}
                        {prop.sqm && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium text-zinc-700 bg-zinc-50 border border-zinc-200/90 whitespace-nowrap">
                            {prop.sqm} sqm
                          </span>
                        )}
                      </div>

                      {/* Bottom Row: Source Domain + Suggested / Favorite / Chevron */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        {/* Left: Domain source or Suggested Tag */}
                        <div className="flex items-center gap-3">
                          <a
                            href={`https://${prop.sourceDomain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-zinc-500 hover:text-zinc-900 underline-offset-2 hover:underline truncate max-w-[140px] sm:max-w-none"
                          >
                            {prop.sourceDomain}
                          </a>

                          {prop.isSuggested && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-700 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                              <Lightbulb size={12} weight="fill" className="text-amber-500" />
                              <span>Suggested Property</span>
                            </span>
                          )}
                        </div>

                        {/* Right: Heart favorite icon and Chevron action */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => toggleFavorite(prop.id, e)}
                            className="p-1 hover:scale-110 active:scale-95 transition-all text-zinc-400 hover:text-zinc-700"
                            aria-label="Favorite listing"
                          >
                            <Heart
                              size={20}
                              weight={isFav ? "fill" : "regular"}
                              className={isFav ? "text-red-500 fill-red-500" : "text-zinc-400"}
                            />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalProperty(prop);
                            }}
                            className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors"
                            aria-label="View details"
                          >
                            <CaretRight size={18} weight="bold" />
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ==================== RIGHT COLUMN: MAP ==================== */}
        <div className="w-full lg:w-[46%] xl:w-[50%] h-[400px] lg:h-full relative">
          <PropertyMap
            properties={filteredProperties}
            anchors={anchors}
            selectedPropertyId={selectedPropertyId}
            selectedAnchorId={selectedAnchorId}
            onSelectProperty={(p) => {
              setSelectedPropertyId(p.id);
            }}
            onSelectAnchor={(a) => {
              setSelectedAnchorId(a.id);
            }}
          />
        </div>

      </div>

      {/* ==================== PROPERTY DETAIL MODAL / DOSSIER ==================== */}
      {modalProperty && (
        <div 
          className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setModalProperty(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-xl w-full border border-zinc-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Image */}
            <div className="relative h-64 w-full">
              <img
                src={modalProperty.image}
                alt={modalProperty.title}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setModalProperty(null)}
                className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-md rounded-full text-zinc-700 hover:text-zinc-950 shadow-md transition-all"
              >
                <X size={18} weight="bold" />
              </button>
              <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full text-sm font-bold text-zinc-950 shadow-md">
                {formatPriceBadge(modalProperty.price, modalProperty.currency)}
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
              <div>
                <h3 className="text-xl font-bold text-zinc-950">{modalProperty.title}</h3>
                <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                  <MapPin size={14} className="text-zinc-400" />
                  {modalProperty.address}
                </p>
              </div>

              {/* Specs Pills */}
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-800">
                  {modalProperty.bedrooms} Bedrooms
                </span>
                <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-800">
                  {modalProperty.bathrooms} Bathrooms
                </span>
                {modalProperty.sqm && (
                  <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-800">
                    {modalProperty.sqm} m² Living Area
                  </span>
                )}
                <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-800">
                  Listed {modalProperty.timeAgo}
                </span>
              </div>

              {/* Description */}
              {modalProperty.description && (
                <div>
                  <h5 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-1.5">Overview</h5>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    {modalProperty.description}
                  </p>
                </div>
              )}

              {/* Living Autonomy & Privacy Shield Breakdown */}
              {modalProperty.privacyDetails && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck size={16} weight="bold" className="text-zinc-900" />
                      Living Autonomy & Privacy Shield
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      modalProperty.privacyVerified ? 'bg-zinc-900 text-white' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {modalProperty.privacyVerified ? 'Verified Private' : 'Shared Elements'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="flex items-center gap-1.5 text-zinc-700">
                      {modalProperty.privacyDetails.independentLiving ? (
                        <CheckCircle size={14} weight="fill" className="text-zinc-900" />
                      ) : (
                        <WarningCircle size={14} weight="fill" className="text-amber-500" />
                      )}
                      <span>Independent Living</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-zinc-700">
                      {modalProperty.privacyDetails.privateEntrance ? (
                        <CheckCircle size={14} weight="fill" className="text-zinc-900" />
                      ) : (
                        <WarningCircle size={14} weight="fill" className="text-amber-500" />
                      )}
                      <span>Private Entrance</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-zinc-700">
                      {modalProperty.privacyDetails.privateGarden ? (
                        <CheckCircle size={14} weight="fill" className="text-zinc-900" />
                      ) : (
                        <WarningCircle size={14} weight="fill" className="text-zinc-400" />
                      )}
                      <span>Private Garden</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-zinc-700">
                      {modalProperty.privacyDetails.noLandlordOnSite ? (
                        <CheckCircle size={14} weight="fill" className="text-zinc-900" />
                      ) : (
                        <WarningCircle size={14} weight="fill" className="text-amber-500" />
                      )}
                      <span>No Landlord On-Site</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Proximity Anchors Matrix */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Target size={16} weight="bold" />
                  Proximity Anchor Commute Matrix
                </span>
                <p className="text-xs text-zinc-600">
                  {modalProperty.commuteNotes || 'Calculated commute estimates to your saved anchor points.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <a
                  href={`https://${modalProperty.sourceDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-zinc-950 text-white text-center py-3 rounded-2xl text-xs font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  <span>View on {modalProperty.sourceDomain}</span>
                  <ArrowSquareOut size={14} weight="bold" />
                </a>

                <button
                  onClick={() => toggleFavorite(modalProperty.id)}
                  className={`p-3 rounded-2xl border transition-all ${
                    favorites[modalProperty.id]
                      ? 'bg-red-50 border-red-200 text-red-600'
                      : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}
                  aria-label="Toggle favorite"
                >
                  <Heart size={20} weight={favorites[modalProperty.id] ? "fill" : "regular"} />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
