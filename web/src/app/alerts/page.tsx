'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText,
  CircleNotch,
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
  Eye,
  PencilSimple,
  X
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
  prompt?: string;
  personal_tastes?: string;
  require_private_garden?: boolean;
  exclude_shared_house?: boolean;
}

export default function AlertsPage() {
  const { user, profile, loading, login, logout } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);
  const [isScanningAll, setIsScanningAll] = useState(false);
  const [scanningAlertId, setScanningAlertId] = useState<string | null>(null);
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit Alert State
  const [editingAlert, setEditingAlert] = useState<AlertItem | null>(null);
  const [editArea, setEditArea] = useState('');
  const [editMaxPrice, setEditMaxPrice] = useState('');
  const [editMinBedrooms, setEditMinBedrooms] = useState('1');
  const [editPropertyType, setEditPropertyType] = useState('Apartment');
  const [editPrompt, setEditPrompt] = useState('');
  const [editPersonalTastes, setEditPersonalTastes] = useState('');
  const [editIndependentLiving, setEditIndependentLiving] = useState(false);
  const [editPrivateEntrance, setEditPrivateEntrance] = useState(false);
  const [editPrivateGarden, setEditPrivateGarden] = useState(false);
  const [editExcludeLandlord, setEditExcludeLandlord] = useState(false);
  const [editExcludeShared, setEditExcludeShared] = useState(false);
  const [editVerifiedSeaView, setEditVerifiedSeaView] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleOpenEdit = (alert: AlertItem) => {
    setEditingAlert(alert);
    setEditArea(alert.target_area || alert.search_query?.replace(/^AI Radar:\s*/, '').split('(')[0].trim() || 'Gardens');
    setEditMaxPrice(alert.max_price ? String(alert.max_price) : '18000');
    
    // Parse bedrooms
    let bedsVal = '1';
    if (alert.min_bedrooms) {
      if (Array.isArray(alert.min_bedrooms) && alert.min_bedrooms.length > 0) {
        bedsVal = String(alert.min_bedrooms[0]);
      } else {
        bedsVal = String(alert.min_bedrooms);
      }
    }
    setEditMinBedrooms(bedsVal.includes('+') ? bedsVal : `${bedsVal}+`);
    setEditPropertyType(alert.property_type || 'Apartment');
    setEditPrompt(alert.prompt || '');
    setEditPersonalTastes(alert.personal_tastes || '');
    setEditIndependentLiving(!!alert.require_independent_living);
    setEditPrivateEntrance(!!alert.require_private_entrance);
    setEditPrivateGarden(!!alert.require_private_garden);
    setEditExcludeLandlord(!!alert.exclude_landlord_on_site);
    setEditExcludeShared(!!alert.exclude_shared_house);
    setEditVerifiedSeaView(!!alert.require_verified_sea_view);
  };

  const handleSaveEdit = async () => {
    if (!editingAlert) return;
    const searchId = editingAlert.id || editingAlert.search_id;
    if (!searchId) return;

    const uid = profile?.id || user?.uid || 'taun_test_user';
    const bedsNum = parseInt(editMinBedrooms.replace('+', '')) || 1;
    const maxP = parseInt(editMaxPrice) || 18000;

    const updatedData = {
      target_area: editArea,
      search_query: `AI Radar: ${editArea} (${bedsNum}+ Beds, max R${maxP})`,
      max_price: maxP,
      min_bedrooms: [bedsNum],
      property_type: editPropertyType,
      prompt: editPrompt,
      personal_tastes: editPersonalTastes,
      require_independent_living: editIndependentLiving,
      require_private_entrance: editPrivateEntrance,
      require_private_garden: editPrivateGarden,
      exclude_landlord_on_site: editExcludeLandlord,
      exclude_shared_house: editExcludeShared,
      require_verified_sea_view: editVerifiedSeaView,
    };

    try {
      setIsSavingEdit(true);
      const res = await fetchWithAuth(`/update-alert/${uid}/${searchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (res && res.ok) {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === searchId || a.search_id === searchId ? { ...a, ...updatedData } : a
          )
        );
        showToast(`✓ Radar alert for ${editArea} updated successfully!`);
        setEditingAlert(null);
      } else {
        showToast('Failed to update alert on server.');
      }
    } catch (err) {
      console.error('Error saving alert:', err);
      showToast('Error saving changes to alert.');
    } finally {
      setIsSavingEdit(false);
    }
  };

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

  // Generate a fresh on-demand AI report for an alert
  const handleGenerateReport = async (alert: AlertItem) => {
    const searchId = alert.id || alert.search_id;
    if (!searchId) return;
    setGeneratingReportId(searchId);
    const uid = profile?.id || user?.uid || 'taun_test_user';

    try {
      showToast(`Generating fresh AI report for ${alert.target_area || 'alert'}...`);
      const res = await fetchWithAuth(`/trigger-report/${uid}/${searchId}`, {
        method: 'POST',
      });
      if (res && res.ok) {
        const data = await res.json();
        showToast(`✓ Fresh AI Intelligence Report generated! View in Reports tab.`);
      } else {
        showToast('Report generation queued in background.');
      }
    } catch (err) {
      console.error('Report generation failed:', err);
      showToast('Error generating fresh report.');
    } finally {
      setGeneratingReportId(null);
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
              const isGeneratingThis = generatingReportId === searchId;

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
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-800 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                      >
                        <Eye size={15} weight="bold" />
                        <span>View</span>
                      </Link>

                      {/* Edit Alert Button */}
                      <button
                        onClick={() => handleOpenEdit(alert)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 transition-colors cursor-pointer"
                        title="Edit alert parameters, budget, and lifestyle filters"
                      >
                        <PencilSimple size={14} weight="bold" />
                        <span>Edit</span>
                      </button>

                      {/* Generate Fresh Report Button */}
                      <button
                        onClick={() => handleGenerateReport(alert)}
                        disabled={isGeneratingThis}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-all disabled:opacity-60 cursor-pointer shadow-2xs"
                        title="Generate a fresh AI Scout Intelligence Report for this alert"
                      >
                        {isGeneratingThis ? (
                          <CircleNotch size={14} className="animate-spin text-zinc-950" weight="bold" />
                        ) : (
                          <FileText size={14} weight="bold" className="text-zinc-700" />
                        )}
                        <span>{isGeneratingThis ? 'Generating...' : 'Generate Report'}</span>
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


      {/* EDIT ALERT MODAL */}
      <AnimatePresence>
        {editingAlert && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div
              className="absolute inset-0"
              onClick={() => setEditingAlert(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 bg-white rounded-3xl border border-zinc-200 max-w-xl w-full flex flex-col max-h-[85vh] shadow-2xl overflow-hidden"
            >
              {/* Modal Header (Fixed / Pinned) */}
              <div className="px-6 py-5 border-b border-zinc-100 flex items-start justify-between shrink-0 bg-white">
                <div>
                  <h3 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
                    <PencilSimple size={20} weight="bold" className="text-zinc-700" />
                    <span>Edit Radar Alert</span>
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Update location, budget ceiling, bedrooms, and lifestyle criteria.
                  </p>
                </div>
                <button
                  onClick={() => setEditingAlert(null)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Edit Form Body (Scrollable interior) */}
              <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
                {/* Target Area */}
                <div>
                  <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                    Target Area / Suburbs
                  </label>
                  <input
                    type="text"
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
                    placeholder="e.g. Gardens, Tamboerskloof"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all font-medium"
                  />
                </div>

                {/* Price Ceiling & Bedrooms */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                      Max Price (Budget Ceiling)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R</span>
                      <input
                        type="number"
                        value={editMaxPrice}
                        onChange={(e) => setEditMaxPrice(e.target.value)}
                        placeholder="18000"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                      Min Bedrooms
                    </label>
                    <div className="flex gap-1.5">
                      {['1+', '2+', '3+', '4+'].map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setEditMinBedrooms(b)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            editMinBedrooms === b
                              ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                              : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Property Type */}
                <div>
                  <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                    Property Type
                  </label>
                  <select
                    value={editPropertyType}
                    onChange={(e) => setEditPropertyType(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all font-medium"
                  >
                    <option value="Apartment">Apartment / Flat</option>
                    <option value="House">House</option>
                    <option value="Townhouse">Townhouse</option>
                    <option value="Any">Any Property Type</option>
                  </select>
                </div>

                {/* Routine & Tastes */}
                <div>
                  <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                    AI Routine & Desires Prompt
                  </label>
                  <textarea
                    rows={2}
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Weekly routine, mountain biking, cafe work, acoustic desires..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                    Acoustic & Lifestyle Dealbreakers
                  </label>
                  <input
                    type="text"
                    value={editPersonalTastes}
                    onChange={(e) => setEditPersonalTastes(e.target.value)}
                    placeholder="Acoustic quiet for music, secure bike storage, quiet street..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all"
                  />
                </div>

                {/* Privacy Shield Toggles */}
                <div className="pt-2 border-t border-zinc-100 space-y-2">
                  <span className="block text-xs font-bold text-zinc-800 uppercase tracking-wider">
                    Privacy & Autonomy Shield
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100/70 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={editIndependentLiving}
                        onChange={(e) => setEditIndependentLiving(e.target.checked)}
                        className="rounded text-zinc-950 accent-zinc-950"
                      />
                      <span className="font-semibold text-zinc-800">Independent Living</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100/70 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={editPrivateEntrance}
                        onChange={(e) => setEditPrivateEntrance(e.target.checked)}
                        className="rounded text-zinc-950 accent-zinc-950"
                      />
                      <span className="font-semibold text-zinc-800">Private Entrance</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100/70 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={editExcludeLandlord}
                        onChange={(e) => setEditExcludeLandlord(e.target.checked)}
                        className="rounded text-zinc-950 accent-zinc-950"
                      />
                      <span className="font-semibold text-zinc-800">Exclude Landlord On-Site</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100/70 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={editExcludeShared}
                        onChange={(e) => setEditExcludeShared(e.target.checked)}
                        className="rounded text-zinc-950 accent-zinc-950"
                      />
                      <span className="font-semibold text-zinc-800">Exclude Shared House</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100/70 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={editVerifiedSeaView}
                        onChange={(e) => setEditVerifiedSeaView(e.target.checked)}
                        className="rounded text-zinc-950 accent-zinc-950"
                      />
                      <span className="font-semibold text-zinc-800">Verified Sea View</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Actions Footer (Fixed / Pinned) */}
              <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/80">
                <button
                  type="button"
                  onClick={() => setEditingAlert(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </main>
    </div>
  );
}
