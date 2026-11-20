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
import { SUBURB_ABBREVIATIONS } from '@/constants/capeTownGeo';

const ALERT_SUBURB_SUGGESTIONS = Array.from(
  new Set([
    ...Object.keys(SUBURB_ABBREVIATIONS)
      .filter((k) => k !== 'simons town')
      .map((k) =>
        k.replace(/\b\w/g, (c) => c.toUpperCase())
      ),
    'Llandudno',
    'Noordhoek',
    'Kommetjie',
    'Scarborough',
    'Tokai',
    'Kenilworth',
    'Wynberg',
    'Plumstead',
    'Mowbray',
    'Rosebank',
    'Zonnebloem',
    'Three Anchor Bay',
    'Bergvliet',
    'Meadowridge',
    'Kirstenhof',
  ])
).sort();

interface AlertItem {
  id?: string;
  search_id?: string;
  target_area?: string;
  search_query?: string;
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number[] | number;
  min_size_sqm?: number;
  property_type?: string;
  safeish?: boolean;
  off_main_road?: boolean;
  off_bars?: boolean;
  within_radius?: boolean;
  radius_km?: number;
  fibre_ready?: boolean;
  off_street_parking?: boolean;
  private_only?: boolean;
  min_fit_score?: number;
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

  // Edit / Create Alert State (aligned with Search page filters)
  const [editingAlert, setEditingAlert] = useState<AlertItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editArea, setEditArea] = useState('');
  const [areaQuery, setAreaQuery] = useState('');
  const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);
  const [editMinPrice, setEditMinPrice] = useState('0');
  const [editMaxPrice, setEditMaxPrice] = useState('20000');
  const [editMinBedrooms, setEditMinBedrooms] = useState('0.5');
  const [editMinSqm, setEditMinSqm] = useState('0');
  const [editRadiusKm, setEditRadiusKm] = useState('9.5');
  const [editSafeish, setEditSafeish] = useState(true);
  const [editOffMainRoad, setEditOffMainRoad] = useState(true);
  const [editOffBars, setEditOffBars] = useState(false);
  const [editWithinRadius, setEditWithinRadius] = useState(false);
  const [editFibreReady, setEditFibreReady] = useState(false);
  const [editOffStreetParking, setEditOffStreetParking] = useState(false);
  const [editPetFriendly, setEditPetFriendly] = useState(false);
  const [editPrivateOnly, setEditPrivateOnly] = useState(false);
  const [editMinFitScore, setEditMinFitScore] = useState<number>(80);
  const [editPrompt, setEditPrompt] = useState('');
  const [editPersonalTastes, setEditPersonalTastes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const AI_FIT_CHIPS = [
    'WFH / Quiet calls',
    'Natural light / Afternoon sun',
    'Morning trail / ocean access',
    'No upstairs neighbours',
    'Secure bike / surfboard storage',
    'Quiet street / Low traffic',
  ];

  const togglePersonalTasteChip = (chip: string) => {
    const parts = editPersonalTastes
      .split('·')
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = parts.some((p) => p.toLowerCase() === chip.toLowerCase());
    const next = exists
      ? parts.filter((p) => p.toLowerCase() !== chip.toLowerCase())
      : [...parts, chip];
    setEditPersonalTastes(next.join(' · '));
  };

  const handleOpenCreate = () => {
    setIsCreatingNew(true);
    setEditingAlert({ id: 'new' });
    setEditArea('Gardens, Sea Point');
    setAreaQuery('');
    setShowAreaSuggestions(false);
    setEditMinPrice('0');
    setEditMaxPrice('18000');
    setEditMinBedrooms('1');
    setEditMinSqm('0');
    setEditRadiusKm('9.5');
    setEditSafeish(true);
    setEditOffMainRoad(true);
    setEditOffBars(false);
    setEditWithinRadius(false);
    setEditFibreReady(false);
    setEditOffStreetParking(false);
    setEditPetFriendly(false);
    setEditPrivateOnly(false);
    setEditMinFitScore(80);
    setEditPrompt('');
    setEditPersonalTastes('');
  };

  const handleOpenEdit = (alert: AlertItem) => {
    setIsCreatingNew(false);
    setEditingAlert(alert);
    setEditArea(alert.target_area || alert.search_query?.replace(/^AI Radar:\s*/, '').split('(')[0].trim() || 'Gardens');
    setAreaQuery('');
    setShowAreaSuggestions(false);
    setEditMinPrice(alert.min_price !== undefined ? String(alert.min_price) : '0');
    setEditMaxPrice(alert.max_price ? String(alert.max_price) : '18000');

    let bedsVal = 'any';
    if (alert.min_bedrooms) {
      if (Array.isArray(alert.min_bedrooms) && alert.min_bedrooms.length > 0) {
        bedsVal = String(alert.min_bedrooms[0]);
      } else if (!Array.isArray(alert.min_bedrooms)) {
        bedsVal = String(alert.min_bedrooms);
      }
    }
    setEditMinBedrooms(bedsVal);
    setEditMinSqm(String(alert.min_size_sqm || 0));
    const anchorRadius = alert.commute_anchors?.[0]?.radius_km;
    setEditRadiusKm(String(alert.radius_km ?? anchorRadius ?? 9.5));

    setEditSafeish(alert.safeish ?? true);
    setEditOffMainRoad(alert.off_main_road ?? true);
    setEditOffBars(!!alert.off_bars);
    setEditWithinRadius(!!alert.within_radius);
    setEditFibreReady(!!alert.fibre_ready);
    setEditOffStreetParking(!!alert.off_street_parking);
    setEditPetFriendly(!!alert.pet_friendly);
    setEditPrivateOnly(Boolean(alert.private_only || alert.require_private_entrance || alert.require_independent_living));
    setEditMinFitScore(typeof alert.min_fit_score === 'number' ? alert.min_fit_score : 80);
    setEditPrompt(alert.prompt || '');
    setEditPersonalTastes(alert.personal_tastes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingAlert) return;
    const searchId = editingAlert.id || editingAlert.search_id;
    if (!isCreatingNew && !searchId) return;

    const uid = profile?.id || user?.uid || 'taun_test_user';
    const bedsNum = editMinBedrooms === 'any' ? 0 : parseFloat(editMinBedrooms) || 0;
    const bedsLabel = editMinBedrooms === 'any' ? 'Any Beds' : `${editMinBedrooms}+ Beds`;
    const minP = Math.max(0, parseInt(editMinPrice) || 0);
    const maxP = Math.max(minP, parseInt(editMaxPrice) || 18000);
    const minSqmVal = Math.max(0, parseInt(editMinSqm) || 0);
    const radiusVal = Math.max(0.5, parseFloat(editRadiusKm) || 9.5);

    const updatedData = {
      user_id: uid,
      target_area: editArea,
      search_query: `AI Radar: ${editArea} (${bedsLabel}, R${minP.toLocaleString()}–R${maxP.toLocaleString()})`,
      min_price: minP,
      max_price: maxP,
      min_bedrooms: bedsNum > 0 ? [bedsNum] : [],
      min_size_sqm: minSqmVal,
      radius_km: radiusVal,
      safeish: editSafeish,
      off_main_road: editOffMainRoad,
      off_bars: editOffBars,
      within_radius: editWithinRadius,
      fibre_ready: editFibreReady,
      off_street_parking: editOffStreetParking,
      pet_friendly: editPetFriendly,
      private_only: editPrivateOnly,
      min_fit_score: editMinFitScore,
      require_independent_living: editPrivateOnly,
      require_private_entrance: editPrivateOnly,
      prompt: editPrompt,
      personal_tastes: editPersonalTastes,
      trigger_initial_scan: false,
    };

    try {
      setIsSavingEdit(true);
      if (isCreatingNew) {
        const res = await fetchWithAuth('/save-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData),
        });
        if (res && res.ok) {
          const data = await res.json().catch(() => ({}));
          const newId = data?.search_id || `alert-${Date.now()}`;
          setAlerts((prev) => [{ ...updatedData, id: newId, search_id: newId, is_active: true }, ...prev]);
          showToast(`✓ New AI Radar Alert created for ${editArea}!`);
          setEditingAlert(null);
          setIsCreatingNew(false);
        } else {
          showToast('Failed to create alert on server.');
        }
      } else {
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
          showToast(`✓ Radar alert for ${editArea} updated with Search criteria!`);
          setEditingAlert(null);
        } else {
          showToast('Failed to update alert on server.');
        }
      }
    } catch (err) {
      console.error('Error saving alert:', err);
      showToast('Error saving alert.');
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

            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-zinc-950 hover:bg-black text-white font-semibold text-xs transition-all shadow-md active:scale-98 cursor-pointer"
            >
              <Plus size={16} weight="bold" />
              <span>New Alert</span>
            </button>
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

                        {(alert.min_price !== undefined || alert.max_price) && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800">
                            {alert.min_price ? `R ${(alert.min_price / 1000).toFixed(0)}k – ` : 'Up to '}
                            R {((alert.max_price || 20000) / 1000).toFixed(0)}k / mo
                          </span>
                        )}

                        {Array.isArray(alert.min_bedrooms) && alert.min_bedrooms.length > 0 && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700">
                            {alert.min_bedrooms[0]}+ Bed
                          </span>
                        )}

                        {alert.min_size_sqm && alert.min_size_sqm > 0 && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700">
                            {alert.min_size_sqm}+ m²
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          <Sparkle size={11} weight="fill" className="text-indigo-600" />
                          <span>{(alert.min_fit_score ?? 80) > 0 ? `≥ ${alert.min_fit_score ?? 80}% AI Fit` : 'All AI Fits'}</span>
                        </span>
                      </div>

                      {/* Title / Description */}
                      <div>
                        <h3 className="text-base font-bold text-zinc-950">
                          {alert.search_query || `Monitor for ${area}`}
                        </h3>
                      </div>

                      {/* Search Filter Criteria Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {alert.safeish && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            <ShieldCheck size={12} weight="fill" />
                            <span>Safe-ish</span>
                          </span>
                        )}

                        {alert.off_main_road && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-800 bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 rounded-full">
                            <span>Off-Main Rd</span>
                          </span>
                        )}

                        {alert.off_bars && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-900 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                            <span>Off-Bars/Clubs</span>
                          </span>
                        )}

                        {alert.fibre_ready && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-800 bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 rounded-full">
                            <span>Fibre ready</span>
                          </span>
                        )}

                        {alert.off_street_parking && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                            <span>Off-street pkg</span>
                          </span>
                        )}

                        {alert.pet_friendly && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            <span>Pet-friendly</span>
                          </span>
                        )}

                        {(alert.private_only || alert.require_private_entrance || alert.require_independent_living) && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                            <span>Private</span>
                          </span>
                        )}

                        {alert.commute_anchors && alert.commute_anchors.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                            <Target size={12} weight="bold" />
                            <span>
                              {alert.commute_anchors[0]?.label || `${alert.commute_anchors.length} Anchor`}
                              {(alert.radius_km || alert.commute_anchors[0]?.radius_km) ? ` · ≤${alert.radius_km || alert.commute_anchors[0]?.radius_km} km` : ''}
                            </span>
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
                      
                      {/* View Matches in Search */}
                      <Link
                        href={(() => {
                          const params = new URLSearchParams();
                          if (area) params.set('suburbs', area);
                          if (alert.min_price !== undefined) params.set('minPrice', String(alert.min_price));
                          if (alert.max_price) params.set('maxPrice', String(alert.max_price));
                          if (Array.isArray(alert.min_bedrooms) && alert.min_bedrooms.length > 0) {
                            params.set('beds', String(alert.min_bedrooms[0]));
                          }
                          if (alert.min_size_sqm && alert.min_size_sqm > 0) {
                            params.set('minSqm', String(alert.min_size_sqm));
                          }
                          if (alert.safeish !== undefined) params.set('safeish', alert.safeish ? '1' : '0');
                          if (alert.off_main_road !== undefined) params.set('offMain', alert.off_main_road ? '1' : '0');
                          if (alert.off_bars !== undefined) params.set('offBars', alert.off_bars ? '1' : '0');
                          if (alert.fibre_ready !== undefined) params.set('fibre', alert.fibre_ready ? '1' : '0');
                          if (alert.off_street_parking !== undefined) params.set('parking', alert.off_street_parking ? '1' : '0');
                          if (alert.pet_friendly !== undefined) params.set('pet', alert.pet_friendly ? '1' : '0');
                          if (alert.private_only !== undefined || alert.require_private_entrance !== undefined) {
                            params.set('private', (alert.private_only || alert.require_private_entrance) ? '1' : '0');
                          }
                          const qs = params.toString();
                          return qs ? `/search?${qs}` : '/search';
                        })()}
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
                    <span>{isCreatingNew ? 'New Radar Alert' : 'Edit Radar Alert'}</span>
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {isCreatingNew
                      ? 'Configure suburbs, Search filters, and your AI Dealbreakers.'
                      : 'Update location, budget ceiling, bedrooms, and lifestyle criteria.'}
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
                {/* Target Area / Suburbs with Auto-Suggest */}
                <div className="relative">
                  <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                    Target Area / Suburbs
                  </label>
                  {(() => {
                    const selectedAreas = editArea
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const filteredSuggestions = ALERT_SUBURB_SUGGESTIONS.filter(
                      (sub) =>
                        !selectedAreas.some((sel) => sel.toLowerCase() === sub.toLowerCase()) &&
                        (!areaQuery.trim() || sub.toLowerCase().includes(areaQuery.trim().toLowerCase()))
                    ).slice(0, 8);

                    const addSuburb = (sub: string) => {
                      const clean = sub.trim();
                      if (!clean) return;
                      if (!selectedAreas.some((sel) => sel.toLowerCase() === clean.toLowerCase())) {
                        setEditArea([...selectedAreas, clean].join(', '));
                      }
                      setAreaQuery('');
                      setShowAreaSuggestions(false);
                    };

                    const removeSuburb = (sub: string) => {
                      setEditArea(selectedAreas.filter((s) => s !== sub).join(', '));
                    };

                    return (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-zinc-50 border border-zinc-200 focus-within:bg-white focus-within:border-zinc-950 transition-all">
                          {selectedAreas.map((sub) => (
                            <span
                              key={sub}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-bold"
                            >
                              <span>{sub}</span>
                              <button
                                type="button"
                                onClick={() => removeSuburb(sub)}
                                className="text-indigo-500 hover:text-indigo-950 cursor-pointer"
                                aria-label={`Remove ${sub}`}
                              >
                                <X size={11} weight="bold" />
                              </button>
                            </span>
                          ))}
                          <input
                            type="text"
                            value={areaQuery}
                            onFocus={() => setShowAreaSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowAreaSuggestions(false), 160)}
                            onChange={(e) => {
                              setAreaQuery(e.target.value);
                              setShowAreaSuggestions(true);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && areaQuery.trim()) {
                                e.preventDefault();
                                addSuburb(filteredSuggestions[0] || areaQuery.trim());
                              }
                            }}
                            placeholder={selectedAreas.length > 0 ? '+ Add another suburb...' : 'Type suburb (e.g. Hout Bay, Gardens)...'}
                            className="flex-1 min-w-[150px] bg-transparent px-1.5 py-1 text-xs text-zinc-950 focus:outline-none font-medium"
                          />
                        </div>

                        {showAreaSuggestions && filteredSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl max-h-44 overflow-y-auto py-1">
                            {filteredSuggestions.map((sub) => (
                              <button
                                key={sub}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  addSuburb(sub);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-indigo-50 hover:text-indigo-900 flex items-center justify-between cursor-pointer"
                              >
                                <span>{sub}</span>
                                <span className="text-[10px] font-bold text-zinc-400">+ Add</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Budget Window (Min / Max Price) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                      Min Price (R)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R</span>
                      <input
                        type="number"
                        value={editMinPrice}
                        onChange={(e) => setEditMinPrice(e.target.value)}
                        placeholder="12000"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all font-medium"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                      Max Price (R)
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
                </div>

                {/* Bedrooms & Min Size (matches Search page) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                      Min Bedrooms
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { val: 'any', label: 'Any' },
                        { val: '0.5', label: '0.5+' },
                        { val: '1', label: '1+' },
                        { val: '1.5', label: '1.5+' },
                        { val: '2', label: '2+' },
                        { val: '3', label: '3+' },
                      ].map((b) => (
                        <button
                          key={b.val}
                          type="button"
                          onClick={() => setEditMinBedrooms(b.val)}
                          className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            editMinBedrooms === b.val
                              ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                              : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                      Minimum Size (m²)
                    </label>
                    <select
                      value={editMinSqm}
                      onChange={(e) => setEditMinSqm(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all font-medium"
                    >
                      <option value="0">Any Size</option>
                      <option value="40">40+ m²</option>
                      <option value="55">55+ m²</option>
                      <option value="70">70+ m²</option>
                      <option value="90">90+ m²</option>
                      <option value="120">120+ m²</option>
                    </select>
                  </div>
                </div>

                {/* Search Filter Pills */}
                <div className="pt-2 border-t border-zinc-100 space-y-2">
                  <span className="block text-xs font-bold text-zinc-800 uppercase tracking-wider">
                    Search Filter Criteria Pills
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Fibre ready', active: editFibreReady, toggle: () => setEditFibreReady(!editFibreReady) },
                      { label: 'Safe-ish', active: editSafeish, toggle: () => setEditSafeish(!editSafeish) },
                      { label: 'Off-Main Rd', active: editOffMainRoad, toggle: () => setEditOffMainRoad(!editOffMainRoad) },
                      { label: 'Off-Bars/Clubs', active: editOffBars, toggle: () => setEditOffBars(!editOffBars) },
                      { label: `In Radius (≤${editRadiusKm} km)`, active: editWithinRadius, toggle: () => setEditWithinRadius(!editWithinRadius) },
                      { label: 'Off-street pkg', active: editOffStreetParking, toggle: () => setEditOffStreetParking(!editOffStreetParking) },
                      { label: 'Pet-friendly', active: editPetFriendly, toggle: () => setEditPetFriendly(!editPetFriendly) },
                      { label: 'Private', active: editPrivateOnly, toggle: () => setEditPrivateOnly(!editPrivateOnly) },
                    ].map((pill) => (
                      <button
                        key={pill.label}
                        type="button"
                        onClick={pill.toggle}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                          pill.active
                            ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                            : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Minimum AI Fit Threshold (Suppress Noise) */}
                <div className="pt-2 border-t border-zinc-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                      Minimum AI Fit Score
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-700">
                      Suppresses noisy P24-style spam
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { val: 0, label: 'All (Any)' },
                      { val: 70, label: '70%+ Fit' },
                      { val: 80, label: '80%+ Quiet' },
                      { val: 90, label: '90%+ Top' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setEditMinFitScore(opt.val)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          editMinFitScore === opt.val
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Your AI Dealbreakers & Lifestyle Fit */}
                <div className="pt-2 border-t border-zinc-100 space-y-2.5">
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1">
                      Your AI Dealbreakers &amp; Lifestyle Fit
                    </label>
                    <p className="text-[11px] text-zinc-500 mb-2">
                      Click quick-chips or describe your daily routine — AI Scout scores every listing against this.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {AI_FIT_CHIPS.map((chip) => {
                        const isSelected = editPersonalTastes
                          .toLowerCase()
                          .includes(chip.toLowerCase());
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => togglePersonalTasteChip(chip)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-indigo-50/60 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="text"
                      value={editPersonalTastes}
                      onChange={(e) => setEditPersonalTastes(e.target.value)}
                      placeholder="WFH / Quiet calls · Natural light · No upstairs neighbours..."
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                      Daily Routine &amp; Commute Context
                    </label>
                    <textarea
                      rows={2}
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder="e.g. Morning trail run near Chapman's Peak, WFH 4 days/week, need quiet evenings..."
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all"
                    />
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
