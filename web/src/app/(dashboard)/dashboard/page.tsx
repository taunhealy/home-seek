"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { PayPalButtons } from "@paypal/react-paypal-js";
import { fetchWithAuth, API_BASE_URL, fetchSuburbs } from '@/lib/api';
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
  Plus,
  MagnifyingGlass,
  Trash
} from "@phosphor-icons/react";
import { formatCurrency } from '@/lib/utils';
import { ListingCard } from '@/components/ListingCard';
import { AlertItem } from '@/components/AlertItem';
import { ListingSchema, AlertSchema, type Listing, type Alert } from '@/lib/schemas';
import { INTELLIGENCE_SOURCES, TIER_LIMITS, type IntelligenceSource } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';
import { SniperForm } from '@/components/SniperForm';

export default function DashboardPage() {
  const { user, profile: userProfile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'listings' | 'alerts'>('listings');
  const [activeTask, setActiveTask] = useState<any>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [savedAlerts, setSavedAlerts] = useState<Alert[]>([]);
  const [platformFilter, setPlatformFilter] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [missionFilter, setMissionFilter] = useState<'all' | 'long-term' | 'short-term' | 'pet-sitting' | 'looking-for'>('all');
  const [listingsPage, setListingsPage] = useState(1);
  const [editModalData, setEditModalData] = useState<any>(null);

  const fetchAlerts = async () => {
    if (!userProfile?.id || !user) return;
    try {
      const alertsRes = await fetchWithAuth(`/searches/${user.uid}`);
      if (alertsRes && alertsRes.ok) {
        const alertsData = await alertsRes.json();
        const sanitized = Array.isArray(alertsData) ? alertsData.map((a: any) => AlertSchema.parse(a)) : [];
        setSavedAlerts(sanitized);
      }

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
    (window as any).openEditModal = (data: any) => setEditModalData(data);
    return () => { (window as any).openEditModal = undefined; };
  }, []);

  useEffect(() => {
    if (userProfile?.id) fetchAlerts();
  }, [userProfile?.id, listingsPage]);

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
              fetchAlerts();
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
        await refreshProfile();
        alert(`Success! Your account has been upgraded to ${tier.toUpperCase()}.`);
      }
    } catch (e) { console.error("Update failed:", e); }
  };

  const deleteAlert = async (searchId: string) => {
    if (!confirm("Are you sure you want to delete this alert?")) return;
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/delete-alert/${userProfile.id}/${searchId}`, { method: 'DELETE' });
      if (res && res.ok) fetchAlerts();
    } catch (e) { console.error("Delete failed:", e); }
  };

  const updateAlert = async (searchId: string, updates: any) => {
    try {
      setSavedAlerts(prev => prev.map(a => (a.id === searchId || (a as any).search_id === searchId) ? { ...a, ...updates } : a));
      const res = await fetchWithAuth(`${API_BASE_URL}/update-alert/${userProfile.id}/${searchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) fetchAlerts();
    } catch (e) { console.error("Update failed:", e); }
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start min-h-[1000px] animate-in fade-in duration-700 overflow-x-hidden">
      {editModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-lg">
                <h3 className="text-white font-bold mb-6">Edit Alert Parameters</h3>
                <SniperForm 
                    initialData={editModalData}
                    onAlertSaved={() => { setEditModalData(null); fetchAlerts(); }}
                />
                <button onClick={() => setEditModalData(null)} className="mt-4 text-white/50 text-xs uppercase">Cancel</button>
            </div>
        </div>
      )}
      {/* New Alert Form */}
      {/* Sniper Control Tower */}
      <div id="sniper-form" className="lg:col-span-3 space-y-8 lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto custom-scrollbar pr-4">
        <SniperForm 
          onAlertSaved={() => {
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 4000);
            setTimeout(() => fetchAlerts(), 300);
            setActiveTab('alerts');
          }}
          onScanTriggered={(taskId) => {
            setActiveTask({ id: taskId, status: 'Searching...', progress: 5 });
            setActiveTab('listings');
          }}
        />
      </div>

      {/* Activity Feed */}
      <div className="lg:col-span-9 space-y-8 min-h-[800px] items-start">
        <div className="flex justify-between items-center border-b border-white/10 mb-8">
          <div className="flex gap-12">
            <button onClick={() => setActiveTab('listings')} className={`pb-6 text-sm font-bold transition-all relative ${activeTab === 'listings' ? 'text-white' : 'text-white/20'}`}>
              Alert Feed
              {activeTab === 'listings' && <motion.div layoutId="tab-pill" className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500" />}
            </button>
            <button onClick={() => setActiveTab('alerts')} className={`pb-6 text-sm font-bold transition-all relative ${activeTab === 'alerts' ? 'text-white' : 'text-white/20'}`}>
              My Alerts
              {activeTab === 'alerts' && <motion.div layoutId="tab-pill" className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500" />}
            </button>
          </div>
          
          <Link 
            href="/alerts/new" 
            className="flex items-center gap-2 bg-emerald-500 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg mb-4"
          >
            <Plus size={14} weight="bold" /> New Alert
          </Link>
        </div>

        <div className="space-y-6">
          {/* Filter HUDs */}
          <div className="space-y-4">
            {activeTab === 'listings' && (
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
            )}

            <div className="flex flex-wrap gap-2 mb-8 bg-white/[0.02] p-2 rounded-2xl border border-white/5">
              {[
                { id: 'all', label: 'All Missions' },
                { id: 'long-term', label: 'Long Term' },
                { id: 'short-term', label: 'Short Term' },
                { id: 'pet-sitting', label: 'Pet-Sitting' },
                { id: 'looking-for', label: 'Wanted' }
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
          </div>

          {activeTab === 'listings' ? (
              <div className="space-y-6">
                {activeTask && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm font-bold uppercase tracking-widest">{activeTask.status || "Searching..."}</p>
                    <span className="text-xs font-bold text-emerald-500">{activeTask.progress || 0}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-4">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${activeTask.progress || 0}%` }} className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                  </div>
                </div>
              )}

              {listings
                .filter((l: any) => (!platformFilter || l.platform === platformFilter) && (missionFilter === 'all' || l.rental_type?.toLowerCase() === missionFilter.toLowerCase())).length > 0 ? (
                listings
                  .filter((l: any) => (!platformFilter || l.platform === platformFilter) && (missionFilter === 'all' || l.rental_type?.toLowerCase() === missionFilter.toLowerCase()))
                  .map((l: any, idx: number) => (
                    <ListingCard key={idx} listing={l} idx={idx} />
                  ))
              ) : (
                <div className="bg-white/[0.02] border border-white/5 border-dashed rounded-3xl p-32 text-center">
                  <p className="text-white/10 text-[10px] uppercase tracking-[0.5em] font-bold">No historical matches found</p>
                </div>
              )}

              {listings.length >= 50 * listingsPage && (
                <div className="pt-8 flex justify-center gap-4">
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
                {savedAlerts.filter(a => missionFilter === 'all' || a.rental_type?.toLowerCase() === missionFilter.toLowerCase()).length > 0 ? (
                  savedAlerts
                    .filter(a => missionFilter === 'all' || a.rental_type?.toLowerCase() === missionFilter.toLowerCase())
                    .map((alert: any, idx: number) => (
                      <AlertItem key={idx} alert={alert} deleteAlert={deleteAlert} updateAlert={updateAlert} />
                    ))
                ) : (
                  <div className="bg-white/[0.02] border border-white/5 border-dashed rounded-3xl p-32 text-center">
                    <p className="text-white/10 text-[10px] uppercase tracking-[0.5em] font-bold">No active snipers deployed</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>  
      </div>
    </div>
  );
}
