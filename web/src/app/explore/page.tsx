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
  Mountains,
  PawPrint
} from "@phosphor-icons/react";

const API_LOCAL = "http://localhost:8000";
const API_CLOUD = process.env.NEXT_PUBLIC_CLOUD_API || "http://localhost:8000";

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState('long-term');
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [eliteSuburbs, setEliteSuburbs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters State
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    platform: '',
    area: '',
    view: '',
    layout: '',
    pets: false
  });

  // Post Form State
  const [postForm, setPostForm] = useState({
    title: '',
    price: '',
    address: '',
    bedrooms: '',
    description: '',
    source_url: '',
    platform: 'Manual Post'
  });

  const fetchExplore = async (type: string) => {
    setIsLoading(true);
    try {
      // [HYBRID] Always fetch the Market Grid from the Cloud
      let url = `${API_CLOUD}/explore-listings?rental_type=${type}`;
      if (filters.minPrice) url += `&min_price=${filters.minPrice}`;
      if (filters.maxPrice) url += `&max_price=${filters.maxPrice}`;
      if (filters.platform) url += `&platform=${filters.platform}`;
      if (filters.area) url += `&area=${filters.area}`;
      if (filters.view) url += `&view=${filters.view}`;
      if (filters.layout) url += `&layout=${filters.layout}`;
      if (filters.pets) url += `&pets=true`;
      
      const resp = await fetch(url);
      const data = await resp.json();
      setListings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Explore fetch error:", e);
      setListings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuburbs = async () => {
    try {
      const resp = await fetch(`${API_CLOUD}/geofence/suburbs`);
      const data = await resp.json();
      setEliteSuburbs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error fetching suburbs:", e);
    }
  };

  useEffect(() => {
    fetchExplore(activeTab);
    fetchSuburbs();
  }, [activeTab, filters.area, filters.view, filters.layout, filters.pets, filters.platform, filters.minPrice, filters.maxPrice]);

  const handleManualPost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...postForm,
        price: parseInt(postForm.price),
        bedrooms: parseInt(postForm.bedrooms),
        rental_type: activeTab,
        created_at: new Date().toISOString()
      };
      
      const resp = await fetch(`${API_CLOUD}/listings/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (resp.ok) {
        setShowPostModal(false);
        fetchExplore(activeTab);
        setPostForm({ title: '', price: '', address: '', bedrooms: '', description: '', source_url: '', platform: 'Manual Post' });
      }
    } catch (e) {
      console.error("Manual post error:", e);
    }
  };

  const formatCurrency = (val: any) => {
    if (!val) return "TBD";
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30">
      
      {/* Dynamic Navbar */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-[#050505]/80 backdrop-blur-2xl border-b border-white/5 px-12 py-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:rotate-12 transition-all">
            <Search size={20} className="text-black" strokeWidth={3} />
          </div>
          <div>
            <h1 className="text-xl font-serif font-bold tracking-tight">Explore</h1>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest leading-none">Global Discovery Feed</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <a href="/" className="text-[10px] font-bold text-white/40 uppercase tracking-widest hover:text-white transition-all">Home</a>
          <a href="/explore" className="text-[10px] font-bold text-white uppercase tracking-widest border-b-2 border-emerald-500 pb-1">Explore</a>
          <a href="/discover" className="text-[10px] font-bold text-white/40 uppercase tracking-widest hover:text-white transition-all">Alerts</a>
          <button 
            onClick={() => setShowPostModal(true)}
            className="flex items-center gap-3 bg-white text-black px-6 py-2.5 rounded-full text-xs font-black uppercase hover:bg-emerald-400 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95"
          >
            <Plus size={14} strokeWidth={4} /> Post Property
          </button>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-12 max-w-[1600px] mx-auto grid grid-cols-12 gap-12">
        
        {/* Advanced Filters Sidebar */}
        <aside className="col-span-3 space-y-12">
          <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-10 space-y-10 sticky top-32">
            <div>
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
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === tab.id ? 'bg-white text-black shadow-2xl' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                  >
                    <tab.icon size={16} weight={activeTab === tab.id ? "fill" : "bold"} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Vision (NEW) */}
            <div>
              <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mb-6 text-center">Layout Vision</h2>
              <div className="bg-black/40 p-1.5 rounded-2xl flex gap-1 border border-white/5">
                {[
                  { id: '', label: 'All', icon: Layout },
                  { id: 'Whole', label: 'Whole', icon: Stack },
                  { id: 'Shared', label: 'Shared', icon: UsersThree }
                ].map((v) => (
                  <button 
                    key={v.id}
                    onClick={() => setFilters({...filters, layout: v.id})}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${filters.layout === v.id ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'text-white/40 hover:text-white'}`}
                  >
                    <v.icon size={14} weight={filters.layout === v.id ? "fill" : "bold"} />
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vista Mode (v54.0) */}
            <div>
              <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mb-6 text-center">Vista Mode</h2>
              <div className="bg-black/40 p-1.5 rounded-2xl flex gap-1 border border-white/5">
                {[
                  { id: '', label: 'All', icon: Globe },
                  { id: 'seaview', label: 'Sea', icon: Waves },
                  { id: 'mountain', label: 'Mountain', icon: Mountains }
                ].map((v) => (
                  <button 
                    key={v.id}
                    onClick={() => setFilters({...filters, view: v.id})}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${filters.view === v.id ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'text-white/40 hover:text-white'}`}
                  >
                    <v.icon size={14} weight={filters.view === v.id ? "fill" : "bold"} />
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pet Friendly Toggle (v56.0) */}
            <div className="pt-2">
               <button 
                 onClick={() => setFilters({...filters, pets: !filters.pets})}
                 className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all ${filters.pets ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/20 hover:text-white'}`}
               >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${filters.pets ? 'bg-emerald-500 text-black' : 'bg-white/5 text-white/20'}`}>
                      <Plus size={12} strokeWidth={4} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Pet Friendly Only</span>
                  </div>
                  <div className={`w-3 h-3 rounded-full border-2 transition-all ${filters.pets ? 'bg-emerald-500 border-emerald-400 scale-125' : 'border-white/10'}`}></div>
               </button>
            </div>

            <div>
              <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mb-6 text-center">Neighborhood Spotlight</h2>
              
              {/* Predictive Search Input (v52.1) */}
              <div className="relative mb-6">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
                  <Search size={14} />
                </div>
                <input 
                  type="text"
                  placeholder="Find elite area..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-[10px] font-bold focus:outline-none focus:border-emerald-500/50 transition-all"
                />
                
                {/* Suggestions Dropdown */}
                {searchTerm && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-[#0A0A0B] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto no-scrollbar">
                    {eliteSuburbs
                      .filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(suburb => (
                        <button
                          key={suburb}
                          onClick={() => {
                            setFilters({...filters, area: suburb});
                            setSearchTerm('');
                          }}
                          className="w-full text-left px-5 py-3 text-[10px] font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all flex items-center gap-3 border-b border-white/[0.02] last:border-0"
                        >
                          <MapPin size={10} className="text-emerald-500" />
                          {suburb}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  'Sea Point', 'Green Point', 'Camps Bay', 'Bantry Bay', 
                  'Gardens', 'Oranjezicht', 'Higgovale', 
                  'Constantia', 'Newlands', 'Claremont Upper',
                  'Hout Bay', 'Noordhoek'
                ].map(area => (
                  <button
                    key={area}
                    onClick={() => {
                      const newArea = filters.area === area ? '' : area;
                      setFilters({...filters, area: newArea});
                    }}
                    className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${
                      filters.area === area 
                        ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
                        : 'bg-white/5 text-white/40 border-white/5 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">Price Range (ZAR)</h2>
              <div className="grid grid-cols-2 gap-4">
                 <input 
                   type="number"
                   placeholder="Min"
                   value={filters.minPrice}
                   onChange={(e) => setFilters({...filters, minPrice: e.target.value})}
                   className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-bold focus:outline-none focus:border-emerald-500/50"
                 />
                 <input 
                   type="number"
                   placeholder="Max"
                   value={filters.maxPrice}
                   onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
                   className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-bold focus:outline-none focus:border-emerald-500/50"
                 />
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">Discovery Source</h2>
              <div className="space-y-2">
                 {['', 'Facebook', 'Property24', 'RentUncle'].map((src) => (
                   <button 
                     key={src}
                     onClick={() => setFilters({...filters, platform: src})}
                     className={`w-full text-left px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${filters.platform === src ? 'bg-white/10 text-emerald-400 border border-emerald-500/20' : 'text-white/30 hover:text-white hover:bg-white/5'}`}
                   >
                     {src || 'All Platforms'}
                   </button>
                 ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 space-y-4">
               <div className="flex justify-between items-center bg-white/5 p-5 rounded-2xl group cursor-pointer hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-4">
                    <Filter size={14} className="text-white/20" />
                    <span className="text-xs font-bold text-white/60">Advanced Search</span>
                  </div>
                  <Plus size={12} className="text-white/20 group-hover:text-white" />
               </div>
            </div>
          </div>
        </aside>

        {/* Community Grid */}
        <div className="col-span-9 space-y-8">
          <header className="flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-serif font-medium mb-2 flex items-center gap-4">
                  {activeTab === 'long-term' && 'Annual Residential Feed'}
                  {activeTab === 'short-term' && 'Flexible Mid-Term Stays'}
                  {activeTab === 'pet-sitting' && 'Elite Pet-Sitting Missions'}
                  <span className="text-xs font-sans font-bold bg-white/10 px-4 py-1.5 rounded-full text-white/40 uppercase tracking-widest">{listings.length} Results</span>
                </h2>
                <p className="text-white/40 text-sm font-medium italic">
                  {activeTab === 'pet-sitting' ? 'Discounted high-trust opportunities for animal lovers.' : "Cape Town's shared intelligence feed. Anonymized & Verified."}
                </p>
              </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {isLoading ? (
              [1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-80 rounded-[2rem] bg-white/[0.02] border border-white/5 animate-pulse" />
              ))
            ) : listings.map((l: any, idx: number) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => window.open(l.source_url, '_blank')}
                className="group relative bg-[#070707] border border-white/5 rounded-[2rem] overflow-hidden hover:bg-white/[0.03] transition-all cursor-pointer"
              >
                <div className="h-48 bg-white/[0.02] relative overflow-hidden">
                   {/* Placeholder Image Effect */}
                   <div className="absolute inset-0 bg-gradient-to-t from-[#070707] to-transparent z-10" />
                   <div className="absolute inset-0 flex items-center justify-center opacity-5 transition-transform duration-700">
                      <Home size={80} />
                   </div>
                   
                   <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2">
                     {l.rental_type === 'pet-sitting' ? (
                        <span className="bg-amber-500/20 backdrop-blur-xl border border-amber-500/40 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-amber-400">
                           🐾 PET SITTING (1m+)
                        </span>
                     ) : (
                        <span className="bg-black/60 backdrop-blur-xl border border-white/10 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-emerald-400">
                           {l.rental_type === 'short-term' ? '⏳ FLEX' : '🏗️ ANNUAL'}
                        </span>
                     )}
                     {l.is_pet_friendly && (
                        <span className="bg-black/60 backdrop-blur-xl border border-white/10 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-emerald-400">
                           🐕 PETS OK
                        </span>
                     )}
                   </div>

                   {/* 🕒 TEMPORAL WATERMARK (v62.0) */}
                   <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
                     {l.published_at && (
                       <span 
                         title="Market Freshness: Time since original listing publication."
                         className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em] bg-black/40 px-3 py-1 rounded-full border border-white/5 cursor-help"
                       >
                          {l.published_at}
                       </span>
                     )}
                     {l.is_pet_friendly && (
                       <div 
                         title="Pet Verified: This property explicitly welcomes feline or canine companions."
                         className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-sm shadow-[0_0_20px_rgba(16,185,129,0.5)] border border-emerald-400/50 scale-90 cursor-help"
                       >
                         🐈
                       </div>
                     )}
                     {l.view_category === 'Sea' && (
                       <div 
                         title="Atlantic Vision: High-confidence seaview or coastal proximity detected."
                         className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm shadow-[0_0_20_rgba(59,130,246,0.5)] border border-blue-400/50 scale-90 cursor-help"
                       >
                         🌊
                       </div>
                     )}
                   </div>

                   <div className="absolute bottom-4 left-4 right-4 z-20 flex justify-between items-end text-white">
                      <p className="text-xl font-black tracking-tighter">{formatCurrency(l.price)}<span className="text-[10px] text-white/40 font-bold tracking-normal ml-1">{l.rental_type === 'short-term' ? '/night' : '/mo'}</span></p>
                      <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center backdrop-blur-xl bg-white/5 hover:bg-emerald-500 hover:text-black transition-all">
                         <Send size={14} />
                      </div>
                   </div>
                </div>

                <div className="p-6 space-y-4">
                   <div>
                      <h3 className="text-sm font-bold mb-1 group-hover:text-emerald-400 transition-colors uppercase tracking-tight line-clamp-1">{l.title}</h3>
                      <div className="flex items-center gap-2 text-white/30 text-[9px] font-bold uppercase tracking-widest leading-none">
                         <MapPin size={10} className="text-emerald-500" /> {l.address || "Cape Town"}
                      </div>
                   </div>

                   <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest text-white/40">
                      <div className="flex items-center gap-2">
                         <div className="w-1 h-1 rounded-full bg-emerald-500" />
                         {l.bedrooms && l.bedrooms > 0 ? `${l.bedrooms} Bed` : 'Any Beds'}
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="w-1 h-1 rounded-full bg-blue-500" />
                         {l.bathrooms || 1} Bath
                      </div>
                   </div>

                   <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <div className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-[7px] font-black">ST</div>
                         <span className="text-[9px] font-bold text-white/10 uppercase tracking-widest leading-none line-clamp-1">via {l.platform || 'Home-Seek'}</span>
                      </div>
                      <a href={l.source_url} target="_blank" onClick={(e) => e.stopPropagation()} className="text-[9px] font-black uppercase text-white/20 hover:text-emerald-500 transition-all tracking-[0.2em]">Source</a>
                   </div>
                </div>
              </motion.div>
            ))}
          </div>

          {!isLoading && listings.length === 0 && (
             <div className="bg-white/[0.02] border border-white/5 border-dashed rounded-[3rem] p-48 text-center">
                <p className="text-white/20 text-xs font-bold uppercase tracking-[0.5em]">No active listings found in this category</p>
             </div>
          )}
        </div>
      </main>

      {/* Post Mission Modal */}
      <AnimatePresence>
        {showPostModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-12">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowPostModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-3xl"
            />
            
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#0f0f0f] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)]"
            >
              <div className="p-12 space-y-10">
                <div className="flex justify-between items-start text-white">
                  <div>
                    <h2 className="text-3xl font-black mb-2 tracking-tighter">Publish Intel</h2>
                    <p className="text-white/40 text-sm font-medium">Contribute to the global Cape Town collective.</p>
                  </div>
                  <button onClick={() => setShowPostModal(false)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleManualPost} className="grid grid-cols-2 gap-6">
                   <div className="col-span-2 space-y-4">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Property Title</label>
                      <input 
                        required
                        value={postForm.title}
                        onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                        placeholder="e.g. Modern Studio with Ocean Views"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all text-white"
                      />
                   </div>

                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Price (ZAR)</label>
                      <input 
                        required
                        type="number"
                        value={postForm.price}
                        onChange={(e) => setPostForm({ ...postForm, price: e.target.value })}
                        placeholder="e.g. 15000"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all text-white"
                      />
                   </div>

                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Bedrooms</label>
                      <input 
                        required
                        type="number"
                        value={postForm.bedrooms}
                        onChange={(e) => setPostForm({ ...postForm, bedrooms: e.target.value })}
                        placeholder="e.g. 1"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all text-white"
                      />
                   </div>

                   <div className="col-span-2 space-y-4">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Area / Suburb</label>
                      <input 
                        required
                        value={postForm.address}
                        onChange={(e) => setPostForm({ ...postForm, address: e.target.value })}
                        placeholder="e.g. Sea Point"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all text-white"
                      />
                   </div>

                   <div className="col-span-2 space-y-4">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Description</label>
                      <textarea 
                        required
                        rows={3}
                        value={postForm.description}
                        onChange={(e) => setPostForm({ ...postForm, description: e.target.value })}
                        placeholder="Tell the community about the space..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-6 text-sm font-medium focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all resize-none text-white"
                      />
                   </div>

                   <div className="col-span-2 pt-6">
                      <button type="submit" className="w-full bg-emerald-500 text-black py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-95 transition-all">
                        Inject Listing into Hive
                      </button>
                   </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
