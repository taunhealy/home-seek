'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  MapPin, 
  Sparkle, 
  ArrowRight, 
  Plus, 
  Trash, 
  CheckCircle, 
  Play, 
  Pause, 
  Lightning, 
  ArrowsClockwise, 
  Waves, 
  ShieldCheck, 
  DeviceMobile, 
  Envelope, 
  Target, 
  House, 
  SlidersHorizontal,
  WarningCircle,
  Eye
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth, API_BASE_URL } from '@/lib/api';

interface AlertItem {
  id?: string;
  search_id?: string;
  target_area?: string;
  search_query?: string;
  max_price?: number;
  min_bedrooms?: number[] | number;
  property_type?: string;
  require_verified_sea_view?: boolean;
  require_independent_living?: boolean;
  require_private_entrance?: boolean;
  exclude_landlord_on_site?: boolean;
  pet_friendly?: boolean;
  is_active?: boolean;
  created_at?: string;
  rental_type?: string;
  commute_anchors?: any[];
}

export default function AlertsPage() {
  const { user, profile, loading, login, logout } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);
  const [isScanningAll, setIsScanningAll] = useState(false);
  const [scanningAlertId, setScanningAlertId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadAlerts = async () => {
    const uid = profile?.id || user?.uid || 'taun_test_user';
    try {
      setIsLoadingAlerts(true);
      const res = await fetchWithAuth(`/searches/${uid}`);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAlerts(data);
        } else {
          setAlerts([]);
        }
      }
    } catch (err) {
      console.warn('Failed to load alerts from backend:', err);
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [user, profile]);

  // Toggle Active / Standby
  const handleToggleActive = async (alert: AlertItem) => {
    const searchId = alert.id || alert.search_id;
    if (!searchId) return;
    const uid = profile?.id || user?.uid || 'taun_test_user';
    const newStatus = alert.is_active === false ? true : false;

    // Optimistic UI update
    setAlerts(prev => prev.map(a => (a.id === searchId || a.search_id === searchId) ? { ...a, is_active: newStatus } : a));

    try {
      const res = await fetchWithAuth(`/update-alert/${uid}/${searchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus }),
      });
      if (res && res.ok) {
        showToast(newStatus ? 'Radar monitor activated!' : 'Radar monitor moved to standby.');
      }
    } catch (err) {
      console.error('Failed to update alert:', err);
      loadAlerts();
    }
  };

  // Delete Alert
  const handleDeleteAlert = async (alert: AlertItem) => {
    const searchId = alert.id || alert.search_id;
    if (!searchId) return;
    const areaName = alert.target_area || 'this alert';
    if (!confirm(`Are you sure you want to delete the radar alert for ${areaName}?`)) return;

    const uid = profile?.id || user?.uid || 'taun_test_user';
    setAlerts(prev => prev.filter(a => a.id !== searchId && a.search_id !== searchId));

    try {
      const res = await fetchWithAuth(`/delete-alert/${uid}/${searchId}`, {
        method: 'DELETE',
      });
      if (res && res.ok) {
        showToast('Alert deleted successfully.');
      }
    } catch (err) {
      console.error('Failed to delete alert:', err);
      loadAlerts();
    }
  };

  // Trigger scan for a single alert
  const handleScanSingle = async (alert: AlertItem) => {
    const searchId = alert.id || alert.search_id;
    setScanningAlertId(searchId || 'scan');
    const uid = profile?.id || user?.uid || 'taun_test_user';

    try {
      const res = await fetchWithAuth(`/trigger-snipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: uid,
          query: alert.target_area || alert.search_query,
          ...alert,
        }),
      });
      if (res && res.ok) {
        showToast(`Pulse scan launched for ${alert.target_area || 'alert'}!`);
      }
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setTimeout(() => setScanningAlertId(null), 3000);
    }
  };

  // Trigger full radar scan across all active monitors
  const handleTriggerFullScan = async () => {
    setIsScanningAll(true);
    const uid = profile?.id || user?.uid || 'taun_test_user';

    try {
      const res = await fetchWithAuth(`/trigger-full-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid }),
      });
      if (res && res.ok) {
        const data = await res.json();
        showToast(`Full radar scan launched! Monitoring ${data.mission_count || alerts.length} active areas.`);
      }
    } catch (err) {
      console.error('Full scan failed:', err);
    } finally {
      setTimeout(() => setIsScanningAll(false), 4000);
    }
  };

  const activeAlertsCount = alerts.filter(a => a.is_active !== false).length;

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col pt-16">
      <Navbar 
        user={user} 
        profile={profile} 
        loading={loading} 
        handleLogin={login} 
        handleLogout={logout} 
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-[200] bg-zinc-950 text-white px-5 py-3 rounded-2xl shadow-xl border border-zinc-800 flex items-center gap-2.5 text-xs font-semibold"
          >
            <CheckCircle size={16} weight="fill" className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8 flex-1">
        
        {/* Top Header & Actions */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-zinc-200">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-700 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time Autonomous Property Radar</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950">
              Active Radar Monitors
            </h1>
            <p className="text-sm text-zinc-600 max-w-xl">
              HomeSeek autonomously inspects Property24 and live rental feeds to surface properties matching your exact location, budget, and privacy standards.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleTriggerFullScan}
              disabled={isScanningAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-zinc-200 text-zinc-800 bg-white hover:bg-zinc-50 hover:border-zinc-300 font-semibold text-xs transition-all shadow-2xs disabled:opacity-60"
            >
              <ArrowsClockwise size={16} className={isScanningAll ? 'animate-spin text-zinc-950' : 'text-zinc-600'} weight="bold" />
              <span>{isScanningAll ? 'Scanning Feeds...' : 'Pulse Scan All'}</span>
            </button>

            <Link
              href="/search"
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-zinc-950 hover:bg-black text-white font-semibold text-xs transition-all shadow-md active:scale-98"
            >
              <Plus size={16} weight="bold" />
              <span>New Search Criteria</span>
            </Link>
          </div>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block">Total Alerts</span>
            <span className="text-2xl font-black text-zinc-950 mt-1 block">{alerts.length}</span>
          </div>

          <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block">Active Monitors</span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">{activeAlertsCount}</span>
          </div>

          <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block">Target Areas</span>
            <span className="text-2xl font-black text-zinc-950 mt-1 block">
              {new Set(alerts.map(a => a.target_area).filter(Boolean)).size || 1}
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block">Radar Status</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 mt-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Continuous Pulse
            </span>
          </div>
        </div>

        {/* Alerts Cards List */}
        {isLoadingAlerts ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 rounded-3xl border border-zinc-200 bg-zinc-50 animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 border-dashed bg-white p-12 text-center space-y-4">
            <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto text-zinc-600">
              <Bell size={24} weight="bold" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-900">No active radar alerts yet</h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Set up your target suburbs, budget constraints, and living privacy preferences to have HomeSeek autonomously find properties for you 24/7.
              </p>
            </div>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-zinc-950 text-white font-semibold text-xs hover:bg-black transition-all shadow-md"
            >
              <Plus size={16} weight="bold" />
              <span>Define Your Search Criteria</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const searchId = alert.id || alert.search_id || 'alert';
              const isActive = alert.is_active !== false;
              const area = alert.target_area || alert.search_query?.replace(/^AI Radar:\s*/, '') || 'Cape Town';
              const isScanningThis = scanningAlertId === searchId;

              return (
                <div
                  key={searchId}
                  className={`rounded-3xl border transition-all p-6 bg-white shadow-2xs hover:shadow-md ${
                    isActive ? 'border-zinc-200' : 'border-zinc-200/60 opacity-75 bg-zinc-50/50'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    
                    {/* Left Meta & Criteria */}
                    <div className="space-y-3.5 flex-1">
                      
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-900">
                          <MapPin size={14} weight="bold" className="text-zinc-600" />
                          <span>{area}</span>
                        </span>

                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                          isActive 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                          <span>{isActive ? 'Active Radar' : 'Standby'}</span>
                        </span>

                        {alert.max_price && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800">
                            Up to R {alert.max_price.toLocaleString()} / mo
                          </span>
                        )}

                        {alert.property_type && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">
                            {alert.property_type}
                          </span>
                        )}
                      </div>

                      {/* Title / Description */}
                      <div>
                        <h3 className="text-base font-bold text-zinc-950">
                          {alert.search_query || `Monitor for ${area}`}
                        </h3>
                      </div>

                      {/* Criteria Signals & Filters */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {alert.require_verified_sea_view && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full">
                            <Waves size={13} weight="bold" />
                            <span>Verified Sea View Required</span>
                          </span>
                        )}

                        {alert.require_independent_living && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-800 bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 rounded-full">
                            <ShieldCheck size={13} weight="bold" />
                            <span>Independent Living Only</span>
                          </span>
                        )}

                        {alert.require_private_entrance && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-700 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-full">
                            <span>Private Entrance</span>
                          </span>
                        )}

                        {alert.pet_friendly && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            <span>Pet Friendly</span>
                          </span>
                        )}

                        {alert.commute_anchors && alert.commute_anchors.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-700 bg-zinc-50 border border-zinc-200 px-2.5 py-0.5 rounded-full">
                            <Target size={13} weight="bold" />
                            <span>{alert.commute_anchors.length} Life Anchors</span>
                          </span>
                        )}
                      </div>

                      {/* Delivery Channels */}
                      <div className="flex items-center gap-4 text-[11px] text-zinc-500 pt-1">
                        <span className="flex items-center gap-1">
                          <DeviceMobile size={13} className="text-emerald-600" weight="bold" /> WhatsApp Alerts Active
                        </span>
                        <span className="flex items-center gap-1">
                          <Envelope size={13} className="text-zinc-600" weight="bold" /> Email Radar Reports
                        </span>
                      </div>

                    </div>

                    {/* Right Action Controls */}
                    <div className="flex items-center gap-2.5 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-zinc-100">
                      
                      {/* View Matches in Properties Feed */}
                      <Link
                        href={`/properties?search=${encodeURIComponent(alert.target_area || '')}`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-zinc-800 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                      >
                        <Eye size={15} weight="bold" />
                        <span>View Properties</span>
                      </Link>

                      {/* Scan Now Button */}
                      <button
                        onClick={() => handleScanSingle(alert)}
                        disabled={isScanningThis}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-700 hover:text-zinc-950 border border-zinc-200 hover:bg-zinc-50 transition-colors disabled:opacity-60"
                        title="Run an instant pulse scan for this area"
                      >
                        <ArrowsClockwise size={14} className={isScanningThis ? 'animate-spin text-zinc-950' : ''} weight="bold" />
                        <span>{isScanningThis ? 'Scanning...' : 'Scan Now'}</span>
                      </button>

                      {/* Standby / Active Toggle */}
                      <button
                        onClick={() => handleToggleActive(alert)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                          isActive
                            ? 'text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                            : 'text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                        title={isActive ? 'Pause monitoring (Standby)' : 'Activate monitoring'}
                      >
                        {isActive ? <Pause size={14} weight="bold" /> : <Play size={14} weight="bold" />}
                        <span>{isActive ? 'Pause' : 'Activate'}</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteAlert(alert)}
                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Delete this alert"
                      >
                        <Trash size={16} />
                      </button>

                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
