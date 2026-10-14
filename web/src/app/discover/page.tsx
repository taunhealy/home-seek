'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkle, 
  MagnifyingGlass, 
  MapPin, 
  House, 
  SunHorizon, 
  Dog, 
  Sliders, 
  ShieldCheck, 
  WarningCircle, 
  Check, 
  Plus, 
  X, 
  ArrowSquareOut,
  CalendarBlank,
  Lightning,
  Funnel,
  Buildings,
  CheckCircle,
  Eye,
  Car,
  Clock,
  Lock
} from '@phosphor-icons/react';
import { fetchWithAuth, fetchSuburbs } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { PropertyAiDossier } from '@/components/PropertyAiDossier';
import { formatCurrency, formatListingDate } from '@/lib/utils';
import { PropertyAiReport } from '@/lib/schemas';

interface CommuteAnchorItem {
  id: string;
  label: string;
  target_place: string;
  max_distance_km?: number | null;
  max_commute_mins?: number | null;
  commute_mode: 'driving' | 'walking' | 'bicycling' | 'transit';
}

const PRESET_COMMUTE_DESTINATIONS = [
  { label: 'Work (Amazon River Club HQ)', target_place: 'Amazon River Club, Observatory', defaultMins: 35, defaultKm: 25 },
  { label: 'Cape Town CBD / Foreshore', target_place: 'Cape Town CBD', defaultMins: 30, defaultKm: 20 },
  { label: 'Century City (Canal Walk)', target_place: 'Century City, Cape Town', defaultMins: 35, defaultKm: 30 },
  { label: 'UCT (Main Campus)', target_place: 'University of Cape Town, Rondebosch', defaultMins: 25, defaultKm: 20 },
  { label: 'Camps Bay Beach', target_place: 'Camps Bay, Cape Town', defaultMins: 20, defaultKm: 15 },
  { label: 'Claremont / Cavendish', target_place: 'Claremont, Cape Town', defaultMins: 25, defaultKm: 18 }
];

const PRESET_MUST_INCLUDES = [
  'Gas Hob (Load Shedding Proof)',
  'Modern Glass / Induction Hob',
  'Fibre Ready',
  'Mountain Views',
  '2 Bathrooms',
  'Secure Parking Bay',
  'Balcony'
];

const PRESET_MUST_EXCLUDES = [
  'Electric Solid Plate Stove (Outdated)',
  'Communal Walkway Window',
  'No-Braai Complex',
  'Ground Floor without Bars',
  'Single Plumbing Point',
  'Cold Tiled Bedrooms',
  'Strict No Pets'
];

const LIFESTYLE_PROFILES = [
  { id: 'wfh', label: 'Remote Worker (WFH)', includes: ['Fibre Ready'], excludes: ['Communal Walkway Window'] },
  { id: 'cook', label: 'Frequent Cook / Foodie', includes: ['Gas Hob (Load Shedding Proof)'], excludes: ['Electric Solid Plate Stove (Outdated)', 'Single Plumbing Point'] },
  { id: 'car', label: 'Vehicle Owner', includes: ['Secure Parking Bay'], excludes: [] },
  { id: 'scenic', label: 'Mountain Lover', includes: ['Mountain Views', 'Balcony'], excludes: [] }
];

