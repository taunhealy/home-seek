'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, CircleNotch, MagnifyingGlass, MapPin, Sparkle, X } from '@phosphor-icons/react';
import { formatPrice } from '@/lib/forensicAudit';
import { apiUrl } from '@/lib/apiClient';

export interface WalkableTarget {
  id: string;
  label: string;
  address?: string;
  lat: number;
  lng: number;
}

interface PlaceSuggestion {
  description: string;
  main_text: string;
  secondary_text?: string;
  category?: string;
}

export interface TopTenRankerModalProps {
  isOpen: boolean;
  matchingCount: number;
  selectedSuburbs: string[];
  minPrice: number | string;
  maxPrice: number | string;
  bedrooms: string | number;
  safeishFilter: boolean;
  withinRadiusFilter: boolean;
  activeAnchorLabel?: string | null;
  locationRadiusKm: number;
  fibreFilter: boolean;
  parkingFilter: boolean;
  petFriendlyFilter: boolean;
  personalPreferences: string;
  walkablePlaces: WalkableTarget[];
  isRunningDeepAi: boolean;
  onClose: () => void;
  onUpdatePreferences: (val: string) => void;
  onAddWalkablePlace: (place: WalkableTarget) => void;
  onRemoveWalkablePlace: (id: string) => void;
  onRunAnalysis: () => void;
}

const WORK_STYLE_ITEMS = [
  { label: 'Work from home (full-time)', tag: 'WFH (Full-time): quiet acoustic environment, fibre ready, desk space', icon: '💻' },
  { label: 'Work from home (part-time)', tag: 'WFH (Part-time): flexible hybrid work, stable fibre', icon: '🏠' },
  { label: 'Work from cafes', tag: 'Work from cafes: walkable to coffee shops & laptop-friendly spots', icon: '☕' },
  { label: 'Work from an office', tag: 'Office commuter: proximity to major business hubs & commute transit', icon: '🏢' },
];

const KEY_RENTAL_FACTORS = [
  { label: 'Quiet sanctuary (no traffic)', shortLabel: 'Quiet (no traffic)', icon: '🔇' },
  { label: '100% Private (no landlord on-site)', shortLabel: '100% Private', icon: '🔒' },
  { label: 'Secure estate / 24h security', shortLabel: '24h Security', icon: '🛡️' },
  { label: 'Backup power / solar inverter', shortLabel: 'Solar / Inverter', icon: '🔋' },
  { label: 'Private patio / balcony', shortLabel: 'Patio / Balcony', icon: '🌿' },
  { label: 'Lock-up garage', shortLabel: 'Lock-up garage', icon: '🚗' },
  { label: 'Gas cooking hob', shortLabel: 'Gas hob', icon: '🍳' },
  { label: 'Pet-friendly lease', shortLabel: 'Pet-friendly', icon: '🐾' },
  { label: 'Scenic mountain / ocean views', shortLabel: 'Mountain / Ocean views', icon: '🏔️' },
];

const QUICK_INSPIRATION_CHIPS = [
  '☀️ North-Facing Sunlight',
  '🏄 Surf & Trail Access',
  '🚶 Walkable Village Vibe',
  '🎸 Acoustic / Music Friendly',
  '🚲 Secure Bike & Gear Storage',
  '🐕 Enclosed Garden Space',
];

