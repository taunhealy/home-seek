'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  WarningCircle, 
  Sparkle, 
  ClipboardText, 
  Money, 
  CaretDown, 
  CaretUp,
  ShieldCheck,
  Check,
  House,
  Eye,
  ArrowSquareOut,
  Buildings,
  Star,
  Globe,
  Waves,
  MapPin,
  Car,
  Lock
} from '@phosphor-icons/react';
import { PropertyAiReport } from '@/lib/schemas';

interface PropertyAiDossierProps {
  report: PropertyAiReport;
  listingTitle: string;
  isExpandedDefault?: boolean;
}

export const PropertyAiDossier: React.FC<PropertyAiDossierProps> = ({
  report,
  listingTitle,
  isExpandedDefault = false
}) => {
  const [isExpanded, setIsExpanded] = useState(isExpandedDefault);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const toggleCheck = (idx: number) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const fitScore = report.fit_score || 80;
  const isHighFit = fitScore >= 80;
  const isMediumFit = fitScore >= 60 && fitScore < 80;

  const hasWarnings = (report.unmet_must_haves && report.unmet_must_haves.length > 0) ||
                      (report.triggered_exclusions && report.triggered_exclusions.length > 0);

  return (
    <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden backdrop-blur-md">
      {/* Header Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-5 md:p-6 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Sparkle size={20} weight="fill" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white">
                Comprehensive Pros & Cons
              </h4>
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-[10px] text-white/40 font-medium mt-0.5">
              Pros, hidden costs & in-person viewing checklist
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Fit Badge */}
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
            isHighFit 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : isMediumFit 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <span className="w-2 h-2 rounded-full animate-pulse bg-current" />
            <span className="text-[10px] font-black uppercase tracking-wider">
              {fitScore}% Match
            </span>
          </div>

          {hasWarnings && (
            <div className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-black flex items-center gap-1.5">
              <WarningCircle size={14} weight="fill" />
              <span>Notes</span>
            </div>
          )}

          <button 
            type="button" 
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            aria-label="Toggle Dossier"
          >
            {isExpanded ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />}
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="border-t border-white/5 p-6 md:p-8 space-y-8"
          >
            {/* Verdict Callout */}
            {report.verdict && (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={18} weight="fill" className="text-emerald-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    Quick Verdict
                  </span>
                </div>
                <p className="text-xs md:text-sm text-white/90 leading-relaxed font-medium">
                  {report.verdict}
                </p>
              </div>
            )}

            {/* Advisory Warnings Banner */}
            {hasWarnings && (
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2">
                  <WarningCircle size={16} weight="fill" className="text-amber-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    Things to Double-Check
                  </span>
                </div>
                <div className="text-xs text-white/70 space-y-1 pl-6">
                  {report.unmet_must_haves?.map((item, i) => (
                    <p key={i} className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>Unverified Must-Have: <strong className="text-white font-semibold">"{item}"</strong> is not explicitly guaranteed in the listing ad.</span>
                    </p>
                  ))}
                  {report.triggered_exclusions?.map((item, i) => (
                    <p key={i} className="flex items-center gap-2">
                      <span className="text-red-400 font-bold">•</span>
                      <span>Potential Deal-Breaker: <strong className="text-white font-semibold">"{item}"</strong> was detected or mentioned.</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* 🏢 MANAGING AGENCY & REVIEW INTEL (Google & Hello Peter) */}
            {report.agency_intel && (
              <div className="p-5 rounded-2xl bg-white/[0.025] border border-white/10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <Buildings size={20} weight="fill" className={
                      report.agency_intel.risk_level === 'high' ? 'text-rose-400' : 'text-emerald-400'
                    } />
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-white">
                          {report.agency_intel.name || 'Managing Agency'}
                        </h5>
                        {report.agency_intel.is_direct_landlord ? (
                          <span className="text-[9px] font-black uppercase tracking-widest text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                            Private Owner
                          </span>
                        ) : report.agency_intel.risk_level === 'high' ? (
                          <span className="text-[9px] font-black uppercase tracking-widest text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                            ⚠️ High Tenant Risk
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            Verified Agency
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/40">
                        {report.agency_intel.is_direct_landlord 
                          ? 'Zero agency commission or lease administration fees.' 
                          : 'Tenant satisfaction, maintenance response, and deposit safety ratings.'}
                      </p>
                    </div>
                  </div>
                </div>

                {!report.agency_intel.is_direct_landlord && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Google Reviews Card */}
                    <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white">Google Reviews</span>
                        {report.agency_intel.google_rating ? (
                          <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                            report.agency_intel.google_rating < 3.0 
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            ★ {report.agency_intel.google_rating} / 5.0
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/40">Not rated</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-white/50 pt-1">
                        <span>{report.agency_intel.google_review_count || 0} tenant reviews</span>
                        {report.agency_intel.google_reviews_url && (
                          <a 
                            href={report.agency_intel.google_reviews_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider transition-colors"
                          >
                            View on Google <ArrowSquareOut size={12} weight="bold" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Hello Peter Card */}
                    <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white">Hello Peter</span>
                        {report.agency_intel.hellopeter_rating ? (
                          <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                            report.agency_intel.hellopeter_rating < 3.0 
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            ★ {report.agency_intel.hellopeter_rating} / 5.0
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/40">Unlisted</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-white/50 pt-1">
                        <span>{report.agency_intel.hellopeter_review_count || 0} reviews</span>
                        {report.agency_intel.hellopeter_url && (
                          <a 
                            href={report.agency_intel.hellopeter_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
                          >
                            View on Hello Peter <ArrowSquareOut size={12} weight="bold" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reviews from the web (e.g., Facebook, third-party ratings surfaced on Google) */}
                {report.agency_intel.web_reviews && report.agency_intel.web_reviews.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                      <Globe size={13} weight="bold" className="text-cyan-400" /> Reviews from the web:
                    </span>
                    {report.agency_intel.web_reviews.map((wr, idx) => (
                      <a 
                        key={idx}
                        href={wr.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200 hover:bg-cyan-500/20 hover:border-cyan-500/30 transition-all group"
                      >
                        <span className="font-bold text-white group-hover:text-cyan-300">{wr.source}</span>
                        {wr.rating && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-black">
                            {wr.rating}
                          </span>
                        )}
                        {wr.votes && <span className="text-[10px] text-white/50">{wr.votes}</span>}
                        <ArrowSquareOut size={12} weight="bold" className="text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Complaint Sample / Red Flags */}
                {report.agency_intel.complaint_sample && (
                  <div className="p-3.5 rounded-xl bg-rose-500/[0.04] border border-rose-500/20 text-xs text-rose-200/90 leading-relaxed italic flex items-start gap-2.5">
                    <WarningCircle size={16} weight="fill" className="text-rose-400 shrink-0 mt-0.5" />
                    <span>"{report.agency_intel.complaint_sample}"</span>
                  </div>
                )}
              </div>
            )}

            {/* 🌊 Forensically Verified View Audit (Pro Feature) */}
            {report.vision_intel && (
              <div className={`p-4 rounded-2xl border transition-all ${
                report.vision_intel.sea_view_type === 'panoramic_direct'
                  ? 'bg-gradient-to-r from-cyan-950/40 via-blue-950/20 to-transparent border-cyan-500/30'
                  : report.vision_intel.sea_view_type === 'partial_glimpse'
                    ? 'bg-amber-500/[0.04] border-amber-500/20'
                    : 'bg-rose-500/[0.04] border-rose-500/20'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      report.vision_intel.sea_view_type === 'panoramic_direct'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                        : report.vision_intel.sea_view_type === 'partial_glimpse'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      <Waves size={18} weight="fill" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-white">
                          Sea View Photo Check
                        </h5>
                        <span className="text-[9px] font-black uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                          PHOTO VERIFIED
                        </span>
                      </div>
                      <p className="text-[11px] text-white/70 mt-0.5 font-medium">
                        {report.vision_intel.view_description || 'Checked directly from listing photos.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black px-2.5 py-1 rounded-xl border ${
                      report.vision_intel.sea_view_type === 'panoramic_direct'
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : report.vision_intel.sea_view_type === 'partial_glimpse'
                          ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                          : 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                    }`}>
                      {report.vision_intel.sea_view_type === 'panoramic_direct' && '🌊 Real Ocean View'}
                      {report.vision_intel.sea_view_type === 'partial_glimpse' && '⚠️ Partial / Small Glimpse'}
                      {report.vision_intel.sea_view_type === 'none_or_deceptive' && '🚫 No Sea View in Photos'}
                      {report.vision_intel.sea_view_type === 'unverified' && '🔍 Not Checked'}
                    </span>
                    {report.vision_intel.sea_view_score > 0 && (
                      <span className="text-[10px] font-bold text-white/40">
                        {report.vision_intel.sea_view_score}% Match
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 📍 Commute & Life Anchors Proximity (Pro Feature) */}
            {report.commute_intel && report.commute_intel.length > 0 && (
              <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-blue-950/30 via-indigo-950/20 to-transparent border border-blue-500/20 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(59,130,246,0.25)]">
                      <MapPin size={18} weight="fill" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-white">
                          Commute & Life Anchors
                        </h5>
                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-300 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-full">
                          PRO COMMUTE
                        </span>
                      </div>
                      <p className="text-[11px] text-white/60 font-medium">
                        Live travel time & distance matrix calculated via Google Maps
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {report.commute_intel.map((commute, cIdx) => (
                    <div 
                      key={cIdx}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                        commute.is_within_threshold
                          ? 'bg-white/[0.02] border-blue-500/20 hover:border-blue-500/40'
                          : 'bg-amber-500/[0.04] border-amber-500/20 hover:border-amber-500/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-white/50 block">
                            {commute.anchor_label}
                          </span>
                          <h6 className="text-xs font-bold text-white leading-tight">
                            {commute.destination}
                          </h6>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${
                          commute.is_within_threshold
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        }`}>
                          {commute.is_within_threshold ? 'Within Target' : 'Exceeds Target'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                        <div className="flex items-center gap-3 text-white/80">
                          <span className="flex items-center gap-1.5 font-semibold text-white">
                            <Car size={15} weight="fill" className="text-blue-400" />
                            {commute.duration_text}
                          </span>
                          <span className="text-white/40">•</span>
                          <span className="text-white/60">{commute.distance_text}</span>
                        </div>

                        {commute.maps_route_url && (
                          <a 
                            href={commute.maps_route_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors group"
                          >
                            <span>Live Route</span>
                            <ArrowSquareOut size={12} weight="bold" className="group-hover:translate-x-0.5 transition-transform" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 🏡 Living Autonomy & Privacy Shield */}
            {report.privacy_intel && (
              <div className={`p-4 md:p-5 rounded-2xl border transition-all ${
                report.privacy_intel.privacy_score >= 80
                  ? 'bg-gradient-to-r from-emerald-950/20 via-teal-950/10 to-transparent border-emerald-500/20'
                  : report.privacy_intel.privacy_score >= 60
                    ? 'bg-amber-500/[0.04] border-amber-500/25'
                    : 'bg-rose-500/[0.05] border-rose-500/30'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      report.privacy_intel.privacy_score >= 80
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : report.privacy_intel.privacy_score >= 60
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      <Lock size={18} weight="fill" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-white">
                          Living Autonomy & Privacy
                        </h5>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                          report.privacy_intel.dwelling_type === 'independent'
                            ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                            : report.privacy_intel.dwelling_type === 'garden_cottage'
                              ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                              : 'text-rose-300 bg-rose-500/10 border-rose-500/30'
                        }`}>
                          {report.privacy_intel.dwelling_type === 'independent' && '100% STANDALONE'}
                          {report.privacy_intel.dwelling_type === 'garden_cottage' && 'GARDEN COTTAGE / SHARED ERF'}
                          {report.privacy_intel.dwelling_type === 'attached_flatlet' && 'ATTACHED FLATLET'}
                          {report.privacy_intel.dwelling_type === 'room_shared' && 'ROOM / HOUSE SHARE'}
                          {report.privacy_intel.dwelling_type === 'unknown' && 'UNVERIFIED'}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/70 mt-0.5 font-medium">
                        {report.privacy_intel.privacy_summary || 'Autonomous private dwelling.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black px-2.5 py-1 rounded-xl border ${
                      report.privacy_intel.privacy_score >= 80
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : report.privacy_intel.privacy_score >= 60
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}>
                      {report.privacy_intel.privacy_score}% Autonomy
                    </span>
                  </div>
                </div>

                {report.privacy_intel.privacy_flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                    {report.privacy_intel.privacy_flags.map((flag, idx) => (
                      <span key={idx} className="text-[10px] font-semibold px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white/70 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2-Column Grid: Pros vs Cons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* THE PROS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400">
                    The Pros
                  </h5>
                </div>
                <ul className="space-y-3">
                  {report.pros && report.pros.length > 0 ? (
                    report.pros.map((pro, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-xs text-white/80 leading-relaxed bg-white/[0.015] p-3.5 rounded-2xl border border-white/5">
                        <CheckCircle size={16} weight="fill" className="text-emerald-400 shrink-0 mt-0.5" />
                        <span>{pro}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-white/30 italic">No specific pros extracted.</li>
                  )}
                </ul>
              </div>

              {/* THE CONS & HIDDEN COSTS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185]" />
                  <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-400">
                    The Cons & Hidden Costs
                  </h5>
                </div>
                <ul className="space-y-3">
                  {report.cons_and_hidden_costs && report.cons_and_hidden_costs.length > 0 ? (
                    report.cons_and_hidden_costs.map((con, idx) => {
                      const isCost = con.toLowerCase().includes('cost') || 
                                     con.toLowerCase().includes('deposit') || 
                                     con.toLowerCase().includes('parking') || 
                                     con.toLowerCase().includes('r ');
                      return (
                        <li key={idx} className={`flex items-start gap-3 text-xs leading-relaxed p-3.5 rounded-2xl border ${
                          isCost 
                            ? 'bg-rose-500/[0.04] border-rose-500/20 text-white/85' 
                            : 'bg-white/[0.015] border-white/5 text-white/80'
                        }`}>
                          <WarningCircle size={16} weight="fill" className="text-rose-400 shrink-0 mt-0.5" />
                          <span>{con}</span>
                        </li>
                      );
                    })
                  ) : (
                    <li className="text-xs text-white/30 italic">No notable cons or hidden costs detected.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* VIEWING CHECKLIST */}
            {report.viewing_checklist && report.viewing_checklist.length > 0 && (
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardText size={18} weight="fill" className="text-cyan-400" />
                  <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-400">
                    In-Person Viewing Checklist
                  </h5>
                  <span className="text-[9px] text-white/40 font-bold ml-auto">
                    {Object.values(checkedItems).filter(Boolean).length} / {report.viewing_checklist.length} Inspected
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {report.viewing_checklist.map((item, idx) => {
                    const isChecked = !!checkedItems[idx];
                    return (
                      <div 
                        key={idx}
                        onClick={() => toggleCheck(idx)}
                        className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-white line-through opacity-70' 
                            : 'bg-white/[0.02] border-white/5 text-white/80 hover:border-white/20'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                          isChecked ? 'bg-cyan-500 border-cyan-400 text-black' : 'border-white/30'
                        }`}>
                          {isChecked && <Check size={12} weight="bold" />}
                        </div>
                        <span className="text-xs leading-relaxed font-medium">{item}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
