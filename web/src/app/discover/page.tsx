"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PayPalButtons } from "@paypal/react-paypal-js";
import { fetchWithAuth, API_BASE_URL, fetchSuburbs } from '@/lib/api';
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
  ChartPolar,
  Plus
} from "@phosphor-icons/react";
import { formatCurrency } from '@/lib/utils';
import { ListingCard } from '@/components/ListingCard';
import { AlertItem } from '@/components/AlertItem';
import { Navbar } from '@/components/Navbar';
import { ListingSchema, AlertSchema, type Listing, type Alert } from '@/lib/schemas';
import { INTELLIGENCE_SOURCES, TIER_LIMITS, type IntelligenceSource } from '@/lib/constants';


export default function DiscoverPage() {
  const [activeTab, setActiveTab] = useState<'listings' | 'alerts'>('listings');
  const [aiPrompt, setAiPrompt] = useState('');
  const [targetArea, setTargetArea] = useState('');
  const [maxPrice, setMaxPrice] = useState(25000);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [selectedBedrooms, setSelectedBedrooms] = useState<number[]>([]);
  const [rentalType, setRentalType] = useState<'all' | 'long-term' | 'short-term' | 'pet-sitting'>('all');
  const [propertySubType, setPropertySubType] = useState<'all' | 'Whole' | 'Shared'>('all');
  const [isDeploying, setIsDeploying] = useState(false);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [userProfile, setUserProfile] = useState<any>({ tier: 'free' });
  const [selectedSources, setSelectedSources] = useState<string[]>(INTELLIGENCE_SOURCES.map(s => s.id));
  const [savedAlerts, setSavedAlerts] = useState<Alert[]>([]);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [platformFilter, setPlatformFilter] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [allSuburbs, setAllSuburbs] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [petPolicy, setPetPolicy] = useState<'all' | 'yes' | 'no'>('all');
  const [missionFilter, setMissionFilter] = useState<'all' | 'long-term' | 'short-term' | 'pet-sitting'>('all');
  const [listingsPage, setListingsPage] = useState(1);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const res = await fetchWithAuth(`/user-profile/${u.uid}`);
          if (res && res.ok) {
            const profile = await res.json();
            // Single source of truth: always use verified Firebase UID
            setUserProfile({ ...profile, id: u.uid });
          } else {
            setUserProfile({ tier: 'free', id: u.uid });
          }
        } catch {
          setUserProfile({ tier: 'free', id: u.uid });
        }
      } else {
        // User signed out — reset to null to trigger loading guard
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);


  const fetchMissions = async () => {
    if (!userProfile?.id || !user) return;
    try {
      // 🟢 Part A: Fetch Active Alerts
      const alertsRes = await fetchWithAuth(`/searches/${userProfile.id}`);
      if (alertsRes && alertsRes.ok) {
        const alertsData = await alertsRes.json();
        const sanitized = alertsData.map((a: any) => AlertSchema.parse(a));
        setSavedAlerts(sanitized);
      }

      // 🔵 Part B: Fetch Historical Listings (Past Matches)
      const listingsRes = await fetchWithAuth(`/listings/${userProfile.id}?page=${listingsPage}`);
      if (listingsRes && listingsRes.ok) {
        const listingsData = await listingsRes.json();
        const sanitized = listingsData.map((l: any) => ListingSchema.parse(l));
        if (listingsPage > 1) {
          setListings(prev => [...prev, ...sanitized]);
        } else {
          setListings(sanitized);
        }
      }
    } catch (e) {
      console.error("Failed to sync terminal data:", e);
    }
  };

  useEffect(() => {
    if (mounted && userProfile?.id) fetchMissions();
  }, [mounted, userProfile?.id, listingsPage]);

  // 🌍 GEOFENCE REGISTRY — Suburb autocomplete
  useEffect(() => {
    if (!mounted) return;
    fetchSuburbs().then(setAllSuburbs);
  }, [mounted]);

  // 🛰️ SIGNAL SPOTLIGHT (Autocomplete Logic)
  useEffect(() => {
    if (!aiPrompt || aiPrompt.length < 2) {
      setSuggestions([]);
      return;
    }
    
    // Filter suburbs based on the last part of the prompt
    const parts = aiPrompt.split(/[\s,]+/);
    const lastPart = parts[parts.length - 1].trim().toLowerCase();
    
    if (lastPart.length < 2) {
      setSuggestions([]);
      return;
    }

    const matches = (Array.isArray(allSuburbs) ? allSuburbs : [])
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
            const res = await fetchWithAuth(`${API_BASE_URL}/task/${activeTask.id}`);
            if (!res || res.status === 404) return;
            const data = await res.json();
            
            if (data.status === 'Completed' || data.status === 'Done') {
              const sanitized = (data.results || []).map((l: any) => ListingSchema.parse(l));
              setListings(sanitized);
              setActiveTask(null);
              clearInterval(interval);
            } else if (data?.status?.includes?.('Found') || data?.status?.includes?.('Complete') || data?.status?.includes?.('Failed')) {
              clearInterval(interval);
              const resultsRes = await fetchWithAuth(`/listings/${userProfile.id}`);
              if (resultsRes && resultsRes.ok) {
                 const resultsData = await resultsRes.json();
                 setListings(resultsData);
              }
              fetchMissions();
            }
          } catch (e) { console.error(e); }
        }, 2000);
      }, 1000);
      
      return () => { clearTimeout(timer); clearInterval(interval); };
    }
  }, [activeTask?.id, userProfile?.id]);

  const handleSubscriptionSuccess = async (tier: string, subscriptionId: string) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/update-tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: tier.toLowerCase(),
          subscription_id: subscriptionId,
          user_id: userProfile?.id,
          updated_at: new Date().toISOString()
        })
      });
      if (res && res.ok) {
        const data = await res.json();
        if (data.status === 'ok') {
          setUserProfile({ ...userProfile, tier });
          alert(`Success! Your account has been upgraded to ${tier.toUpperCase()}.`);
        }
      }
    } catch (e) { console.error("Update failed:", e); }
  };

  const deleteAlert = async (searchId: string) => {
    if (!confirm("Are you sure you want to delete this alert?")) return;
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/delete-alert/${userProfile.id}/${searchId}`, { method: 'DELETE' });
      if (res && res.ok) fetchMissions();
    } catch (e) { console.error("Delete failed:", e); }
  };

  const updateAlert = async (searchId: string, updates: any) => {
    try {
      // Optimistic Update
      setSavedAlerts(prev => prev.map(a => (a.id === searchId || (a as any).search_id === searchId) ? { ...a, ...updates } : a));
      
      const res = await fetchWithAuth(`${API_BASE_URL}/update-alert/${userProfile.id}/${searchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res && res.ok) {
        // Optimistic state is sufficient, avoid stale overwrite
      }
    } catch (e) { console.error("Update failed:", e); }
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
      // Access Check: Check Tier Limits (Client Side Fast-Fail)
      const currentLimit = TIER_LIMITS[userProfile?.tier as keyof typeof TIER_LIMITS] || 0;
      const currentAlerts = savedAlerts.length;
      
      if (isAlertSave && currentAlerts >= currentLimit && userProfile?.tier === 'free') {
        alert(`Upgrade Required! Your current profile is restricted to exploration only. Please subscribe to start deploying automated snipers.`);
        setIsDeploying(false);
        return;
      }
      
      if (isAlertSave && currentAlerts >= currentLimit) {
        alert(`Mission Cap Reached! Your ${userProfile?.tier?.toUpperCase()} tier is limited to ${currentLimit} active snipers. Please upgrade to expand your discovery grid.`);
        setIsDeploying(false);
        return;
      }

      const response = await fetchWithAuth(`${API_BASE_URL}/deploy-sniper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Always use the live Firebase UID — never trust derived state
          user_id: user?.uid,
          search_query: aiPrompt,
          target_area: targetArea,
          alert_enabled: isAlertSave,
          max_price: maxPrice,
          min_bedrooms: selectedBedrooms,
          pet_friendly: petPolicy === 'yes',
          pet_policy: petPolicy, 
          rental_type: rentalType,
          property_sub_type: propertySubType,
          sources: selectedSources
        }),
      });
      if (!response) return;
      const data = await response.json();
      
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
          // Refresh list with buffer for DB propagation
          setTimeout(() => fetchMissions(), 300);
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
      setSelectedSources(INTELLIGENCE_SOURCES.filter((s: IntelligenceSource) => s.type === 'pet').map((s: IntelligenceSource) => s.id));
      setPetPolicy('yes');
    } else {
      if (petPolicy === 'yes') {
        setSelectedSources(INTELLIGENCE_SOURCES.filter((s: IntelligenceSource) => s.type === 'pet').map((s: IntelligenceSource) => s.id));
      } else if (petPolicy === 'no') {
        setSelectedSources(INTELLIGENCE_SOURCES.filter((s: IntelligenceSource) => s.type === 'standard').map((s: IntelligenceSource) => s.id));
      } else {
        setSelectedSources(INTELLIGENCE_SOURCES.map((s: IntelligenceSource) => s.id));
      }
    }
  }, [rentalType, petPolicy]);

  const handleUpdateProfile = async (updates: any) => {
    if (!user) return;
    try {
      await fetchWithAuth(`/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid, ...updates })
      });
      setUserProfile((prev: any) => ({ ...prev, ...updates }));
    } catch (e) {
      console.error("Failed to update profile telemetry:", e);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em]">Synchronizing Identity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <Navbar 
        user={user} 
        profile={userProfile} 
        handleLogout={handleLogout} 
        onUpdateProfile={handleUpdateProfile}
      />

      <div className="max-w-[1400px] mx-auto p-6 md:p-12 space-y-12">
        {!user ? (
          <div className="py-32 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-[0_0_50px_rgba(16,185,129,0.1)] border border-emerald-500/20">
               <Globe size={48} className="text-emerald-500" weight="duotone" />
            </div>
            <h2 className="text-5xl font-serif font-medium mb-6 tracking-tight">Intel Access Restricted</h2>
            <p className="text-white/30 max-w-xl mx-auto mb-12 text-lg leading-relaxed font-medium">
               The Home-Seek Intelligence Engine requires a verified ZAF node connection to deploy snipers, monitor neighborhoods, and relay real-time rental alerts.
            </p>
            <div className="flex flex-col items-center gap-6">
              <button 
                onClick={handleLogin}
                className="bg-white text-black px-16 py-6 rounded-3xl font-black uppercase text-sm tracking-[0.3em] shadow-[0_30px_60px_rgba(255,255,255,0.1)] hover:bg-emerald-500 transition-all hover:scale-105 active:scale-95"
              >
                Initialize Secure Session
              </button>
              <p className="text-[10px] text-white/10 uppercase tracking-[0.4em] font-black">Authorized Personnel Only</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 animate-in fade-in duration-700 overflow-x-hidden">
          
          {/* New Alert Form */}
          <div id="sniper-form" className="lg:col-span-3 space-y-8 lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto custom-scrollbar pr-4">
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
              <h2 className="text-[11px] font-black text-white/40 uppercase tracking-[0.4em] mb-10 text-center">New Property Alert</h2>
              
               {/* Pet Friendly Toggle */}
               <div className="mb-6 p-0.5 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                 <div className="flex flex-col p-4 bg-emerald-500/[0.03]">
                   <span className="text-[9px] font-black text-emerald-500/80 uppercase tracking-[0.2em] leading-none mb-3">Pet Friendly</span>
                   <div className="flex bg-black/60 p-1 rounded-xl border border-white/5">
                     <button 
                       onClick={() => setPetPolicy('all')}
                       className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${petPolicy === 'all' ? 'bg-white/10 text-white shadow-lg' : 'text-white/20 hover:text-white/40'}`}
                     >
                       ALL
                     </button>
                     <button 
                       onClick={() => setPetPolicy('yes')}
                       className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${petPolicy === 'yes' ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'text-white/20 hover:text-white/40'}`}
                     >
                       YES
                     </button>
                     <button 
                       onClick={() => setPetPolicy('no')}
                       className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${petPolicy === 'no' ? 'bg-red-500/20 text-red-500 shadow-lg' : 'text-white/20 hover:text-white/40'}`}
                     >
                       NO
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
                  {INTELLIGENCE_SOURCES.map((s: IntelligenceSource) => {
                    const isActive = selectedSources.includes(s.id);
                    return (
                      <button 
                        key={s.id} 
                        onClick={() => toggleSource(s.id)}
                        className={`px-3 py-1.5 rounded-lg border transition-all text-[9px] font-black uppercase flex items-center gap-1.5 ${
                          isActive 
                            ? `bg-${s.color}-500/20 text-${s.color}-400 border-${s.color}-500/40 shadow-[0_0_10px_rgba(16,185,129,0.1)]` 
                            : 'bg-white/5 text-white/20 border-white/5 opacity-50 grayscale hover:grayscale-0 hover:opacity-100'
                        }`}
                      >
                        <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-current animate-pulse' : 'bg-white/20'}`} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              
              <div className="space-y-6">
                <div className="space-y-4">
                  {/* Bedrooms */}
                  <div className="flex flex-col gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Target Bedrooms</span>
                    <div className="grid grid-cols-6 gap-1">
                      <button
                        onClick={() => setSelectedBedrooms([])}
                        className={`py-3 rounded-xl text-[10px] font-bold transition-all border ${
                          selectedBedrooms.length === 0 
                            ? 'bg-white text-black border-white shadow-[0_10px_20px_rgba(255,255,255,0.1)]' 
                            : 'bg-white/5 text-white/40 border-white/5 hover:border-white/20'
                        }`}
                      >
                        ALL
                      </button>
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

                  {/* Dedicated Target Neighborhood (ENFORCED v120.0) */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Target Neighborhood</label>
                    <div className="relative">
                       <input 
                          type="text"
                          value={targetArea}
                          onChange={(e) => setTargetArea(e.target.value)}
                          placeholder="Where should the Sniper watch? (e.g. Muizenberg)"
                          className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all font-bold placeholder:text-white/20"
                       />
                       {suggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-2 p-2 bg-black border border-white/10 rounded-2xl shadow-2xl flex flex-wrap gap-2">
                             {suggestions.map(s => (
                                <button 
                                   key={s}
                                   onClick={() => {
                                      setTargetArea(s);
                                      setSuggestions([]);
                                   }}
                                   className="px-3 py-1.5 bg-emerald-500 text-black rounded-xl text-[10px] font-black hover:scale-105 transition-all shadow-lg"
                                >
                                   {s}
                                </button>
                             ))}
                          </div>
                       )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end mb-1">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Mission Context (Optional)</label>
                    </div>
                    <textarea 
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g. Water included, seaview..."
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-white/20 transition-all min-h-[80px]"
                    />
                  </div>
                  
                  {/* Protocol Presets (Fallback/Helpers) */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {[
                      "Sea Point", "Green Point", "Camps Bay", "Gardens", "Newlands", "Constantia", "Muizenberg", "Kalk Bay", "Water Included", "Safe", "Garage"
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

                  <button 
                    onClick={() => handleAiSearch(true)} 
                    disabled={isDeploying}
                    className={`w-full bg-emerald-500 text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all ${isDeploying ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:brightness-110 active:scale-95'}`}
                  >
                    {isDeploying ? 'DEPLOYING MISSION...' : 'DEPLOY SMART SNIPER'}
                  </button>
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-6 space-y-8">
            <div className="flex gap-12 border-b border-white/10">
              <button onClick={() => setActiveTab('listings')} className={`pb-6 text-sm font-bold transition-all relative ${activeTab === 'listings' ? 'text-white' : 'text-white/20'}`}>
                Past Alerts
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

                  {/* Mission Category Filter (v105.5) */}
                  <div className="flex flex-wrap gap-2 mb-8 bg-white/[0.02] p-2 rounded-2xl border border-white/5">
                    {[
                      { id: 'all', label: 'All Missions' },
                      { id: 'long-term', label: 'Long Term' },
                      { id: 'short-term', label: 'Short Term' },
                      { id: 'pet-sitting', label: 'Pet-Sitting' }
                    ].map((mission) => (
                      <button 
                        key={mission.id}
                        onClick={() => setMissionFilter(mission.id as any)}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                          missionFilter === mission.id 
                            ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.15)]' 
                            : 'text-white/20 border-transparent hover:text-white/40 hover:bg-white/5'
                        }`}
                      >
                        {mission.label}
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
                    .filter((l: any) => (!platformFilter || l.platform === platformFilter) && (missionFilter === 'all' || l.rental_type === missionFilter)).length > 0 ? (
                    listings
                      .filter((l: any) => (!platformFilter || l.platform === platformFilter) && (missionFilter === 'all' || l.rental_type === missionFilter))
                      .map((l: any, idx: number) => (
                        <ListingCard key={idx} listing={l} idx={idx} />
                      ))
                  ) : (
                    <div className="bg-white/[0.02] border border-white/5 border-dashed rounded-3xl p-32 text-center">
                      <p className="text-white/10 text-[10px] uppercase tracking-[0.5em] font-bold">No historical matches found</p>
                    </div>
                  )}

                  {listings.length >= 50 * listingsPage && (
                    <div className="pt-8 flex justify-center">
                      <button 
                        onClick={() => setListingsPage(prev => prev + 1)}
                        className="bg-white/5 border border-white/10 px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white hover:bg-white/10 transition-all"
                      >
                        Load More History
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="space-y-4">
                    {savedAlerts.length > 0 ? (
                      savedAlerts.map((alert: any, idx: number) => (
                        <AlertItem key={idx} alert={alert} deleteAlert={deleteAlert} updateAlert={updateAlert} />
                      ))
                    ) : (
                      <div className="bg-white/[0.02] border border-white/5 border-dashed rounded-3xl p-32 text-center">
                        <p className="text-white/10 text-[10px] uppercase tracking-[0.5em] font-bold">No saved alerts found</p>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => {
                      const formElement = document.getElementById('sniper-form');
                      formElement?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 py-6 rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] hover:bg-emerald-500 hover:text-black transition-all group flex items-center justify-center gap-3"
                  >
                    <Plus size={16} weight="bold" /> Deploy New Sniper
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar (Account & Subscription) */}
          <div className="lg:col-span-3 space-y-8 lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto overflow-x-hidden custom-scrollbar pl-2">
            
            {/* 📱 SIGNAL CHANNELS */}
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 space-y-6">
               <div>
                  <h2 className="text-sm font-bold text-emerald-500 uppercase tracking-[0.2em] mb-2">Signal Channels</h2>
                  <p className="text-[9px] text-white/40 uppercase font-bold">Where to send your live alerts</p>
               </div>
               
               <div className="space-y-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-white/60 uppercase">WhatsApp Number</label>
                     <div className="flex gap-2">
                        <input 
                           type="text" 
                           placeholder="e.g. 27821234567"
                           value={userProfile?.whatsapp || ''}
                           onChange={(e) => setUserProfile({...userProfile, whatsapp: e.target.value})}
                           className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-all"
                        />
                        <button 
                           onClick={async () => {
                              try {
                                 await fetchWithAuth(`${API_BASE_URL}/update-profile`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ user_id: user?.uid, whatsapp: userProfile?.whatsapp })
                                 });
                                 alert("Signal established! WhatsApp linked.");
                              } catch (e) { console.error(e); }
                           }}
                           className="bg-emerald-500 text-black p-3 rounded-xl hover:bg-emerald-400 transition-all active:scale-95"
                        >
                           <CheckCircle size={18} weight="bold" />
                        </button>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-8">
               <div>
                 <h2 className="text-sm font-bold text-white/40 uppercase tracking-[0.2em] mb-4">Account Status</h2>
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Active Plan</p>
                  <p className="text-lg font-black text-white">{userProfile?.tier?.toUpperCase() || 'FREE'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Available Upgrades</h3>
                
                {userProfile?.tier === 'free' && (
                  <div className="bg-white/5 border border-white/5 p-6 rounded-2xl space-y-4 hover:border-white/10 transition-all">
                    <div>
                      <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Silent Hunter</h4>
                      <p className="text-sm font-bold text-white">R149 / Month</p>
                      <div className="space-y-1 mt-2">
                         <p className="text-[12px] text-white/40">• 8h Frequency</p>
                         <p className="text-[12px] text-white/40">• WhatsApp Alerts</p>
                         <p className="text-[12px] text-white/40">• Automated Search</p>
                      </div>
                    </div>
                    <PayPalButtons 
                      style={{ layout: 'vertical', color: 'blue', shape: 'pill', label: 'subscribe', height: 35 }}
                      createSubscription={(data, actions) => {
                        const planId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_BRONZE;
                        return actions.subscription.create({ 'plan_id': planId || "" });
                      }}
                      onApprove={async (data) => handleSubscriptionSuccess('bronze', data.subscriptionID || '')}
                    />
                  </div>
                )}

                {userProfile?.tier !== 'silver' && userProfile?.tier !== 'gold' && (
                  <div className="bg-white/10 border border-blue-500/20 p-6 rounded-2xl space-y-4 hover:border-blue-500/40 transition-all">
                    <div>
                      <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Proactive Sniper</h4>
                      <p className="text-sm font-bold text-white">R299 / Month</p>
                      <div className="space-y-1 mt-2">
                         <p className="text-[12px] text-white/40">• 4h Frequency</p>
                         <p className="text-[12px] text-white/40">• Fast Alerts</p>
                         <p className="text-[12px] text-white/40">• Priority Area Access</p>
                      </div>
                    </div>
                    <PayPalButtons 
                      style={{ layout: 'vertical', color: 'blue', shape: 'pill', label: 'subscribe', height: 35 }}
                      createSubscription={(data, actions) => {
                        const planId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_SILVER;
                        return actions.subscription.create({ 'plan_id': planId || "" });
                      }}
                      onApprove={async (data) => handleSubscriptionSuccess('silver', data.subscriptionID || '')}
                    />
                  </div>
                )}

                {userProfile?.tier !== 'gold' && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-2xl space-y-4 hover:border-emerald-500/40 transition-all relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[8px] font-black px-3 py-1 uppercase tracking-widest">Speed</div>
                    <div>
                      <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Discovery Overlord</h4>
                      <p className="text-sm font-bold text-white">R499 / Month</p>
                      <div className="space-y-1 mt-2">
                         <p className="text-[12px] text-emerald-500 font-bold">• 1h Frequency (Fastest)</p>
                         <p className="text-[12px] text-white/40">• Instant Alerts</p>
                         <p className="text-[12px] text-white/40">• Unlimited Searches</p>
                      </div>
                    </div>
                    <PayPalButtons 
                      style={{ layout: 'vertical', color: 'black', shape: 'pill', label: 'subscribe', height: 35 }}
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
        )}
      </div>
    </div>
  );
}