export const TopTenRankerModal: React.FC<TopTenRankerModalProps> = ({
  isOpen,
  matchingCount,
  selectedSuburbs,
  minPrice,
  maxPrice,
  bedrooms,
  safeishFilter,
  withinRadiusFilter,
  activeAnchorLabel,
  locationRadiusKm,
  fibreFilter,
  parkingFilter,
  petFriendlyFilter,
  personalPreferences,
  walkablePlaces,
  isRunningDeepAi,
  onClose,
  onUpdatePreferences,
  onAddWalkablePlace,
  onRemoveWalkablePlace,
  onRunAnalysis,
}) => {
  const [walkQuery, setWalkQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = walkQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsSearchingPlaces(false);
      return;
    }

    let cancelled = false;
    setIsSearchingPlaces(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/places/autocomplete?q=${encodeURIComponent(trimmed)}&limit=6`));
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setIsSearchingPlaces(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [walkQuery, isOpen]);

  if (!isOpen) return null;

  const handleSelectSuggestion = async (s: PlaceSuggestion) => {
    setPlaceError(null);
    setIsResolvingPlace(true);
    setShowDropdown(false);
    try {
      const res = await fetch(apiUrl(`/api/places/details?query=${encodeURIComponent(s.description || s.main_text)}`));
      const data = await res.json();
      const place = data?.place;
      if (place && typeof place.lat === 'number' && typeof place.lng === 'number') {
        const id = `walk-${(s.main_text || s.description).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        onAddWalkablePlace({
          id,
          label: s.main_text || place.name || s.description,
          address: s.secondary_text || place.formatted_address,
          lat: place.lat,
          lng: place.lng,
        });
        setWalkQuery('');
        setSuggestions([]);
      } else {
        setPlaceError(`Could not find map coordinates for "${s.main_text}". Try adding suburb name.`);
      }
    } catch {
      setPlaceError('Failed to look up place coordinates.');
    } finally {
      setIsResolvingPlace(false);
    }
  };

  const togglePhrase = (phrase: string, checked: boolean) => {
    if (checked) {
      const cleaned = personalPreferences.trim().replace(/\.$/, '');
      onUpdatePreferences(cleaned ? `${cleaned}. ${phrase}.` : `${phrase}.`);
    } else {
      const updated = personalPreferences
        .replace(new RegExp(`\\b${phrase}\\b\\.?`, 'gi'), '')
        .replace(/\.\s*\./g, '.')
        .replace(/,\s*,/g, ',')
        .trim();
      onUpdatePreferences(updated);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) {
          e.stopPropagation();
        }
      }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-zinc-200 max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <Sparkle size={22} weight="fill" className="text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-zinc-950 leading-tight">
                  Rank Top 10
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                  Data-Driven
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                Ranks your Top 10 using walkable spots, acoustic dBA, privacy &amp; value — zero AI cost. Run AI Vision on individual listings anytime.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Section 1: Active Search Filters Taken into Account */}
        <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-900">
            <span className="flex items-center gap-1.5 text-zinc-700">
              <CheckCircle size={15} weight="bold" className="text-emerald-600" />
              Active Search Filters Taken Into Account:
            </span>
            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
              {matchingCount} Matching
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
            {safeishFilter && (
              <span className="bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-800 shadow-2xs">
                ✓ 🛡️ Safe-ish (Hiding High Risk Zones)
              </span>
            )}
            {withinRadiusFilter && activeAnchorLabel && (
              <span className="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-800 shadow-2xs">
                ✓ 🎯 In Radius (≤{locationRadiusKm.toFixed(1)} km of {activeAnchorLabel})
              </span>
            )}
            {fibreFilter && (
              <span className="bg-zinc-900 text-cyan-300 px-2 py-0.5 rounded-md border border-zinc-800 shadow-2xs">
                ✓ 🌐 Fibre ready
              </span>
            )}
            {parkingFilter && (
              <span className="bg-zinc-900 text-emerald-300 px-2 py-0.5 rounded-md border border-zinc-800 shadow-2xs">
                ✓ 🚗 Off-street parking
              </span>
            )}
            {petFriendlyFilter && (
              <span className="bg-zinc-900 text-pink-300 px-2 py-0.5 rounded-md border border-zinc-800 shadow-2xs">
                ✓ 🐾 Pet-friendly
              </span>
            )}
            {!fibreFilter && !parkingFilter && !petFriendlyFilter && (
              <span className="bg-white/80 text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-200/60 text-[10.5px]">
                (No feature toggles active · showing all verified)
              </span>
            )}
          </div>
        </div>

        {/* Section 2: Walkable To (Google Places Autocomplete) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-black text-zinc-900 uppercase tracking-wider">
              Walkable to:
            </label>
            <span className="text-[10px] font-semibold text-zinc-400">
              Ranks walkable homes (≤1.2 km) higher in Top Fit · never filters out listings
            </span>
          </div>

          <div className="relative">
            <div className="relative flex items-center">
              <MagnifyingGlass size={14} weight="bold" className="absolute left-3 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={walkQuery}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
                onChange={(e) => {
                  setWalkQuery(e.target.value);
                  setShowDropdown(true);
                  setPlaceError(null);
                }}
                placeholder="Search cafe, gym, grocery, MyCiTi stop (e.g. Seattle Coffee Hout Bay)..."
                className="w-full pl-8 pr-8 py-2 rounded-xl border border-zinc-200 bg-zinc-50/70 focus:bg-white text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
              {(isSearchingPlaces || isResolvingPlace) && (
                <CircleNotch size={14} className="animate-spin text-indigo-600 absolute right-3" />
              )}
            </div>

            {showDropdown && walkQuery.trim().length >= 2 && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-zinc-200 py-1 z-30 max-h-48 overflow-y-auto divide-y divide-zinc-50">
                {suggestions.map((s, idx) => (
                  <button
                    key={`${s.main_text}-${idx}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(s);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50/80 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin size={13} weight="bold" className="text-indigo-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-900 truncate">{s.main_text}</div>
                        {s.secondary_text && (
                          <div className="text-[10px] text-zinc-400 truncate">{s.secondary_text}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-indigo-600 shrink-0">+ Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {placeError && (
            <p className="text-[11px] font-semibold text-rose-600">{placeError}</p>
          )}

          {walkablePlaces.length > 0 && (
            <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
              {walkablePlaces.map((wp) => (
                <span
                  key={wp.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-bold"
                  title={wp.address || wp.label}
                >
                  <span>🚶 {wp.label}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveWalkablePlace(wp.id)}
                    className="text-indigo-500 hover:text-rose-600 cursor-pointer"
                    title={`Remove ${wp.label}`}
                  >
                    <X size={11} weight="bold" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Personal Preferences Input Box */}
        <div className="space-y-2">
          <label className="block text-xs font-black text-zinc-900 uppercase tracking-wider">
            Personal Preferences &amp; Lifestyle Sanctuary
          </label>
          <p className="text-[11px] text-zinc-500 font-medium">
            Specify views, sunlight, remote work requirements, noise sensitivity, or special needs.
          </p>
          <textarea
            rows={2}
            value={personalPreferences}
            onChange={(e) => onUpdatePreferences(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onRunAnalysis();
              }
            }}
            placeholder="e.g. Quiet sanctuary, ocean views, natural light, gas stove, and dedicated remote work space..."
            className="w-full text-xs p-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-zinc-900 font-medium resize-none leading-relaxed transition-all"
          />

          {/* Standard Lifestyle & Work Mode Checkboxes */}
          <div className="pt-1.5 space-y-2">
            <span className="text-[10px] font-bold text-zinc-400 block uppercase tracking-wider">
              Work Style &amp; Daily Routine:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {WORK_STYLE_ITEMS.map((item) => {
                const isChecked = personalPreferences.toLowerCase().includes(item.label.toLowerCase());
                return (
                  <label
                    key={item.label}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-all select-none ${isChecked
                      ? 'bg-purple-50/90 border-purple-300 text-purple-950 shadow-2xs font-extrabold ring-1 ring-purple-400/40'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200/90 text-zinc-700'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => togglePhrase(item.label, e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600 shrink-0"
                    />
                    <span className="truncate">{item.icon} {item.label}</span>
                  </label>
                );
              })}
            </div>

            <span className="text-[10px] font-bold text-zinc-400 block uppercase tracking-wider pt-1">
              Key Rental Decision Factors:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {KEY_RENTAL_FACTORS.map((factor) => {
                const isChecked = personalPreferences.toLowerCase().includes(factor.label.toLowerCase());
                return (
                  <label
                    key={factor.label}
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all select-none ${isChecked
                      ? 'bg-purple-100/80 border-purple-300 text-purple-950 font-black shadow-2xs'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => togglePhrase(factor.label, e.target.checked)}
                      className="w-3 h-3 rounded text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600 shrink-0"
                    />
                    <span className="truncate" title={factor.label}>{factor.icon} {factor.shortLabel}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Quick Inspiration Chips */}
          <div className="pt-1">
            <span className="text-[10px] font-bold text-zinc-400 block mb-1.5 uppercase tracking-wider">
              Quick-Add Inspiration:
            </span>
            <div className="flex items-center flex-wrap gap-1.5">
              {QUICK_INSPIRATION_CHIPS.map((chip) => {
                const chipKey = chip.replace(/^[^\w\s]+\s*/, '');
                const isAlreadyIn = personalPreferences.toLowerCase().includes(chipKey.toLowerCase());
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      if (isAlreadyIn) {
                        onUpdatePreferences(
                          personalPreferences.replace(new RegExp(chipKey, 'gi'), '').replace(/,\s*,/g, ',').trim()
                        );
                      } else {
                        onUpdatePreferences(
                          personalPreferences ? `${personalPreferences.trim().replace(/\.$/, '')}, ${chipKey}.` : `${chipKey}.`
                        );
                      }
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${isAlreadyIn
                      ? 'bg-purple-100 border-purple-300 text-purple-900 shadow-2xs font-black'
                      : 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                      }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Button */}
        <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-xs font-bold text-zinc-700 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isRunningDeepAi}
            onClick={onRunAnalysis}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white text-xs font-extrabold shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {isRunningDeepAi ? (
              <>
                <CircleNotch size={15} className="animate-spin text-white" />
                <span>Ranking Top 10 Matches...</span>
              </>
            ) : (
              <>
                <Sparkle size={15} weight="fill" className="text-amber-300" />
                <span>Rank Top 10</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
