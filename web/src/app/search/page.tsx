'use client';

import React, { useState } from 'react';
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
  Sparkle
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';

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

  // Search Criteria State
  const [locationQuery, setLocationQuery] = useState('Camps Bay, Gardens, Observatory, Sea Point');
  const [minPrice, setMinPrice] = useState('12000');
  const [maxPrice, setMaxPrice] = useState('30000');
  const [bedrooms, setBedrooms] = useState('2');
  const [bathrooms, setBathrooms] = useState('1');

  // Living Autonomy & Privacy Shield Checkboxes
  const [requireIndependentLiving, setRequireIndependentLiving] = useState(true);
  const [requirePrivateEntrance, setRequirePrivateEntrance] = useState(true);
  const [requirePrivateGarden, setRequirePrivateGarden] = useState(false);
  const [excludeLandlordOnSite, setExcludeLandlordOnSite] = useState(true);
  const [excludeSharedHouse, setExcludeSharedHouse] = useState(true);

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

  // Save criteria and navigate to Properties
  const handleSaveAndExplore = () => {
    // Save to localStorage for sync with Properties page
    try {
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
        },
        anchors,
      };
      localStorage.setItem('homeseek_search_criteria', JSON.stringify(criteria));
    } catch (e) {}

    router.push('/properties');
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
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                  Target Suburbs or Regions
                </label>
                <div className="relative">
                  <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    placeholder="e.g. Camps Bay, Sea Point, Gardens, Observatory"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                  />
                </div>
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
                <h2 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
                  <ShieldCheck size={20} weight="bold" />
                  <span>Living Autonomy & Privacy Shield</span>
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Filter out shared houses, shared gardens, or on-site landlords upfront before you tour.
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-800 px-2.5 py-1 rounded-full">
                AI Filter
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              {/* Checkbox 1 */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={requireIndependentLiving}
                  onChange={(e) => setRequireIndependentLiving(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-zinc-950 accent-zinc-950 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-zinc-950 block">Require Independent Living</span>
                  <span className="text-[11px] text-zinc-500 block">Standalone unit with private kitchen, bathroom & living space</span>
                </div>
              </label>

              {/* Checkbox 2 */}
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

              {/* Checkbox 3 */}
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

              {/* Checkbox 4 */}
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

              {/* Checkbox 5 */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 cursor-pointer transition-all md:col-span-2">
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
              Criteria will automatically sync with your interactive Properties view and notification signals.
            </p>

            <button
              onClick={handleSaveAndExplore}
              className="w-full sm:w-auto bg-zinc-950 text-white hover:bg-black px-8 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-98"
            >
              <span>Save & View Matching Properties</span>
              <ArrowRight size={16} weight="bold" />
            </button>
          </div>

        </div>

      </main>
    </div>
  );
}
