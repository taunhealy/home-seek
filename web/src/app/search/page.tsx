'use client';

import React, { useState, useEffect } from 'react';
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
  SpeakerSimpleSlash
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { AreaPillsInput } from '@/components/AreaPillsInput';

interface CommuteAnchor {
  id: string;
  label: string;
  target_place: string;
  max_commute_mins: number;
  max_distance_km: number;
  commute_mode: 'driving' | 'transit' | 'walking' | 'bicycling';
}

const PRESET_ANCHORS = [
  { label: 'Work (Amazon River Club HQ)', target_place: 'Amazon River Club, Observatory', mins: 30, km: 20 },
  { label: 'Cape Town CBD / Foreshore', target_place: 'Cape Town City Bowl', mins: 25, km: 15 },
  { label: 'UCT Main Campus', target_place: 'University of Cape Town, Rondebosch', mins: 20, km: 12 },
  { label: 'Camps Bay Beach', target_place: 'Camps Bay Promenade', mins: 20, km: 15 },
];

export default function SearchPage() {
  const router = useRouter();
  const { user, profile, loading, login, logout, refreshProfile } = useAuth();

  // Search Criteria State - Area Filter Pills
  const [selectedAreas, setSelectedAreas] = useState<string[]>([
    'Camps Bay', 
    'Gardens', 
    'Observatory', 
    'Sea Point'
  ]);
  const locationQuery = selectedAreas.join(', ');

  const [minPrice, setMinPrice] = useState('12000');
  const [maxPrice, setMaxPrice] = useState('30000');
  const [bedrooms, setBedrooms] = useState('2');
  const [bathrooms, setBathrooms] = useState('1');

  // Load saved criteria from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('homeseek_search_criteria');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.locationQuery && typeof parsed.locationQuery === 'string') {
          const loadedAreas = parsed.locationQuery.split(',').map((s: string) => s.trim()).filter(Boolean);
          if (loadedAreas.length > 0) {
            setSelectedAreas(loadedAreas);
          }
        }
        if (parsed.minPrice) setMinPrice(parsed.minPrice);
        if (parsed.maxPrice) setMaxPrice(parsed.maxPrice);
        if (parsed.bedrooms) setBedrooms(parsed.bedrooms);
        if (parsed.bathrooms) setBathrooms(parsed.bathrooms);
        if (parsed.privacy) {
          if (parsed.privacy.requireIndependentLiving !== undefined) setRequireIndependentLiving(parsed.privacy.requireIndependentLiving);
          if (parsed.privacy.requirePrivateEntrance !== undefined) setRequirePrivateEntrance(parsed.privacy.requirePrivateEntrance);
          if (parsed.privacy.requirePrivateGarden !== undefined) setRequirePrivateGarden(parsed.privacy.requirePrivateGarden);
          if (parsed.privacy.excludeLandlordOnSite !== undefined) setExcludeLandlordOnSite(parsed.privacy.excludeLandlordOnSite);
          if (parsed.privacy.excludeSharedHouse !== undefined) setExcludeSharedHouse(parsed.privacy.excludeSharedHouse);
          if (parsed.privacy.requireNoOneAbove !== undefined) setRequireNoOneAbove(parsed.privacy.requireNoOneAbove);
        }
      }
    } catch (e) {}
  }, []);

  // Living Autonomy & Privacy Shield Checkboxes
  const [requireIndependentLiving, setRequireIndependentLiving] = useState(true);
  const [requirePrivateEntrance, setRequirePrivateEntrance] = useState(true);
  const [requirePrivateGarden, setRequirePrivateGarden] = useState(false);
  const [excludeLandlordOnSite, setExcludeLandlordOnSite] = useState(true);
  const [excludeSharedHouse, setExcludeSharedHouse] = useState(true);
  const [requireNoOneAbove, setRequireNoOneAbove] = useState(false);

  // Privacy Info Modal State
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Proximity Anchors
  const [anchors, setAnchors] = useState<CommuteAnchor[]>([
    {
      id: 'anchor-1',
      label: 'Work (Amazon River Club HQ)',
      target_place: 'Amazon River Club, Observatory',
      max_commute_mins: 30,
      max_distance_km: 25,
      commute_mode: 'driving',
    },
    {
      id: 'anchor-2',
      label: 'Cape Town CBD',
      target_place: 'Cape Town CBD',
      max_commute_mins: 25,
      max_distance_km: 20,
      commute_mode: 'driving',
    },
  ]);

  const [newAnchorLabel, setNewAnchorLabel] = useState('');
  const [newAnchorPlace, setNewAnchorPlace] = useState('');
  const [newAnchorMins, setNewAnchorMins] = useState('25');

  // Must-Haves
  const [mustInverter, setMustInverter] = useState(true);
  const [mustFibre, setMustFibre] = useState(true);
  const [mustParking, setMustParking] = useState(true);
  const [mustPets, setMustPets] = useState(false);

  // Alert Channels
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Save criteria to backend alert and navigate
  const handleSaveAndExplore = async (destination: 'properties' | 'alerts' = 'properties') => {
    setIsSaving(true);
    const uid = profile?.id || user?.uid || 'taun_test_user';

    // 1. Save locally for instant offline sync
    const criteria = {
      locationQuery,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
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

    // 2. Persist real autonomous radar alert to backend
    try {
      const primaryArea = locationQuery.split(',')[0].trim() || 'Cape Town';
      const alertPayload = {
        user_id: uid,
        target_area: primaryArea,
        search_query: `AI Radar: ${locationQuery} (${bedrooms} Bed, max R${maxPrice})`,
        max_price: parseInt(maxPrice) || 30000,
        min_bedrooms: [parseInt(bedrooms) || 1],
        property_type: 'Apartment',
        require_verified_sea_view: locationQuery.toLowerCase().includes('sea') || locationQuery.toLowerCase().includes('hout bay'),
        require_independent_living: requireIndependentLiving,
        require_private_entrance: requirePrivateEntrance,
        require_private_garden: requirePrivateGarden,
        exclude_landlord_on_site: excludeLandlordOnSite,
        exclude_shared_house: excludeSharedHouse,
        require_no_one_above: requireNoOneAbove,
        pet_friendly: mustPets,
        commute_anchors: anchors,
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
        if (destination === 'alerts') {
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
      max_distance_km: 20,
      commute_mode: 'driving',
    };
    setAnchors([...anchors, newAnchor]);
    setNewAnchorLabel('');
    setNewAnchorPlace('');
  };

  const removeAnchor = (id: string) => {
    setAnchors(anchors.filter((a) => a.id !== id));
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

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 space-y-10">
        
        {/* Header */}
        <div className="space-y-2 border-b border-zinc-200 pb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-xs font-semibold">
            <Target size={14} weight="bold" />
            <span>Search Radar Setup</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
            Define Your Search Criteria
          </h1>
          <p className="text-sm text-zinc-600 max-w-2xl leading-relaxed">
            Configure your target locations, price window, proximity anchors, and privacy requirements. 
            HomeSeek continuously checks property portals and displays matching listings in your Properties feed.
          </p>
        </div>

        {/* Form Sections */}
        <div className="space-y-8">
          
          {/* 1. Location & Budget */}
          <section className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xs">
            <h2 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
              <MapPin size={20} weight="bold" />
              <span>Target Locations & Budget</span>
            </h2>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                    Target Suburbs or Regions
                  </label>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    {selectedAreas.length} {selectedAreas.length === 1 ? 'area' : 'areas'} selected
                  </span>
                </div>
                <AreaPillsInput
                  selectedAreas={selectedAreas}
                  onChange={setSelectedAreas}
                  placeholder="Type area name (e.g. Hout Bay, Sea Point)..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                    Min Price (ZAR / AUD)
                  </label>
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="12000"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                    Max Price (ZAR / AUD)
                  </label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="30000"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                    Bedrooms
                  </label>
                  <div className="flex gap-2">
                    {['1', '2', '3', '4+'].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBedrooms(b)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                          bedrooms === b
                            ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                            : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                        }`}
                      >
                        {b} {b === '1' ? 'Bed' : 'Beds'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                    Bathrooms
                  </label>
                  <div className="flex gap-2">
                    {['1', '2', '3+'].map((bath) => (
                      <button
                        key={bath}
                        type="button"
                        onClick={() => setBathrooms(bath)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                          bathrooms === bath
                            ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                            : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                        }`}
                      >
                        {bath} {bath === '1' ? 'Bath' : 'Baths'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Living Autonomy & Privacy Shield */}
          <section className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
                    <ShieldCheck size={20} weight="bold" />
                    <span>Living Autonomy & Privacy Shield</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsPrivacyModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200/90 rounded-full transition-all cursor-pointer shadow-2xs border border-zinc-200/60"
                    title="Click for detailed breakdown of each privacy shield"
                  >
                    <Info size={14} weight="bold" className="text-zinc-500" />
                    <span>How it works</span>
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Filter out shared houses, upstairs stomping, shared gardens, or on-site landlords upfront before you tour.
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-800 px-2.5 py-1 rounded-full">
                AI Filter
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              {/* Checkbox 1: Entire Self-Contained Unit */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={requireIndependentLiving}
                  onChange={(e) => setRequireIndependentLiving(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-zinc-950 accent-zinc-950 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-zinc-950 block">Entire Self-Contained Unit</span>
                  <span className="text-[11px] text-zinc-500 block">100% private dwelling — dedicated kitchen, bathroom & living space (no shared facilities)</span>
                </div>
              </label>

              {/* Checkbox 2: No One Living Above */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={requireNoOneAbove}
                  onChange={(e) => setRequireNoOneAbove(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-zinc-950 accent-zinc-950 cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-zinc-950 block">No One Living Above</span>
                    <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md uppercase">Quiet</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 block">Top-floor apartment, penthouse, or standalone house with zero upstairs neighbors stomping overhead</span>
                </div>
              </label>

              {/* Checkbox 3: Require Private Entrance */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={requirePrivateEntrance}
                  onChange={(e) => setRequirePrivateEntrance(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-zinc-950 accent-zinc-950 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-zinc-950 block">Require Private Entrance</span>
                  <span className="text-[11px] text-zinc-500 block">No passing through someone else's hallway, foyer, or house</span>
                </div>
              </label>

              {/* Checkbox 4: Require Private Garden / Yard */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={requirePrivateGarden}
                  onChange={(e) => setRequirePrivateGarden(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-zinc-950 accent-zinc-950 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-zinc-950 block">Require Private Garden / Yard</span>
                  <span className="text-[11px] text-zinc-500 block">Exclusive outdoor area, not shared with primary house or other tenants</span>
                </div>
              </label>

              {/* Checkbox 5: Exclude Landlord On-Site */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={excludeLandlordOnSite}
                  onChange={(e) => setExcludeLandlordOnSite(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-zinc-950 accent-zinc-950 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-zinc-950 block">Exclude Landlord On-Site</span>
                  <span className="text-[11px] text-zinc-500 block">Filter out garden cottages or rooms where landlord resides on premises</span>
                </div>
              </label>

              {/* Checkbox 6: Exclude Shared House / Communes */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={excludeSharedHouse}
                  onChange={(e) => setExcludeSharedHouse(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-zinc-950 accent-zinc-950 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-zinc-950 block">Exclude Shared House / Communes</span>
                  <span className="text-[11px] text-zinc-500 block">No commune living, shared roommate accommodations, or single room rentals</span>
                </div>
              </label>

            </div>
          </section>

          {/* 3. Desired Proximity Locations (Life Anchors) */}
          <section className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xs">
            <div>
              <h2 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
                <Target size={20} weight="bold" />
                <span>Desired Proximity Locations (Life Anchors)</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Your properties map will plot these anchors and calculate commute times for every discovered property.
              </p>
            </div>

            {/* Existing Anchors List */}
            <div className="space-y-2.5">
              {anchors.map((anchor) => (
                <div
                  key={anchor.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-bold">
                      <Target size={16} weight="bold" />
                    </div>
                    <div>
                      <span className="font-bold text-zinc-950 block">{anchor.label}</span>
                      <span className="text-[11px] text-zinc-500 block">{anchor.target_place}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-zinc-600 font-medium hidden sm:inline">
                      Max {anchor.max_commute_mins} mins ({anchor.commute_mode})
                    </span>
                    <button
                      onClick={() => removeAnchor(anchor.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-600 transition-colors"
                      title="Remove anchor"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Anchor Form */}
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
              <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">Add Proximity Anchor</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Label (e.g. Work HQ)"
                  value={newAnchorLabel}
                  onChange={(e) => setNewAnchorLabel(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
                <input
                  type="text"
                  placeholder="Destination / Address"
                  value={newAnchorPlace}
                  onChange={(e) => setNewAnchorPlace(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Max mins (e.g. 25)"
                    value={newAnchorMins}
                    onChange={(e) => setNewAnchorMins(e.target.value)}
                    className="w-24 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                  <button
                    onClick={addAnchor}
                    className="flex-1 bg-zinc-950 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} weight="bold" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Must-Have Amenities */}
          <section className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xs">
            <h2 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
              <Lightning size={20} weight="bold" />
              <span>Must-Have Amenities</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setMustInverter(!mustInverter)}
                className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all ${
                  mustInverter
                    ? 'bg-zinc-950 text-white border-zinc-950'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                <Lightning size={18} weight={mustInverter ? "fill" : "regular"} />
                <span>Inverter / Backup</span>
              </button>

              <button
                type="button"
                onClick={() => setMustFibre(!mustFibre)}
                className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all ${
                  mustFibre
                    ? 'bg-zinc-950 text-white border-zinc-950'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                <Sparkle size={18} weight={mustFibre ? "fill" : "regular"} />
                <span>Fibre Ready</span>
              </button>

              <button
                type="button"
                onClick={() => setMustParking(!mustParking)}
                className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all ${
                  mustParking
                    ? 'bg-zinc-950 text-white border-zinc-950'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                <Car size={18} weight={mustParking ? "fill" : "regular"} />
                <span>Secure Parking</span>
              </button>

              <button
                type="button"
                onClick={() => setMustPets(!mustPets)}
                className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all ${
                  mustPets
                    ? 'bg-zinc-950 text-white border-zinc-950'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                <Dog size={18} weight={mustPets ? "fill" : "regular"} />
                <span>Pet Friendly</span>
              </button>
            </div>
          </section>

          {/* Action CTA */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-200">
            <p className="text-xs text-zinc-500">
              Criteria automatically registers an active autonomous monitor and syncs with your interactive Properties view.
            </p>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleSaveAndExplore('alerts')}
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl border border-zinc-200 hover:border-zinc-300 bg-white text-zinc-900 font-semibold text-xs transition-all shadow-2xs hover:bg-zinc-50 flex items-center justify-center gap-2"
              >
                <Bell size={16} weight="bold" />
                <span>Save to Radar Alerts</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveAndExplore('properties')}
                disabled={isSaving}
                className="w-full sm:w-auto bg-zinc-950 text-white hover:bg-black px-7 py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <ArrowsClockwise size={16} className="animate-spin" />
                    <span>Activating Radar...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle size={16} weight="fill" className="text-emerald-400" />
                    <span>Radar Activated!</span>
                  </>
                ) : (
                  <>
                    <span>Activate & View Properties</span>
                    <ArrowRight size={16} weight="bold" />
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

      </main>

      {/* ==================== PRIVACY SHIELD EXPLANATION MODAL ==================== */}
      {isPrivacyModalOpen && (
        <div 
          onClick={() => setIsPrivacyModalOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-zinc-100 max-h-[90vh] overflow-y-auto space-y-6 relative custom-scrollbar animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-zinc-950 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck size={22} weight="bold" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-950">
                    Living Autonomy & Privacy Shield
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    How HomeSeek evaluates property listings to protect your privacy and daily peace of mind.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-950 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                aria-label="Close modal"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Explanation Grid */}
            <div className="space-y-4">
              
              {/* Feature 1 */}
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-950 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-zinc-950" />
                  <span>Entire Self-Contained Unit</span>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed pl-4">
                  <strong className="text-zinc-800">What it means:</strong> A 100% private dwelling with your own dedicated kitchen, bathroom, and living area.
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed pl-4">
                  <strong className="text-zinc-700">Why this matters in South Africa:</strong> Many landlords advertise partitioned bedrooms, granny flatlets, or backhouses as "bachelor studios", yet they secretly share a geyser, laundry hookup, or hallway. This filter ensures zero shared facilities.
                </p>
              </div>

              {/* Feature 2: No One Living Above */}
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-950 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-600" />
                  <span>No One Living Above (Quiet Ceiling)</span>
                  <span className="text-[9px] font-bold bg-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded-md uppercase">Top Floor / House</span>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed pl-4">
                  <strong className="text-zinc-800">What it means:</strong> Only matches top-floor apartments, penthouses, or standalone single-story houses.
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed pl-4">
                  <strong className="text-zinc-700">Why this matters:</strong> Overhead footstep noise, heel stomping, late-night furniture dragging, and creaky floorboards are the #1 complaint of apartment tenants. This filter guarantees no upstairs neighbors living above your ceiling.
                </p>
              </div>

              {/* Feature 3: Private Entrance */}
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-950 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-zinc-950" />
                  <span>Require Private Entrance</span>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed pl-4">
                  <strong className="text-zinc-800">What it means:</strong> Direct, independent exterior door leading straight outside.
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed pl-4">
                  <strong className="text-zinc-700">Why this matters:</strong> Eliminates awkward entry layouts where you have to unlock the landlord's front door, walk through their foyer, or pass through their private living room to reach your space.
                </p>
              </div>

              {/* Feature 4: Private Garden */}
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-950 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-zinc-950" />
                  <span>Require Private Garden / Yard</span>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed pl-4">
                  <strong className="text-zinc-800">What it means:</strong> An exclusive-use enclosed outdoor area, deck, or yard.
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed pl-4">
                  <strong className="text-zinc-700">Why this matters:</strong> Garden cottages frequently advertise "access to beautiful garden and pool", which usually means sharing the lawn with the owner's barking dogs or family gatherings.
                </p>
              </div>

              {/* Feature 5: Exclude Landlord On-Site */}
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-950 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-zinc-950" />
                  <span>Exclude Landlord On-Site</span>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed pl-4">
                  <strong className="text-zinc-800">What it means:</strong> The property owner does not live on the same erf or in the primary house.
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed pl-4">
                  <strong className="text-zinc-700">Why this matters:</strong> Ensures full personal autonomy without feeling monitored, dealing with micromanaged curfew rules, or having the landlord drop by unexpectedly.
                </p>
              </div>

              {/* Feature 6: Exclude Shared House */}
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-950 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-zinc-950" />
                  <span>Exclude Shared House / Communes</span>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed pl-4">
                  <strong className="text-zinc-800">What it means:</strong> Full disqualification of student digs, co-living communes, and roommate sublets.
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed pl-4">
                  <strong className="text-zinc-700">Why this matters:</strong> Ensures every listing on your radar is an entire private rental lease in your own name.
                </p>
              </div>

            </div>

            {/* AI Verification Note */}
            <div className="p-4 rounded-2xl bg-zinc-900 text-white space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <ShieldCheck size={16} weight="bold" />
                <span>How HomeSeek's AI Validates Listings</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Our forensic evaluator inspects property descriptions, agent notes, architectural floor levels, and structural tags on Property24 to detect subtle signs of shared grounds, landlord proximity, or downstairs placement before saving to your feed.
              </p>
            </div>

            {/* Close Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="w-full py-3.5 bg-zinc-950 hover:bg-black text-white text-xs font-bold rounded-2xl transition-all shadow-md active:scale-98 cursor-pointer"
              >
                Got It, Return to Search Setup
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
