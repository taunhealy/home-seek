'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fetchWithAuth, API_BASE_URL, fetchSuburbs } from '@/lib/api';
import { 
  Globe, 
  House, 
  SunHorizon, 
  Dog, 
  Layout, 
  Stack, 
  UsersThree, 
  Lightning,
  MagnifyingGlass
} from "@phosphor-icons/react";
import { formatCurrency } from '@/lib/utils';
import { INTELLIGENCE_SOURCES, TIER_LIMITS, type IntelligenceSource } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';

interface SniperFormProps {
  onSuccess?: () => void;
  onScanTriggered?: (taskId: string) => void;
  onAlertSaved?: () => void;
  isStandalone?: boolean;
  initialData?: any;
}

export const SniperForm: React.FC<SniperFormProps> = ({ 
  onSuccess, 
  onScanTriggered, 
  onAlertSaved, 
  isStandalone = false,
  initialData
}) => {
  const { user, profile: userProfile } = useAuth();
  const [aiPrompt, setAiPrompt] = useState(initialData?.search_query || '');
  const [targetArea, setTargetArea] = useState(initialData?.target_area || '');
  const [maxPrice, setMaxPrice] = useState(initialData?.max_price || 25000);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [selectedBedrooms, setSelectedBedrooms] = useState<number[]>(initialData?.min_bedrooms || []);
  const [rentalType, setRentalType] = useState<'all' | 'long-term' | 'short-term' | 'pet-sitting' | 'looking-for'>(initialData?.rental_type || 'all');
  const [propertySubType, setPropertySubType] = useState<'all' | 'Whole' | 'Shared'>(initialData?.property_sub_type || 'all');
  const [isDeploying, setIsDeploying] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>(initialData?.sources || INTELLIGENCE_SOURCES.map(s => s.id));
  const [allSuburbs, setAllSuburbs] = useState<string[]>([]);
  const [targetAreaSuggestions, setTargetAreaSuggestions] = useState<string[]>([]);
  const [petPolicy, setPetPolicy] = useState<'all' | 'yes' | 'no'>(initialData?.pet_policy || (initialData?.pet_friendly ? 'yes' : 'all'));

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
      setTargetAreaSuggestions(matches);
    } else {
      setTargetAreaSuggestions([]);
    }
  }, [targetArea, allSuburbs]);

  useEffect(() => {
    if (rentalType === 'short-term') {
      setSelectedSources(['Sea Point Rentals']);
    } else if (rentalType === 'pet-sitting') {
      setSelectedSources(['Sea Point Rentals']);
    } else if (rentalType === 'looking-for') {
      setSelectedSources(['Huis Huis']);
    } else {
      if (petPolicy === 'yes') {
        setSelectedSources(INTELLIGENCE_SOURCES.filter(s => s.type === 'pet' || s.id === 'Huis Huis').map(s => s.id));
      } else {
        setSelectedSources(INTELLIGENCE_SOURCES.map((s: IntelligenceSource) => s.id));
      }
    }
  }, [rentalType, petPolicy]);

  const handleAiSearch = async (isAlertSave = false) => {
    setIsDeploying(true);
    try {
      const searchId = initialData?.id || initialData?.search_id;
      const endpoint = searchId ? `/update-alert/${user?.uid}/${searchId}` : `/deploy-sniper`;
      const method = searchId ? 'POST' : 'POST'; // Both are POST in the backend for these routes

      const response = await fetchWithAuth(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.uid,
          search_query: aiPrompt,
          target_area: targetArea,
          alert_enabled: isAlertSave || !!searchId,
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
      } else {
        onSuccess?.();
        if (isAlertSave || searchId) {
          onAlertSaved?.();
          if (!searchId) {
            setAiPrompt('');
            setTargetArea('');
          }
        } else if (data.task_id) {
          onScanTriggered?.(data.task_id);
        }
      }
    } catch (error) { 
      console.error(error); 
    } finally { 
      setIsDeploying(false); 
    }
  };

  const toggleSource = (name: string) => {
    setSelectedSources(prev => 
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  return (
    <div className={`space-y-8 ${isStandalone ? 'max-w-2xl mx-auto' : ''}`}>
      <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 md:p-8">
        <h2 className="text-[11px] font-black text-white uppercase tracking-[0.4em] mb-10 text-center">
          New Property Alert
        </h2>
        
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
                className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-2 ${petPolicy === 'yes' ? 'bg-emerald-500 text-black shadow-lg' : 'text-white/20 hover:text-white/40'}`}
              >
                <Dog size={12} weight="bold" /> YES
              </button>
              <button 
                onClick={() => setPetPolicy('no')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${petPolicy === 'no' ? 'bg-red-500/20 text-red-400' : 'text-white/20 hover:text-white/40'}`}
              >
                NO
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-8">
           <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block ml-1">Mission Type</span>
           <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'long-term', label: 'Long Term', icon: House },
                { id: 'short-term', label: 'Short Term', icon: SunHorizon },
                { id: 'pet-sitting', label: 'Pet-Sitting', icon: Dog },
                { id: 'looking-for', label: 'Wanted', icon: MagnifyingGlass }
              ].map((type) => (
                <button 
                  key={type.id}
                  onClick={() => setRentalType(type.id as any)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${rentalType === type.id ? 'bg-white/10 border-white/20 text-white shadow-xl' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
                >
                  <type.icon size={18} weight={rentalType === type.id ? "fill" : "bold"} className={rentalType === type.id ? "text-emerald-500" : ""} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{type.label}</span>
                </button>
              ))}
           </div>
        </div>

        {/* Layout Toggle */}
        <div className="mb-8 space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Property Layout</span>
            <span className="text-[9px] font-black text-emerald-500/60 uppercase">{propertySubType === 'all' ? 'Any Configuration' : propertySubType}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
             {[
               { id: 'all', label: 'Any', icon: Stack },
               { id: 'Whole', label: 'Whole', icon: Layout },
               { id: 'Shared', label: 'Shared', icon: UsersThree }
             ].map((opt) => (
               <button
                 key={opt.id}
                 onClick={() => setPropertySubType(opt.id as any)}
                 className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all ${propertySubType === opt.id ? 'bg-white/10 text-white shadow-lg border border-white/10' : 'text-white/20 hover:text-white/40'}`}
               >
                 <opt.icon size={14} weight="bold" />
                 {opt.label}
               </button>
             ))}
          </div>
        </div>

        {/* Price Controller */}
        <div className="mb-8 p-6 bg-black/40 rounded-3xl border border-white/5 group hover:border-emerald-500/30 transition-all">
          <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col">
               <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Max Budget</span>
               <div className="flex items-center gap-3">
                  {isEditingPrice ? (
                    <input 
                      autoFocus
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                      onBlur={() => setIsEditingPrice(false)}
                      onKeyDown={(e) => e.key === 'Enter' && setIsEditingPrice(false)}
                      className="bg-transparent text-2xl font-black text-white focus:outline-none w-32 border-b border-emerald-500"
                    />
                  ) : (
                    <h4 className="text-2xl font-black text-white tracking-tighter" onClick={() => setIsEditingPrice(true)}>
                      {formatCurrency(maxPrice)}
                    </h4>
                  )}
                  <button onClick={() => setIsEditingPrice(!isEditingPrice)} className="p-1 hover:bg-white/5 rounded-lg transition-all">
                    <Lightning size={14} className="text-emerald-500/40" />
                  </button>
               </div>
            </div>
            <div className="text-right">
               <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Market Tier</span>
               <p className="text-[10px] font-black text-white/40 uppercase">{maxPrice > 30000 ? 'LUXURY' : 'STANDARD'}</p>
            </div>
          </div>
          <input 
            type="range" 
            min="2000" 
            max="100000" 
            step="500"
            value={maxPrice}
            onChange={(e) => setMaxPrice(parseInt(e.target.value))}
            className="w-full accent-emerald-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
          />
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
                      }} 
                      className={`py-3 rounded-lg flex items-center justify-center text-[10px] font-bold border transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
                    >
                      {n === 5 ? '5+' : n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dedicated Target Neighborhood */}
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
                 {targetAreaSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-2 p-2 bg-black border border-white/10 rounded-2xl shadow-2xl flex flex-wrap gap-2">
                       {targetAreaSuggestions.map(s => (
                          <button 
                             key={s}
                             onClick={() => {
                                setTargetArea(s);
                                setTargetAreaSuggestions([]);
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
          </div>

          <div className="flex flex-col gap-3 pt-6">
             <button 
               onClick={() => handleAiSearch(true)}
               disabled={isDeploying || !targetArea}
               className={`w-full py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 ${isDeploying || !targetArea ? 'bg-white/5 text-white/10 cursor-not-allowed' : 'bg-emerald-500 text-black hover:bg-emerald-400 hover: shadow-[0_20px_40px_rgba(16,185,129,0.2)]'}`}
             >
                {isDeploying ? (
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <>DEPLOY SNIPER <Lightning size={16} weight="fill" /></>
                )}
             </button>
             
             {!isStandalone && (
               <button 
                 onClick={() => handleAiSearch(false)}
                 disabled={isDeploying || !targetArea}
                 className={`w-full py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all border ${isDeploying || !targetArea ? 'border-white/5 text-white/5 cursor-not-allowed' : 'border-white/20 text-white/60 hover:bg-white/5 hover:text-white'}`}
               >
                  QUICK SCAN ONLY
               </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
