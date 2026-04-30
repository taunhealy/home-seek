'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, Home, Calendar, MapPin, Tag, X, Send, Search } from 'lucide-react';
import { 
  Globe, 
  House, 
  SunHorizon, 
  Dog, 
  Layout, 
  Stack, 
  UsersThree, 
  Waves,
  PawPrint,
  User,
  CheckCircle,
  Mountains as MountainsIcon,
  Waves as WavesIcon
} from "@phosphor-icons/react";
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { FilterBadge } from '@/components/FilterBadge';
import { INTELLIGENCE_SOURCES } from '@/lib/constants';

const RadarLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] w-full relative">
    <div className="relative flex items-center justify-center">
      <motion.div 
        animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        className="absolute w-64 h-64 border-2 border-emerald-500/30 rounded-full"
      />
      <motion.div 
        animate={{ scale: [1, 2], opacity: [0.3, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
        className="absolute w-64 h-64 border border-emerald-500/20 rounded-full"
      />
      <div className="relative z-10 bg-emerald-500/10 p-8 rounded-full border border-emerald-500/20 backdrop-blur-xl">
        <Globe size={48} className="text-emerald-500 animate-pulse" weight="fill" />
      </div>
      
      {/* Scanning Beam */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="absolute w-80 h-80 rounded-full border-t-2 border-emerald-500/40 opacity-40"
        style={{ background: 'conic-gradient(from 0deg at 50% 50%, rgba(16, 185, 129, 0.1) 0%, transparent 25%)' }}
      />
    </div>
    <div className="mt-12 text-center">
      <p className="text-emerald-500 text-xs font-black uppercase tracking-[0.6em] animate-pulse">Scoping Discovery Zone</p>
      <p className="text-white/20 text-[10px] mt-2 font-bold uppercase tracking-widest">Awaiting Tactical Confirmation...</p>
    </div>
  </div>
);

const ExploreSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 animate-pulse">
    <aside className="lg:col-span-3 space-y-12">
      <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] h-[600px]" />
    </aside>
    <div className="lg:col-span-9 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-80 rounded-[2rem] bg-white/[0.02] border border-white/5" />
        ))}
      </div>
    </div>
  </div>
);

