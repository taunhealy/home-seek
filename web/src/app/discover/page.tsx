"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PayPalButtons } from "@paypal/react-paypal-js";
import { auth, googleAuthProvider } from '@/lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  Globe, 
  House, 
  SunHorizon, 
  Dog, 
  Layout, 
  Stack, 
  UsersThree, 
  CheckCircle,
  Gear,
  ChartPolar
} from "@phosphor-icons/react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function DiscoverPage() {
  const [activeTab, setActiveTab] = useState<'listings' | 'alerts'>('listings');
  const [aiPrompt, setAiPrompt] = useState('');
  const [maxPrice, setMaxPrice] = useState(25000);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [selectedBedrooms, setSelectedBedrooms] = useState<number[]>([]);
  const [rentalType, setRentalType] = useState<'all' | 'long-term' | 'short-term' | 'pet-sitting'>('all');
  const [propertySubType, setPropertySubType] = useState<'all' | 'Whole' | 'Shared'>('all');
  const [isDeploying, setIsDeploying] = useState(false);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [listings, setListings] = useState<any>([]);
  const [userProfile, setUserProfile] = useState<any>({ 
    tier: 'free', 
    id: 'taun_test_user',
    billing_date: '2026-05-15',
    status: 'active'
  });
  const [selectedSources, setSelectedSources] = useState<string[]>(['Property24', 'Sea Point Rentals', 'Huis Huis', 'RentUncle', 'RentUncle Pet Friendly']);
  const [savedAlerts, setSavedAlerts] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [platformFilter, setPlatformFilter] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [allSuburbs, setAllSuburbs] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isPetFriendly, setIsPetFriendly] = useState(true);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const res = await fetch(`${API_BASE_URL}/user-profile/${u.uid}`);
          if (res.ok) {
            const profile = await res.json();
            setUserProfile({ ...profile, id: u.uid }); // Explicit anchor
          } else {
            setUserProfile({ ...userProfile, id: u.uid, email: u.email });
          }
        } catch (e) {
          setUserProfile({ ...userProfile, id: u.uid, email: u.email });
        }
      } else {
        setUserProfile({ tier: 'free', id: 'guest' });
      }
    });
    return () => unsubscribe();
  }, []);

  const formatCurrency = (val: number) => {
    if (!mounted) return `R${val}`;
    return `R${val.toLocaleString('en-ZA')}`;
  };

  const fetchMissions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/searches/${userProfile.id}`);
      const data = await res.json();
      setSavedAlerts(data);
    } catch (e) { console.error("Failed to fetch alerts:", e); }
  };

  useEffect(() => {
    if (mounted) fetchMissions();
    
    // 🌍 FETCH GEOFENCE REGISTRY (v79.0)
    if (mounted) {
      fetch(`${API_BASE_URL}/geofence/suburbs`)
        .then(res => res.json())
        .then(data => setAllSuburbs(data))
        .catch(err => console.error("Geofence sync failed:", err));
    }
  }, [mounted, userProfile.id]);

  // 🛰️ SIGNAL SPOTLIGHT (Autocomplete Logic)
  useEffect(() => {
    if (!aiPrompt || aiPrompt.length < 2) {
      setSuggestions([]);
      return;
    }
    
    // Filter suburbs based on the last part of the prompt
    const parts = aiPrompt.split(/[\s,]+/);
    const lastPart = parts[parts.length - 1].toLowerCase();
    
    if (lastPart.length < 2) {
      setSuggestions([]);
      return;
    }

    const matches = allSuburbs
      .filter(s => s.toLowerCase().startsWith(lastPart))
      .filter(s => !aiPrompt.toLowerCase().includes(s.toLowerCase())) // Don't suggest if already there
      .slice(0, 5);
      
    setSuggestions(matches);
  }, [aiPrompt, allSuburbs]);

  useEffect(() => {
    let interval: any;
    if (activeTask?.id) {
      const timer = setTimeout(() => {
        interval = setInterval(async () => {
          try {
            const res = await fetch(`${API_BASE_URL}/task/${activeTask.id}`);
            if (res.status === 404) return;
            const data = await res.json();
            setActiveTask(data);
            
            if (data?.status?.includes?.('Found') || data?.status?.includes?.('Complete') || data?.status?.includes?.('Failed')) {
              clearInterval(interval);
              const resultsRes = await fetch(`${API_BASE_URL}/listings/${userProfile.id}`);
              const resultsData = await resultsRes.json();
              setListings(resultsData);
              fetchMissions();
            }
          } catch (e) { console.error(e); }
        }, 2000);
      }, 1000);
      
      return () => { clearTimeout(timer); clearInterval(interval); };
    }
  }, [activeTask?.id, userProfile.id]);

  const handleSubscriptionSuccess = async (tier: string, subscriptionId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/update-tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userProfile.id, tier, subscription_id: subscriptionId })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setUserProfile({ ...userProfile, tier });
        alert(`Success! Your account has been upgraded to ${tier.toUpperCase()}.`);
      }
    } catch (e) { console.error("Update failed:", e); }
  };

  const deleteAlert = async (searchId: string) => {
    if (!confirm("Are you sure you want to delete this alert?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/delete-alert/${userProfile.id}/${searchId}`, { method: 'DELETE' });
      if (res.ok) fetchMissions();
    } catch (e) { console.error("Delete failed:", e); }
  };

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (e: any) { 
      if (e.code !== 'auth/cancelled-popup-request') {
        console.error("Login failed:", e); 
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) { console.error("Logout failed:", e); }
  };

  const handleAiSearch = async (isAlertSave = false) => {
    setIsDeploying(true);
    try {
      const response = await fetch(`${API_BASE_URL}/deploy-sniper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userProfile.id,
          search_query: aiPrompt,
          alert_enabled: isAlertSave,
          max_price: maxPrice,
          min_bedrooms: selectedBedrooms,
          pet_friendly: isPetFriendly,
          rental_type: rentalType,
          property_sub_type: propertySubType,
          sources: selectedSources
        }),
      });
      const data = await response.json();
      
      // Tier Limit Checks
      const limits: Record<string, number> = { 'free': 1, 'bronze': 5, 'silver': 10, 'gold': 50 };
      const currentLimit = limits[userProfile.tier] || 1;
      
      if (isAlertSave && savedAlerts.length >= currentLimit) {
        alert(`Mission Cap Reached! Your ${userProfile.tier.toUpperCase()} tier is limited to ${currentLimit} active snipers. Please upgrade to expand your discovery grid.`);
        setIsDeploying(false);
        return;
      }

      if (data.status === 'limited') {
        alert(data.message);
      } else if (data.status === 'busy') {
        alert("The Sniper Station is currently busy with another scan. Please wait a moment and try again.");
      } else if (data.task_id) {
        if (isAlertSave) {
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 4000);
          // Clear current search form
          setAiPrompt('');
          // Refresh list immediately
          fetchMissions();
          setActiveTab('alerts');
        } else {
          setActiveTask({ id: data.task_id, status: 'Searching...', progress: 5 });
          setActiveTab('listings');
        }
      }
    } catch (error) { console.error(error); } finally { setIsDeploying(false); }
  };

  const toggleSource = (name: string) => {
    setSelectedSources(prev => 
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  useEffect(() => {
    if (rentalType === 'short-term') {
      setSelectedSources(['Sea Point Rentals (Short Term)', 'Cape Town Mid-Term (1-6 Months)', 'Cape Town Short/Long Rentals', 'Facebook Marketplace']);
    } else if (rentalType === 'pet-sitting') {
      setSelectedSources(['Huis Huis Pet Friendly (Cape Town)', 'RentUncle (Pet Friendly)']);
      setIsPetFriendly(true);
    } else {
      // Long Term / All
      if (isPetFriendly) {
        setSelectedSources(['Property24 Pet Friendly', 'RentUncle (Pet Friendly)', 'Huis Huis Pet Friendly (Cape Town)']);
      } else {
        setSelectedSources(['Property24', 'Sea Point Rentals', 'Huis Huis', 'RentUncle', 'Facebook Marketplace']);
      }
    }
  }, [rentalType, isPetFriendly]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* 🚀 PREMIUM NAVBAR */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/5 px-6 md:px-12 py-4">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <span className="text-black font-black text-xl">H</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Home-Seek</h1>
              <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest leading-none">Intelligence Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-6 mr-4 border-r border-white/10 pr-8">
              <a href="/" className="text-[10px] font-bold text-white/40 uppercase tracking-widest hover:text-white transition-all">Home</a>
              <a href="/explore" className="text-[10px] font-bold text-white/40 uppercase tracking-widest hover:text-white transition-all">Explore</a>
              <a href="/discover" className="text-[10px] font-bold text-white uppercase tracking-widest border-b-2 border-emerald-500 pb-1">Alerts</a>
            </div>

            <div className="text-right hidden lg:block">
              <p className="text-[9px] uppercase tracking-[0.3em] text-emerald-500 font-bold mb-0.5">Terminal Active</p>
              <p className="text-white/20 text-[9px] uppercase tracking-widest font-bold">ZAF Nodes Connected</p>
            </div>

            {user ? (
              <div className="flex items-center gap-6">
                 {user.photoURL && <img src={user.photoURL} className="w-8 h-8 rounded-full border border-white/10" alt="avatar" />}
                 <button 
                  onClick={handleLogout} 
                  className="bg-white/5 border border-white/10 px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 hover:text-red-500 transition-all"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className={`bg-white text-black px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500 transition-all ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoggingIn ? 'Logging In...' : 'Log In'}
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto p-6 md:p-12 space-y-12">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* New Alert Form */}
          <div className="lg:col-span-3 space-y-8 lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto custom-scrollbar pr-2">
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
              {/* Protocol Mode Toggle */}
              <div className="mb-6 p-0.5 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-emerald-500/[0.03]">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-emerald-500/80 uppercase tracking-[0.2em] leading-none mb-1">Protocol Mode</span>
                    <span className="text-[11px] font-bold text-white uppercase tracking-widest">Pet Friendly Focus</span>
                  </div>
                  <div className="flex bg-black/60 p-1 rounded-xl border border-white/5">
                    <button 
                      onClick={() => setIsPetFriendly(false)}
                      className={`w-14 py-2 rounded-lg text-[10px] font-black transition-all ${!isPetFriendly ? 'bg-white/10 text-white shadow-lg' : 'text-white/20 hover:text-white/40'}`}
                    >
                      OFF
                    </button>
                    <button 
                      onClick={() => setIsPetFriendly(true)}
                      className={`w-14 py-2 rounded-lg text-[10px] font-black transition-all ${isPetFriendly ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'text-white/20 hover:text-white/40'}`}
                    >
                      ON
                    </button>
                  </div>
                </div>
              </div>

              {/* Mission Category (NEW) */}
              <div className="mb-8 space-y-4">
                <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Mission Category</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'all', label: 'All Listings', icon: Globe },
                    { id: 'long-term', label: 'Long Term', icon: House },
                    { id: 'short-term', label: 'Short Term', icon: SunHorizon },
                    { id: 'pet-sitting', label: 'Pet-Sitting', icon: Dog }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setRentalType(cat.id as any)}
                      className={`px-3 py-3 rounded-xl border transition-all text-[9px] font-bold uppercase flex flex-col items-center gap-1.5 ${
                        rentalType === cat.id 
                          ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                          : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <cat.icon size={18} weight={rentalType === cat.id ? "fill" : "bold"} />
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Property Layout (NEW) */}
              <div className="mb-8 space-y-4">
                <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Property Layout</h3>
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                  {[
                    { id: 'all', label: 'All', icon: Layout },
                    { id: 'Whole', label: 'Whole', icon: Stack },
                    { id: 'Shared', label: 'Shared', icon: UsersThree }
                  ].map(type => (
                    <button
                      key={type.id}
                      onClick={() => setPropertySubType(type.id as any)}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                        propertySubType === type.id 
                          ? 'bg-white/10 text-white shadow-lg border border-white/10' 
                          : 'text-white/30 hover:text-white/50'
                      }`}
                    >
                      <type.icon size={14} weight={propertySubType === type.id ? "fill" : "bold"} />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sources */}
              <div className="mb-8 space-y-4">
                <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Active Intelligence Sources</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { n: 'Property24', c: 'blue' },
                    { n: 'Property24 Pet Friendly', c: 'emerald' },
                    { n: 'Sea Point Rentals', c: 'indigo' },
                    { n: 'Huis Huis', c: 'rose' },
                    { n: 'Huis Huis Pet Friendly', c: 'emerald' },
                    { n: 'RentUncle', c: 'orange' },
                    { n: 'RentUncle Pet Friendly', c: 'emerald' }
                  ].map(s => {
                    const isActive = selectedSources.includes(s.n);
                    return (
                      <button 
                        key={s.n} 
                        onClick={() => toggleSource(s.n)}
                        className={`px-3 py-1.5 rounded-lg border transition-all text-[9px] font-black uppercase flex items-center gap-1.5 ${
                          isActive 
                            ? `bg-${s.c}-500/20 text-${s.c}-400 border-${s.c}-500/40 shadow-[0_0_10px_rgba(16,185,129,0.1)]` 
                            : 'bg-white/5 text-white/20 border-white/5 opacity-50 grayscale hover:grayscale-0 hover:opacity-100'
                        }`}
                      >
                        <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-current animate-pulse' : 'bg-white/20'}`} />
                        {s.n}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-white/5 mb-8" />

              <h2 className="text-lg font-bold mb-8">New Property Alert</h2>
              
              <div className="space-y-6">
                <div className="space-y-4">
                  {/* Bedrooms */}
                  <div className="flex flex-col gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Target Bedrooms</span>
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 2, 3, 4, 5].map(n => {
                        const isSelected = selectedBedrooms.includes(n);
                        return (
                          <button 
                            key={n} 
                            onClick={() => {
                              const newSelected = isSelected 
                                ? selectedBedrooms.filter(b => b !== n)
                                : [...selectedBedrooms, n].sort();
                              
                              setSelectedBedrooms(newSelected);
                              
                              // Update prompt with all selected rooms
                              const tag = n === 5 ? '5+ Bedroom' : `${n} Bedroom`;
                              setAiPrompt(prev => {
                                if (isSelected) {
                                  // Remove the tag cleanly
                                  return prev.replace(new RegExp(`(\\b${tag}\\b,?\\s?|\\s?,?\\s?\\b${tag}\\b)`, 'gi'), '').trim().replace(/,\s*$/, '').replace(/^,\s*/, '');
                                } else {
                                  // Append the tag
                                  const cleaned = prev.replace(/,\s*,/g, ',').trim();
                                  const suffix = cleaned ? (cleaned.endsWith(',') ? ` ${tag}` : `, ${tag}`) : tag;
                                  return (cleaned + suffix).replace(/^,\s*/, '').replace(/,\s*$/, '');
                                }
                              });
                            }} 
                            className={`py-3 rounded-lg flex items-center justify-center text-[10px] font-bold border transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
                          >
                            {n === 5 ? '5+' : n}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end mb-1">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Search Description</label>
                    </div>
                    <textarea 
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g. 2 bedroom Sea Point"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all min-h-[120px]"
                    />
                  </div>
                  
                  {/* Neighborhood Spotlight (Autocomplete) */}
                  <AnimatePresence>
                    {suggestions.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex flex-wrap gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl"
                      >
                        <span className="w-full text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Neighborhood Spotlight</span>
                        {suggestions.map(s => (
                          <button 
                            key={s}
                            onClick={() => {
                              const parts = aiPrompt.split(/[\s,]+/);
                              parts[parts.length - 1] = s;
                              setAiPrompt(parts.join(' ') + ', ');
                              setSuggestions([]);
                            }}
                            className="px-3 py-1.5 bg-emerald-500 text-black rounded-xl text-[10px] font-bold hover:scale-105 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                          >
                            + {s}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Protocol Presets (Fallback/Helpers) */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {[
                      "Sea Point", "Green Point", "Camps Bay", "Gardens", "Newlands", "Constantia", "Muizenberg", "Water Included", "Safe", "Garage"
                    ].map(tag => (
                      <button 
                        key={tag}
                        onClick={() => setAiPrompt(prev => prev ? `${prev}, ${tag}, ` : `${tag}, `)}
                        className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-[9px] font-bold text-white/40 hover:text-white transition-all underline decoration-emerald-500/30 underline-offset-4"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Max Price</span>
                    <button onClick={() => setIsEditingPrice(true)} className="text-xl font-bold hover:text-emerald-400">
                      {formatCurrency(maxPrice)}
                    </button>
                  </div>
                  <input type="range" min="5000" max="50000" step="500" value={maxPrice} onChange={(e) => setMaxPrice(parseInt(e.target.value))} className="w-full h-1 accent-emerald-500 bg-white/10 appearance-none rounded-full" />
                </div>
                
                <AnimatePresence>
                  {showSuccessToast && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-center gap-3 mt-4 overflow-hidden relative"
                    >
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-black font-black text-[10px]"
                      >
                        ✓
                      </motion.div>
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Protocol Accepted: Mission Saved</p>
                      <motion.div 
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ duration: 4, ease: "linear" }}
                        className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500/40"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 gap-3 pt-4">
                  <button 
                    onClick={() => handleAiSearch(true)} 
                    disabled={isDeploying}
                    className={`bg-emerald-500 text-black font-bold py-4 rounded-2xl text-xs uppercase transition-all ${isDeploying ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                  >
                    {isDeploying ? 'Saving Mission...' : 'Save Alert'}
                  </button>
                  <button 
                    onClick={() => {
                      console.log("🛰️ HUD: Initiating Quick Search Request...");
                      handleAiSearch(false);
                    }} 
                    disabled={isDeploying} 
                    className={`bg-white/10 border border-white/20 text-white font-bold py-4 rounded-2xl text-xs uppercase transition-all ${isDeploying ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20 hover:scale-[1.01] hover:border-emerald-500/50'}`}
                  >
                    {isDeploying ? 'Deploying Sniper...' : 'Quick Search Only'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-6 space-y-8">
            <div className="flex gap-12 border-b border-white/10">
              <button onClick={() => setActiveTab('listings')} className={`pb-6 text-sm font-bold transition-all relative ${activeTab === 'listings' ? 'text-white' : 'text-white/20'}`}>
                Past Listings
                {activeTab === 'listings' && <motion.div layoutId="tab-pill" className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500" />}
              </button>
              <button onClick={() => setActiveTab('alerts')} className={`pb-6 text-sm font-bold transition-all relative ${activeTab === 'alerts' ? 'text-white' : 'text-white/20'}`}>
                My Alerts
                {activeTab === 'alerts' && <motion.div layoutId="tab-pill" className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500" />}
              </button>
            </div>

            <div className="space-y-6">
              {activeTab === 'listings' ? (
                <div className="space-y-6">
                  {/* Platform Filter HUD (v105.4) */}
                  <div className="flex flex-wrap gap-2 mb-4 bg-white/[0.02] p-2 rounded-2xl border border-white/5">
                    {['', 'Facebook', 'Property24', 'RentUncle'].map((plat) => (
                      <button 
                        key={plat}
                        onClick={() => setPlatformFilter(plat)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${platformFilter === plat ? 'bg-emerald-500 text-black shadow-lg' : 'text-white/30 hover:text-white hover:bg-white/5'}`}
                      >
                        {plat || 'All Sources'}
                      </button>
                    ))}
                  </div>

                  {activeTask && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6">
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-sm font-bold uppercase tracking-widest">{activeTask.status || "Searching..."}</p>
                        <span className="text-xs font-bold text-emerald-500">{activeTask.progress || 0}%</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-4">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${activeTask.progress || 0}%` }} className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                      </div>
                      <div className="bg-black/80 border border-white/10 rounded-xl p-4 font-mono text-[10px] text-emerald-400/80 h-48 overflow-y-auto flex flex-col gap-1">
                        {!activeTask.logs && <p>Awaiting telemetry...</p>}
                        {activeTask.logs && activeTask.logs.map((log: string, i: number) => (
                           <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}>
                             {log}
                           </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {listings
                    .filter((l: any) => !platformFilter || l.platform === platformFilter)
                    .map((l: any, idx: number) => (
                    <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 group hover:border-white/20 transition-all">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h4 className="font-bold text-xl mb-1">{l.title}</h4>
                          <p className="text-xs text-white/40 font-bold uppercase tracking-widest">{l.address}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{formatCurrency(l.price)}</p>
                          {l.property_sub_type === 'Shared' && (
                            <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest border border-orange-400/30 px-2 py-0.5 rounded-md mt-1 inline-block">Shared Room</span>
                          )}
                          <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest text-white/30 mt-2">
                             <span>🏗️ {l.bedrooms && l.bedrooms > 0 ? `${l.bedrooms} Bed` : 'Any Beds'}</span>
                             <span>🚿 {l.bathrooms || 1} Bath</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-white/60 mb-8 border-l-2 border-emerald-500/30 pl-6 py-1 leading-relaxed">"{l.match_reason}"</p>
                      <div className="flex gap-4">
                        <a href={l.source_url} target="_blank" className="bg-white text-black px-8 py-3 rounded-xl text-xs font-bold uppercase hover:bg-emerald-400 transition-all">View Property</a>
                        <span className="bg-white/5 px-6 py-3 rounded-xl text-[10px] font-bold text-white/20 uppercase tracking-widest flex items-center">{l.platform}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {savedAlerts.length > 0 ? (
                    savedAlerts.map((alert: any, idx: number) => {
                      const displayQuery = alert.search_query.split('(')[0].trim();
                      const isPetFriendly = alert.search_query.toLowerCase().includes('pet friendly');
                      
                      return (
                        <div key={idx} className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex justify-between items-center group transition-all hover:bg-white/[0.05] hover:border-white/20">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-sm font-bold">{displayQuery}</h4>
                              {isPetFriendly && (
                                 <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter border border-emerald-500/20 flex items-center gap-1">
                                   <Dog size={10} weight="fill" /> Pet-Sit Priority
                                 </span>
                              )}
                            </div>
                            <div className="flex gap-4 text-[10px] font-bold text-white/30 uppercase tracking-widest items-center">
                              <div className="flex items-center gap-1.5 grayscale opacity-50">
                                🏗️ {alert.min_bedrooms ? 
                                    (Array.isArray(alert.min_bedrooms) ? alert.min_bedrooms.join(', ') : alert.min_bedrooms) + '+' : 
                                    'Any'} Beds
                              </div>
                              <div className="flex items-center gap-1.5">
                                💰 {formatCurrency(alert.max_price)} Max
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => deleteAlert(alert.id || alert.search_id)}
                            className="text-white/10 group-hover:text-red-500/60 text-[10px] font-bold uppercase tracking-widest transition-all px-4 py-2 hover:bg-red-500/5 rounded-xl border border-transparent hover:border-red-500/10"
                          >
                            Delete
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="bg-white/[0.02] border border-white/5 border-dashed rounded-3xl p-32 text-center">
                      <p className="text-white/10 text-[10px] uppercase tracking-[0.5em] font-bold">No saved alerts found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar (Account & Subscription) */}
          <div className="lg:col-span-3 space-y-8 lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto custom-scrollbar pl-2">
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-8">
              <div>
                <h2 className="text-sm font-bold text-white/40 uppercase tracking-[0.2em] mb-4">Account Status</h2>
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Active Plan</p>
                  <p className="text-lg font-black text-white">{userProfile.tier.toUpperCase()}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Available Upgrades</h3>
                
                {userProfile.tier === 'free' && (
                  <div className="bg-white/5 border border-white/5 p-6 rounded-2xl space-y-4 hover:border-white/10 transition-all">
                    <div>
                      <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Bronze Plan</h4>
                      <p className="text-sm font-bold text-white">R100 / Month</p>
                      <div className="space-y-1 mt-2">
                         <p className="text-[9px] text-white/40">• 5 Active Sniper Alerts</p>
                         <p className="text-[9px] text-white/40">• Access to P24 & RentUncle</p>
                      </div>
                    </div>
                    <PayPalButtons 
                      style={{ layout: 'horizontal', color: 'blue', shape: 'pill', label: 'subscribe', height: 35 }}
                      createSubscription={(data, actions) => {
                        const planId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_BRONZE;
                        return actions.subscription.create({ 'plan_id': planId || "" });
                      }}
                      onApprove={async (data) => handleSubscriptionSuccess('bronze', data.subscriptionID || '')}
                    />
                  </div>
                )}

                {userProfile.tier !== 'silver' && userProfile.tier !== 'gold' && (
                  <div className="bg-white/10 border border-blue-500/20 p-6 rounded-2xl space-y-4 hover:border-blue-500/40 transition-all">
                    <div>
                      <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Silver Plan</h4>
                      <p className="text-sm font-bold text-white">R200 / Month</p>
                      <div className="space-y-1 mt-2">
                         <p className="text-[9px] text-white/40">• 10 Active Sniper Alerts</p>
                         <p className="text-[9px] text-white/60">• 2x Deep Scans Per Day</p>
                         <p className="text-[9px] text-emerald-400/80 font-bold">• Pet-Friendly Semantic Extract</p>
                      </div>
                    </div>
                    <PayPalButtons 
                      style={{ layout: 'horizontal', color: 'blue', shape: 'pill', label: 'subscribe', height: 35 }}
                      createSubscription={(data, actions) => {
                        const planId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_SILVER;
                        return actions.subscription.create({ 'plan_id': planId || "" });
                      }}
                      onApprove={async (data) => handleSubscriptionSuccess('silver', data.subscriptionID || '')}
                    />
                  </div>
                )}

                {userProfile.tier !== 'gold' && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-2xl space-y-4 hover:border-emerald-500/40 transition-all relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[8px] font-black px-3 py-1 uppercase tracking-widest">Speed</div>
                    <div>
                      <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Gold Plan</h4>
                      <p className="text-sm font-bold text-white">R300 / Month</p>
                      <div className="space-y-1 mt-2">
                         <p className="text-[9px] text-white/40">• 50 Active Sniper Alerts</p>
                         <p className="text-[9px] text-emerald-500 font-bold tracking-tight">• Scans Every 10 Minutes</p>
                      </div>
                    </div>
                    <PayPalButtons 
                      style={{ layout: 'horizontal', color: 'black', shape: 'pill', label: 'subscribe', height: 35 }}
                      createSubscription={(data, actions) => {
                        const planId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_GOLD;
                        return actions.subscription.create({ 'plan_id': planId || "" });
                      }}
                      onApprove={async (data) => handleSubscriptionSuccess('gold', data.subscriptionID || '')}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
