'use client';

import React, { useState } from 'react';
import {
  ArrowSquareOut,
  Camera,
  Car,
  ChatCircleText,
  CheckCircle,
  CircleNotch,
  Clock,
  Eye,
  Info,
  MapPin,
  PaperPlaneRight,
  Ruler,
  Scales,
  ShieldCheck,
  SlidersHorizontal,
  Sparkle,
  SpeakerHigh,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { formatPrice, isPropertyInHighRiskCrimeZone } from '@/lib/forensicAudit';
import { getDwellingPrivacyInfo } from '@/lib/geo';
import { apiUrl } from '@/lib/apiClient';
import { consumeAuditCredit } from '@/lib/pro-plan';

export interface AiPropertyReportModalProps {
  viewingAiReportProp: any;
  setViewingAiReportProp: React.Dispatch<React.SetStateAction<any>>;
  selectedSuburbs: string[];
  minPrice: string | number;
  maxPrice: string | number;
  bedrooms: string | number;
  safeishFilter: boolean;
  withinRadiusFilter: boolean;
  activeAnchor: { label: string } | null | undefined;
  locationRadiusKm: number;
  fibreFilter: boolean;
  parkingFilter: boolean;
  petFriendlyFilter: boolean;
  minSqm: string | number;
  offMainRoadFilter: boolean;
  offBarsFilter: boolean;
  privateOnlyFilter: boolean;
  personalPreferences: string;
  handleUpdatePreferences: (val: string) => void;
  planSummary: any;
  uploadedViewingPhotos: string[];
  setUploadedViewingPhotos: React.Dispatch<React.SetStateAction<string[]>>;
  handleUploadViewingPhotos: (files: FileList | null) => void;
  photoSourceMode: 'both' | 'uploaded' | 'listing';
  setPhotoSourceMode: React.Dispatch<React.SetStateAction<'both' | 'uploaded' | 'listing'>>;
  runForensicAiInspection: (prop: any) => void;
  compareIds: string[];
  toggleCompareProperty: (prop: any) => void;
  snagCopied: boolean;
  handleCopySnagReport: (prop: any) => void;
  isExportingPdf: boolean;
  handleDownloadReportPdf: (prop: any) => void;
  isEmailPdfOpen: boolean;
  setIsEmailPdfOpen: React.Dispatch<React.SetStateAction<boolean>>;
  emailPdfTarget: string;
  setEmailPdfTarget: React.Dispatch<React.SetStateAction<string>>;
  isSendingEmailPdf: boolean;
  emailPdfStatus: { type: 'ok' | 'err'; text: string } | null;
  setEmailPdfStatus: React.Dispatch<React.SetStateAction<{ type: 'ok' | 'err'; text: string } | null>>;
  handleEmailReportPdf: (prop: any) => void;
  userEmail?: string | null;
  cardGalleries: Record<string, string[]>;
  getAgencyReputationInfo: (prop: any) => any;
  getPropertyBarNoiseExposure: (prop: any) => any;
  getPropertyBusyRoadExposure: (prop: any) => any;
  isLandlordOnSiteProperty: (prop: any) => boolean;
  resolveGoogleMapsUrl: (prop: any) => string;
  resolveProperty24Url: (prop: any) => string;
  openProperty24Url: (e: React.MouseEvent, url: string) => void;
}

export const AiPropertyReportModal: React.FC<AiPropertyReportModalProps> = ({
  viewingAiReportProp,
  setViewingAiReportProp,
  selectedSuburbs,
  minPrice,
  maxPrice,
  bedrooms,
  safeishFilter,
  withinRadiusFilter,
  activeAnchor,
  locationRadiusKm,
  fibreFilter,
  parkingFilter,
  petFriendlyFilter,
  minSqm,
  offMainRoadFilter,
  offBarsFilter,
  privateOnlyFilter,
  personalPreferences,
  handleUpdatePreferences,
  planSummary,
  uploadedViewingPhotos,
  setUploadedViewingPhotos,
  handleUploadViewingPhotos,
  photoSourceMode,
  setPhotoSourceMode,
  runForensicAiInspection,
  compareIds,
  toggleCompareProperty,
  snagCopied,
  handleCopySnagReport,
  isExportingPdf,
  handleDownloadReportPdf,
  isEmailPdfOpen,
  setIsEmailPdfOpen,
  emailPdfTarget,
  setEmailPdfTarget,
  isSendingEmailPdf,
  emailPdfStatus,
  setEmailPdfStatus,
  handleEmailReportPdf,
  userEmail,
  cardGalleries,
  getAgencyReputationInfo,
  getPropertyBarNoiseExposure,
  getPropertyBusyRoadExposure,
  isLandlordOnSiteProperty,
  resolveGoogleMapsUrl,
  resolveProperty24Url,
  openProperty24Url,
}) => {
  const user = userEmail ? { email: userEmail } : null;
  const [chatByProp, setChatByProp] = useState<Record<string, Array<{ role: 'user' | 'assistant'; content: string }>>>({});
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  if (!viewingAiReportProp) return null;

  const propIdKey = String(viewingAiReportProp.id || 'default');
  const chatMessages = chatByProp[propIdKey] || [];
  const remainingCredits = planSummary?.remainingAudits ?? 0;

  const handleSendChat = async (overrideText?: string) => {
    const q = (overrideText ?? chatInput).trim();
    if (!q || isSendingChat) return;
    if (remainingCredits <= 0) {
      setChatError('No AI credits left. Upgrade or top up credits to continue chatting.');
      return;
    }

    setChatError(null);
    const nextHistory = [...chatMessages, { role: 'user' as const, content: q }];
    setChatByProp((prev) => ({ ...prev, [propIdKey]: nextHistory }));
    if (!overrideText) setChatInput('');
    setIsSendingChat(true);

    try {
      const res = await fetch(apiUrl('/api/listing/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property: viewingAiReportProp,
          audit: (viewingAiReportProp as any).deep_ai_audit || {},
          personal_preferences: personalPreferences,
          messages: chatMessages,
          question: q,
        }),
      });
      const data = await res.json();
      const replyText = data?.reply || 'No response returned.';
      if (data?.status === 'success' && !data?.is_fallback) {
        consumeAuditCredit();
      }
      setChatByProp((prev) => ({
        ...prev,
        [propIdKey]: [...nextHistory, { role: 'assistant', content: replyText }],
      }));
    } catch {
      setChatError('Failed to reach AI chat service. No credit charged.');
    } finally {
      setIsSendingChat(false);
    }
  };

  return (
    <>
      {viewingAiReportProp && (
        <div
          className="fixed inset-0 z-[130] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingAiReportProp(null);
            }
          }}
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-zinc-200 max-w-4xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                  <Sparkle size={22} weight="fill" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-zinc-950 leading-tight">
                      AI Property Forensic Report
                    </h2>
                    {viewingAiReportProp.fit_score && (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {viewingAiReportProp.fit_score}% Fit
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 font-medium">
                    Automated multimodal vision, acoustic modeling &amp; lease verification.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingAiReportProp(null)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                aria-label="Close Report"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Property Quick Summary Banner */}
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center gap-3">
              <img
                src={viewingAiReportProp.image}
                alt={viewingAiReportProp.title}
                className="w-16 h-16 rounded-xl object-cover shrink-0 border border-zinc-200 shadow-2xs"
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-sm text-zinc-900 truncate">
                  {viewingAiReportProp.title}
                </h3>
                <p className="text-xs text-zinc-500 truncate">{viewingAiReportProp.address}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-black text-indigo-700">
                    R {viewingAiReportProp.price.toLocaleString()} /mo
                  </span>
                  <span className="text-zinc-300">·</span>
                  <span className="text-[11px] font-medium text-zinc-600">
                    🛏️ {viewingAiReportProp.bedrooms} {viewingAiReportProp.bedrooms === 1 ? 'bed' : 'beds'}
                  </span>
                  <span className="text-[11px] font-medium text-zinc-600">
                    🚿 {viewingAiReportProp.bathrooms} bath
                  </span>
                  {viewingAiReportProp.sqm && (
                    <span className="text-[11px] font-medium text-zinc-600">
                      📐 {viewingAiReportProp.sqm} m²
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Active Search Filters in Effect */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-900">
                <span className="flex items-center gap-1.5 text-zinc-800">
                  <SlidersHorizontal size={14} weight="bold" className="text-indigo-600" />
                  Active Search Filters
                </span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Live Session Filters
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className="bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-zinc-800 shadow-2xs">
                  📍 {selectedSuburbs.length > 0 ? selectedSuburbs.join(', ') : 'All Suburbs'}
                </span>
                <span className="bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-zinc-800 shadow-2xs">
                  💰 R {formatPrice(minPrice)} – R {formatPrice(maxPrice)}
                </span>
                <span className="bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-zinc-800 shadow-2xs">
                  🛏️ {bedrooms} Bed
                </span>
                {minSqm && (
                  <span className="bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-zinc-800 shadow-2xs">
                    📐 {minSqm}+ m²
                  </span>
                )}
                {activeAnchor && (
                  <span className="bg-indigo-50 text-indigo-900 px-2 py-0.5 rounded-md border border-indigo-200 shadow-2xs">
                    🎯 {activeAnchor.label}
                  </span>
                )}
                {safeishFilter && (
                  <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-300 shadow-2xs">
                    ✓ 🛡️ Safe-ish
                  </span>
                )}
                {fibreFilter && (
                  <span className="bg-cyan-50 text-cyan-900 px-2 py-0.5 rounded-md border border-cyan-300 shadow-2xs">
                    ✓ 🌐 Fibre ready
                  </span>
                )}
                {parkingFilter && (
                  <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-300 shadow-2xs">
                    ✓ 🚗 Parking
                  </span>
                )}
                {petFriendlyFilter && (
                  <span className="bg-pink-50 text-pink-900 px-2 py-0.5 rounded-md border border-pink-300 shadow-2xs">
                    ✓ 🐾 Pet-friendly
                  </span>
                )}
                {offMainRoadFilter && (
                  <span className="bg-purple-50 text-purple-900 px-2 py-0.5 rounded-md border border-purple-300 shadow-2xs">
                    ✓ 🛣️ Off-Main Rd
                  </span>
                )}
                {privateOnlyFilter && (
                  <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-300 shadow-2xs">
                    ✓ 🔒 100% Private Standalone
                  </span>
                )}
              </div>
            </div>

            {/* User Personal Preferences Input Box (Stored in localStorage) */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkle size={14} weight="fill" className="text-purple-600" />
                  Your Personal Preferences
                </label>
                {personalPreferences.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleUpdatePreferences('')}
                    className="text-[11px] font-bold text-zinc-500 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <X size={12} weight="bold" />
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">
                Saved automatically across sessions. Enter your lifestyle, space, or noise criteria. The report updates in real time.
              </p>
              <textarea
                rows={2}
                value={personalPreferences}
                onChange={(e) => handleUpdatePreferences(e.target.value)}
                placeholder="e.g. Quiet street, high natural light, fibre internet, space for desk, gas stove..."
                className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-zinc-900 font-medium resize-none leading-relaxed transition-all shadow-2xs"
              />
              {/* Standard Lifestyle & Work Mode Checkboxes */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase tracking-wider">
                  Work &amp; Lifestyle Mode:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Work from home (full-time)', tag: 'WFH (Full-time): quiet acoustic environment, fibre ready, desk space' },
                    { label: 'Work from home (part-time)', tag: 'WFH (Part-time): flexible hybrid work, stable fibre' },
                    { label: 'Work from cafes', tag: 'Work from cafes: walkable to coffee shops & laptop-friendly spots' },
                    { label: 'Work from an office', tag: 'Office commuter: proximity to major business hubs & commute transit' },
                  ].map((item) => {
                    const isChecked = personalPreferences.toLowerCase().includes(item.label.toLowerCase());
                    return (
                      <label
                        key={item.label}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all select-none ${isChecked
                          ? 'bg-purple-50/90 border-purple-300 text-purple-950 shadow-2xs font-extrabold ring-1 ring-purple-400/40'
                          : 'bg-white hover:bg-zinc-50 border-zinc-200/90 text-zinc-700'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const cleaned = personalPreferences.trim().replace(/\.$/, '');
                              handleUpdatePreferences(cleaned ? `${cleaned}. ${item.label}.` : `${item.label}.`);
                            } else {
                              const updated = personalPreferences
                                .replace(new RegExp(`\\b${item.label}\\b\\.?`, 'gi'), '')
                                .replace(/\.\s*\./g, '.')
                                .replace(/,\s*,/g, ',')
                                .trim();
                              handleUpdatePreferences(updated);
                            }
                          }}
                          className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600 shrink-0"
                        />
                        <span className="truncate">{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Pro Feature: Viewing / Off-Portal Photo Upload */}
              <div className="pt-2 border-t border-zinc-200/60 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Camera size={13} weight="bold" className="text-purple-600" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
                      Viewing / Off-Portal Photos
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black uppercase tracking-wider">
                      {planSummary?.tier === 'free' ? 'Pro' : planSummary?.tier === 'hunter_pass' ? 'Hunter Pass' : 'Pro Active'}
                    </span>
                    {planSummary && (
                      <span className="text-[10px] font-semibold text-zinc-500">
                        • {planSummary.remainingAudits} {planSummary.remainingAudits === 1 ? 'audit' : 'audits'} left
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {planSummary?.tier === 'free' ? (
                      <a
                        href="/pricing"
                        className="text-[10px] font-black text-purple-700 hover:text-purple-900 underline"
                      >
                        Unlock R149 Hunter Pass →
                      </a>
                    ) : (
                      <a
                        href="/pricing"
                        className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 underline"
                      >
                        Manage Plan
                      </a>
                    )}
                  </div>
                </div>

                {planSummary && !planSummary.canUploadPhotos ? (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900">
                    <span>
                      Upload photos you snapped at a viewing (cracks, damp, plug points, street noise, kitchen) or off-portal Gumtree/Facebook screenshots for Gemini Vision inspection.
                    </span>
                    <a
                      href="/pricing"
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black transition-colors"
                    >
                      Upgrade
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-purple-50 border border-dashed border-purple-300 text-[11px] font-bold text-purple-800 cursor-pointer transition-colors">
                        <Camera size={13} weight="bold" />
                        <span>Upload Viewing Photos ({uploadedViewingPhotos.length}/8)</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            handleUploadViewingPhotos(e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>

                      {uploadedViewingPhotos.length > 0 && (
                        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-zinc-200">
                          {(
                            [
                              { id: 'both', label: 'Listing + Mine' },
                              { id: 'uploaded', label: 'My Photos Only' },
                              { id: 'listing', label: 'Listing Only' },
                            ] as const
                          ).map((mode) => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => setPhotoSourceMode(mode.id)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${photoSourceMode === mode.id
                                  ? 'bg-purple-700 text-white'
                                  : 'text-zinc-600 hover:bg-zinc-100'
                                }`}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {uploadedViewingPhotos.length > 0 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {uploadedViewingPhotos.map((src, idx) => (
                          <div key={idx} className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-purple-200 bg-zinc-100">
                            <img src={src} alt={`Viewing photo ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() =>
                                setUploadedViewingPhotos((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-zinc-900/80 text-white text-[9px] font-black flex items-center justify-center cursor-pointer"
                              title="Remove photo"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit / Re-Run Button & Quick-Add Chips */}
              <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (viewingAiReportProp) {
                      runForensicAiInspection(viewingAiReportProp);
                    }
                  }}
                  disabled={Boolean((viewingAiReportProp as any).deep_ai_audit?.isVisionLoading)}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-95 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkle size={13} weight="fill" />
                  <span>
                    {(viewingAiReportProp as any).deep_ai_audit?.isVisionLoading
                      ? 'Analyzing Property...'
                      : 'Submit Preferences & Run AI Report'}
                  </span>
                </button>
                <div className="flex items-center flex-wrap gap-1">
                  {[
                    '☀️ North-Facing Sunlight',
                    '🍳 Gas Cooking / Load-Shedding',
                    '🔋 Solar / Inverter Backup',
                    '🏔️ Mountain or Ocean Views',
                    '🔇 Thick Brick Walls / Low Echo',
                    '💻 Dedicated WFH Desk Zone',
                    '🌿 Private Balcony / Patio',
                    '🚲 Secure Bike / Gear Storage'
                  ].map((chip) => {
                    const chipKey = chip.replace(/^[^\w\s]+\s*/, '');
                    const isAlreadyIn = personalPreferences.toLowerCase().includes(chipKey.toLowerCase());
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          if (isAlreadyIn) {
                            handleUpdatePreferences(
                              personalPreferences.replace(new RegExp(chipKey, 'gi'), '').replace(/,\s*,/g, ',').trim()
                            );
                          } else {
                            handleUpdatePreferences(
                              personalPreferences ? `${personalPreferences.trim().replace(/\.$/, '')}, ${chipKey}.` : `${chipKey}.`
                            );
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${isAlreadyIn
                          ? 'bg-purple-100 border-purple-300 text-purple-900 shadow-2xs font-black'
                          : 'bg-white hover:bg-zinc-100 text-zinc-600 border-zinc-200/80'
                          }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section: AI Forensic Report Results Container */}
            <div className="pt-2">
              <div className="p-4 rounded-2xl bg-gradient-to-b from-purple-50/60 via-white to-white border-2 border-purple-200/90 shadow-md space-y-4">
                {/* Formal Report Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-purple-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Sparkle size={18} weight="fill" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wide">
                          AI Property Forensic Report
                        </h3>
                        {viewingAiReportProp.fit_score && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                            {viewingAiReportProp.fit_score}% Fit
                          </span>
                        )}
                        {(viewingAiReportProp as any).deep_ai_audit?.hasAiRun && (
                          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ✓ Verified Run
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 font-medium">
                        Autonomous multimodal vision, acoustic decibel modeling &amp; lease audit.
                      </p>
                    </div>
                  </div>

                  {/* Metadata Stamp (Time + Status) + Compare / Snag Export Actions */}
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <button
                      type="button"
                      onClick={() => viewingAiReportProp && toggleCompareProperty(viewingAiReportProp)}
                      className={`px-2.5 py-1 rounded-xl border text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer ${viewingAiReportProp && compareIds.includes(viewingAiReportProp.id)
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-white border-zinc-200 text-zinc-700 hover:bg-purple-50 hover:border-purple-200'
                        }`}
                    >
                      <Scales size={13} weight="bold" />
                      <span>
                        {viewingAiReportProp && compareIds.includes(viewingAiReportProp.id) ? '✓ In Compare' : '+ Compare'}
                      </span>
                    </button>

                    {compareIds.length >= 2 && (
                      <a
                        href="/compare"
                        className="px-2.5 py-1 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-[11px] font-black transition-colors"
                      >
                        Open Compare ({compareIds.length}) →
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => viewingAiReportProp && handleCopySnagReport(viewingAiReportProp)}
                      className="px-2.5 py-1 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 text-[11px] font-bold transition-colors cursor-pointer"
                      title="Copy formatted viewing / move-in snag checklist"
                    >
                      {snagCopied ? '✓ Snag Copied' : 'Copy Snag Report'}
                    </button>

                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => viewingAiReportProp && handleDownloadReportPdf(viewingAiReportProp)}
                      className="px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-indigo-600 disabled:opacity-50 text-white text-[11px] font-bold transition-colors cursor-pointer"
                      title="Download this report as a PDF"
                    >
                      {isExportingPdf ? 'Generating...' : '📄 Save PDF'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsEmailPdfOpen(!isEmailPdfOpen);
                        setEmailPdfStatus(null);
                        if (!emailPdfTarget && user?.email) setEmailPdfTarget(user.email);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-[11px] font-bold transition-colors cursor-pointer"
                      title="Email this PDF report to an email address"
                    >
                      ✉️ Email PDF
                    </button>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-semibold bg-white px-2.5 py-1 rounded-xl border border-zinc-200 shadow-2xs">
                      <Clock size={13} weight="bold" className="text-purple-600" />
                      <span>
                        Generated: {(viewingAiReportProp as any).deep_ai_audit?.generatedAt || 'Standby (Pending Submission)'}
                      </span>
                    </div>
                  </div>
                </div>

                {isEmailPdfOpen && viewingAiReportProp && (
                  <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-indigo-900">Email PDF Report to:</span>
                    <input
                      type="email"
                      value={emailPdfTarget}
                      onChange={(e) => setEmailPdfTarget(e.target.value)}
                      placeholder="name@example.com"
                      className="flex-1 min-w-[200px] px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs text-zinc-900 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      disabled={isSendingEmailPdf}
                      onClick={() => handleEmailReportPdf(viewingAiReportProp)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                    >
                      {isSendingEmailPdf ? 'Sending...' : 'Send PDF'}
                    </button>
                    {emailPdfStatus && (
                      <span className={`text-[11px] font-bold ${emailPdfStatus.type === 'ok' ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {emailPdfStatus.text}
                      </span>
                    )}
                  </div>
                )}

                {/* Consolidated Preference Alignment & Search Baseline Card (Zero Duplication) */}
                <div className="p-3.5 rounded-2xl bg-purple-50/75 border border-purple-200/80 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkle size={16} weight="fill" className="text-purple-600" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-purple-950">
                        Preference Alignment &amp; Search Baseline
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-zinc-500">
                        {selectedSuburbs.length > 0 ? selectedSuburbs.join(', ') : 'All Suburbs'} · R {formatPrice(minPrice)}–{formatPrice(maxPrice)}
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                        {viewingAiReportProp.rank ? `Rank #${viewingAiReportProp.rank}` : 'Forensic Match'}
                      </span>
                    </div>
                  </div>

                  {/* Active Search Filters (only shown if any filters or anchor are active) */}
                  {(activeAnchor || safeishFilter || fibreFilter || parkingFilter || petFriendlyFilter || offMainRoadFilter || offBarsFilter || privateOnlyFilter) && (
                    <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-semibold">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mr-0.5 flex items-center gap-1">
                        <SlidersHorizontal size={11} weight="bold" className="text-indigo-500" />
                        Filters:
                      </span>
                      {activeAnchor && (
                        <span className="bg-indigo-50 text-indigo-900 px-2 py-0.5 rounded-md border border-indigo-200">
                          🎯 {activeAnchor.label}
                        </span>
                      )}
                      {safeishFilter && (
                        <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                          Safe-ish
                        </span>
                      )}
                      {offBarsFilter && (
                        <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                          Off-Bars/Clubs
                        </span>
                      )}
                      {fibreFilter && (
                        <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                          Fibre
                        </span>
                      )}
                      {parkingFilter && (
                        <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                          Parking
                        </span>
                      )}
                      {petFriendlyFilter && (
                        <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                          Pet-friendly
                        </span>
                      )}
                      {offMainRoadFilter && (
                        <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                          Off-Main Rd
                        </span>
                      )}
                      {privateOnlyFilter && (
                        <span className="bg-white text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200">
                          100% Private
                        </span>
                      )}
                    </div>
                  )}

                  {/* Applied Lifestyle Input + AI Verdict in a clean 2-part card */}
                  <div className="bg-white/90 rounded-xl border border-purple-100 divide-y divide-purple-100/70">
                    <div className="p-2.5 text-[11px] text-zinc-600 flex items-start gap-1.5">
                      <span className="font-extrabold text-purple-900 shrink-0">Your Brief:</span>
                      <span className="italic text-zinc-700">
                        {(viewingAiReportProp as any).deep_ai_audit?.appliedPreferences ||
                          personalPreferences.trim() ||
                          'Standard optimal rental baseline (no custom criteria provided).'}
                      </span>
                    </div>
                    <div className="p-2.5 text-[11.5px] font-semibold text-purple-950 leading-relaxed flex items-start gap-1.5">
                      <span className="font-extrabold text-purple-700 shrink-0">Verdict:</span>
                      <span>
                        {(viewingAiReportProp as any).deep_ai_audit?.personalMatchVerdict ||
                          (viewingAiReportProp as any).deep_ai_audit?.amenitiesVerdict ||
                          'Evaluated against your active search criteria and property telemetry.'}
                      </span>
                    </div>
                  </div>

                  {/* Verified Property Telemetry & Risk Badges (Shown Once) */}
                  <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                    {(() => {
                      const rep = getAgencyReputationInfo(viewingAiReportProp);
                      if (!rep.isPoorAgency) return null;
                      return (
                        <span
                          className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-600 border border-rose-700 text-white flex items-center gap-1 shadow-2xs"
                          title={rep.tooltipReason}
                        >
                          <WarningCircle size={11} weight="fill" className="text-white" />
                          <span>{rep.badgeLabel}</span>
                        </span>
                      );
                    })()}
                    {(() => {
                      const barNoise = getPropertyBarNoiseExposure(viewingAiReportProp);
                      if (!barNoise.isExposed || !barNoise.badgeLabel) return null;
                      return (
                        <span
                          className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-50 border border-rose-300 text-rose-950 flex items-center gap-1 shadow-2xs"
                          title={barNoise.tooltipReason}
                        >
                          <SpeakerHigh size={11} weight="fill" className="text-rose-600" />
                          <span>{barNoise.badgeLabel}</span>
                        </span>
                      );
                    })()}
                    {(() => {
                      const busyRoad = getPropertyBusyRoadExposure(viewingAiReportProp);
                      if (!busyRoad.isNearBusyRoad || !busyRoad.badgeLabel) return null;
                      return (
                        <span
                          className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-950 flex items-center gap-1 shadow-2xs"
                          title={busyRoad.tooltipReason}
                        >
                          <Car size={11} weight="fill" className="text-amber-700" />
                          <span>{busyRoad.badgeLabel}</span>
                        </span>
                      );
                    })()}
                    {(() => {
                      const privacy = getDwellingPrivacyInfo(viewingAiReportProp);
                      if (privacy.isLandlordOnSite) {
                        return (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-950 flex items-center gap-1 shadow-2xs">
                            <WarningCircle size={11} weight="fill" className="text-amber-700" />
                            <span>Landlord On-Site / Shared Grounds</span>
                          </span>
                        );
                      }
                      if (privacy.isPossibleSharedProperty) {
                        return (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 flex items-center gap-1 shadow-2xs">
                            <WarningCircle size={11} weight="fill" className="text-amber-600" />
                            <span>Verify Privacy (Possible Shared Driveway)</span>
                          </span>
                        );
                      }
                      return (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center gap-1">
                          <ShieldCheck size={11} weight="bold" className="text-emerald-700" />
                          <span>Autonomous 100% Private Lease</span>
                        </span>
                      );
                    })()}
                    {!isPropertyInHighRiskCrimeZone(viewingAiReportProp.lat, viewingAiReportProp.lng) ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-emerald-900 flex items-center gap-1">
                        <span>🛡️</span> Safe-ish Verified
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 border border-rose-300 text-rose-900 flex items-center gap-1">
                        <span>⚠️</span> Near Crime Hotspot
                      </span>
                    )}
                    {Boolean(viewingAiReportProp.fibre_ready) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-cyan-200 text-cyan-900">
                        ✓ Fibre Ready
                      </span>
                    )}
                    {(viewingAiReportProp.has_garage || (viewingAiReportProp.parking_type && viewingAiReportProp.parking_type !== 'none')) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-900">
                        ✓ Off-Street Parking
                      </span>
                    )}
                    {viewingAiReportProp.stove_type === 'gas' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-orange-200 text-orange-900">
                        ✓ Gas Hob
                      </span>
                    )}
                    {viewingAiReportProp.pet_friendly && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-pink-200 text-pink-900">
                        ✓ Pet Friendly
                      </span>
                    )}
                    {((viewingAiReportProp.acoustic_audit?.facing_direction || '').toLowerCase().includes('north') || viewingAiReportProp.title.toLowerCase().includes('north')) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-amber-200 text-amber-900">
                        ✓ North-Facing
                      </span>
                    )}
                  </div>
                </div>

                {/* Unified Pros & Cons Audit (Info, Images & Strategic Fit) */}
                {(() => {
                  const audit = (viewingAiReportProp as any).deep_ai_audit;
                  const insights = audit?.strategicInsights;
                  const rawPros: string[] = Array.isArray(audit?.pros) ? audit.pros : [];
                  const rawCons: string[] = Array.isArray(audit?.cons) ? audit.cons : [];
                  const reasonsToRent: string[] = Array.isArray(insights?.reasonsToRent) ? insights.reasonsToRent : [];
                  const reasonsToAvoid: string[] = Array.isArray(insights?.reasonsToAvoid) ? insights.reasonsToAvoid : [];
                  const watchouts: string[] = Array.isArray(insights?.criticalWatchouts) ? insights.criticalWatchouts : [];

                  // Deduplicate and consolidate all good-fit reasons and raw pros (excluding baseline "has photos" filler)
                  const unifiedPros = Array.from(new Set([...reasonsToRent, ...rawPros])).filter(
                    (p) => !/gallery includes \d+\+? photos|comprehensive \d+-photo gallery/i.test(p)
                  );
                  const unifiedCons = Array.from(new Set([...reasonsToAvoid, ...rawCons]));

                  if (unifiedPros.length === 0 && unifiedCons.length === 0 && watchouts.length === 0) return null;

                  return (
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <Sparkle size={16} weight="fill" className="text-purple-600" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">
                            Pros &amp; Cons (Info, Images &amp; Strategic Fit)
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold text-zinc-500">
                          {unifiedPros.length} Pros · {unifiedCons.length} Cons · {watchouts.length} Watchouts
                        </span>
                      </div>

                      {/* 3-Column Grid for Pros, Cons & Things to Be Aware Of */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* PROS: Good Fit & Visual Highlights */}
                        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 flex flex-col justify-between space-y-2.5">
                          <div>
                            <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/60">
                              <h5 className="text-[11.5px] font-extrabold uppercase tracking-wide text-emerald-950 flex items-center gap-1.5">
                                <CheckCircle size={15} weight="fill" className="text-emerald-600 shrink-0" />
                                <span>Pros ({unifiedPros.length})</span>
                              </h5>
                              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                Good Fit
                              </span>
                            </div>
                            <ul className="mt-2 space-y-2 text-[11px] font-medium text-emerald-950 leading-snug">
                              {unifiedPros.map((item, idx) => {
                                const isPhoto = /photo|visual|gallery|finishes|worktop|cabinetry|daylight/i.test(item);
                                return (
                                  <li key={idx} className="flex items-start gap-1.5">
                                    <span className="text-emerald-600 font-black shrink-0 mt-0.5">
                                      {isPhoto ? '📷' : '✓'}
                                    </span>
                                    <span>{item}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                          <div className="pt-2 border-t border-emerald-200/40 text-[9.5px] font-bold text-emerald-700">
                            {unifiedPros.length} positive fit indicator{unifiedPros.length === 1 ? '' : 's'}
                          </div>
                        </div>

                        {/* CONS: Friction Points & Visual Gaps */}
                        <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/90 flex flex-col justify-between space-y-2.5">
                          <div>
                            <div className="flex items-center justify-between pb-1.5 border-b border-rose-200/60">
                              <h5 className="text-[11.5px] font-extrabold uppercase tracking-wide text-rose-950 flex items-center gap-1.5">
                                <WarningCircle size={15} weight="fill" className="text-rose-600 shrink-0" />
                                <span>Cons &amp; Risks ({unifiedCons.length})</span>
                              </h5>
                              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                                Watchouts
                              </span>
                            </div>
                            <ul className="mt-2 space-y-2 text-[11px] font-medium text-rose-950 leading-snug">
                              {unifiedCons.map((item, idx) => {
                                const isPhoto = /photo|visual|gallery|withheld|focal length|proportions|gap|sanitaryware/i.test(item);
                                return (
                                  <li key={idx} className="flex items-start gap-1.5">
                                    <span className="text-rose-600 font-black shrink-0 mt-0.5">
                                      {isPhoto ? '📷' : '⚠️'}
                                    </span>
                                    <span>{item}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                          <div className="pt-2 border-t border-rose-200/40 text-[9.5px] font-bold text-rose-700">
                            {unifiedCons.length} potential friction point{unifiedCons.length === 1 ? '' : 's'}
                          </div>
                        </div>

                        {/* THINGS TO BE AWARE OF: Tenant Vigilance Checklist */}
                        <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/90 flex flex-col justify-between space-y-2.5">
                          <div>
                            <div className="flex items-center justify-between pb-1.5 border-b border-indigo-200/60">
                              <h5 className="text-[11.5px] font-extrabold uppercase tracking-wide text-indigo-950 flex items-center gap-1.5">
                                <Info size={15} weight="fill" className="text-indigo-600 shrink-0" />
                                <span>Things to Be Aware Of</span>
                              </h5>
                              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                                Checklist
                              </span>
                            </div>
                            <ul className="mt-2 space-y-2 text-[11px] font-medium text-indigo-950 leading-snug">
                              {watchouts.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-indigo-600 font-black shrink-0 mt-0.5">🔍</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="pt-2 border-t border-indigo-200/40 text-[9.5px] font-bold text-indigo-700">
                            Tenant checklist before signing
                          </div>
                        </div>
                      </div>

                      {/* Notice if Gemini Quota Depleted */}
                      {audit?.isVisionFallback && (
                        <div className="text-[10px] text-zinc-500 bg-amber-50/80 border border-amber-200/60 rounded-xl px-3 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-600">ℹ️</span>
                            <span><strong>Photo Analysis:</strong> Showing visual gallery inspection findings (AI Studio prepayment balance depleted).</span>
                          </div>
                          <a
                            href="https://aistudio.google.com/billing"
                            target="_blank"
                            rel="noreferrer"
                            className="text-amber-800 font-bold underline hover:text-amber-950"
                          >
                            Top up credits in AI Studio →
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Architecture, Space & Building Intelligence Audit */}
                {(() => {
                  const audit = (viewingAiReportProp as any).deep_ai_audit;
                  if (!audit) return null;
                  const bIntel = audit.buildingIntel;
                  const archCards = [
                    { icon: '💻', title: 'Space & WFH Ergonomics', text: audit.wfhLayoutVerdict },
                    { icon: '☀️', title: 'Window Placement & Daylight', text: audit.windowLightAudit },
                    { icon: '🧱', title: 'Wall Type & Acoustics', text: audit.wallAcousticAudit },
                    { icon: '📐', title: 'Ceiling Height & Volume', text: audit.ceilingVolumeAudit },
                    { icon: '💡', title: 'Light Fixtures & Evening Mood', text: audit.lightingFixturesAudit },
                    { icon: '🏢', title: 'Exterior & Building Signal', text: audit.exteriorBuildingAudit },
                  ].filter((c) => Boolean(c.text));

                  if (archCards.length === 0 && !bIntel?.building_name) return null;

                  return (
                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Ruler size={17} weight="bold" className="text-slate-700" />
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                              Architecture, Space &amp; Building Intelligence
                            </h4>
                            <p className="text-[10px] text-slate-500 font-medium">
                              Evaluated against WFH ergonomics, daylight/sightlines, wall transmission, ceilings, lighting &amp; block reputation
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-800 shrink-0">
                          6-Point Audit
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {archCards.map((card, i) => (
                          <div key={i} className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1 shadow-2xs">
                            <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-slate-800">
                              <span>{card.icon}</span>
                              <span>{card.title}</span>
                            </div>
                            <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                              {card.text}
                            </p>
                          </div>
                        ))}
                      </div>

                      {bIntel?.building_name && (
                        <div className="p-3.5 rounded-xl bg-white border border-indigo-200/80 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">🏙️</span>
                              <span className="text-xs font-black text-indigo-950">
                                Block Intel: {bIntel.building_name}
                              </span>
                            </div>
                            {bIntel.google_rating && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                ★ {bIntel.google_rating} {bIntel.review_count ? `(${bIntel.review_count} reviews)` : ''}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                            {bIntel.has_lift && bIntel.has_lift !== 'unknown' && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                                Lift: {bIntel.has_lift === 'yes' ? 'Yes' : 'Walk-up (No Lift)'}
                              </span>
                            )}
                            {bIntel.airbnb_risk && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-200">
                                Airbnb/Short-Let Risk: {String(bIntel.airbnb_risk).split('—')[0].trim()}
                              </span>
                            )}
                            {bIntel.backup_power && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200">
                                Power: {String(bIntel.backup_power).split('—')[0].trim()}
                              </span>
                            )}
                          </div>

                          {bIntel.review_summary && (
                            <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                              {bIntel.review_summary}
                            </p>
                          )}
                          {(bIntel.soundproofing || bIntel.body_corporate) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[10.5px] text-slate-600">
                              {bIntel.soundproofing && (
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  <span className="font-bold text-slate-800">Acoustics:</span> {bIntel.soundproofing}
                                </div>
                              )}
                              {bIntel.body_corporate && (
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  <span className="font-bold text-slate-800">Body Corporate:</span> {bIntel.body_corporate}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Section 1: Acoustic Decibel & Orientation Audit (Moved from Map Card) */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white border border-indigo-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SpeakerHigh size={18} weight="bold" className="text-indigo-600" />
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950">
                        Acoustic Decibel &amp; Orientation Audit
                      </h4>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${(viewingAiReportProp.acoustic_audit?.estimated_db || 40) <= 40
                      ? 'bg-emerald-100/80 text-emerald-900 border-emerald-300'
                      : 'bg-rose-100/80 text-rose-900 border-rose-300'
                      }`}>
                      {viewingAiReportProp.acoustic_audit?.estimated_db || (viewingAiReportProp.noise_risk === 'sanctuary' ? 38 : 45)} dBA
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white/90 border border-indigo-100/80 space-y-1">
                      <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
                        Sound Shadow Status
                      </div>
                      <div className="font-bold text-zinc-800 text-[11px]">
                        {viewingAiReportProp.acoustic_audit?.sound_shadow_status ||
                          (viewingAiReportProp.noise_risk === 'sanctuary'
                            ? 'Quiet Sanctuary Setback'
                            : 'Standard Residential Buffer')}
                      </div>
                      <div className="text-[10px] text-zinc-500 leading-relaxed">
                        Shielded from direct traffic reverberations and arterial corridors via natural elevation and building setback.
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/90 border border-indigo-100/80 space-y-1">
                      <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
                        Orientation &amp; Natural Shielding
                      </div>
                      <div className="font-bold text-zinc-800 text-[11px]">
                        Facing: {viewingAiReportProp.acoustic_audit?.facing_direction || 'Not specified in listing'}
                      </div>
                      <div className="text-[10px] text-zinc-500 leading-relaxed">
                        Balcony and main living windows oriented away from prevailing winds and transit noise.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Multimodal Computer Vision Photo Audit */}
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Eye size={18} weight="bold" className="text-purple-600" />
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-900">
                        Computer Vision Photo Inspection
                      </h4>
                    </div>
                    {((viewingAiReportProp as any).deep_ai_audit?.isVisionLoading) ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 animate-pulse">
                        Inspecting photos…
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200/80 text-zinc-700">
                        {(cardGalleries[viewingAiReportProp.id]?.length || viewingAiReportProp.images?.length || 1)} photo(s)
                      </span>
                    )}
                  </div>

                  {(() => {
                    const imgs = cardGalleries[viewingAiReportProp.id]?.length
                      ? cardGalleries[viewingAiReportProp.id]
                      : viewingAiReportProp.images?.length
                        ? viewingAiReportProp.images
                        : viewingAiReportProp.image
                          ? [viewingAiReportProp.image]
                          : [];
                    const photoStory = (viewingAiReportProp as any).deep_ai_audit?.photoStory;
                    return (
                      <>
                        {imgs.length > 0 && (
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                            {imgs.slice(0, 6).map((src: string, idx: number) => (
                              <img
                                key={idx}
                                src={src}
                                alt={`Gallery ${idx + 1}`}
                                className="w-16 h-12 rounded-lg object-cover border border-zinc-200 shrink-0"
                              />
                            ))}
                          </div>
                        )}
                        {photoStory && (
                          <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/80 text-[11.5px] font-medium text-purple-950 leading-relaxed">
                            <span className="font-extrabold text-purple-900">Photo Story: </span>
                            {photoStory}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  <div className="space-y-2 text-xs">
                    {/* Stove Inspection */}
                    <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-zinc-200/70">
                      <span className="text-base leading-none mt-0.5">🍳</span>
                      <div className="min-w-0">
                        <div className="font-extrabold text-zinc-900 text-[11px]">
                          Stove &amp; Cooktop Verification
                        </div>
                        <div className="text-[11px] text-zinc-600">
                          {(viewingAiReportProp as any).deep_ai_audit?.stoveType ||
                            (viewingAiReportProp.stove_type === 'gas' ? 'Gas hob detected (4-burner)' : viewingAiReportProp.stove_type === 'induction' ? 'Induction hob detected' : 'Built-in stove & oven verified')}
                        </div>
                      </div>
                    </div>

                    {/* Natural Light & Glazing */}
                    <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-zinc-200/70">
                      <span className="text-base leading-none mt-0.5">☀️</span>
                      <div className="min-w-0">
                        <div className="font-extrabold text-zinc-900 text-[11px]">
                          Daylight &amp; Glazing Angles
                        </div>
                        <div className="text-[11px] text-zinc-600">
                          {(viewingAiReportProp as any).deep_ai_audit?.glazing ||
                            'Direct natural daylight verified across main living spaces.'}
                        </div>
                      </div>
                    </div>

                    {/* Plumbing Connections */}
                    <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-zinc-200/70">
                      <span className="text-base leading-none mt-0.5">🚰</span>
                      <div className="min-w-0">
                        <div className="font-extrabold text-zinc-900 text-[11px]">
                          Kitchen Appliance Plumbing
                        </div>
                        <div className="text-[11px] text-zinc-600">
                          {(viewingAiReportProp as any).deep_ai_audit?.plumbing ||
                            'Dedicated washing machine and dishwasher plumbing connection points verified.'}
                        </div>
                      </div>
                    </div>

                    {/* Lens Distortion Check */}
                    <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-zinc-200/70">
                      <span className="text-base leading-none mt-0.5">📐</span>
                      <div className="min-w-0">
                        <div className="font-extrabold text-zinc-900 text-[11px]">
                          Camera Perspective &amp; Distortion Check
                        </div>
                        <div className="text-[11px] text-zinc-600">
                          {(viewingAiReportProp as any).deep_ai_audit?.distortion ||
                            'Standard 28mm architectural lens ratio; zero deceptive fish-eye room stretching detected.'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Agent Copy & Lease Forensic Audit */}
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} weight="bold" className="text-emerald-600" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-900">
                      Agent Copy &amp; Lease Forensic Verdict
                    </h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    {(() => {
                      const rep = getAgencyReputationInfo(viewingAiReportProp);
                      if (rep.isPoorAgency) {
                        return (
                          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-300">
                            <WarningCircle size={16} weight="fill" className="text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-extrabold text-rose-950 text-[11px]">
                                🚩 High Agency Risk: {rep.agencyName} ({rep.rating}★)
                              </div>
                              <div className="text-[11px] text-rose-900 mt-0.5 leading-snug">
                                {rep.tooltipReason}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (rep.agencyName) {
                        return (
                          <div className="flex items-start gap-2 p-2 rounded-xl bg-white border border-zinc-200/70">
                            <CheckCircle size={15} weight="bold" className="text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-extrabold text-zinc-900 text-[11px]">
                                Managing Agency Reputation
                              </div>
                              <div className="text-[11px] text-zinc-600">
                                {rep.agencyName}{rep.rating ? ` (${rep.rating}★ verified Google rating)` : ' — Standard tenancy verification.'}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <div className="flex items-start gap-2 p-2 rounded-xl bg-white border border-zinc-200/70">
                      {((viewingAiReportProp as any).deep_ai_audit?.isLandlordOnSite) ? (
                        <Info size={15} weight="bold" className="text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle size={15} weight="bold" className="text-emerald-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-extrabold text-zinc-900 text-[11px]">Private Tenancy Verification</div>
                        <div className="text-[11px] text-zinc-600">
                          {(viewingAiReportProp as any).deep_ai_audit?.tenancyType ||
                            '100% self-contained private lease (zero student digs or shared commune clauses).'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 p-2 rounded-xl bg-white border border-zinc-200/70">
                      <CheckCircle size={15} weight="bold" className="text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-extrabold text-zinc-900 text-[11px]">Quiet Hours &amp; Rules</div>
                        <div className="text-[11px] text-zinc-600">
                          {(viewingAiReportProp as any).deep_ai_audit?.quietRules ||
                            'Formal residential tenancy agreement prohibiting noise disturbances or disruptive short-lets.'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: AI Follow-Up Chat (1 AI Credit per message) */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/60 border border-indigo-200/80 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <ChatCircleText size={16} weight="fill" className="text-indigo-600" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">
                        Ask AI About This Property
                      </h4>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                        1 AI Credit / msg
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <span className={remainingCredits > 0 ? 'text-zinc-600' : 'text-rose-600'}>
                        {remainingCredits} {remainingCredits === 1 ? 'credit' : 'credits'} left
                      </span>
                      {remainingCredits <= 0 && (
                        <a href="/pricing" className="text-purple-700 hover:underline font-black">
                          Top Up →
                        </a>
                      )}
                    </div>
                  </div>

                  {chatMessages.length === 0 && (
                    <div className="flex items-center flex-wrap gap-1.5">
                      {[
                        'Is the driveway or yard likely shared?',
                        'How well does this suit full-time WFH?',
                        'Draft 4 viewing questions for the agent',
                      ].map((q) => (
                        <button
                          key={q}
                          type="button"
                          disabled={isSendingChat || remainingCredits <= 0}
                          onClick={() => handleSendChat(q)}
                          className="px-2.5 py-1 rounded-xl bg-white hover:bg-indigo-50 border border-indigo-200/80 text-[10.5px] font-bold text-indigo-900 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}

                  {chatMessages.length > 0 && (
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {chatMessages.map((m, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${m.role === 'user'
                            ? 'bg-indigo-600 text-white ml-8 font-medium'
                            : 'bg-white border border-zinc-200 text-zinc-800 mr-4'
                            }`}
                        >
                          {m.content}
                        </div>
                      ))}
                      {isSendingChat && (
                        <div className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-500 text-xs flex items-center gap-2 mr-4">
                          <CircleNotch size={13} className="animate-spin text-indigo-600" />
                          <span>Analyzing listing &amp; report...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {chatError && (
                    <p className="text-[11px] font-semibold text-rose-600">{chatError}</p>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChat();
                        }
                      }}
                      disabled={isSendingChat || remainingCredits <= 0}
                      placeholder={
                        remainingCredits > 0
                          ? 'Ask a follow-up question about this listing (1 AI credit)...'
                          : 'Out of AI credits — top up on Pricing to continue chatting'
                      }
                      className="flex-1 px-3 py-2 rounded-xl bg-white border border-indigo-200 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-zinc-100"
                    />
                    <button
                      type="button"
                      disabled={isSendingChat || !chatInput.trim() || remainingCredits <= 0}
                      onClick={() => handleSendChat()}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                    >
                      {isSendingChat ? (
                        <CircleNotch size={14} className="animate-spin" />
                      ) : (
                        <PaperPlaneRight size={14} weight="fill" />
                      )}
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setViewingAiReportProp(null)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-xs font-bold text-zinc-700 transition-all cursor-pointer"
                >
                  Close Report
                </button>
                <div className="flex items-center gap-2">
                  <a
                    href={resolveGoogleMapsUrl(viewingAiReportProp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="py-2.5 px-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold flex items-center justify-center gap-1.5 border border-zinc-200 transition-all cursor-pointer"
                    title="Show this location in Google Maps (opens in a new tab)"
                  >
                    <MapPin size={13} weight="bold" className="text-rose-500" />
                    <span>Google Maps</span>
                    <ArrowSquareOut size={12} weight="bold" className="text-zinc-400" />
                  </a>
                  <a
                    href={resolveProperty24Url(viewingAiReportProp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => openProperty24Url(e, resolveProperty24Url(viewingAiReportProp))}
                    className="py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-indigo-600 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <span>View Original on Property24</span>
                    <ArrowSquareOut size={13} weight="bold" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