export default function DiscoverPage() {
  const { user, profile } = useAuth();
  
  // Alert & Filter State
  const [targetArea, setTargetArea] = useState('Hout Bay');
  const [maxPrice, setMaxPrice] = useState<number>(20000);
  const [rentalType, setRentalType] = useState<'all' | 'long-term' | 'short-term'>('long-term');
  const [bedrooms, setBedrooms] = useState<string>('2');
  const [bathrooms, setBathrooms] = useState<string>('2');
  const [petPolicy, setPetPolicy] = useState<'all' | 'yes' | 'no'>('all');
  
  // AI Criteria
  const [mustInclude, setMustInclude] = useState<string[]>([
    'Gas Hob (Load Shedding Proof)',
    'Mountain Views',
    '2 Bathrooms'
  ]);
  const [mustExclude, setMustExclude] = useState<string[]>([
    'Communal Walkway Window',
    'No-Braai Complex'
  ]);
  const [customIncludeInput, setCustomIncludeInput] = useState('');
  const [customExcludeInput, setCustomExcludeInput] = useState('');
  const [strictMode, setStrictMode] = useState<boolean>(false);
  const [requireVerifiedSeaView, setRequireVerifiedSeaView] = useState<boolean>(false);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>(['wfh', 'scenic']);

  // 🛡️ Agency Reputation Guard State
  const [minAgencyRating, setMinAgencyRating] = useState<number | null>(3.0);
  const [excludeLowRatedAgencies, setExcludeLowRatedAgencies] = useState<boolean>(false);
  const [allowDirectLandlords, setAllowDirectLandlords] = useState<boolean>(true);

  // 🏡 Living Autonomy & Privacy Shield State
  const [requireIndependentLiving, setRequireIndependentLiving] = useState<boolean>(false);
  const [requirePrivateEntrance, setRequirePrivateEntrance] = useState<boolean>(false);
  const [requirePrivateGarden, setRequirePrivateGarden] = useState<boolean>(false);
  const [excludeLandlordOnSite, setExcludeLandlordOnSite] = useState<boolean>(false);
  const [excludeSharedHouse, setExcludeSharedHouse] = useState<boolean>(true);

  // 📍 Pro Commute Distance Matrix State
  const [enableProCommute, setEnableProCommute] = useState<boolean>(true);
  const [commuteAnchors, setCommuteAnchors] = useState<CommuteAnchorItem[]>([
    {
      id: 'amazon-hq',
      label: 'Work (Amazon River Club HQ)',
      target_place: 'Amazon River Club, Observatory',
      max_distance_km: 25,
      max_commute_mins: 35,
      commute_mode: 'driving'
    }
  ]);
  const [customAnchorLabel, setCustomAnchorLabel] = useState('');
  const [customAnchorPlace, setCustomAnchorPlace] = useState('');
  const [customAnchorMins, setCustomAnchorMins] = useState<number>(35);
  const [customAnchorKm, setCustomAnchorKm] = useState<number>(25);
  const [showAddAnchorForm, setShowAddAnchorForm] = useState(false);

  // Autocomplete
  const [allSuburbs, setAllSuburbs] = useState<string[]>([]);
  const [suburbSuggestions, setSuburbSuggestions] = useState<string[]>([]);

  // Execution & Results
  const [isDeployingAlert, setIsDeployingAlert] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [alertSuccessMsg, setAlertSuccessMsg] = useState('');
  const [listings, setListings] = useState<any[]>([]);
  const [evaluatingIds, setEvaluatingIds] = useState<Record<string, boolean>>({});
  const [aiReports, setAiReports] = useState<Record<string, PropertyAiReport>>({});

  useEffect(() => {
    const loadSuburbs = async () => {
      const data = await fetchSuburbs();
      setAllSuburbs(data);
    };
    loadSuburbs();
  }, []);

  useEffect(() => {
    if (targetArea && targetArea.length > 1) {
      const matches = allSuburbs.filter(s => 
        s.toLowerCase().includes(targetArea.toLowerCase()) && 
        s.toLowerCase() !== targetArea.toLowerCase()
      ).slice(0, 5);
      setSuburbSuggestions(matches);
    } else {
      setSuburbSuggestions([]);
    }
  }, [targetArea, allSuburbs]);

  // Initial load simulation
  useEffect(() => {
    handleDiscoverScan();
  }, []);

  const handleToggleInclude = (item: string) => {
    setMustInclude(prev => 
      prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]
    );
  };

  const handleToggleExclude = (item: string) => {
    setMustExclude(prev => 
      prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]
    );
  };

  const handleAddCustomInclude = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customIncludeInput.trim()) return;
    if (!mustInclude.includes(customIncludeInput.trim())) {
      setMustInclude(prev => [...prev, customIncludeInput.trim()]);
    }
    setCustomIncludeInput('');
  };

  const handleAddCustomExclude = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customExcludeInput.trim()) return;
    if (!mustExclude.includes(customExcludeInput.trim())) {
      setMustExclude(prev => [...prev, customExcludeInput.trim()]);
    }
    setCustomExcludeInput('');
  };

  const handleToggleProfile = (p: typeof LIFESTYLE_PROFILES[0]) => {
    const isSelected = selectedProfiles.includes(p.id);
    if (isSelected) {
      setSelectedProfiles(prev => prev.filter(x => x !== p.id));
    } else {
      setSelectedProfiles(prev => [...prev, p.id]);
      // Auto-append tags
      p.includes.forEach(inc => {
        if (!mustInclude.includes(inc)) setMustInclude(prev => [...prev, inc]);
      });
      p.excludes.forEach(exc => {
        if (!mustExclude.includes(exc)) setMustExclude(prev => [...prev, exc]);
      });
    }
  };

  const handleAddPresetAnchor = (preset: typeof PRESET_COMMUTE_DESTINATIONS[0]) => {
    if (commuteAnchors.some(a => a.target_place.toLowerCase() === preset.target_place.toLowerCase())) return;
    setCommuteAnchors(prev => [
      ...prev,
      {
        id: `anchor-${Date.now()}`,
        label: preset.label,
        target_place: preset.target_place,
        max_commute_mins: preset.defaultMins,
        max_distance_km: preset.defaultKm,
        commute_mode: 'driving'
      }
    ]);
  };

  const handleRemoveAnchor = (id: string) => {
    setCommuteAnchors(prev => prev.filter(a => a.id !== id));
  };

  const handleAddCustomAnchor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAnchorPlace.trim()) return;
    setCommuteAnchors(prev => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        label: customAnchorLabel.trim() || customAnchorPlace.trim(),
        target_place: customAnchorPlace.trim(),
        max_commute_mins: customAnchorMins || 35,
        max_distance_km: customAnchorKm || 25,
        commute_mode: 'driving'
      }
    ]);
    setCustomAnchorLabel('');
    setCustomAnchorPlace('');
    setShowAddAnchorForm(false);
  };

  // Perform Live AI Discover Scan
  const handleDiscoverScan = async () => {
    setIsScanning(true);
    try {
      const params = new URLSearchParams();
      if (targetArea) params.append('area', targetArea);
      if (maxPrice) params.append('max_price', String(maxPrice));
      if (rentalType !== 'all') params.append('rental_type', rentalType);
      if (bedrooms && bedrooms !== 'any') params.append('bedrooms', bedrooms);
      if (bathrooms && bathrooms !== 'any') params.append('bathrooms', bathrooms);
      if (petPolicy === 'yes') params.append('pets', 'true');

      const res = await fetchWithAuth(`/explore-listings?${params.toString()}`);
      if (res && res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.listings || []);
        
        // If no listings in area yet, seed high-fidelity candidate matching Hout Bay example
        if (items.length === 0) {
          const sampleListings = [
            {
              id: 'hout-bay-sentinel-1',
              title: '2 Bed Modern Apartment with Sentinel Peak Views',
              address: 'Scott Estate, Hout Bay',
              price: 15500,
              bedrooms: 2,
              bathrooms: 2,
              sqm: 85,
              property_type: 'Apartment',
              property_sub_type: 'Whole',
              rental_type: 'long-term',
              available_date: 'Immediate',
              source_url: 'https://www.property24.com/to-rent/hout-bay-central/hout-bay/western-cape/16694/110831457',
              platform: 'Property24',
              agency_name: 'Watchprop Century City',
              agency_rating: 2.7,
              agency_review_count: 48,
              google_reviews_url: 'https://www.google.com/search?q=Watchprop+Century+City+reviews',
              hellopeter_rating: 2.1,
              hellopeter_review_count: 19,
              hellopeter_url: 'https://www.hellopeter.com/watchprop',
              agency_risk_level: 'high',
              agency_complaint_sample: 'Contentious double deposit deductions upon move-out and long response delays for emergency maintenance.',
              agency_flags: [
                'Frequent tenant complaints regarding withheld deposits',
                'Slow maintenance response on wet services and geysers',
                'Difficult communication turnaround during lease termination'
              ],
              is_direct_landlord: false,
              view_category: 'Mountain',
              is_pet_friendly: false,
              is_furnished: false,
              amenities: ['Mountain Views', 'Balcony', 'En-Suite', 'Built-in Cupboards'],
              description: 'Bright 2 bedroom, 2 bathroom unit in quiet Scott Estate complex. Spacious lounge with wood laminate floors. Balcony with unobstructed mountain views. Kitchen features ample cupboards and single plumbing point for appliance. Freestanding stove space. Water included in rent. Parking bay available at R644/month. Double deposit required. No pets permitted by body corporate. Managed by Watchprop Century City.'
            },
            {
              id: 'hout-bay-beach-2',
              title: 'Seaside 2-Bed Garden Flat Near Mainstream Mall',
              address: 'Beach Crescent, Hout Bay',
              price: 17000,
              bedrooms: 2,
              bathrooms: 1,
              sqm: 78,
              property_type: 'Apartment',
              property_sub_type: 'Whole',
              rental_type: 'long-term',
              available_date: '1st Proximo',
              source_url: 'https://www.property24.com',
              platform: 'Property24 (Direct Landlord)',
              agency_name: 'Direct Landlord (Private Owner)',
              agency_rating: null,
              agency_risk_level: 'neutral',
              agency_flags: ['No agent lease administration fees. Deal directly with owner.'],
              is_direct_landlord: true,
              view_category: 'Sea',
              is_pet_friendly: true,
              is_furnished: true,
              amenities: ['Fibre Ready', 'Built-in Stove/Oven', 'Secure Parking Bay', 'Pet Friendly'],
              description: 'Charming pet-friendly apartment within 3 minutes walk to Mainstream Mall and beach. Fully equipped kitchen with built-in oven, gas hob, and dishwasher plumbing. Secure covered parking bay included. Fibre ready. Listed directly by owner.'
            },
            {
              id: 'p24-117666052',
              title: '0.5 Bedroom Apartment / Flat to Rent in Hout Bay Beachfront',
              address: 'Hout Bay Beachfront, Cape Town',
              price: 15000,
              bedrooms: 0.5,
              bathrooms: 1,
              sqm: 50,
              property_type: 'Apartment',
              property_sub_type: 'Whole',
              rental_type: 'long-term',
              available_date: '01 December 2026',
              source_url: 'https://www.property24.com/to-rent/hout-bay-beachfront/hout-bay/western-cape/17480/117666052',
              platform: 'Property24 (Chas Everitt)',
              agency_name: 'Chas Everitt Hout Bay',
              agency_rating: 4.9,
              agency_review_count: 105,
              google_reviews_url: 'https://www.google.com/search?q=Chas+Everitt+Hout+Bay+review',
              hellopeter_rating: 4.1,
              hellopeter_review_count: 88,
              hellopeter_url: 'https://www.hellopeter.com/chas-everitt-international-property-group',
              web_reviews: [
                {
                  source: 'Facebook',
                  rating: '5/5',
                  votes: '9 votes',
                  url: 'https://www.facebook.com/p/Chas-Everitt-Hout-Bay-100058326147029/'
                }
              ],
              agency_risk_level: 'low',
              agency_complaint_sample: 'Consistently praised for quick lease turnaround and polite maintenance coordination.',
              agency_flags: [
                'Top-tier Google rating (4.9★ across 105 verified local reviews)',
                '5/5 customer rating on Facebook "Reviews from the web"',
                'Established local branch with strong Hout Bay presence'
              ],
              is_direct_landlord: false,
              view_category: 'Sea',
              is_pet_friendly: false,
              is_furnished: false,
              amenities: ['Sea Views', 'Mountain Views', 'Secure Parking Bay', 'Prepaid Electricity', 'CCTV Security', 'Electric Fencing'],
              image_urls: [
                'https://images.prop24.com/387401999/Ensure960x540',
                'https://images.prop24.com/387402001/Ensure960x540',
                'https://images.prop24.com/387402002/Ensure960x540'
              ],
              description: 'Charming beachfront studio apartment offering breathtaking sea and mountain views directly overlooking Hout Bay and Sentinel Peak. Features 1 bathroom, prepaid electricity, utilities included, secure parking bay, electric fencing and CCTV security. Managed by Chas Everitt Hout Bay.'
            }
          ];
          setListings(sampleListings);
          // Auto evaluate first listing
          evaluateListing(sampleListings[0]);
        } else {
          setListings(items);
          if (items[0]) evaluateListing(items[0]);
        }
      }
    } catch (err) {
      console.error('[DISCOVER ERROR]', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Evaluate single listing with Gemini 3.8 Flash
  const evaluateListing = async (listing: any) => {
    const listId = listing.id || listing.source_url;
    setEvaluatingIds(prev => ({ ...prev, [listId]: true }));
    try {
      const res = await fetchWithAuth('/evaluate-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing,
          must_include: mustInclude,
          must_exclude: mustExclude,
          lifestyle_signals: selectedProfiles,
          strict_mode: strictMode,
          require_verified_sea_view: requireVerifiedSeaView,
          min_agency_rating: minAgencyRating,
          exclude_low_rated_agencies: excludeLowRatedAgencies,
          allow_direct_landlords: allowDirectLandlords,
          commute_anchors: enableProCommute ? commuteAnchors : [],
          require_independent_living: requireIndependentLiving,
          require_private_entrance: requirePrivateEntrance,
          require_private_garden: requirePrivateGarden,
          exclude_landlord_on_site: excludeLandlordOnSite,
          exclude_shared_house: excludeSharedHouse
        })
      });

      if (res && res.ok) {
        const data = await res.json();
        if (data.report) {
          setAiReports(prev => ({ ...prev, [listId]: data.report }));
        }
      }
    } catch (err) {
      console.error('[EVALUATION ERROR]', err);
    } finally {
      setEvaluatingIds(prev => ({ ...prev, [listId]: false }));
    }
  };

  // Save / Deploy Alert
  const handleDeployAlert = async () => {
    setIsDeployingAlert(true);
    setAlertSuccessMsg('');
    try {
      const payload = {
        user_id: user?.uid,
        search_query: `AI Radar: ${targetArea} (${mustInclude.slice(0, 2).join(', ')})`,
        target_area: targetArea,
        alert_enabled: true,
        max_price: maxPrice,
        min_bedrooms: bedrooms === 'any' ? [] : [parseInt(bedrooms, 10)],
        rental_type: rentalType,
        pet_friendly: petPolicy === 'yes',
        must_include: mustInclude,
        must_exclude: mustExclude,
        lifestyle_signals: selectedProfiles,
        strict_mode: strictMode,
        min_fit_score: 70,
        min_agency_rating: minAgencyRating,
        exclude_low_rated_agencies: excludeLowRatedAgencies,
        allow_direct_landlords: allowDirectLandlords,
        require_verified_sea_view: requireVerifiedSeaView,
        commute_anchors: enableProCommute ? commuteAnchors : [],
        require_independent_living: requireIndependentLiving,
        require_private_entrance: requirePrivateEntrance,
        require_private_garden: requirePrivateGarden,
        exclude_landlord_on_site: excludeLandlordOnSite,
        exclude_shared_house: excludeSharedHouse
      };

      const res = await fetchWithAuth('/deploy-sniper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res && res.ok) {
        const data = await res.json();
        if (data.status === 'limited') {
          alert(data.message);
        } else {
          setAlertSuccessMsg(`AI Alert active! Monitoring ${targetArea} with Agency Guard (≥ ${minAgencyRating || 'Any'}★).`);
        }
      }
    } catch (err) {
      console.error('[DEPLOY ALERT ERROR]', err);
    } finally {
      setIsDeployingAlert(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-white selection:bg-emerald-500 selection:text-black">
      <Navbar 
        user={user} 
        profile={profile} 
        handleLogout={() => {}} 
      />

      <main className="max-w-[1440px] mx-auto px-4 md:px-8 pt-28 pb-20">
        {/* Hero Header */}
        <div className="mb-10 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-[0.25em] mb-4 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <Sparkle size={14} weight="fill" className="animate-spin" style={{ animationDuration: '6s' }} />
            Gemini 3.8 Flash • AI Property Intelligence
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase">
            Discover & Alert Radar
          </h1>
          <p className="text-white/40 text-xs md:text-sm font-medium mt-2 leading-relaxed">
            Arm your property search with personal preferences, negative exclusions, and instant AI reports on pros, cons, and hidden costs.
          </p>
        </div>

        {/* 2-Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL: Tactical Alert & AI Criteria Setup Form */}
          <div className="lg:col-span-5 bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-7 sticky top-28">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Funnel size={18} weight="bold" className="text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-[0.25em]">
                  Alert Configuration
                </h3>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                Stage 1 & 2
              </span>
            </div>

            {/* Target Suburb */}
            <div className="relative">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-2">
                Target Suburb / Neighborhood
              </label>
              <div className="relative">
                <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input 
                  type="text" 
                  value={targetArea}
                  onChange={(e) => setTargetArea(e.target.value)}
                  placeholder="e.g. Hout Bay, Sea Point, Camps Bay..."
                  className="w-full bg-black/60 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-xs font-bold text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none transition-all"
                />
              </div>

              {suburbSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-black/90 border border-white/10 rounded-2xl p-2 z-50 shadow-2xl backdrop-blur-xl">
                  {suburbSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setTargetArea(s);
                        setSuburbSuggestions([]);
                      }}
                      className="w-full text-left px-4 py-2.5 rounded-xl text-xs text-white/80 hover:bg-emerald-500/10 hover:text-emerald-400 font-bold transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Price Ceiling */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                  Budget Ceiling
                </label>
                <span className="text-xs font-black text-emerald-400 font-mono">
                  {formatCurrency(maxPrice)}/mo
                </span>
              </div>
              <input 
                type="range"
                min="5000"
                max="80000"
                step="500"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Specs: Beds & Baths */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-2">
                  Bedrooms
                </label>
                <div className="flex bg-black/60 p-1 rounded-xl border border-white/5">
                  {['any', '1', '2', '3+'].map((b) => (
                    <button
                      key={b}
                      onClick={() => setBedrooms(b)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                        bedrooms === b ? 'bg-emerald-500 text-black shadow-md' : 'text-white/30 hover:text-white'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-2">
                  Bathrooms
                </label>
                <div className="flex bg-black/60 p-1 rounded-xl border border-white/5">
                  {['any', '1', '2+'].map((ba) => (
                    <button
                      key={ba}
                      onClick={() => setBathrooms(ba)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                        bathrooms === ba ? 'bg-emerald-500 text-black shadow-md' : 'text-white/30 hover:text-white'
                      }`}
                    >
                      {ba}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Lifestyle Profile Presets */}
            <div>
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-2">
                Lifestyle Presets (Auto-Tagging)
              </label>
              <div className="flex flex-wrap gap-2">
                {LIFESTYLE_PROFILES.map((p) => {
                  const isSelected = selectedProfiles.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleToggleProfile(p)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                        isSelected 
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                          : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI MUST INCLUDE */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle size={14} weight="fill" />
                  Must Include (Preferences)
                </label>
                <span className="text-[9px] text-white/30 font-bold">{mustInclude.length} active</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_MUST_INCLUDES.map((item) => {
                  const active = mustInclude.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => handleToggleInclude(item)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                        active 
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                          : 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/5'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}
                      {item}
                    </button>
                  );
                })}
              </div>
              
              {/* Custom include input */}
              <form onSubmit={handleAddCustomInclude} className="flex gap-2 pt-1">
                <input 
                  type="text" 
                  value={customIncludeInput}
                  onChange={(e) => setCustomIncludeInput(e.target.value)}
                  placeholder="Add custom must-include..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-white/20 focus:border-emerald-500/40 focus:outline-none"
                />
                <button 
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase transition-all"
                >
                  Add
                </button>
              </form>
            </div>

            {/* AI MUST EXCLUDE */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                  <WarningCircle size={14} weight="fill" />
                  Must Exclude (Deal-Breakers)
                </label>
                <span className="text-[9px] text-white/30 font-bold">{mustExclude.length} active</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_MUST_EXCLUDES.map((item) => {
                  const active = mustExclude.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => handleToggleExclude(item)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                        active 
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' 
                          : 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/5'
                      }`}
                    >
                      {active ? '✕ ' : '+ '}
                      {item}
                    </button>
                  );
                })}
              </div>

              {/* Custom exclude input */}
              <form onSubmit={handleAddCustomExclude} className="flex gap-2 pt-1">
                <input 
                  type="text" 
                  value={customExcludeInput}
                  onChange={(e) => setCustomExcludeInput(e.target.value)}
                  placeholder="Add custom deal-breaker..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-white/20 focus:border-rose-500/40 focus:outline-none"
                />
                <button 
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase transition-all"
                >
                  Add
                </button>
              </form>
            </div>

            {/* 🛡️ AGENCY & LANDLORD REPUTATION GUARD */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} weight="fill" className="text-emerald-400" />
                  <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                    Agency & Landlord Guard
                  </h4>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Google Intel
                </span>
              </div>

              <div>
                <label className="text-[10px] font-black text-white/50 uppercase tracking-widest block mb-2">
                  Min Agency Google Review Rating
                </label>
                <div className="grid grid-cols-4 gap-1.5 bg-black/60 p-1 rounded-xl border border-white/5">
                  {[
                    { val: null, label: 'Any' },
                    { val: 2.5, label: '≥ 2.5★' },
                    { val: 3.0, label: '≥ 3.0★' },
                    { val: 4.0, label: '≥ 4.0★' }
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setMinAgencyRating(opt.val)}
                      className={`py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                        minAgencyRating === opt.val 
                          ? 'bg-emerald-500 text-black shadow-md' 
                          : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-white/40 mt-1.5">
                  {minAgencyRating === 3.0 
                    ? 'Recommended: Flags agencies under 3.0★ (e.g. Watchprop, Trafalgar) for deposit disputes.'
                    : minAgencyRating === 4.0 
                      ? 'Strict: High filter. Excludes 75%+ of agencies including major reputable franchises.'
                      : minAgencyRating === 2.5
                        ? 'Basic: Filters only the absolute lowest-rated property managers.'
                        : 'No rating filter active.'}
                </p>
              </div>

              {/* Private Landlords Toggle */}
              <div 
                onClick={() => setAllowDirectLandlords(!allowDirectLandlords)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-all"
              >
                <span className="text-[10px] font-bold text-white/80">
                  Always Allow Direct Landlords (Private Owners)
                </span>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  allowDirectLandlords ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-white/20'
                }`}>
                  {allowDirectLandlords && <Check size={12} weight="bold" />}
                </div>
              </div>

              {/* Strict Agency Exclusion Checkbox */}
              <div 
                onClick={() => setExcludeLowRatedAgencies(!excludeLowRatedAgencies)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  excludeLowRatedAgencies 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                    excludeLowRatedAgencies ? 'bg-red-500 border-red-400 text-white' : 'border-white/20'
                  }`}>
                    {excludeLowRatedAgencies && <Check size={12} weight="bold" />}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-white block">
                      Silently exclude low-rated agencies from Alerts
                    </span>
                    <span className="text-[9px] text-white/40 leading-snug block mt-0.5">
                      {excludeLowRatedAgencies 
                        ? 'You will not receive any alerts from agencies below your star rating.' 
                        : 'Advisory (Default): You still get alerted, with a prominent Agency Red Flag in the report.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* STRICT DISQUALIFICATION TOGGLE */}
            <div 
              onClick={() => setStrictMode(!strictMode)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                strictMode 
                  ? 'bg-red-500/[0.08] border-red-500/30' 
                  : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                  strictMode ? 'bg-red-500 border-red-400 text-white' : 'border-white/30'
                }`}>
                  {strictMode && <Check size={14} weight="bold" />}
                </div>
                <div>
                  <h5 className="text-[11px] font-black uppercase tracking-wider text-white">
                    Strict Disqualification Mode
                  </h5>
                  <p className="text-[10px] text-white/50 mt-1 leading-relaxed">
                    {strictMode ? (
                      <span className="text-red-300 font-semibold">
                        Strict: Silently excludes properties if any must-have is missing or deal-breaker is detected.
                      </span>
                    ) : (
                      <span>
                        <strong className="text-emerald-400">Advisory Mode (Recommended):</strong> You will be notified of promising listings, with all missing items and red flags highlighted in the report so you never miss an unlisted gem.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* 🌊 PRO VISION: SEA VIEW PHOTO VERIFICATION TOGGLE */}
            <div 
              onClick={() => setRequireVerifiedSeaView(!requireVerifiedSeaView)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                requireVerifiedSeaView 
                  ? 'bg-cyan-500/[0.08] border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                  : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                  requireVerifiedSeaView ? 'bg-cyan-500 border-cyan-400 text-black' : 'border-white/30'
                }`}>
                  {requireVerifiedSeaView && <Check size={14} weight="bold" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-[11px] font-black uppercase tracking-wider text-white">
                      Verify Sea View in Photos
                    </h5>
                    <span className="text-[9px] font-black uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                      PHOTO CHECK
                    </span>
                  </div>
                  <p className="text-[10px] text-white/50 mt-1 leading-relaxed">
                    {requireVerifiedSeaView ? (
                      <span className="text-cyan-300 font-semibold">
                        Active: AI checks the actual photos. Stock beach photos or fake "sea view" claims are automatically filtered out.
                      </span>
                    ) : (
                      <span>
                        Off: Matches based on the agent's listing description.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* 📍 PRO COMMUTE: DISTANCE & LIFE ANCHORS */}
            <div className={`p-5 rounded-2xl border transition-all ${
              enableProCommute 
                ? 'bg-gradient-to-br from-blue-950/40 via-indigo-950/20 to-black/40 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.12)]' 
                : 'bg-white/[0.02] border-white/10'
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    enableProCommute ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-white/40'
                  }`}>
                    <Car size={16} weight="fill" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                        Commute & Life Anchors
                      </h4>
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-300 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-full">
                        PRO COMMUTE
                      </span>
                    </div>
                    <p className="text-[9px] text-white/40 mt-0.5">
                      Filter alerts by real driving distance & peak commute time
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEnableProCommute(!enableProCommute)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    enableProCommute ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                  aria-label="Toggle Pro Commute"
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      enableProCommute ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {enableProCommute && (
                <div className="space-y-4 pt-3">
                  {/* Active Anchors List */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center justify-between">
                      <span>Monitored Destinations</span>
                      <span className="text-[9px] text-white/40 font-bold">{commuteAnchors.length} active</span>
                    </label>

                    {commuteAnchors.length === 0 ? (
                      <p className="text-[10px] text-white/40 italic py-1">
                        No commute anchors set. Select a preset below or add a custom destination.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {commuteAnchors.map((anchor) => (
                          <div
                            key={anchor.id}
                            className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3 group hover:border-blue-500/30 transition-all"
                          >
                            <div className="min-w-0">
                              <span className="text-[10px] font-black uppercase tracking-wider text-white block truncate">
                                {anchor.label}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-white/50 mt-0.5">
                                <span className="truncate">{anchor.target_place}</span>
                                <span>•</span>
                                <span className="text-blue-300 font-bold shrink-0">≤ {anchor.max_commute_mins} mins</span>
                                <span>•</span>
                                <span className="text-white/60 shrink-0">≤ {anchor.max_distance_km} km</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveAnchor(anchor.id)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 text-white/40 transition-all shrink-0"
                              aria-label="Remove Anchor"
                            >
                              <X size={13} weight="bold" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Add Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-white/40 block">
                      Quick Add Popular Cape Town Life Anchors:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_COMMUTE_DESTINATIONS.map((preset) => {
                        const isAdded = commuteAnchors.some(
                          a => a.target_place.toLowerCase() === preset.target_place.toLowerCase()
                        );
                        return (
                          <button
                            key={preset.target_place}
                            type="button"
                            onClick={() => handleAddPresetAnchor(preset)}
                            disabled={isAdded}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                              isAdded
                                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 opacity-60 cursor-default'
                                : 'bg-white/[0.02] border-white/10 text-white/60 hover:text-white hover:bg-blue-500/10 hover:border-blue-500/30'
                            }`}
                          >
                            {isAdded ? '✓ ' : '+ '}
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Anchor Input Toggle / Form */}
                  {!showAddAnchorForm ? (
                    <button
                      type="button"
                      onClick={() => setShowAddAnchorForm(true)}
                      className="w-full py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-dashed border-white/10 hover:border-blue-500/30 text-[10px] font-bold text-white/60 hover:text-blue-300 uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus size={12} weight="bold" />
                      Add Custom Office / Gym / School
                    </button>
                  ) : (
                    <form onSubmit={handleAddCustomAnchor} className="p-3 rounded-xl bg-black/60 border border-blue-500/30 space-y-3">
                      <div className="flex items-center justify-between pb-1 border-b border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-300">
                          Custom Life Anchor
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAddAnchorForm(false)}
                          className="text-white/40 hover:text-white text-xs"
                        >
                          <X size={13} weight="bold" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-white/50 uppercase">Anchor Name / Label</label>
                        <input
                          type="text"
                          value={customAnchorLabel}
                          onChange={(e) => setCustomAnchorLabel(e.target.value)}
                          placeholder="e.g. Partner's Office, Virgin Active Point"
                          className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 focus:border-blue-500/40 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-white/50 uppercase">Destination / Address</label>
                        <input
                          type="text"
                          value={customAnchorPlace}
                          onChange={(e) => setCustomAnchorPlace(e.target.value)}
                          placeholder="e.g. V&A Waterfront, Century City, Claremont"
                          className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 focus:border-blue-500/40 focus:outline-none"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-white/50 uppercase">Max Drive Time</label>
                          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1">
                            <Clock size={13} className="text-blue-400" />
                            <input
                              type="number"
                              min="5"
                              max="120"
                              value={customAnchorMins}
                              onChange={(e) => setCustomAnchorMins(parseInt(e.target.value) || 30)}
                              className="w-full bg-transparent text-xs text-white focus:outline-none"
                            />
                            <span className="text-[9px] text-white/40">mins</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-white/50 uppercase">Max Distance</label>
                          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1">
                            <Car size={13} className="text-blue-400" />
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={customAnchorKm}
                              onChange={(e) => setCustomAnchorKm(parseInt(e.target.value) || 20)}
                              className="w-full bg-transparent text-xs text-white focus:outline-none"
                            />
                            <span className="text-[9px] text-white/40">km</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-black text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        Confirm & Save Anchor
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* 🏡 LIVING AUTONOMY & PRIVACY SHIELD */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Lock size={15} weight="bold" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                      Living Autonomy & Privacy Shield
                    </h4>
                    <p className="text-[10px] text-white/40 font-medium">
                      Filter out shared gardens, driveways, cottages, and live-in landlords.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {/* 1. Independent Living Only */}
                <div 
                  onClick={() => setRequireIndependentLiving(!requireIndependentLiving)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    requireIndependentLiving 
                      ? 'bg-emerald-500/[0.08] border-emerald-500/40 text-white shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] text-white/80'
                  }`}
                >
                  <div className={`w-4 h-4 rounded mt-0.5 border flex items-center justify-center shrink-0 transition-all ${
                    requireIndependentLiving ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-white/30'
                  }`}>
                    {requireIndependentLiving && <Check size={12} weight="bold" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Require Standalone / Independent Living</span>
                    <span className="text-[10px] text-white/40 block mt-0.5">
                      Strictly exclude garden cottages, granny flats, and dual-living setups on shared erfs.
                    </span>
                  </div>
                </div>

                {/* 2. Private Entrance & Driveway */}
                <div 
                  onClick={() => setRequirePrivateEntrance(!requirePrivateEntrance)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    requirePrivateEntrance 
                      ? 'bg-emerald-500/[0.08] border-emerald-500/40 text-white shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] text-white/80'
                  }`}
                >
                  <div className={`w-4 h-4 rounded mt-0.5 border flex items-center justify-center shrink-0 transition-all ${
                    requirePrivateEntrance ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-white/30'
                  }`}>
                    {requirePrivateEntrance && <Check size={12} weight="bold" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Require Dedicated Entrance & Driveway</span>
                    <span className="text-[10px] text-white/40 block mt-0.5">
                      Exclude properties with shared driveways, common security gates, or entrance past main house.
                    </span>
                  </div>
                </div>

                {/* 3. Private Exclusive Garden / Yard */}
                <div 
                  onClick={() => setRequirePrivateGarden(!requirePrivateGarden)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    requirePrivateGarden 
                      ? 'bg-emerald-500/[0.08] border-emerald-500/40 text-white shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] text-white/80'
                  }`}
                >
                  <div className={`w-4 h-4 rounded mt-0.5 border flex items-center justify-center shrink-0 transition-all ${
                    requirePrivateGarden ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-white/30'
                  }`}>
                    {requirePrivateGarden && <Check size={12} weight="bold" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Require Private Garden & Pool (No Shared Grounds)</span>
                    <span className="text-[10px] text-white/40 block mt-0.5">
                      Exclude shared communal lawns, shared courtyards, or pools at owner's discretion.
                    </span>
                  </div>
                </div>

                {/* 4. Exclude Landlord on Site */}
                <div 
                  onClick={() => setExcludeLandlordOnSite(!excludeLandlordOnSite)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    excludeLandlordOnSite 
                      ? 'bg-emerald-500/[0.08] border-emerald-500/40 text-white shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] text-white/80'
                  }`}
                >
                  <div className={`w-4 h-4 rounded mt-0.5 border flex items-center justify-center shrink-0 transition-all ${
                    excludeLandlordOnSite ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-white/30'
                  }`}>
                    {excludeLandlordOnSite && <Check size={12} weight="bold" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Exclude Landlord Residing on Property</span>
                    <span className="text-[10px] text-white/40 block mt-0.5">
                      Filter out listings where the property owner lives in the main house or sets house rules.
                    </span>
                  </div>
                </div>

                {/* 5. Exclude Shared House / Room to Let */}
                <div 
                  onClick={() => setExcludeSharedHouse(!excludeSharedHouse)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    excludeSharedHouse 
                      ? 'bg-emerald-500/[0.08] border-emerald-500/40 text-white shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] text-white/80'
                  }`}
                >
                  <div className={`w-4 h-4 rounded mt-0.5 border flex items-center justify-center shrink-0 transition-all ${
                    excludeSharedHouse ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-white/30'
                  }`}>
                    {excludeSharedHouse && <Check size={12} weight="bold" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Block Room / House Shares (Digs)</span>
                    <span className="text-[10px] text-white/40 block mt-0.5">
                      Automatically exclude flatshares, room lets, and student digs.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleDiscoverScan}
                disabled={isScanning}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.25)] hover:scale-[1.01] active:scale-95 disabled:opacity-50"
              >
                <MagnifyingGlass size={16} weight="bold" />
                {isScanning ? 'Scanning Discovery Zone...' : 'Discover & Run AI Analysis'}
              </button>

              <button
                onClick={handleDeployAlert}
                disabled={isDeployingAlert}
                className="w-full bg-white/5 hover:bg-white/10 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lightning size={16} weight="fill" className="text-amber-400" />
                {isDeployingAlert ? 'Arming Sniper Radar...' : 'Save & Arm Background Alert'}
              </button>

              {alertSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center animate-in fade-in">
                  ✓ {alertSuccessMsg}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Discovered Properties & Forensic Reports */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black uppercase tracking-wider">
                  Live Intelligence Feed
                </h3>
                <p className="text-xs text-white/40">
                  Showing matches in <strong className="text-white">{targetArea || 'All Areas'}</strong>
                </p>
              </div>

              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                {listings.length} Discovered
              </span>
            </div>

            {listings.length === 0 && !isScanning && (
              <div className="p-12 text-center rounded-[2.5rem] bg-white/[0.02] border border-white/5">
                <p className="text-sm font-bold text-white/40 uppercase tracking-widest">
                  No properties currently matching your search
                </p>
                <p className="text-xs text-white/20 mt-1">
                  Try broadening your budget or suburb criteria.
                </p>
              </div>
            )}

            {listings.map((l, idx) => {
              const listId = l.id || l.source_url;
              const isEvaluating = !!evaluatingIds[listId];
              const report = aiReports[listId];

              return (
                <motion.div
                  key={listId}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className="bg-white/[0.03] border border-white/10 hover:border-white/20 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-md transition-all shadow-xl"
                >
                  {/* Card Top Details */}
                  <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg md:text-xl font-bold tracking-tight">
                          {l.title}
                        </h4>
                        {l.view_category === 'Mountain' && <span title="Mountain View" className="text-lg">🏔️</span>}
                        {l.view_category === 'Sea' && <span title="Sea View" className="text-lg">🌊</span>}
                      </div>
                      <p className="text-xs text-white/40 font-bold uppercase tracking-[0.2em] mt-1">
                        {l.address}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                          <CalendarBlank size={12} weight="bold" />
                          {formatListingDate(l.created_at || l.published_at)}
                        </span>
                        {l.available_date && (
                          <span className="text-[10px] font-medium text-white/40">
                            Available: {l.available_date}
                          </span>
                        )}
                      </div>

                      {/* Agency Reputation Tag */}
                      <div className="flex items-center gap-2 mt-2.5">
                        {l.is_direct_landlord ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20">
                            <span>👤</span> Direct Landlord (No Agency Fees)
                          </span>
                        ) : l.agency_name ? (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${
                            l.agency_rating && l.agency_rating < 3.0
                              ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                              : 'text-white/80 bg-white/5 border-white/10'
                          }`}>
                            <span>🏢</span>
                            <strong>{l.agency_name}</strong>
                            {l.agency_rating ? (
                              <span className={l.agency_rating < 3.0 ? 'text-rose-400 font-black' : 'text-emerald-400 font-black'}>
                                ({l.agency_rating}★ Google)
                              </span>
                            ) : null}
                            {l.agency_rating && l.agency_rating < 3.0 && (
                              <span className="text-[9px] text-rose-300 font-black uppercase tracking-wider ml-1 bg-rose-500/20 px-1.5 py-0.5 rounded">
                                ⚠️ High Tenant Risk
                              </span>
                            )}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-black tracking-tight text-white">
                        {formatCurrency(l.price)}
                      </p>
                      <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest border border-emerald-400/30 px-2 py-0.5 rounded-md mt-1 inline-block">
                        {l.property_type || 'Unit'}
                      </span>
                    </div>
                  </div>

                  {/* Spec Chips */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <div className="px-3 py-1 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                      <span>🛏️</span> {l.bedrooms || 1} Bed
                    </div>
                    <div className="px-3 py-1 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                      <span>🚿</span> {l.bathrooms || 1} Bath
                    </div>
                    {l.sqm ? (
                      <div className="px-3 py-1 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                        <span>📐</span> {l.sqm} m²
                      </div>
                    ) : null}
                    {l.is_pet_friendly && (
                      <div className="px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/5 text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                        <span>🐾</span> Pet Friendly
                      </div>
                    )}
                  </div>

                  {/* Listing excerpt */}
                  {l.description && (
                    <p className="text-xs text-white/60 mb-5 leading-relaxed line-clamp-2">
                      {l.description}
                    </p>
                  )}

                  {/* Actions & Report Trigger */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-3">
                      {!report && (
                        <button
                          onClick={() => evaluateListing(l)}
                          disabled={isEvaluating}
                          className="px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all"
                        >
                          <Sparkle size={14} weight="fill" />
                          {isEvaluating ? 'Evaluating with Gemini...' : 'Generate AI Pros & Cons'}
                        </button>
                      )}
                    </div>

                    <a 
                      href={l.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ml-auto"
                    >
                      <ArrowSquareOut size={14} weight="bold" />
                      View on {l.platform || 'Portal'}
                    </a>
                  </div>

                  {/* THE COMPREHENSIVE PROS & CONS DOSSIER */}
                  {report && (
                    <PropertyAiDossier 
                      report={report}
                      listingTitle={l.title}
                      isExpandedDefault={true}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>

        </div>
      </main>
    </div>
  );
}