export default function ExplorePage() {
  const { user, profile, loading, logout, login, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('long-term');
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [eliteSuburbs, setEliteSuburbs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSniperCounts, setActiveSniperCounts] = useState<Record<string, number>>({});
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  
  const [filters, setFilters] = useState({
    intent: 'listings',
    pets: false,
    minPrice: '',
    maxPrice: '',
    bedrooms: 'any',
    bathrooms: 'any',
    furnished: 'any',
    layout: 'any',
    view: 'any',
    horizon: 'any',
    area: 'any',
    platform: 'any',
    page: 1
  });

  const [postForm, setPostForm] = useState({
    title: '',
    price: '',
    address: '',
    bedrooms: '',
    description: '',
    source_url: '',
    platform: 'HomeSeek',
    property_type: 'Apartment',
    property_sub_type: 'Whole',
    view_category: 'Other',
    available_date: '',
    is_furnished: false,
    is_pet_friendly: false
  });
  const [postAreaSuggestions, setPostAreaSuggestions] = useState<string[]>([]);

  const fetchExplore = async (type: string) => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        rental_type: type,
        intent: filters.intent,
        page: filters.page.toString(),
        ...(filters.pets && { pets: 'true' }),
        ...(filters.minPrice && { min_price: filters.minPrice }),
        ...(filters.maxPrice && { max_price: filters.maxPrice }),
        ...(filters.bedrooms !== 'any' && { bedrooms: filters.bedrooms }),
        ...(filters.bathrooms !== 'any' && { bathrooms: filters.bathrooms }),
        ...(filters.furnished !== 'any' && { furnished: filters.furnished }),
        ...(filters.layout !== 'any' && { layout: filters.layout }),
        ...(filters.view !== 'any' && { view: filters.view }),
        ...(filters.horizon !== 'any' && { horizon: filters.horizon }),
        ...(filters.area !== 'any' && { area: filters.area }),
        ...(filters.platform !== 'any' && { platform: filters.platform }),
      }).toString();
      
      const resp = await fetchWithAuth(`/explore-listings?${query}`);
      if (resp && resp.ok) {
        const data = await resp.json();
        const newItems = Array.isArray(data) ? data : [];
        if (filters.page > 1) {
          setListings(prev => [...prev, ...newItems]);
        } else {
          setListings(newItems);
        }
      }
    } catch (e) {
      console.error("Explore fetch error:", e);
      setListings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuburbs = async () => {
    try {
      const resp = await fetchWithAuth(`/geofence/suburbs`);
      if (resp && resp.ok) {
        const data = await resp.json();
        setEliteSuburbs(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchAnalytics = async () => {
    try {
      const resp = await fetchWithAuth(`/analytics/active-snipers`);
      if (resp && resp.ok) {
        const data = await resp.json();
        setActiveSniperCounts(data);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchExplore(activeTab);
    fetchSuburbs();
    fetchAnalytics();
  }, [
    activeTab, 
    filters.area, 
    filters.view, 
    filters.layout, 
    filters.pets, 
    filters.minPrice, 
    filters.maxPrice,
    filters.intent,
    filters.page,
    filters.bedrooms,
    filters.bathrooms,
    filters.furnished,
    filters.horizon,
    filters.platform
  ]);

  useEffect(() => {
    if (postForm.address && postForm.address.length > 1) {
      const matches = eliteSuburbs.filter(s => 
        s.toLowerCase().includes(postForm.address.toLowerCase()) && 
        s.toLowerCase() !== postForm.address.toLowerCase()
      ).slice(0, 5);
      setPostAreaSuggestions(matches);
    } else {
      setPostAreaSuggestions([]);
    }
  }, [postForm.address, eliteSuburbs]);

  const handleManualPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        login();
        return;
    }
    try {
      const payload = {
        ...postForm,
        price: parseInt(postForm.price),
        bedrooms: parseInt(postForm.bedrooms),
        rental_type: activeTab,
        created_at: new Date().toISOString()
      };
      
      const resp = await fetchWithAuth(`/listings/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (resp.ok) {
        setShowPostModal(false);
        fetchExplore(activeTab);
        setPostForm({ title: '', price: '', address: '', bedrooms: '', description: '', source_url: '', platform: 'HomeSeek', property_type: 'Apartment', property_sub_type: 'Whole', view_category: 'Other', available_date: '', is_furnished: false, is_pet_friendly: false });
      }
    } catch (e) { console.error(e); }
  };

  const handleUpdateProfile = async (updates: any) => {
    if (!user) return;
    try {
      await fetchWithAuth(`/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid, ...updates })
      });
      await refreshProfile();
    } catch (e) {
      console.error("Failed to update profile telemetry:", e);
    }
  };

  const formatCurrency = (val: any) => {
    if (!val) return "TBD";
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <Navbar 
        user={user} 
        profile={profile} 
        loading={loading}
        handleLogout={logout} 
        handleLogin={login}
        onUpdateProfile={handleUpdateProfile}
      />
      <div className="h-32 w-full" />

      <main className="max-w-[1600px] mx-auto p-6 md:p-12 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Advanced Filters Sidebar */}
          <aside className="lg:col-span-3 space-y-12">
            <div className="bg-white/3 border border-white/10 rounded-[2.5rem] p-10 space-y-10">
              <div>
                <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mb-6 text-center">Feed Intelligence</h2>
                <div className="grid grid-cols-2 bg-white/5 p-1 rounded-2xl border border-white/5">
                  {[
                    { id: 'listings', label: 'Listings', icon: House },
                    { id: 'seekers', label: 'Seekers', icon: User }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilters({ ...filters, intent: tab.id, page: 1 })}
                      suppressHydrationWarning
                      className={`flex items-center justify-center gap-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        filters.intent === tab.id 
                          ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                          : 'text-white/40 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <tab.icon size={14} weight={filters.intent === tab.id ? 'fill' : 'regular'} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mb-6 text-center">Precision Filters</h2>
                <div className="space-y-4">
                  <button
                    onClick={() => setFilters({ ...filters, pets: !filters.pets, page: 1 })}
                    suppressHydrationWarning
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      filters.pets 
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                        : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <PawPrint size={18} weight={filters.pets ? "fill" : "bold"} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Pet Friendly Only</span>
                    </div>
                    <div className={`w-8 h-4 rounded-full relative transition-all ${filters.pets ? 'bg-emerald-500' : 'bg-white/10'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${filters.pets ? 'left-4.5' : 'left-0.5'}`} />
                    </div>
                  </button>

                  <button
                    onClick={() => setShowAdvancedModal(true)}
                    suppressHydrationWarning
                    className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 text-white/60 hover:text-white hover:border-white/10 transition-all group"
                  >
                    <Filter size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Advanced Filters</span>
                  </button>
                </div>
              </div>

              <div>
                  <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mb-6 text-center">Discovery Channels</h2>
                  <div className="flex flex-wrap gap-2 mb-12">
                    {INTELLIGENCE_SOURCES.filter(s => !s.id.includes('Pet Friendly')).map((source) => {
                      const isActive = filters.platform === source.id;
                      return (
                        <button
                          key={source.id}
                          onClick={() => setFilters({ ...filters, platform: source.id, page: 1 })}
                          className={`px-3 py-1.5 rounded-lg border transition-all text-[9px] font-black uppercase flex items-center gap-1.5 ${
                            isActive 
                              ? `bg-${source.color}-500/20 text-${source.color}-400 border-${source.color}-500/40 shadow-[0_0_10px_rgba(16,185,129,0.1)]` 
                              : 'bg-white/5 text-white/20 border-white/5 opacity-50 grayscale hover:grayscale-0 hover:opacity-100'
                          }`}
                        >
                          <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-current animate-pulse' : 'bg-white/20'}`} />
                          {source.label}
                        </button>
                      );
                    })}
                    <button
                        onClick={() => setFilters({ ...filters, platform: 'any', page: 1 })}
                        className={`px-3 py-1.5 rounded-lg border transition-all text-[9px] font-black uppercase flex items-center gap-1.5 ${
                          filters.platform === 'any' 
                            ? 'bg-white/20 text-white border-white/40' 
                            : 'bg-white/5 text-white/20 border-white/5 opacity-50 hover:opacity-100'
                        }`}
                      >
                         All Channels
                      </button>
                  </div>

                  <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mb-6 text-center">Rental Horizon</h2>
                <div className="grid grid-cols-3 bg-white/5 p-1 rounded-2xl border border-white/5">
                  {[
                    { id: 'long-term', label: 'Annual', icon: House },
                    { id: 'short-term', label: 'Short', icon: SunHorizon },
                    { id: 'pet-sitting', label: 'Pet-Sit', icon: Dog }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      suppressHydrationWarning
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === tab.id ? 'bg-white text-black shadow-2xl' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                    >
                      <tab.icon size={16} weight={activeTab === tab.id ? "fill" : "bold"} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mb-6 text-center">Neighborhood Spotlight</h2>
                <div className="relative mb-6">
                  <input 
                    type="text"
                    placeholder={filters.area || "Find area..."}
                    value={searchTerm}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    suppressHydrationWarning
                    className={`w-full bg-white/5 border rounded-xl pl-4 pr-10 py-3 text-[10px] font-bold focus:outline-none transition-all ${filters.area ? 'border-emerald-500/50 text-emerald-400' : 'border-white/10'}`}
                  />
                  {isSearchFocused && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-[#0A0A0B] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto no-scrollbar">
                      {eliteSuburbs.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase())).map(suburb => (
                        <button
                          key={suburb}
                          onClick={() => { setFilters({...filters, area: suburb}); setSearchTerm(''); }}
                          className="w-full text-left px-5 py-3 text-[10px] font-bold text-white/60 hover:text-white hover:bg-white/5"
                        >
                          {suburb}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Community Grid */}
          <div className="lg:col-span-9 space-y-8">
            <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-[36px] leading-[40px] font-bold text-[#FAFAFA] tracking-normal font-sans mb-2 flex items-center gap-4">
                    Global Discovery Feed
                    {!isLoading && <span className="text-xs font-sans font-bold bg-white/10 px-4 py-1.5 rounded-full text-white/40 uppercase tracking-widest">{listings.length} Results</span>}
                  </h2>
                  <p className="text-white/40 text-sm font-medium italic">Cape Town's shared intelligence feed. Anonymized & Verified.</p>
                </div>
                <button 
                  onClick={() => user ? setShowPostModal(true) : alert("Login to post")}
                  suppressHydrationWarning
                  className="bg-white text-black px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all"
                >
                  + Post Property
                </button>
            </header>

            {/* Active Filter Tags */}
            <div className="flex flex-wrap gap-2 mb-6 min-h-[36px]">
              {filters.pets && (
                <FilterBadge 
                  label="Pet Friendly" 
                  icon={PawPrint} 
                  active 
                  onRemove={() => setFilters({ ...filters, pets: false, page: 1 })} 
                />
              )}
              {(filters.minPrice || filters.maxPrice) && (
                <FilterBadge 
                  label={`R${filters.minPrice || '0'} - R${filters.maxPrice || '∞'}`} 
                  onRemove={() => setFilters({ ...filters, minPrice: '', maxPrice: '', page: 1 })} 
                />
              )}
              {filters.bedrooms !== 'any' && (
                <FilterBadge 
                  label={`${filters.bedrooms} BR`} 
                  onRemove={() => setFilters({ ...filters, bedrooms: 'any', page: 1 })} 
                />
              )}
              {filters.bathrooms !== 'any' && (
                <FilterBadge 
                  label={`${filters.bathrooms} Bath`} 
                  onRemove={() => setFilters({ ...filters, bathrooms: 'any', page: 1 })} 
                />
              )}
              {filters.horizon !== 'any' && (
                <FilterBadge 
                  label={filters.horizon} 
                  onRemove={() => setFilters({ ...filters, horizon: 'any', page: 1 })} 
                />
              )}
              {filters.layout !== 'any' && (
                <FilterBadge 
                  label={filters.layout} 
                  onRemove={() => setFilters({ ...filters, layout: 'any', page: 1 })} 
                />
              )}
              {filters.view !== 'any' && (
                <FilterBadge 
                  label={`${filters.view} View`} 
                  onRemove={() => setFilters({ ...filters, view: 'any', page: 1 })} 
                />
              )}
              {filters.furnished !== 'any' && (
                <FilterBadge 
                  label={filters.furnished} 
                  onRemove={() => setFilters({ ...filters, furnished: 'any', page: 1 })} 
                />
              )}
              {filters.area !== 'any' && (
                <FilterBadge 
                  label={filters.area} 
                  onRemove={() => setFilters({ ...filters, area: 'any', page: 1 })} 
                />
              )}
            </div>

            {isLoading && listings.length === 0 ? (
              <RadarLoader />
            ) : (
              <div className="space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {listings.map((l: any, idx: number) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group bg-[#070707] border border-white/5 rounded-[2rem] p-6 hover:bg-white/[0.03] transition-all cursor-pointer relative overflow-hidden"
                      onClick={() => window.open(l.source_url, '_blank')}
                    >
                      {/* Source Badge */}
                      <div className="absolute top-4 right-4 z-10">
                        <span className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-[8px] font-black text-emerald-400 uppercase tracking-widest backdrop-blur-md">
                          {l.source_name || l.platform || 'INTEL'}
                        </span>
                      </div>

                      <div className="h-48 bg-white/[0.02] rounded-xl mb-4 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-all overflow-hidden relative">
                         {l.image_url ? (
                            <img src={l.image_url} className="w-full h-full object-cover" alt="" />
                         ) : (
                            <Home size={48} />
                         )}
                         <div className="absolute inset-0 bg-gradient-to-t from-[#070707] to-transparent opacity-60" />
                      </div>
                      
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-sm font-bold tracking-tight line-clamp-1 flex-1">{l.title}</h3>
                      </div>
                      
                      <p className="text-2xl font-black text-emerald-500">{formatCurrency(l.price)}</p>
                      
                      <div className="flex items-center gap-2 mt-4">
                        <MapPin size={12} className="text-white/20" />
                        <span className="text-[11px] font-medium text-white/40 tracking-tight">{l.address}</span>
                      </div>

                      <div className="flex items-center gap-4 mt-6 pt-6 border-t border-white/5">
                        <div className="flex items-center gap-1.5">
                          <Layout size={14} className="text-white/20" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{l.bedrooms || '0'} BR</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Tag size={14} className="text-white/20" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{l.property_type || 'APT'}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Pagination / Load More */}
                {listings.length >= 20 && (
                  <div className="flex justify-center pt-12">
                    <button 
                      onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                      disabled={isLoading}
                      className="bg-white/5 border border-white/10 px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all disabled:opacity-50"
                    >
                      {isLoading ? 'Scanning Next Sector...' : 'Initialize Next Page Protocol'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!isLoading && listings.length === 0 && (
                <div className="bg-white/[0.02] border border-white/5 border-dashed rounded-[3rem] p-48 text-center w-full">
                    <p className="text-white/20 text-xs font-bold uppercase tracking-[0.5em]">No active listings found</p>
                </div>
            )}
          </div>
        </div>
      </main>

      {/* Post Modal */}
      <AnimatePresence>
        {showPostModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-12">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowPostModal(false)} />
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg bg-[#0f0f0f] border border-white/10 rounded-[3rem] p-12"
            >
               <h2 className="text-2xl font-black mb-8 uppercase tracking-tighter">Publish Property</h2>
               <form onSubmit={handleManualPost} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Title</label>
                    <input value={postForm.title} onChange={e => setPostForm({...postForm, title: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Price</label>
                        <input type="number" value={postForm.price} onChange={e => setPostForm({...postForm, price: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Bedrooms</label>
                        <input type="number" value={postForm.bedrooms} onChange={e => setPostForm({...postForm, bedrooms: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Address</label>
                    <input value={postForm.address} onChange={e => setPostForm({...postForm, address: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                  <button className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest mt-6 shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:scale-105 transition-all">Post to Feed</button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Advanced Filters Modal */}
      <AnimatePresence>
        {showAdvancedModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-12">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowAdvancedModal(false)} />
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-4xl bg-[#0f0f0f] border border-white/10 rounded-[3rem] p-12 overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-8">
                  <button onClick={() => setShowAdvancedModal(false)} className="p-2 hover:bg-white/5 rounded-full transition-all">
                    <X size={24} className="text-white/20" />
                  </button>
               </div>
               <h2 className="text-[36px] leading-[40px] font-bold text-[#FAFAFA] tracking-normal font-sans mb-12">Tactical Filters</h2>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    {/* Price Range */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Price Range (ZAR)</label>
                      <div className="grid grid-cols-2 gap-4">
                        <input 
                          placeholder="Min" 
                          value={filters.minPrice}
                          onChange={e => setFilters({...filters, minPrice: e.target.value, page: 1})}
                          className="bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 transition-all" 
                        />
                        <input 
                          placeholder="Max" 
                          value={filters.maxPrice}
                          onChange={e => setFilters({...filters, maxPrice: e.target.value, page: 1})}
                          className="bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 transition-all" 
                        />
                      </div>
                    </div>

                    {/* Bedrooms */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Bedrooms</label>
                      <div className="grid grid-cols-4 gap-2">
                        {['any', '1', '2', '3+'].map(val => (
                          <button
                            key={val}
                            onClick={() => setFilters({...filters, bedrooms: val, page: 1})}
                            className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                              filters.bedrooms === val 
                                ? 'bg-emerald-500 border-emerald-500 text-black' 
                                : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bathrooms */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Bathrooms</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['any', '1', '2+'].map(val => (
                          <button
                            key={val}
                            onClick={() => setFilters({...filters, bathrooms: val, page: 1})}
                            className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                              filters.bathrooms === val 
                                ? 'bg-emerald-500 border-emerald-500 text-black' 
                                : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* Unit Layout */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Unit Layout</label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: 'any', label: 'Any Layout' },
                          { id: 'Whole Property', label: 'Whole Property' },
                          { id: 'Shared Room', label: 'Shared Room' }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setFilters({...filters, layout: opt.id, page: 1})}
                            className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border flex justify-between items-center ${
                              filters.layout === opt.id 
                                ? 'bg-emerald-500 border-emerald-500 text-black' 
                                : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                            }`}
                          >
                            {opt.label}
                            {filters.layout === opt.id && <CheckCircle size={16} weight="bold" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Furnishing */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Furnishing Status</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'any', label: 'Any' },
                          { id: 'Furnished', label: 'Furnished' },
                          { id: 'Unfurnished', label: 'Unfurnished' }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setFilters({...filters, furnished: opt.id, page: 1})}
                            className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                              filters.furnished === opt.id 
                                ? 'bg-emerald-500 border-emerald-500 text-black' 
                                : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Vista Priority */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Vista Priority</label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: 'any', label: 'No Preference', icon: Globe },
                          { id: 'Ocean', label: 'Ocean View', icon: WavesIcon },
                          { id: 'Mountain', label: 'Mountain View', icon: MountainsIcon }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setFilters({...filters, view: opt.id, page: 1})}
                            className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-4 ${
                              filters.view === opt.id 
                                ? 'bg-emerald-500 border-emerald-500 text-black' 
                                : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                            }`}
                          >
                            <opt.icon size={18} weight={filters.view === opt.id ? "fill" : "bold"} />
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
               </div>

               <div className="mt-12 pt-8 border-t border-white/5 flex justify-end gap-4">
                  <button 
                    onClick={() => {
                      setFilters({
                        intent: 'listings',
                        pets: false,
                        minPrice: '',
                        maxPrice: '',
                        bedrooms: 'any',
                        bathrooms: 'any',
                        furnished: 'any',
                        layout: 'any',
                        view: 'any',
                        horizon: 'any',
                        area: 'any',
                        platform: 'any',
                        page: 1
                      });
                      setShowAdvancedModal(false);
                    }}
                    className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-all"
                  >
                    Reset All
                  </button>
                  <button 
                    onClick={() => setShowAdvancedModal(false)}
                    className="bg-white text-black px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:scale-105 transition-all"
                  >
                    Apply Intel
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
