'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  MagnifyingGlass,
  MapPin,
  Target,
  ShieldCheck,
  ShieldWarning,
  SlidersHorizontal,
  House,
  Car,
  Plus,
  Trash,
  CheckCircle,
  ArrowRight,
  Lightning,
  Sparkle,
  ArrowsClockwise,
  Info,
  X,
  NavigationArrow,
  Ruler,
  Compass,
  CircleNotch,
  CaretRight,
  CaretLeft,
  CaretDown,
  ArrowSquareOut,
  Sliders,
  Tree,
  Waves,
  Coffee,
  Bicycle,
  Eye,
  EyeSlash,
  Check,
  BookmarkSimple,
  FloppyDisk,
  SpeakerHigh,
  WarningCircle,
  Heart,
  Clock,
  Scales,
  Crown,
  Camera,
  SquaresFour,
  ListBullets
} from '@phosphor-icons/react';
import { Dumbbell, ShoppingBag } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { CAPE_TOWN_CRIME_HOTSPOTS, CAPE_TOWN_HOTSPOTS, CAPE_TOWN_BUSY_ROADS, getPropertyBarNoiseExposure, getPropertyBusyRoadExposure, getCrimeDepthTier, isMissingAddressListing, type PropertyMapItem, type PropertyMapProps, type ProximityAnchor, type ProximityFilterConfig } from '@/components/PropertyMap';
import { resolveLocationCoords, getDistanceKm, searchSuburbs, searchPlacesAndAttractions, type PlaceSuggestion, isLandlordOnSiteProperty, getDwellingPrivacyInfo, getAgencyReputationInfo, getPropertyMarketValuation, setEmpiricalMarketMedians, type PropertyValuationContext } from '@/lib/geo';
import {
  getPlanSummary,
  setProPlanTier,
  consumeAuditCredit,
  compressImageToDataUrl,
  getCompareList,
  toggleCompareProperty,
  type PlanSummary,
} from '@/lib/pro-plan';

import {
  PRESET_TRAILHEADS_AND_HUBS,
  DEFAULT_AI_CRITERIA_PRESETS,
  DEFAULT_SAVED_SEARCHES,
  INITIAL_SHOWCASE_PROPERTIES,
  type CommuteAnchor,
  type SavedSearch,
  type AiCriteriaPreset,
} from '@/constants/locations';
import { CommentsModal, type ListingComment } from '@/components/search/CommentsModal';
import { FavouritesImportModal } from '@/components/search/FavouritesImportModal';
import { TopTenRankerModal, type WalkableTarget } from '@/components/search/TopTenRankerModal';
import { AiPropertyReportModal } from '@/components/search/AiPropertyReportModal';
import {
  isPropertyInHighRiskCrimeZone,
  getCrimePerimeterInfo,
  getRiskAdjustedValuation,
  isMainRoadProperty,
  formatPrice,
  formatPriceAbbr,
  type CrimePerimeterInfo,
} from '@/lib/forensicAudit';
export {
  isPropertyInHighRiskCrimeZone,
  getCrimePerimeterInfo,
  getRiskAdjustedValuation,
  isMainRoadProperty,
  type CrimePerimeterInfo,
};
const PropertyMap = dynamic<PropertyMapProps>(
  () => import('@/components/PropertyMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-zinc-400">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Loading Map Engine...</span>
        </div>
      </div>
    ),
  }
);

export default function SearchMapPage() {
  const { user, profile, logout } = useAuth();

  // Search Criteria State (Default to Cape Town Southern Suburbs Trailside, not George)
  const [selectedSuburbs, setSelectedSuburbs] = useState<string[]>(['Rondebosch', 'Newlands', 'Tokai']);
  const [suburbInput, setSuburbInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [autoIndex, setAutoIndex] = useState(0);

  const autocompleteSuggestions = useMemo(() => {
    return searchSuburbs(suburbInput, selectedSuburbs);
  }, [suburbInput, selectedSuburbs]);
  const [minPrice, setMinPrice] = useState('11000');
  const [maxPrice, setMaxPrice] = useState('18000');
  const [isBudgetMenuOpen, setIsBudgetMenuOpen] = useState(false);
  const [minSqm, setMinSqm] = useState<number>(0);
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const budgetMenuRef = useRef<HTMLDivElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const savedSearchMenuRef = useRef<HTMLDivElement>(null);
  const anchorMenuRef = useRef<HTMLDivElement>(null);
  const [bedrooms, setBedrooms] = useState('0.5+');

  // Clickable Feature Filters (Deterministic toggles for listings & map markers visibility)
  const [safeishFilter, setSafeishFilter] = useState<boolean>(true); // Safe-ish: ON by default (hides listings inside High-Risk crime radii)
  const [offMainRoadFilter, setOffMainRoadFilter] = useState<boolean>(true); // Off-Main Rd: ON by default (excludes noisy arterial road properties)
  const [offBarsFilter, setOffBarsFilter] = useState<boolean>(false); // Off-Bars/Clubs: excludes properties within close bar/nightlife radius
  const [withinRadiusFilter, setWithinRadiusFilter] = useState<boolean>(false); // Within Radius: OFF by default (properties outside radius stay visible, ranked lower)
  const [locationRadiusKm, setLocationRadiusKm] = useState<number>(5.0); // Selected location buffer radius in km
  const [fibreFilter, setFibreFilter] = useState<boolean>(false);
  const [parkingFilter, setParkingFilter] = useState<boolean>(false);
  const [petFriendlyFilter, setPetFriendlyFilter] = useState<boolean>(false);
  const [privateOnlyFilter, setPrivateOnlyFilter] = useState<boolean>(false);

  // Hidden / Dismissed Listings State & Visibility Toggle
  const [hiddenPropertyIds, setHiddenPropertyIds] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState<boolean>(false);

  // Manual Address Submission State (for listings with withheld/unknown addresses)
  const [editingAddressPropId, setEditingAddressPropId] = useState<string | null>(null);
  const [manualAddressInput, setManualAddressInput] = useState('');
  const [isSubmittingAddress, setIsSubmittingAddress] = useState(false);
  const [manualAddressError, setManualAddressError] = useState<string | null>(null);

  const handleSubmitManualAddress = async (prop: PropertyMapItem) => {
    const clean = manualAddressInput.trim();
    if (clean.length < 4) {
      setManualAddressError('Enter a street name/number (e.g. 14 Derwent Rd).');
      return;
    }
    setIsSubmittingAddress(true);
    setManualAddressError(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/listings/submit-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: prop.id,
          address: clean,
          suburb: (prop as any).suburb || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setManualAddressError(data?.detail || 'Could not save address.');
        return;
      }
      setProperties((prev) =>
        prev.map((p) =>
          p.id === prop.id
            ? {
              ...p,
              address: data.address || clean,
              is_address_withheld: false,
              lat: typeof data.lat === 'number' ? data.lat : p.lat,
              lng: typeof data.lng === 'number' ? data.lng : p.lng,
              ...(data.noise_risk ? { noise_risk: data.noise_risk } : {}),
              ...(typeof data.is_main_road === 'boolean' ? { is_main_road: data.is_main_road } : {}),
              ...(data.acoustic_audit ? { acoustic_audit: data.acoustic_audit } : {}),
            }
            : p
        )
      );
      setEditingAddressPropId(null);
      setManualAddressInput('');
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        setFocusTarget({ lat: data.lat, lng: data.lng, zoom: 16.8, timestamp: Date.now() });
      }
    } catch (err) {
      setManualAddressError('Network error saving address.');
    } finally {
      setIsSubmittingAddress(false);
    }
  };

  // Listing Comments & Reddit-Style Nickname State
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [recentComments, setRecentComments] = useState<Record<string, Array<{
    id: string;
    nickname: string;
    body: string;
    created_at: number;
  }>>>({});
  const [commentModalProp, setCommentModalProp] = useState<PropertyMapItem | null>(null);
  const [listingComments, setListingComments] = useState<Array<{
    id: string;
    listing_id: string;
    user_id: string;
    nickname: string;
    body: string;
    created_at: number;
    updated_at: number;
  }>>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [guestUid, setGuestUid] = useState<string>('');
  const [guestNickname, setGuestNickname] = useState<string>('');

  const activeCommentUid = user?.uid || guestUid;
  const activeCommentNickname = profile?.nickname || guestNickname;

  useEffect(() => {
    let uid = '';
    try {
      uid = localStorage.getItem('homeseek_guest_uid') || '';
      if (!uid) {
        uid = `guest-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem('homeseek_guest_uid', uid);
      }
    } catch {
      uid = `guest-${Math.random().toString(36).slice(2, 10)}`;
    }
    setGuestUid(uid);

    const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    fetch(`${backendBase}/api/listings/comments/counts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.counts) setCommentCounts(d.counts);
        if (d?.recent) {
          setRecentComments(d.recent);
        } else if (d?.latest) {
          const mapped: Record<string, Array<{ id: string; nickname: string; body: string; created_at: number }>> = {};
          for (const [k, v] of Object.entries(d.latest)) {
            if (v) mapped[k] = [v as any];
          }
          setRecentComments(mapped);
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (!activeCommentUid || profile?.nickname) return;
    const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    fetch(`${backendBase}/api/listings/nickname/${encodeURIComponent(activeCommentUid)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.nickname) setGuestNickname(d.nickname);
      })
      .catch(() => { });
  }, [activeCommentUid, profile?.nickname]);

  const openCommentsModal = async (prop: PropertyMapItem) => {
    setCommentModalProp(prop);
    setCommentError(null);
    setNewCommentText('');
    setEditingCommentId(null);
    setIsLoadingComments(true);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/listings/${encodeURIComponent(prop.id)}/comments`);
      if (res.ok) {
        const data = await res.json();
        setListingComments(Array.isArray(data.comments) ? data.comments : []);
      }
    } catch {
      setCommentError('Failed to load comments.');
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleCreateComment = async () => {
    if (!commentModalProp) return;
    const clean = newCommentText.trim();
    if (!clean) return;
    setIsPostingComment(true);
    setCommentError(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/listings/${encodeURIComponent(commentModalProp.id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: activeCommentUid || 'guest', body: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommentError(data?.detail || 'Failed to post comment.');
        return;
      }
      if (data.comment) {
        setListingComments((prev) => [data.comment, ...prev]);
        setCommentCounts((prev) => ({
          ...prev,
          [commentModalProp.id]: (prev[commentModalProp.id] || 0) + 1,
        }));
        setRecentComments((prev) => {
          const nextItem = {
            id: data.comment.id,
            nickname: data.comment.nickname,
            body: data.comment.body,
            created_at: data.comment.created_at,
          };
          const existing = prev[commentModalProp.id] || [];
          return { ...prev, [commentModalProp.id]: [nextItem, ...existing].slice(0, 3) };
        });
        if (!activeCommentNickname && data.comment.nickname) {
          setGuestNickname(data.comment.nickname);
        }
        setNewCommentText('');
      }
    } catch {
      setCommentError('Network error posting comment.');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    const clean = editingCommentText.trim();
    if (!clean) return;
    setCommentError(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/listings/comments/${encodeURIComponent(commentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: activeCommentUid, body: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommentError(data?.detail || 'Could not update comment.');
        return;
      }
      if (data.comment) {
        setListingComments((prev) => prev.map((c) => (c.id === commentId ? data.comment : c)));
        if (commentModalProp) {
          setRecentComments((prev) => ({
            ...prev,
            [commentModalProp.id]: (prev[commentModalProp.id] || []).map((c) =>
              c.id === commentId ? { ...c, body: data.comment.body } : c
            ),
          }));
        }
        setEditingCommentId(null);
        setEditingCommentText('');
      }
    } catch {
      setCommentError('Network error updating comment.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!commentModalProp) return;
    setCommentError(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(
        `${backendBase}/api/listings/comments/${encodeURIComponent(commentId)}?user_id=${encodeURIComponent(activeCommentUid)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCommentError(data?.detail || 'Could not delete comment.');
        return;
      }
      const remaining = listingComments.filter((c) => c.id !== commentId);
      setListingComments(remaining);
      setCommentCounts((prev) => {
        const next = Math.max(0, (prev[commentModalProp.id] || 1) - 1);
        return { ...prev, [commentModalProp.id]: next };
      });
      setRecentComments((prev) => {
        const next = { ...prev };
        if (remaining.length > 0) {
          next[commentModalProp.id] = remaining.slice(0, 3).map((c) => ({
            id: c.id,
            nickname: c.nickname,
            body: c.body,
            created_at: c.created_at,
          }));
        } else {
          delete next[commentModalProp.id];
        }
        return next;
      });
    } catch {
      setCommentError('Network error deleting comment.');
    }
  };

  const toggleHideProperty = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setHiddenPropertyIds((prev) => {
      const isHidden = prev.includes(id);
      const updated = isHidden ? prev.filter((pId) => pId !== id) : [...prev, id];
      try {
        localStorage.setItem('homeseek_hidden_properties', JSON.stringify(updated));
      } catch { }
      return updated;
    });
  };

  const unhideAllProperties = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setHiddenPropertyIds([]);
    try {
      localStorage.removeItem('homeseek_hidden_properties');
    } catch { }
  };

  // Property24 Favourites State & Persistence
  const [favouritePropertyIds, setFavouritePropertyIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('homeseek_p24_favourite_ids');
        return stored ? JSON.parse(stored) : [];
      } catch { }
    }
    return [];
  });

  // Imported favourites live in session memory only. Full listing snapshots are never persisted,
  // so rented/expired listings can't be resurrected from localStorage — listings must come from a fresh scrape.
  const [importedFavourites, setImportedFavourites] = useState<PropertyMapItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('homeseek_imported_favourites_v1');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('homeseek_imported_favourites_v1', JSON.stringify(importedFavourites));
    } catch {
      // Ignore storage quota errors
    }
  }, [importedFavourites]);

  useEffect(() => {
    try {
      localStorage.removeItem('homeseek_p24_favourites');
    } catch { }
  }, []);

  const [showOnlyFavourites, setShowOnlyFavourites] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importInputText, setImportInputText] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatusMsg, setImportStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const toggleFavouriteProperty = (prop: PropertyMapItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setFavouritePropertyIds((prev) => {
      const isFav = prev.includes(prop.id);
      const updated = isFav ? prev.filter((id) => id !== prop.id) : [...prev, prop.id];
      try {
        localStorage.setItem('homeseek_p24_favourite_ids', JSON.stringify(updated));
      } catch { }
      return updated;
    });

    setImportedFavourites((prev) => {
      const exists = prev.some((p) => p.id === prop.id);
      return exists ? prev.filter((p) => p.id !== prop.id) : prev;
    });
  };

  const clearAllFavourites = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setFavouritePropertyIds([]);
    setImportedFavourites([]);
    setShowOnlyFavourites(false);
    try {
      localStorage.removeItem('homeseek_p24_favourite_ids');
      localStorage.removeItem('homeseek_p24_favourites');
    } catch { }
  };

  const handleImportFavourites = async () => {
    if (!importInputText.trim()) return;
    setIsImporting(true);
    setImportStatusMsg(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/p24/import-favourites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_input: importInputText,
          anchor_lat: activeAnchor?.lat,
          anchor_lng: activeAnchor?.lng,
        }),
      });

      if (!res.ok) {
        throw new Error(`Import failed with status ${res.status}`);
      }

      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.listings) && data.listings.length > 0) {
        const newListings: PropertyMapItem[] = data.listings;

        // Merge with existing imported favourites
        setImportedFavourites((prev) => {
          const merged = [...prev];
          for (const item of newListings) {
            const idx = merged.findIndex((m) => m.id === item.id || ((m as any).p24_id && (m as any).p24_id === (item as any).p24_id));
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...item, is_favorite: true };
            } else {
              merged.push({ ...item, is_favorite: true });
            }
          }
          return merged;
        });

        // Add to favourite IDs
        setFavouritePropertyIds((prev) => {
          const idsSet = new Set(prev);
          newListings.forEach((item) => idsSet.add(item.id));
          const updatedIds = Array.from(idsSet);
          try {
            localStorage.setItem('homeseek_p24_favourite_ids', JSON.stringify(updatedIds));
          } catch { }
          return updatedIds;
        });

        setImportStatusMsg({
          type: 'success',
          text: `Successfully imported ${newListings.length} Property24 favourite${newListings.length === 1 ? '' : 's'}!`,
        });

        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportInputText('');
          setImportStatusMsg(null);
          setShowOnlyFavourites(true);
        }, 1200);
      } else {
        setImportStatusMsg({
          type: 'error',
          text: data.message || 'No Property24 listings could be found or extracted. Please check the URLs or HTML and try again.',
        });
      }
    } catch (err: any) {
      setImportStatusMsg({
        type: 'error',
        text: `Error connecting to scraper: ${err.message}`,
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Area Templates State (Groups of Suburbs)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(DEFAULT_SAVED_SEARCHES);
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<string>('preset-cape-trailside');
  const [isSavedSearchMenuOpen, setIsSavedSearchMenuOpen] = useState(false);
  const [newSearchName, setNewSearchName] = useState('');
  const [isSavingSearch, setIsSavingSearch] = useState(false);

  // Fit & AI Analysis State
  const [enableFitScore, setEnableFitScore] = useState<boolean>(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [personalPreferences, setPersonalPreferences] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('homeseek_personal_preferences');
        if (saved !== null) return saved;
      } catch { }
    }
    return '';
  });
  const [deepAiRunCount, setDeepAiRunCount] = useState<number>(0);
  const [viewingAiReportProp, setViewingAiReportProp] = useState<PropertyMapItem | null>(null);
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null);
  const [uploadedViewingPhotos, setUploadedViewingPhotos] = useState<string[]>([]);
  const [photoSourceMode, setPhotoSourceMode] = useState<'both' | 'uploaded' | 'listing'>('both');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [snagCopied, setSnagCopied] = useState(false);

  useEffect(() => {
    setPlanSummary(getPlanSummary());
    setCompareIds(getCompareList().map((p) => String(p.id)));
    const syncPlan = () => setPlanSummary(getPlanSummary());
    const syncCompare = () => setCompareIds(getCompareList().map((p) => String(p.id)));
    window.addEventListener('homeseek-plan-updated', syncPlan);
    window.addEventListener('homeseek-compare-updated', syncCompare);
    return () => {
      window.removeEventListener('homeseek-plan-updated', syncPlan);
      window.removeEventListener('homeseek-compare-updated', syncCompare);
    };
  }, []);

  const handleUploadViewingPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = Math.max(0, 8 - uploadedViewingPhotos.length);
    const selected = Array.from(files).slice(0, remainingSlots);
    const compressed = await Promise.all(selected.map((f) => compressImageToDataUrl(f, 1024, 0.8)));
    setUploadedViewingPhotos((prev) => [...prev, ...compressed].slice(0, 8));
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isEmailPdfOpen, setIsEmailPdfOpen] = useState(false);
  const [emailPdfTarget, setEmailPdfTarget] = useState('');
  const [isSendingEmailPdf, setIsSendingEmailPdf] = useState(false);
  const [emailPdfStatus, setEmailPdfStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const buildReportPdfPayload = (prop: PropertyMapItem) => {
    const audit = (prop as any).deep_ai_audit || {};
    return {
      id: prop.id,
      title: prop.title,
      address: prop.address,
      price: prop.price,
      bedrooms: prop.bedrooms,
      bathrooms: prop.bathrooms,
      sqm: prop.sqm,
      url: prop.url,
      generated_at: audit.generatedAt || new Date().toLocaleString(),
      verdict: audit.verdict || '',
      photo_story: audit.photoStory || '',
      pros: Array.isArray(audit.pros) ? audit.pros : [],
      cons: Array.isArray(audit.cons) ? audit.cons : [],
      architecture: {
        wfhLayoutVerdict: audit.wfhLayoutVerdict || '',
        windowLightAudit: audit.windowLightAudit || '',
        wallAcousticAudit: audit.wallAcousticAudit || '',
        ceilingVolumeAudit: audit.ceilingVolumeAudit || '',
        lightingFixturesAudit: audit.lightingFixturesAudit || '',
        exteriorBuildingAudit: audit.exteriorBuildingAudit || '',
      },
    };
  };

  const handleDownloadReportPdf = async (prop: PropertyMapItem) => {
    setIsExportingPdf(true);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/reports/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: buildReportPdfPayload(prop) }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homeseek-report-${prop.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleEmailReportPdf = async (prop: PropertyMapItem) => {
    const to = emailPdfTarget.trim();
    if (!to) {
      setEmailPdfStatus({ type: 'err', text: 'Enter an email address.' });
      return;
    }
    setIsSendingEmailPdf(true);
    setEmailPdfStatus(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/reports/email-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_email: to, report: buildReportPdfPayload(prop) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailPdfStatus({ type: 'err', text: data?.detail || 'Failed to send PDF.' });
        return;
      }
      setEmailPdfStatus({ type: 'ok', text: `Sent PDF to ${to}` });
    } catch {
      setEmailPdfStatus({ type: 'err', text: 'Network error sending PDF.' });
    } finally {
      setIsSendingEmailPdf(false);
    }
  };

  const handleCopySnagReport = async (prop: PropertyMapItem) => {
    const audit = (prop as any).deep_ai_audit;
    if (!audit) return;
    const lines = [
      `# Home-Seek Viewing & Snagging Report`,
      `**Property:** ${prop.title} (${prop.address})`,
      `**Rent:** R ${prop.price.toLocaleString()}/mo | ${prop.bedrooms} bed | ${prop.sqm ? `${prop.sqm} m²` : 'N/A'}`,
      `**Generated:** ${audit.generatedAt || new Date().toLocaleString()}`,
      `**Lifestyle Brief:** ${audit.appliedPreferences || personalPreferences || 'Standard'}`,
      ``,
      `## Verdict`,
      audit.personalMatchVerdict || '',
      ``,
      `## Photo Story`,
      audit.photoStory || '',
      ``,
      `## Architectural & WFH Audit`,
      `- Space & WFH: ${audit.wfhLayoutVerdict || ''}`,
      `- Windows & Light: ${audit.windowLightAudit || ''}`,
      `- Walls & Acoustics: ${audit.wallAcousticAudit || ''}`,
      `- Ceilings & Volume: ${audit.ceilingVolumeAudit || ''}`,
      `- Lighting Fixtures: ${audit.lightingFixturesAudit || ''}`,
      `- Exterior & Building: ${audit.exteriorBuildingAudit || ''}`,
      ``,
      `## Pros`,
      ...(audit.pros || []).map((p: string) => `- [+] ${p}`),
      ``,
      `## Cons & Risks`,
      ...(audit.cons || []).map((c: string) => `- [-] ${c}`),
      ``,
      `## Things to Be Aware Of`,
      ...((audit.strategicInsights?.criticalWatchouts || []) as string[]).map((w: string) => `- [!] ${w}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setSnagCopied(true);
      setTimeout(() => setSnagCopied(false), 2500);
    } catch { }
  };

  // Sync preference changes to localStorage and re-evaluate active property report in real-time
  const handleUpdatePreferences = (newPrefs: string) => {
    setPersonalPreferences(newPrefs);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('homeseek_personal_preferences', newPrefs);
      } catch { }
    }
    if (viewingAiReportProp) {
      const updatedAudit = generatePropertyAiAudit(viewingAiReportProp, viewingAiReportProp.rank || 1, newPrefs);
      setViewingAiReportProp({
        ...viewingAiReportProp,
        deep_ai_audit: updatedAudit
      });
    }
  };

  // Helper to synthesize forensic AI audit for any property on demand
  const generatePropertyAiAudit = (prop: PropertyMapItem, rank: number, userPreferences?: string, galleryOverride?: string[]) => {
    const isSanctuary = prop.noise_risk === 'sanctuary';
    const isNorth =
      (prop.acoustic_audit?.facing_direction || '').toLowerCase().includes('north') ||
      /\bnorth[\s-]?facing\b/i.test(`${prop.title || ''} ${prop.description || ''}`);
    const stoveLabel = prop.stove_type === 'gas' ? 'Verified 4-burner gas hob & built-in oven' : prop.stove_type === 'induction' ? 'Induction hob detected' : 'Built-in stove & oven verified';
    const parkingLabel = prop.has_garage ? 'Private lock-up automated garage' : (prop.parking_type === 'secure_bay' ? 'Allocated secure off-street parking bay' : 'Dedicated off-street parking');
    const facingLabel = isNorth ? 'North-facing orientation: maximum sun exposure throughout living room and workspace' : `${prop.acoustic_audit?.facing_direction || 'Standard aspect'} with balanced natural lighting`;

    // Detect landlord on-site / cottage / possible shared erf on property
    const privacyInfo = getDwellingPrivacyInfo(prop);
    const isLandlordOnSite = privacyInfo.isLandlordOnSite;
    const isPossibleShared = Boolean(privacyInfo.isPossibleSharedProperty);

    // Detect if property sits directly on noisy main road arterial corridor
    const isMainRoad = Boolean(prop.is_main_road) || isMainRoadProperty(prop.address, prop.title);

    const tenancyType = isLandlordOnSite
      ? '⚠️ Shared Property / Landlord On-Site: Listing text confirms a cottage, flatlet, or secondary dwelling on a shared landlord property.'
      : isPossibleShared
        ? '🔍 Verify Privacy / Possible Shared Erf: Single-house street address with a studio/1-bed layout (no unit/block number; often attached to a main house with a shared driveway or shared Wi-Fi).'
        : isMainRoad
          ? '⚠️ Arterial Road Lease: Standalone tenancy but situated directly on a high-traffic Main Road arterial.'
          : '✅ 100% Autonomous Private Tenancy: Standalone property with complete perimeter independence (zero shared grounds or landlord residing on-site).';

    const photoAudit = isSanctuary
      ? `📸 AI Vision: ${stoveLabel}, ${isNorth ? 'north-facing floor-to-ceiling glazing' : 'large windows with natural daylight'}, scenic mountain/coastal backdrop, zero fish-eye lens distortion.`
      : `📸 AI Vision: ${stoveLabel}, natural daylight verified with true-perspective 28mm equivalent framing.`;

    const textVerdict = isMainRoad
      ? `🧠 AI Copy Audit #${rank}: ⚠️ Main Road Arterial Traffic Corridor. High ambient traffic rumble (M4), delivery scooter buzzing & elevated street-level exposure.`
      : isLandlordOnSite
        ? `🧠 AI Copy Audit #${rank}: Secondary dwelling / cottage on private landlord property detected. Potential shared entrance or grounds.`
        : isPossibleShared
          ? `🧠 AI Copy Audit #${rank}: Possible attached dwelling or shared driveway — single-erf street address with studio/1-bed layout and no apartment block/unit number; verify at viewing.`
          : `🧠 AI Copy Audit #${rank}: Explicit self-contained private lease (zero student digs or shared commune clauses), rules confirm quiet residential tenancy.`;

    const prefs = userPreferences && userPreferences.trim().length > 0 ? userPreferences.trim() : '';
    const privacyMatchPhrase = prefs.toLowerCase().includes('private') || prefs.toLowerCase().includes('landlord')
      ? (isLandlordOnSite
        ? '⚠️ Flagged: Not fully private (landlord on-site / shared grounds)'
        : isPossibleShared
          ? '🔍 Verify privacy: possible attached unit / shared driveway'
          : '🛡️ 100% Private Standalone confirmed')
      : null;

    const mainRoadWarning = isMainRoad ? '⚠️ Main Road traffic trap' : null;

    const verdictParts = [
      mainRoadWarning,
      privacyMatchPhrase || (isLandlordOnSite ? 'Secondary cottage / shared grounds' : 'Private standalone residence'),
      isSanctuary ? 'Quiet sanctuary verified' : isMainRoad ? 'Arterial street noise' : 'Standard residential acoustic buffer',
      isNorth ? 'North-facing natural light' : 'Balanced lighting',
      prop.fibre_ready ? 'High-speed fibre ready' : 'Standard internet',
      stoveLabel,
    ].filter(Boolean);

    const personalMatchVerdict = `${verdictParts.join(' · ')}.`;

    const buildForensicProsAndCons = () => {
      const pros: string[] = [];
      const cons: string[] = [];
      const rawText = `${prop.title || ''} ${prop.address || ''} ${prop.description || ''} ${prop.ai_insight || ''}`.toLowerCase();
      const galleryPhotos =
        galleryOverride && galleryOverride.length > 0
          ? galleryOverride
          : cardGalleries[prop.id]?.length
            ? cardGalleries[prop.id]
            : Array.isArray(prop.images) && prop.images.length > 0
              ? prop.images
              : prop.image
                ? [prop.image]
                : [];
      const photoCount = galleryPhotos.length;

      // Market valuation (risk-adjusted for crime/township proximity, main road, landlord on-site, parking & m²)
      const marketVal = getRiskAdjustedValuation(prop, allCandidateProperties);
      if (marketVal) {
        if (marketVal.isUnderpriced) {
          pros.push(`Strong market value: ${marketVal.badgeText} (${marketVal.badgeTooltip})`);
        } else if (marketVal.isOverpriced) {
          cons.push(`Above market rate: ${marketVal.badgeText} (${marketVal.badgeTooltip})`);
        } else {
          pros.push(`Fairly priced relative to comparable ${prop.bedrooms}-bed listings in the area`);
        }
      }

      if (isPossibleShared) {
        cons.push('Possible attached unit / shared driveway: single-erf street address with studio/1-bed layout (and/or included Wi-Fi) — verify whether entrance, driveway, and yard are shared with a main house.');
      }

      // Photo / visual inspection: only flag when coverage is suspiciously sparse (having photos is baseline)
      if (photoCount > 0 && photoCount <= 2) {
        cons.push(`Limited photo coverage (${photoCount} ${photoCount === 1 ? 'image' : 'images'}) — key rooms or exterior may be unshown`);
      }

      if (isNorth) {
        pros.push('North-facing orientation with strong natural daylight');
      }
      if (/ocean|sea view|mountain view|scenic|sunny|bright|airy/.test(rawText)) {
        pros.push('Bright interior / scenic outlook noted in listing & imagery');
      }

      // Work & Lifestyle Factors Alignment
      const prefLower = (userPreferences || '').toLowerCase();
      const wantsWfhFull = prefLower.includes('work from home (full-time)') || (prefLower.includes('full-time') && prefLower.includes('wfh'));
      const wantsWfhPart = prefLower.includes('work from home (part-time)') || (prefLower.includes('part-time') && prefLower.includes('wfh'));
      const wantsCafes = prefLower.includes('work from cafes') || prefLower.includes('cafes');
      const wantsOffice = prefLower.includes('work from an office') || prefLower.includes('office');
      const wantsQuietSanctuary = prefLower.includes('quiet sanctuary') || prefLower.includes('noise sensitive');
      const wantsSecurityEstate = prefLower.includes('secure estate') || prefLower.includes('24h security') || prefLower.includes('gated');
      const wantsOutdoorBalcony = prefLower.includes('private patio') || prefLower.includes('balcony') || prefLower.includes('outdoor');
      const wantsBackupPower = prefLower.includes('backup power') || prefLower.includes('load-shedding') || prefLower.includes('solar') || prefLower.includes('inverter');
      const wantsGasStove = prefLower.includes('gas cooking') || prefLower.includes('gas stove');
      const wantsPetFriendly = prefLower.includes('pet-friendly') || prefLower.includes('dog');
      const wantsLockupGarage = prefLower.includes('lock-up garage') || prefLower.includes('garage');

      if (wantsWfhFull) {
        if (prop.fibre_ready && isSanctuary && (prop.sqm ? prop.sqm >= 60 : true)) {
          pros.push('WFH Full-Time Prime Fit: high-speed fibre + quiet acoustic setback + ample workspace room');
        } else if (!prop.fibre_ready) {
          cons.push('WFH Full-Time Risk: listing does not verify fibre readiness for uninterrupted remote work');
        }
        if (isMainRoad) {
          cons.push('WFH Conflict: main road daytime traffic roar directly interferes with remote Zoom / client calls');
        }
      }

      if (wantsWfhPart) {
        if (prop.fibre_ready) {
          pros.push('Hybrid WFH Verified: stable fibre connectivity in place for remote days');
        }
      }

      if (wantsCafes) {
        const cafeAnchors = PRESET_TRAILHEADS_AND_HUBS.filter(
          (loc) => loc.iconType === 'cafe' || loc.category === 'cafe'
        );
        let nearestCafe: { name: string; distance_km: number } | null = null;
        if (prop.lat && prop.lng) {
          for (const c of cafeAnchors) {
            const d = getDistanceKm(prop.lat, prop.lng, c.lat, c.lng);
            if (!nearestCafe || d < nearestCafe.distance_km) {
              nearestCafe = { name: c.label, distance_km: Number(d.toFixed(1)) };
            }
          }
        }
        if (!nearestCafe) {
          const prox = (prop.location_proximity || []).find((loc: any) =>
            String(loc.name || loc.category || '').toLowerCase().includes('cafe') ||
            String(loc.name || loc.category || '').toLowerCase().includes('coffee')
          );
          if (prox) {
            nearestCafe = { name: prox.name || 'local coffee spots', distance_km: Number(prox.distance_km || 1.0) };
          }
        }

        if (nearestCafe && nearestCafe.distance_km <= 1.8) {
          pros.push(`Cafe Work Hub: walkable to ${nearestCafe.name} (${nearestCafe.distance_km} km)`);
        } else if (nearestCafe && nearestCafe.distance_km <= 3.5) {
          pros.push(`Cafe Access: short trip to ${nearestCafe.name} (${nearestCafe.distance_km} km)`);
        } else {
          cons.push('Work from Cafes Note: limited walkable laptop-friendly coffee shops detected in immediate perimeter');
        }
      }

      if (wantsOffice && activeAnchor) {
        const distKm = getDistanceKm(prop.lat, prop.lng, activeAnchor.lat, activeAnchor.lng);
        if (distKm <= 4.0) {
          pros.push(`Office Commute Champion: only ~${distKm.toFixed(1)} km from ${activeAnchor.label}`);
        } else if (distKm > 10.0) {
          cons.push(`Extended Office Commute: ~${distKm.toFixed(1)} km to ${activeAnchor.label} (${Math.round((distKm / 35) * 60)} mins peak traffic)`);
        }
      }

      if (wantsBackupPower) {
        if (prop.has_inverter || /solar|inverter|backup|battery/.test(rawText)) {
          pros.push('Load-Shedding Resilient: inverter / solar battery power verified');
        } else {
          cons.push('Load-Shedding Vulnerability: zero inverter or solar backup mentioned in listing');
        }
      }

      if (wantsSecurityEstate) {
        if (/estate|security complex|gated|24 hour security|access control|guard/.test(rawText)) {
          pros.push('Security Estate: access-controlled gated perimeter with guarded security');
        } else {
          cons.push('Security Note: standalone perimeter without 24/7 manned security estate gate');
        }
      }

      if (wantsLockupGarage && !prop.has_garage) {
        cons.push('Parking Variance: no automated lock-up garage confirmed (only open bay or street parking)');
      }

      if (wantsGasStove && prop.stove_type !== 'gas') {
        cons.push('Kitchen Cooking Note: standard electric hob fitted (no gas cooktop for power outages)');
      }

      if (wantsPetFriendly && !prop.pet_friendly) {
        cons.push('Pet Restriction: listing does not explicitly approve pets / dogs');
      }

      if (wantsOutdoorBalcony && !/balcony|patio|garden|terrace|braai/.test(rawText)) {
        cons.push('Outdoor Living Note: no private patio, balcony or garden noted in listing');
      }

      // Space & amenities
      if (prop.sqm && prop.sqm >= 75) {
        pros.push(`Spacious ${prop.sqm} m² floor plan`);
      } else if (prop.sqm && prop.sqm < 45) {
        cons.push(`Compact ${prop.sqm} m² footprint — limited storage & living area`);
      }

      if (prop.has_garage) {
        pros.push('Private lock-up garage included');
      } else if (prop.parking_type && prop.parking_type !== 'none') {
        pros.push('Dedicated off-street parking');
      } else if (/street parking|no parking/.test(rawText)) {
        cons.push('No dedicated off-street parking confirmed');
      }

      if (prop.fibre_ready) pros.push('Fibre internet ready');
      if (prop.stove_type === 'gas') pros.push('Gas hob (load-shedding resilient cooking)');
      if (prop.pet_friendly) pros.push('Pet-friendly lease');
      if (/no pets|not pet friendly/.test(rawText)) cons.push('No pets permitted');
      if (/solar|inverter|backup power|battery/.test(rawText)) pros.push('Backup power / solar / inverter mentioned');
      if (/balcony|patio|garden|terrace|braai|courtyard/.test(rawText)) pros.push('Private outdoor space (patio / balcony / garden)');
      if (/all-inclusive|water included|utilities included/.test(rawText)) pros.push('Utilities / water included in rent');
      if (/furnished/.test(rawText) && !/unfurnished/.test(rawText)) pros.push('Furnished & move-in ready');

      // Tenancy, acoustic, crime, address & agency risks
      if (isLandlordOnSite) {
        cons.push('Landlord on-site / shared property (cottage or flatlet may share entrance or yard)');
      } else {
        pros.push('Autonomous private residence with independent access');
      }

      if (isMissingAddressListing(prop)) {
        cons.push(`Street address withheld ("${prop.address}") — exact street security & immediate neighbours unverified`);
      }

      if (isSanctuary) {
        pros.push(`Quiet acoustic sanctuary (~${prop.acoustic_audit?.estimated_db || 38} dBA)`);
      }

      const busyRoad = getPropertyBusyRoadExposure(prop);
      if (isMainRoad || busyRoad.isNearBusyRoad) {
        cons.push(`${busyRoad.badgeLabel || 'Main road arterial exposure'} — higher traffic & scooter noise`);
      }

      const barNoise = getPropertyBarNoiseExposure(prop);
      if (barNoise.isExposed) {
        cons.push(`${barNoise.badgeLabel || 'Near late-night bar / nightlife corridor'}`);
      }

      if (isPropertyInHighRiskCrimeZone(prop.lat, prop.lng)) {
        cons.push('Near a flagged high-risk crime zone — verify perimeter security or estate access control');
      }

      const rep = getAgencyReputationInfo(prop);
      if (rep.isPoorAgency) {
        cons.push(`Agency risk flag: ${rep.badgeLabel}`);
      }

      if (/prepaid electricity|pre-paid/.test(rawText)) {
        cons.push('Prepaid electricity (verify municipal tariff / meter setup)');
      }
      if (/single.*only|one person only|single professional/.test(rawText)) {
        cons.push('Single-occupant restriction stated in listing');
      }

      if (cons.length === 0) {
        cons.push('No major red flags detected — confirm lease terms & meter readings during viewing');
      }

      return { pros: pros.slice(0, 8), cons: cons.slice(0, 8) };
    };

    const { pros, cons } = buildForensicProsAndCons();

    const buildStrategicInsights = () => {
      const reasonsToRent: string[] = [];
      const reasonsToAvoid: string[] = [];
      const criticalWatchouts: string[] = [];

      const rawText = `${prop.title || ''} ${prop.address || ''} ${prop.description || ''} ${prop.ai_insight || ''}`.toLowerCase();
      const marketVal = getRiskAdjustedValuation(prop, allCandidateProperties);
      const busyRoad = getPropertyBusyRoadExposure(prop);
      const barNoise = getPropertyBarNoiseExposure(prop);
      const rep = getAgencyReputationInfo(prop);
      const inCrimeZone = isPropertyInHighRiskCrimeZone(prop.lat, prop.lng);
      const missingAddr = isMissingAddressListing(prop);
      const effectivePrefs = (userPreferences !== undefined ? userPreferences : personalPreferences).toLowerCase();

      // 1. What makes it a good fit
      if (marketVal && marketVal.isUnderpriced) {
        reasonsToRent.push(`High Value: Priced ${marketVal.badgeText} compared to suburb medians.`);
      }
      if (isSanctuary) {
        reasonsToRent.push('Acoustic Sanctuary: Low-decibel residential pocket shielded from Cape Town arterial transit corridors.');
      }
      if (!isLandlordOnSite) {
        reasonsToRent.push('Complete Autonomy: 100% private standalone dwelling with independent entrance and no landlord on-site.');
      }
      if (prop.fibre_ready) {
        reasonsToRent.push('Remote Work Ready: High-speed fibre installed and confirmed, ideal for remote work and video conferencing.');
      }
      if (prop.has_garage) {
        reasonsToRent.push('Lock-Up Garaging: Secure automated garage protecting vehicle from weather, salt air, and street opportunism.');
      } else if (prop.has_secure_bay) {
        reasonsToRent.push('Dedicated Parking: Off-street secure bay inside access-controlled gates.');
      }
      if (prop.stove_type === 'gas') {
        reasonsToRent.push('Load-Shedding Resilient: 4-burner gas hob allows reliable cooking during power outages.');
      }
      if (/solar|inverter|battery|backup power/.test(rawText)) {
        reasonsToRent.push('Power Backup: On-site inverter or solar system keeps Wi-Fi and core lights online during outages.');
      }
      if (isNorth) {
        reasonsToRent.push('Optimal Orientation: North-facing aspect captures warm winter sunlight and natural illumination.');
      }
      if (effectivePrefs.includes('work from cafes')) {
        reasonsToRent.push(`Cafe Access: Walking distance to local coffee shops and amenities in ${prop.suburb || 'the area'}.`);
      }
      if (effectivePrefs.includes('work from an office')) {
        reasonsToRent.push('Commute Ready: Convenient arterial access for traveling to business centers.');
      }
      if (reasonsToRent.length === 0) {
        reasonsToRent.push('Clean baseline rental meeting core suburb, sizing, and pricing criteria.');
      }

      // 2. What makes it a bad fit
      if (marketVal && marketVal.isOverpriced) {
        reasonsToAvoid.push(`Price Premium: Priced ${marketVal.badgeText} above comparable properties in the immediate area.`);
      }
      if (isMainRoad || busyRoad.isNearBusyRoad) {
        reasonsToAvoid.push(`Arterial Noise Exposure: Direct frontage on ${busyRoad.badgeLabel || 'heavy traffic'} (elevated engine rumble and delivery transit).`);
      }
      if (barNoise.isExposed) {
        reasonsToAvoid.push(`Nightlife Sound Leakage: Adjacent to nightlife corridor (${barNoise.badgeLabel || 'bars and restaurants'}) with weekend noise.`);
      }
      if (isLandlordOnSite) {
        reasonsToAvoid.push('Shared Grounds: Secondary dwelling/cottage on landlord property with shared driveway and reduced perimeter autonomy.');
      }
      if (inCrimeZone) {
        reasonsToAvoid.push('Elevated Area Crime Profile: Situated in or near a designated municipal crime hotspot with opportunistic risk.');
      }
      if (!prop.has_garage && !prop.has_secure_bay) {
        reasonsToAvoid.push('No Dedicated Off-Street Parking: Dependent on kerbside street parking with vehicle exposure.');
      }
      if (effectivePrefs.includes('work from home') && (isMainRoad || busyRoad.isNearBusyRoad)) {
        reasonsToAvoid.push('WFH Disruption Risk: Daytime roadside traffic decibels may interfere with focused work or video calls.');
      }
      if (reasonsToAvoid.length === 0) {
        reasonsToAvoid.push('No critical dealbreakers or disqualifying red flags detected.');
      }

      // 3. Things to be aware of (Tenant Vigilance Checklist)
      if (missingAddr) {
        criticalWatchouts.push('Withheld Street Address: Exact street number is obscured by agent. Request pin or drive past to inspect gradient and immediate neighbours.');
      }
      if (/prepaid|pre-paid/.test(rawText)) {
        criticalWatchouts.push('Prepaid Electricity Meter: Check tariff band and ask previous tenant or landlord for average monthly electricity expenditure.');
      }
      if (rep.isPoorAgency) {
        criticalWatchouts.push(`Managing Agency Scrutiny: ${rep.badgeLabel}. Verify lease terms and ensure damage deposit is held in a statutory interest-bearing trust account.`);
      }
      const crimePerimeter = getCrimePerimeterInfo(prop);
      if ((inCrimeZone || crimePerimeter.isNearHighRisk) && !crimePerimeter.hasEstateSecurity) {
        criticalWatchouts.push(
          `Perimeter Security Check (${crimePerimeter.hotspotName || 'High-Risk Fringe'}): No 24h estate security detected — verify burglar bars, electric fencing, alarm sensors, and nighttime street lighting.`
        );
      }
      if (/single.*only|one person only/.test(rawText)) {
        criticalWatchouts.push('Occupancy Limitation: Listing specifies single professional occupancy only (no couples or frequent overnight guests).');
      }
      criticalWatchouts.push('Utilities Split: Confirm in writing whether water, refuse, sewerage, and Wi-Fi are included or invoiced separately.');
      if (!prop.pet_friendly && effectivePrefs.includes('pet')) {
        criticalWatchouts.push('Pet Policy: Listing does not specify pet allowance; written landlord consent is mandatory prior to signing.');
      }

      return {
        reasonsToRent: reasonsToRent.slice(0, 4),
        reasonsToAvoid: reasonsToAvoid.slice(0, 4),
        criticalWatchouts: criticalWatchouts.slice(0, 4),
      };
    };

    const strategicInsights = buildStrategicInsights();

    const buildArchitecturalForensics = () => {
      const rawText = `${prop.title || ''} ${prop.address || ''} ${prop.description || ''}`.toLowerCase();
      const prefsLower = (userPreferences !== undefined ? userPreferences : personalPreferences).toLowerCase();
      const isWfhFull = prefsLower.includes('work from home (full-time)') || prefsLower.includes('full-time');
      const isWfhAny = prefsLower.includes('work from home') || prefsLower.includes('remote');
      const isStudio = (prop.bedrooms !== undefined && prop.bedrooms <= 0.5) || /\b(studio|bachelor|0\.5\s*bed|loft)\b/i.test(rawText);
      const sqm = prop.sqm || 0;
      const hasOutdoor = /\b(balcony|patio|deck|terrace|sliding door)\b/i.test(rawText);

      const hasStudy = /\b(study|office|workstation|desk|nook|2nd bed|second bed)\b/i.test(rawText);
      let wfhLayoutVerdict = '1-bed layout (m² unconfirmed) — verify lounge or bedroom wall clearance for a proper desk and chair, as smaller 1-beds often force laptops onto kitchen counters.';
      if (isStudio) {
        const sizeNote = sqm ? `(${sqm} m²) ` : '';
        if (isWfhFull) {
          wfhLayoutVerdict = `0.5-bed / studio footprint ${sizeNote}poses full-time WFH friction: no acoustic door separating your desk from fridge/kitchen hum, and bed may appear on video calls unless zoned.`;
        } else if (isWfhAny) {
          wfhLayoutVerdict = `0.5-bed / studio layout ${sizeNote}works well for part-time WFH / café hybrid if a compact desk fits near natural light; watch for appliance hum in one room.`;
        } else {
          wfhLayoutVerdict = `Open-plan 0.5-bed / studio ${sizeNote}maximizes usable floor area without corridor waste; verify storage and dining/desk zoning.`;
        }
      } else if (prop.bedrooms === 1 && sqm && sqm <= 42) {
        wfhLayoutVerdict = `Tight ${sqm} m² 1-bed footprint — living/kitchen area likely lacks room for a full ergonomic desk; expect to place a compact desk in the bedroom or work from a dining counter.`;
      } else if (prop.bedrooms === 1 && sqm && sqm <= 56) {
        wfhLayoutVerdict = `Compact ${sqm} m² 1-bed layout — separate bedroom door helps for calls, though a dedicated desk in the lounge may compete with sofa/dining space; check plug points & chair clearance.`;
      } else if (prop.bedrooms >= 2 || hasStudy || (sqm && sqm >= 65)) {
        wfhLayoutVerdict = `Generous ${sqm ? `${sqm} m² ` : ''}layout with clear separation between sleeping and work zones — easy to fit a proper ergonomic desk setup away from kitchen noise.`;
      }

      let windowLightAudit = hasOutdoor
        ? 'Balcony/sliding doors support cross-ventilation and daylight; verify windows do not face a close boundary wall (<3 m).'
        : 'Single-aspect windows may limit cross-breeze; confirm sightlines during viewing so blinds are not kept shut all day.';
      if (isNorth) {
        windowLightAudit = `North-facing aspect (Cape Town gold standard for winter sun & low damp risk). ${hasOutdoor ? 'Balcony doors aid cross-ventilation.' : 'Check window-to-wall ratio for airflow.'}`;
      } else if (/\bwest[\s-]?facing\b/i.test(rawText)) {
        windowLightAudit = 'West-facing exposure delivers warm afternoon sun but risks harsh late-afternoon screen glare during WFH calls; check blinds.';
      } else if (/\bsouth[\s-]?facing\b/i.test(rawText)) {
        windowLightAudit = 'South-facing aspect gets indirect light and runs cooler in winter — inspect window frames and curtains for damp/condensation.';
      }

      let wallAcousticAudit = 'Standard masonry/sectional title build; check party-wall thickness, upstairs footfall, and add a rug/curtains if rooms are all-tile to cut Zoom echo.';
      if (/\b(art deco|parquet|heritage|solid brick)\b/i.test(rawText)) {
        wallAcousticAudit = 'Heritage / solid brick build typically blocks airborne neighbour voices well; if parquet floors exist, check upstairs footfall transmission.';
      } else if (/\b(new development|modern block|micro|newly built)\b/i.test(rawText)) {
        wallAcousticAudit = 'Modern infill build: check whether internal partitions are hollow drywall (higher voice/TV bleed) and note hard-tile echo on video calls.';
      }

      let ceilingVolumeAudit = 'Standard ~2.4 m–2.6 m ceiling height inferred; watch for 0.5x ultra-wide camera lens stretching in listing photos.';
      if (/\b(high ceiling|double volume|victorian|art deco)\b/i.test(rawText)) {
        ceilingVolumeAudit = 'High ceilings (~2.8 m–3.2 m+) improve airiness, daylight reach, and call acoustics; verify true room width beyond wide-angle photos.';
      } else if (/\b(cottage|garden flat|basement|attic)\b/i.test(rawText)) {
        ceilingVolumeAudit = 'Cottage/ancillary structure: verify ceiling height (≥2.4 m) and bulkhead clearances in person, as low ceilings feel tight for full-time WFH.';
      }

      const lightingFixturesAudit = /\b(downlight|recessed|led|renovated|modern)\b/i.test(rawText)
        ? 'Likely fitted with recessed downlights/layered fixtures; check color temperature (warm 2700K–3000K vs harsh 5000K) and inverter-tied bulbs.'
        : 'Confirm rooms do not rely solely on a single central overhead bulb (causes evening eye strain/glare) and check bathroom ventilation.';

      const exteriorBuildingAudit = /\b(estate|24 hour|concierge|access control|electric fence)\b/i.test(rawText)
        ? 'Managed security perimeter signalled; check façade paint/rust streaks and bin-area neatness as a proxy for Body Corporate reserve health.'
        : 'Inspect exterior façade for peeling paint, rust/water streaks under balconies, and working gate motors/electric fencing — key clues to Body Corporate health.';

      return {
        wfhLayoutVerdict,
        windowLightAudit,
        wallAcousticAudit,
        ceilingVolumeAudit,
        lightingFixturesAudit,
        exteriorBuildingAudit,
      };
    };

    const archForensics = buildArchitecturalForensics();

    return {
      rank,
      photoAudit,
      textVerdict,
      personalMatchVerdict,
      pros,
      cons,
      strategicInsights,
      ...archForensics,
      facingAudit: facingLabel,
      amenitiesVerdict: `${prop.fibre_ready ? 'High-speed fibre ready' : 'Standard connectivity'}. ${parkingLabel}. ${prop.pet_friendly ? 'Pet-friendly lease confirmed' : 'Standard lease'}.`,
      stoveType: stoveLabel,
      glazing: isNorth ? 'North-facing floor-to-ceiling glazing with scenic mountain/coastal buffer' : 'Ample daylight through wide exterior windows',
      plumbing: 'Dedicated washing machine and dishwasher plumbing connection points verified',
      distortion: 'Standard focal length (28mm equivalent); zero fish-eye lens distortion or artificial stretching',
      tenancyType,
      quietRules: isMainRoad
        ? '⚠️ Arterial corridor traffic trap (68–74 dB ambient daytime peak). Heavy taxi & delivery vehicle noise.'
        : 'Formal residential tenancy agreement prohibiting noise disturbances or disruptive short-lets',
      isLandlordOnSite,
      isMainRoad,
    };
  };

  const runForensicAiInspection = async (propToInspect: PropertyMapItem) => {
    let fullGallery =
      cardGalleries[propToInspect.id]?.length
        ? cardGalleries[propToInspect.id]
        : Array.isArray(propToInspect.images) && propToInspect.images.length > 0
          ? propToInspect.images
          : propToInspect.image
            ? [propToInspect.image]
            : [];

    setViewingAiReportProp((prev) =>
      prev && prev.id === propToInspect.id
        ? { ...prev, deep_ai_audit: { ...(prev as any).deep_ai_audit, isVisionLoading: true } }
        : prev
    );

    let updatedProp: PropertyMapItem = { ...propToInspect, images: fullGallery };
    if (fullGallery.length <= 1 && propToInspect.url) {
      const galleryRes = await fetchCardGallery(propToInspect.id, propToInspect.url);
      if (galleryRes && galleryRes.photos.length > 0) {
        fullGallery = galleryRes.photos;
        const f = galleryRes.features || {};
        updatedProp = {
          ...updatedProp,
          images: fullGallery,
          description: f.description || updatedProp.description,
          has_garage: Boolean(updatedProp.has_garage || f.has_garage),
          has_secure_bay: Boolean(updatedProp.has_secure_bay || f.has_secure_bay),
          parking_type: f.has_garage || updatedProp.has_garage ? 'garage' : f.has_secure_bay || updatedProp.has_secure_bay ? 'secure_bay' : updatedProp.parking_type,
          stove_type: f.stove_type || updatedProp.stove_type,
          has_inverter: Boolean(updatedProp.has_inverter || f.has_inverter),
          pet_friendly: f.pet_friendly !== null && f.pet_friendly !== undefined ? Boolean(updatedProp.pet_friendly || f.pet_friendly) : updatedProp.pet_friendly,
        };
      }
    }

    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const visionRes = await fetch(`${backendBase}/api/listing/forensic-vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updatedProp.id,
          url: updatedProp.url || '',
          title: updatedProp.title || '',
          address: updatedProp.address || '',
          price: updatedProp.price || 0,
          bedrooms: updatedProp.bedrooms || 1,
          bathrooms: updatedProp.bathrooms || 1,
          sqm: updatedProp.sqm || null,
          description: updatedProp.description || updatedProp.ai_insight || '',
          images: fullGallery,
          uploaded_images: uploadedViewingPhotos,
          photo_source_mode: photoSourceMode,
          personal_preferences: personalPreferences || '',
        }),
      });
      if (visionRes.ok) {
        consumeAuditCredit();
        const visionData = await visionRes.json();
        const v = visionData?.vision;
        if (v) {
          const resolvedStove = (v.stove_type && v.stove_type !== 'unknown') ? v.stove_type : updatedProp.stove_type;
          updatedProp = { ...updatedProp, stove_type: resolvedStove };
          setProperties((prev) =>
            prev.map((p) =>
              p.id === propToInspect.id
                ? {
                  ...p,
                  stove_type: resolvedStove || p.stove_type,
                  images: fullGallery.length > 0 ? fullGallery : p.images,
                  has_garage: updatedProp.has_garage,
                  has_secure_bay: updatedProp.has_secure_bay,
                  parking_type: updatedProp.parking_type,
                  has_inverter: updatedProp.has_inverter,
                  pet_friendly: updatedProp.pet_friendly,
                }
                : p
            )
          );
          const baseAudit = generatePropertyAiAudit(updatedProp, propToInspect.rank || 1, personalPreferences, fullGallery);
          const mergedPros = Array.from(new Set([...(Array.isArray(v.photo_pros) ? v.photo_pros : []), ...(baseAudit.pros || [])])).slice(0, 9);
          const mergedCons = Array.from(new Set([...(Array.isArray(v.photo_cons) ? v.photo_cons : []), ...(baseAudit.cons || [])])).slice(0, 9);
          setViewingAiReportProp((prev) =>
            prev && prev.id === propToInspect.id
              ? {
                ...updatedProp,
                deep_ai_audit: {
                  ...baseAudit,
                  pros: mergedPros,
                  cons: mergedCons,
                  photoStory: v.photo_story || '',
                  inspectedPhotoCount: v.inspected_photo_count || fullGallery.length,
                  glazing: v.glazing || baseAudit.glazing,
                  distortion: v.distortion || baseAudit.distortion,
                  wfhLayoutVerdict: v.wfh_layout_verdict || baseAudit.wfhLayoutVerdict,
                  windowLightAudit: v.window_light_audit || baseAudit.windowLightAudit,
                  wallAcousticAudit: v.wall_acoustic_audit || baseAudit.wallAcousticAudit,
                  ceilingVolumeAudit: v.ceiling_volume_audit || baseAudit.ceilingVolumeAudit,
                  lightingFixturesAudit: v.lighting_fixtures_audit || baseAudit.lightingFixturesAudit,
                  exteriorBuildingAudit: v.exterior_building_audit || baseAudit.exteriorBuildingAudit,
                  buildingIntel: v.building_intel || null,
                  stoveType:
                    v.stove_type && v.stove_type !== 'unknown'
                      ? `${v.stove_type.charAt(0).toUpperCase() + v.stove_type.slice(1)} hob/stove observed in kitchen photo`
                      : baseAudit.stoveType,
                  isVisionFallback: Boolean(v.is_fallback),
                  fallbackReason: v.fallback_reason || null,
                  isVisionLoading: false,
                  hasAiRun: true,
                  generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  appliedPreferences: personalPreferences.trim() || 'Standard optimal rental baseline',
                },
              }
              : prev
          );
          return;
        }
      }
    } catch {
      // Non-fatal; fallback to deterministic audit
    }

    setViewingAiReportProp((prev) =>
      prev && prev.id === propToInspect.id
        ? {
          ...prev,
          deep_ai_audit: {
            ...(prev as any).deep_ai_audit,
            isVisionLoading: false,
            hasAiRun: true,
            generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            appliedPreferences: personalPreferences.trim() || 'Standard optimal rental baseline',
          },
        }
        : prev
    );
  };

  const handleTogglePropertyAiReport = (prop: PropertyMapItem) => {
    if (viewingAiReportProp?.id === prop.id) {
      setViewingAiReportProp(null);
      return;
    }

    const fullGallery =
      cardGalleries[prop.id]?.length
        ? cardGalleries[prop.id]
        : Array.isArray(prop.images) && prop.images.length > 0
          ? prop.images
          : prop.image
            ? [prop.image]
            : [];

    const initialAudit = generatePropertyAiAudit(prop, prop.rank || 1, personalPreferences, fullGallery);
    setViewingAiReportProp({
      ...prop,
      images: fullGallery,
      deep_ai_audit: { ...initialAudit, isVisionLoading: false, hasAiRun: false },
    });
    setSelectedPropertyId(prop.id);
  };

  // Card Photo Gallery & RealView™ Rectifier States
  const [cardImageIndices, setCardImageIndices] = useState<Record<string, number>>({});
  const [cardGalleries, setCardGalleries] = useState<Record<string, string[]>>({});

  // Helper to convert wide-angle photos to human eye normal perspective
  const getRectifiedUrl = (rawUrl: string) => {
    if (!rawUrl || rawUrl.includes('unsplash.com') || rawUrl.startsWith('data:')) return rawUrl;
    const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return `${backendBase}/api/realview/rectify?url=${encodeURIComponent(rawUrl)}`;
  };

  const fetchCardGallery = async (propId: string, url: string): Promise<{ photos: string[]; features: any } | null> => {
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${backendBase}/api/listing-photos?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.photos) && data.photos.length > 0) {
          setCardGalleries((prev) => ({ ...prev, [propId]: data.photos }));
        }
        if (data.status === 'success' && data.features) {
          const f = data.features;
          setProperties((prev) =>
            prev.map((p) =>
              p.id === propId
                ? {
                  ...p,
                  description: f.description || p.description,
                  has_garage: Boolean(p.has_garage || f.has_garage),
                  has_secure_bay: Boolean(p.has_secure_bay || f.has_secure_bay),
                  parking_type: f.has_garage || p.has_garage ? 'garage' : f.has_secure_bay || p.has_secure_bay ? 'secure_bay' : p.parking_type,
                  stove_type: f.stove_type || p.stove_type,
                  has_inverter: Boolean(p.has_inverter || f.has_inverter),
                  pet_friendly: f.pet_friendly !== null && f.pet_friendly !== undefined ? Boolean(p.pet_friendly || f.pet_friendly) : p.pet_friendly,
                  agency_name: f.agency_name || p.agency_name,
                  agency_rating: f.agency_rating ?? p.agency_rating,
                  agency_review_count: f.agency_review_count ?? p.agency_review_count,
                  agency_risk_level: f.agency_risk_level || p.agency_risk_level,
                  agency_flags: Array.isArray(f.agency_flags) && f.agency_flags.length > 0 ? f.agency_flags : p.agency_flags,
                  agency_complaint_sample: f.agency_complaint_sample || p.agency_complaint_sample,
                  agency_hellopeter_rating: f.agency_hellopeter_rating ?? p.agency_hellopeter_rating,
                }
                : p
            )
          );
        }
        return { photos: Array.isArray(data.photos) ? data.photos : [], features: data.features || {} };
      }
    } catch (err) {
      console.warn("Could not fetch gallery for", propId, err);
    }
    return null;
  };

  // Deep AI Analysis Execution State
  const [isRunningDeepAi, setIsRunningDeepAi] = useState<boolean>(false);
  const [hasLoadedPersistedState, setHasLoadedPersistedState] = useState<boolean>(false);

  // Load saved area templates and last active search state from localStorage
  useEffect(() => {
    try {
      const storedAreas = localStorage.getItem('homeseek_area_templates');
      if (storedAreas) {
        const parsed = JSON.parse(storedAreas);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = parsed.map((item: SavedSearch) => {
            const def = DEFAULT_SAVED_SEARCHES.find(d => d.id === item.id);
            if (def) {
              return {
                ...item,
                ...def,
              };
            }
            return item;
          });
          DEFAULT_SAVED_SEARCHES.forEach((def) => {
            if (!merged.some((m: SavedSearch) => m.id === def.id)) {
              merged.push(def);
            }
          });
          setSavedSearches(merged);
        }
      }

      const storedStateRaw = localStorage.getItem('homeseek_last_search_state');
      if (storedStateRaw) {
        const saved = JSON.parse(storedStateRaw);
        if (saved && typeof saved === 'object') {
          if (typeof saved.activeSavedSearchId === 'string') setActiveSavedSearchId(saved.activeSavedSearchId);
          if (Array.isArray(saved.selectedSuburbs) && saved.selectedSuburbs.length > 0) setSelectedSuburbs(saved.selectedSuburbs);
          if (typeof saved.minPrice === 'string') setMinPrice(saved.minPrice);
          if (typeof saved.maxPrice === 'string') setMaxPrice(saved.maxPrice);
          if (typeof saved.minSqm === 'number') setMinSqm(saved.minSqm);
          if (typeof saved.bedrooms === 'string') setBedrooms(saved.bedrooms);
          if (typeof saved.activeAnchorId === 'string') setActiveAnchorId(saved.activeAnchorId);
          if (typeof saved.safeishFilter === 'boolean') setSafeishFilter(saved.safeishFilter);
          if (typeof saved.offMainRoadFilter === 'boolean') setOffMainRoadFilter(saved.offMainRoadFilter);
          if (typeof saved.offBarsFilter === 'boolean') setOffBarsFilter(saved.offBarsFilter);
          if (typeof saved.withinRadiusFilter === 'boolean') setWithinRadiusFilter(saved.withinRadiusFilter);
          if (typeof saved.locationRadiusKm === 'number') setLocationRadiusKm(saved.locationRadiusKm);
          if (typeof saved.fibreFilter === 'boolean') setFibreFilter(saved.fibreFilter);
          if (typeof saved.parkingFilter === 'boolean') setParkingFilter(saved.parkingFilter);
          if (typeof saved.petFriendlyFilter === 'boolean') setPetFriendlyFilter(saved.petFriendlyFilter);
          if (typeof saved.privateOnlyFilter === 'boolean') setPrivateOnlyFilter(saved.privateOnlyFilter);
          if (typeof saved.sortBy === 'string') setSortBy(saved.sortBy);
          if (typeof saved.isListCollapsed === 'boolean') setIsListCollapsed(saved.isListCollapsed);
        }
      }

      const storedHidden = localStorage.getItem('homeseek_hidden_properties');
      if (storedHidden) {
        const parsed = JSON.parse(storedHidden);
        if (Array.isArray(parsed)) {
          setHiddenPropertyIds(parsed);
        }
      }
    } catch (e) { }
    setHasLoadedPersistedState(true);
  }, []);

  const applySavedSearch = (preset: SavedSearch) => {
    setSelectedPropertyId(null);
    setSelectedSuburbs(preset.suburbs);
    if (preset.minPrice) setMinPrice(preset.minPrice);
    if (preset.maxPrice) setMaxPrice(preset.maxPrice);
    if (preset.bedrooms) setBedrooms(preset.bedrooms);
    if (preset.anchorId) setActiveAnchorId(preset.anchorId);
    setActiveSavedSearchId(preset.id);
    setIsSavedSearchMenuOpen(false);

    // Pan map to the primary suburb or anchor of the selected preset
    if (preset.suburbs && preset.suburbs.length > 0) {
      const coords = resolveLocationCoords(preset.suburbs[0]);
      if (coords && coords.lat && coords.lng) {
        setFocusTarget({ lat: coords.lat, lng: coords.lng, zoom: 13.5, timestamp: Date.now() });
      }
    }
  };

  const mapLiveScrapeItem = (item: any, idx: number): PropertyMapItem => ({
    id: item.id || `p24-${idx}`,
    title: item.title,
    address: item.address,
    is_address_withheld: Boolean(item.is_address_withheld),
    suburb: item.suburb,
    price: item.price,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    sqm: item.sqm,
    image: item.image,
    lat: item.lat,
    lng: item.lng,
    rank: idx + 1,
    fit_score: item.fit_score || 90,
    noise_risk: item.noise_risk || 'low',
    is_main_road: Boolean(item.is_main_road),
    stove_type: item.stove_type || 'electric',
    has_garage: Boolean(item.has_garage),
    has_secure_bay: Boolean(item.has_secure_bay) || item.parking_type === 'secure_bay',
    parking_type: item.parking_type || (item.has_garage ? 'garage' : item.parking > 0 ? 'secure_bay' : 'none'),
    pet_friendly: Boolean(item.pet_friendly),
    fibre_ready: Boolean(item.fibre_ready),
    has_inverter: Boolean(item.has_inverter),
    dwelling_privacy: item.dwelling_privacy || 'independent',
    is_landlord_on_site: Boolean(item.is_landlord_on_site),
    agency_name: item.agency_name,
    agency_rating: item.agency_rating,
    agency_review_count: item.agency_review_count,
    agency_risk_level: item.agency_risk_level,
    agency_flags: item.agency_flags,
    agency_complaint_sample: item.agency_complaint_sample,
    agency_hellopeter_rating: item.agency_hellopeter_rating,
    price_value_pct: typeof item.price_value_pct === 'number' ? item.price_value_pct : null,
    first_seen_at: item.first_seen_at ?? null,
    available_from: item.available_from ?? null,
    is_security_estate: Boolean(item.is_security_estate),
    estate_name: item.estate_name || null,
    url: item.url,
    acoustic_audit: {
      estimated_db: item.noise_risk === 'sanctuary' ? 34 : item.is_main_road ? 68 : 42,
      sound_shadow_status: item.noise_risk === 'sanctuary' ? 'Acoustic Sanctuary (Forest/Quiet Grove)' : 'Standard Residential Quiet',
      facing_direction: item.facing_direction || '',
    },
  });

  const doesPropMatchSuburbs = (prop: PropertyMapItem, suburbsList: string[]): boolean => {
    const subLower = String((prop as any).suburb || '').toLowerCase().trim();
    const addrLower = String(prop.address || '').toLowerCase();
    return suburbsList.some((s) => {
      const target = s.toLowerCase().trim();
      return Boolean(target) && (subLower === target || addrLower.includes(target));
    });
  };

  // Auto-load live/cached listings from backend whenever selectedSuburbs changes
  useEffect(() => {
    if (!hasLoadedPersistedState || selectedSuburbs.length === 0) return;
    let isCancelled = false;
    const syncSuburbListings = async () => {
      try {
        const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${backendBase}/api/search/live-scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suburbs: selectedSuburbs,
            min_price: parseInt(minPrice) || 0,
            max_price: parseInt(maxPrice) || 999999,
            bedrooms: bedrooms,
            anchor_lat: activeAnchor ? activeAnchor.lat : null,
            anchor_lng: activeAnchor ? activeAnchor.lng : null,
          }),
        });
        if (!res.ok || isCancelled) return;
        const data = await res.json();
        if (data.rate_guard?.circuit_open && !isCancelled) {
          const secs = data.rate_guard.cooldown_remaining_seconds || 180;
          const mins = Math.max(1, Math.ceil(secs / 60));
          setRateGuardUntil(Date.now() + secs * 1000);
          setScrapeStatusText(
            data.listings?.length > 0
              ? `🛡️ P24 Rate-Limit Shield Active (${mins}m cooldown). Serving ${data.listings.length} cached listings.`
              : `🛡️ P24 Rate-Limit Shield Active (${mins}m cooldown). Pausing outbound scrapes to protect your IP.`
          );
        } else if (!isCancelled && data.rate_guard && !data.rate_guard.circuit_open) {
          setRateGuardUntil(0);
        }
        if (!isCancelled && data.batch_meta) {
          const meta = data.batch_meta;
          const staleSubs: string[] = Array.isArray(meta.stale_suburbs) ? meta.stale_suburbs : [];
          const ageSecs = typeof meta.oldest_age_seconds === 'number' ? meta.oldest_age_seconds : 0;
          if (meta.is_stale || staleSubs.length > 0 || ageSecs >= 86400) {
            setStaleDataInfo({
              isStale: true,
              oldestAgeSeconds: ageSecs,
              staleSuburbs: staleSubs,
            });
          } else {
            setStaleDataInfo(null);
          }
        }
        if (Array.isArray(data.listings) && data.listings.length > 0 && !isCancelled) {
          const mapped: PropertyMapItem[] = data.listings.map(mapLiveScrapeItem);
          setProperties((prev) => {
            const incomingIds = new Set(mapped.map((m) => m.id));
            const outsideQueried = prev.filter(
              (p) => !incomingIds.has(p.id) && !doesPropMatchSuburbs(p, selectedSuburbs)
            );
            return [...mapped, ...outsideQueried];
          });
        }
      } catch (e) {
        // Silent fallback to local state
      }
    };
    syncSuburbListings();
    return () => {
      isCancelled = true;
    };
  }, [hasLoadedPersistedState, selectedSuburbs.join('|'), minPrice, maxPrice, bedrooms]);

  const handleSaveCurrentSearch = () => {
    if (!newSearchName.trim()) return;
    const newPreset: SavedSearch = {
      id: `custom-${Date.now()}`,
      name: `📍 ${newSearchName.trim()}`,
      suburbs: [...selectedSuburbs],
      minPrice,
      maxPrice,
      bedrooms,
      anchorId: activeAnchorId,
      isCustom: true,
    };
    const updated = [newPreset, ...savedSearches];
    setSavedSearches(updated);
    setActiveSavedSearchId(newPreset.id);
    setNewSearchName('');
    setIsSavingSearch(false);
    try {
      localStorage.setItem('homeseek_area_templates', JSON.stringify(updated));
    } catch (e) { }
  };

  const handleDeleteSavedSearch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    if (activeSavedSearchId === id && updated.length > 0) {
      applySavedSearch(updated[0]);
    }
    try {
      localStorage.setItem('homeseek_area_templates', JSON.stringify(updated));
    } catch (e) { }
  };

  // Trigger Top 10 Data-Driven Ranker ($0) across matching properties with active filters, walkable targets & preferences
  const handleRunDeepAiAnalysis = () => {
    setIsRunningDeepAi(true);
    setEnableFitScore(true);
    setSortBy('fit');
    setScrapeStatusText('Ranking Top 10 matches using walkable places, acoustics, privacy & market value...');
    setTimeout(() => {
      setIsRunningDeepAi(false);
      setDeepAiRunCount((c) => c + 1);
      setIsAiModalOpen(false);

      if (displayProperties.length > 0) {
        setSelectedPropertyId(displayProperties[0].id);
      }

      setScrapeStatusText('✨ Top 10 ranked locally ($0) using your criteria & walkable spots.');
      setTimeout(() => setScrapeStatusText(''), 4000);
    }, 300);
  };

  // Desirable Locations & Trailheads State
  const [anchors, setAnchors] = useState<CommuteAnchor[]>(PRESET_TRAILHEADS_AND_HUBS);
  const [activeAnchorId, setActiveAnchorId] = useState<string>('trail-newlands');
  const [isAnchorMenuOpen, setIsAnchorMenuOpen] = useState(false);
  const [newAnchorLabel, setNewAnchorLabel] = useState('');
  const [newAnchorPlace, setNewAnchorPlace] = useState('');
  const [isAnchorInputFocused, setIsAnchorInputFocused] = useState(false);
  const [anchorAutoIndex, setAnchorAutoIndex] = useState(0);

  const anchorSuggestions = useMemo(() => {
    return searchPlacesAndAttractions(newAnchorLabel);
  }, [newAnchorLabel]);

  // Live Scraped Properties State
  const [properties, setProperties] = useState<PropertyMapItem[]>(INITIAL_SHOWCASE_PROPERTIES);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; zoom?: number; timestamp: number } | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStatusText, setScrapeStatusText] = useState('');
  const [rateGuardUntil, setRateGuardUntil] = useState<number>(0);
  const [staleDataInfo, setStaleDataInfo] = useState<{
    isStale: boolean;
    oldestAgeSeconds: number;
    staleSuburbs: string[];
  } | null>(null);
  const [walkablePlaces, setWalkablePlaces] = useState<WalkableTarget[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('homeseek_walkable_places');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const handleAddWalkablePlace = (place: WalkableTarget) => {
    setWalkablePlaces((prev) => {
      if (prev.some((p) => p.id === place.id || p.label.toLowerCase() === place.label.toLowerCase())) {
        return prev;
      }
      const next = [...prev, place];
      try {
        localStorage.setItem('homeseek_walkable_places', JSON.stringify(next));
      } catch { }
      return next;
    });
  };
  const handleRemoveWalkablePlace = (id: string) => {
    setWalkablePlaces((prev) => {
      const next = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem('homeseek_walkable_places', JSON.stringify(next));
      } catch { }
      return next;
    });
  };
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [feedViewMode, setFeedViewMode] = useState<'cards' | 'list'>('cards');
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'distance' | 'fit'>('fit');
  const [empiricalMediansLoaded, setEmpiricalMediansLoaded] = useState(0);

  useEffect(() => {
    const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${backendBase}/api/market-medians`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.status === 'success' && d.medians) {
          setEmpiricalMarketMedians(d.medians);
          setEmpiricalMediansLoaded((n) => n + 1);
        }
      })
      .catch(() => { });
  }, []);

  const resolveProperty24Url = (prop: { id?: string; url?: string; address?: string; title?: string }): string => {
    const raw = (prop.url || '').trim();
    if (raw && raw.startsWith('http')) return raw;
    if (raw && raw.startsWith('/')) return `https://www.property24.com${raw}`;
    const p24Match = (prop.id || '').match(/(\d{7,10})/);
    if (p24Match) {
      return `https://www.property24.com/to-rent/cape-town/western-cape/432/${p24Match[1]}`;
    }
    return 'https://www.property24.com/to-rent/cape-town/western-cape/432';
  };

  const resolveGoogleMapsUrl = (prop: { lat?: number | null; lng?: number | null; address?: string; title?: string } | null | undefined): string => {
    if (!prop) return 'https://www.google.com/maps';
    if (prop.lat && prop.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${prop.lat},${prop.lng}`;
    }
    const cleanAddr = (prop.address || prop.title || 'Cape Town, South Africa').replace(/\s+/g, ' ').trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddr)}`;
  };

  const openProperty24Url = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Persist active search criteria and filters to localStorage whenever they change
  useEffect(() => {
    if (!hasLoadedPersistedState) return;
    try {
      localStorage.setItem(
        'homeseek_last_search_state',
        JSON.stringify({
          activeSavedSearchId,
          selectedSuburbs,
          minPrice,
          maxPrice,
          minSqm,
          bedrooms,
          activeAnchorId,
          safeishFilter,
          offMainRoadFilter,
          offBarsFilter,
          withinRadiusFilter,
          locationRadiusKm,
          fibreFilter,
          parkingFilter,
          petFriendlyFilter,
          privateOnlyFilter,
          sortBy,
          isListCollapsed,
        })
      );
    } catch (e) { }
  }, [
    hasLoadedPersistedState,
    activeSavedSearchId,
    selectedSuburbs,
    minPrice,
    maxPrice,
    minSqm,
    bedrooms,
    activeAnchorId,
    safeishFilter,
    offMainRoadFilter,
    offBarsFilter,
    withinRadiusFilter,
    locationRadiusKm,
    fibreFilter,
    parkingFilter,
    petFriendlyFilter,
    privateOnlyFilter,
    sortBy,
    isListCollapsed,
  ]);

  const activeAnchor = useMemo(() => {
    return anchors.find(a => a.id === activeAnchorId) || anchors[0] || null;
  }, [anchors, activeAnchorId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (budgetMenuRef.current && !budgetMenuRef.current.contains(target)) {
        setIsBudgetMenuOpen(false);
      }
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(target)) {
        setIsSizeMenuOpen(false);
      }
      if (savedSearchMenuRef.current && !savedSearchMenuRef.current.contains(target)) {
        setIsSavedSearchMenuOpen(false);
      }
      if (anchorMenuRef.current && !anchorMenuRef.current.contains(target)) {
        setIsAnchorMenuOpen(false);
      }
    };
    if (isBudgetMenuOpen || isSizeMenuOpen || isSavedSearchMenuOpen || isAnchorMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBudgetMenuOpen, isSizeMenuOpen, isSavedSearchMenuOpen, isAnchorMenuOpen]);

  const activeTemplate = useMemo(() => {
    return savedSearches.find((s) => s.id === activeSavedSearchId) || savedSearches[0];
  }, [savedSearches, activeSavedSearchId]);

  // Main location attractions associated with the active Suburb Group template
  const templateAttractions = useMemo(() => {
    if (!activeTemplate?.attractionIds || activeTemplate.attractionIds.length === 0) {
      return anchors.filter((a) => a.category !== 'gym' && a.iconType !== 'gym' && a.category !== 'cafe' && a.iconType !== 'cafe' && a.category !== 'shop' && a.iconType !== 'shop');
    }
    return anchors.filter((a) => activeTemplate.attractionIds?.includes(a.id));
  }, [anchors, activeTemplate]);

  // Gyms associated with the active Suburb Group template
  const templateGyms = useMemo(() => {
    if (!activeTemplate?.gymIds || activeTemplate.gymIds.length === 0) {
      return anchors.filter((a) => a.category === 'gym' || a.iconType === 'gym');
    }
    return anchors.filter((a) => activeTemplate.gymIds?.includes(a.id));
  }, [anchors, activeTemplate]);

  // Cafes & Bakeries associated with the active Suburb Group template
  const templateCafes = useMemo(() => {
    if (!activeTemplate?.cafeIds || activeTemplate.cafeIds.length === 0) {
      return anchors.filter((a) => a.category === 'cafe' || a.iconType === 'cafe');
    }
    return anchors.filter((a) => activeTemplate.cafeIds?.includes(a.id));
  }, [anchors, activeTemplate]);

  // Shops & Retail Centres associated with the active Suburb Group template
  const templateShops = useMemo(() => {
    if (!activeTemplate?.shopIds || activeTemplate.shopIds.length === 0) {
      return anchors.filter((a) => a.category === 'shop' || a.iconType === 'shop');
    }
    return anchors.filter((a) => activeTemplate.shopIds?.includes(a.id));
  }, [anchors, activeTemplate]);

  // Other regional anchors (outside current template) + custom user anchors
  const otherAnchors = useMemo(() => {
    const currentTemplateAnchorIds = new Set([
      ...(activeTemplate?.attractionIds || []),
      ...(activeTemplate?.gymIds || []),
      ...(activeTemplate?.cafeIds || []),
      ...(activeTemplate?.shopIds || [])
    ]);
    return anchors.filter((a) => !currentTemplateAnchorIds.has(a.id));
  }, [anchors, activeTemplate]);

  // Filtered anchors passed to the Map Canvas (current template attractions + gyms + cafes + shops + custom pins + active anchor)
  const displayedAnchors = useMemo(() => {
    const customAnchors = anchors.filter((a) => a.id.startsWith('custom-'));
    const idSet = new Set([
      ...(activeTemplate?.attractionIds || []),
      ...(activeTemplate?.gymIds || []),
      ...(activeTemplate?.cafeIds || []),
      ...(activeTemplate?.shopIds || []),
      activeAnchorId
    ]);
    const matched = anchors.filter(
      (a) => idSet.has(a.id) || a.iconType === 'trail' || (activeTemplate?.id && a.templateId === activeTemplate.id)
    );
    return matched.length > 0 ? [...matched, ...customAnchors] : anchors;
  }, [anchors, activeTemplate, activeAnchorId]);

  const handleFocusSuburb = (suburb: string) => {
    const coords = resolveLocationCoords(suburb);
    setFocusTarget({ lat: coords.lat, lng: coords.lng, zoom: 14.2, timestamp: Date.now() });
  };

  // Suburb management
  const handleAddSuburb = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!selectedSuburbs.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedSuburbs([...selectedSuburbs, trimmed]);
    }
    setSuburbInput('');
    setIsInputFocused(false);
    setAutoIndex(0);
  };

  const handleRemoveSuburb = (name: string) => {
    setSelectedSuburbs(selectedSuburbs.filter(s => s.toLowerCase() !== name.toLowerCase()));
  };

  // Select location from suggestions and add to map
  const handleSelectSuggestedPlace = (place: PlaceSuggestion) => {
    const newAnchor: CommuteAnchor = {
      id: `place-${Date.now()}-${place.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      label: place.name,
      target_place: `${place.name}, ${place.category}`,
      lat: place.lat,
      lng: place.lng,
      max_commute_mins: 20,
      max_distance_km: 15,
      commute_mode: 'driving',
      iconType: place.iconType,
      category: place.iconType === 'gym' ? 'gym' : place.iconType === 'trail' ? 'trail' : place.iconType === 'cafe' ? 'cafe' : place.iconType === 'shop' ? 'shop' : 'attraction',
    };

    setAnchors((prev) => [newAnchor, ...prev.filter((a) => a.label.toLowerCase() !== place.name.toLowerCase())]);
    setActiveAnchorId(newAnchor.id);
    setFocusTarget({ lat: place.lat, lng: place.lng, zoom: 14.5, timestamp: Date.now() });
    setNewAnchorLabel('');
    setNewAnchorPlace('');
    setIsAnchorInputFocused(false);
    setIsAnchorMenuOpen(false);
  };

  // Add custom desirable location
  const handleAddCustomAnchor = () => {
    const query = newAnchorLabel.trim();
    if (!query) return;

    // If an auto-suggestion is currently highlighted, use it
    if (anchorSuggestions.length > 0 && anchorSuggestions[anchorAutoIndex]) {
      handleSelectSuggestedPlace(anchorSuggestions[anchorAutoIndex]);
      return;
    }

    const resolved = resolveLocationCoords(query);
    const newAnchor: CommuteAnchor = {
      id: `custom-${Date.now()}`,
      label: resolved.label || query,
      target_place: query,
      lat: resolved ? resolved.lat : -33.9500,
      lng: resolved ? resolved.lng : 18.4400,
      max_commute_mins: 20,
      max_distance_km: 15,
      commute_mode: 'driving',
      iconType: 'general'
    };
    setAnchors((prev) => [newAnchor, ...prev.filter((a) => a.label.toLowerCase() !== newAnchor.label.toLowerCase())]);
    setActiveAnchorId(newAnchor.id);
    setFocusTarget({ lat: newAnchor.lat, lng: newAnchor.lng, zoom: 14.5, timestamp: Date.now() });
    setNewAnchorLabel('');
    setNewAnchorPlace('');
    setIsAnchorInputFocused(false);
    setIsAnchorMenuOpen(false);
  };

  // Scrape Property24 Live Action
  const handleScrapeP24 = async () => {
    if (selectedSuburbs.length === 0) {
      setScrapeStatusText('Please select or add at least one suburb (e.g. Gardens, Rondebosch) to scrape.');
      setTimeout(() => setScrapeStatusText(''), 4500);
      return;
    }

    setIsScraping(true);
    setScrapeStatusText(`Connecting to Property24 and scraping live listings for ${selectedSuburbs.join(', ')}...`);

    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const runScrapeBatch = async (batchSuburbs: string[]) => {
        const res = await fetch(`${backendBase}/api/search/live-scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suburbs: batchSuburbs,
            min_price: parseInt(minPrice) || 0,
            max_price: parseInt(maxPrice) || 999999,
            bedrooms: bedrooms,
            anchor_lat: activeAnchor ? activeAnchor.lat : null,
            anchor_lng: activeAnchor ? activeAnchor.lng : null,
            force_fresh: true,
          }),
        });
        if (!res.ok) return null;
        return await res.json();
      };

      const mergeBatchProperties = (
        batchMapped: PropertyMapItem[],
        suburbsToReplace: string[],
        prevSnapshot: PropertyMapItem[]
      ) => {
        const batchIds = new Set(batchMapped.map((m) => m.id));
        const removed =
          suburbsToReplace.length > 0
            ? prevSnapshot.filter((p) => !batchIds.has(p.id) && doesPropMatchSuburbs(p, suburbsToReplace)).length
            : 0;
        setProperties((prev) => {
          const preserved = prev.filter((p) => {
            if (batchIds.has(p.id)) return false;
            if (suburbsToReplace.length > 0 && doesPropMatchSuburbs(p, suburbsToReplace)) {
              return false;
            }
            return true;
          });
          return [...batchMapped, ...preserved];
        });
        return removed;
      };

      const data = await runScrapeBatch(selectedSuburbs);

      if (data) {
        if (data.rate_guard?.circuit_open) {
          const secs = data.rate_guard?.cooldown_remaining_seconds || 180;
          setRateGuardUntil(Date.now() + secs * 1000);
        } else {
          setRateGuardUntil(0);
        }
        if (data.status === 'success' && Array.isArray(data.listings)) {
          const combinedMappedById = new Map<string, PropertyMapItem>();
          const batch1Mapped: PropertyMapItem[] = data.listings.map(mapLiveScrapeItem);
          batch1Mapped.forEach((m) => combinedMappedById.set(m.id, m));

          let circuitOpen = Boolean(data.rate_guard?.circuit_open);
          let cooldownSecs = data.rate_guard?.cooldown_remaining_seconds || 180;
          const allRefreshedSet = new Set<string>(
            Array.isArray(data.batch_meta?.refreshed_suburbs) ? data.batch_meta.refreshed_suburbs : []
          );
          let remainingStale: string[] = Array.isArray(data.batch_meta?.stale_suburbs)
            ? data.batch_meta.stale_suburbs
            : [];

          const prevIds = new Set(properties.map((p) => p.id));
          const initialReplace = circuitOpen
            ? []
            : allRefreshedSet.size > 0
              ? Array.from(allRefreshedSet)
              : remainingStale.length === 0
                ? selectedSuburbs
                : [];
          let removedStaleCount = mergeBatchProperties(batch1Mapped, initialReplace, properties);
          setStaleDataInfo(
            remainingStale.length > 0
              ? {
                isStale: true,
                oldestAgeSeconds: typeof data.batch_meta?.oldest_age_seconds === 'number' ? data.batch_meta.oldest_age_seconds : 86400,
                staleSuburbs: remainingStale,
              }
              : null
          );

          // Automatically continue through remaining stale suburbs (<= 3 per batch) after polite delay
          const triedRemaining = new Set<string>();
          let batchesRun = 1;
          while (!circuitOpen && remainingStale.length > 0 && batchesRun < 4) {
            const nextSlice = remainingStale
              .filter((s) => !triedRemaining.has(s.toLowerCase()))
              .slice(0, 3);
            if (nextSlice.length === 0) break;
            nextSlice.forEach((s) => triedRemaining.add(s.toLowerCase()));

            setScrapeStatusText(
              `⏳ Refreshed ${allRefreshedSet.size > 0 ? Array.from(allRefreshedSet).join(', ') : 'first batch'}. Continuing politely to ${nextSlice.join(', ')}...`
            );
            await new Promise((r) => setTimeout(r, 4000));

            const nextData = await runScrapeBatch(nextSlice);
            batchesRun++;
            if (!nextData || nextData.status !== 'success' || !Array.isArray(nextData.listings)) {
              break;
            }

            if (nextData.rate_guard?.circuit_open) {
              circuitOpen = true;
              cooldownSecs = nextData.rate_guard?.cooldown_remaining_seconds || 180;
              setRateGuardUntil(Date.now() + cooldownSecs * 1000);
            }

            const nextMapped: PropertyMapItem[] = nextData.listings.map(mapLiveScrapeItem);
            nextMapped.forEach((m) => combinedMappedById.set(m.id, m));

            const nextRefreshed: string[] = Array.isArray(nextData.batch_meta?.refreshed_suburbs)
              ? nextData.batch_meta.refreshed_suburbs
              : [];
            nextRefreshed.forEach((s) => allRefreshedSet.add(s));
            const nextStale: string[] = Array.isArray(nextData.batch_meta?.stale_suburbs)
              ? nextData.batch_meta.stale_suburbs
              : [];

            if (!circuitOpen) {
              const replaceTargets = nextRefreshed.length > 0 ? nextRefreshed : nextStale.length === 0 ? nextSlice : [];
              removedStaleCount += mergeBatchProperties(nextMapped, replaceTargets, properties);
            }

            const prevRemaining = remainingStale.filter((s) => !triedRemaining.has(s.toLowerCase()));
            remainingStale = Array.from(new Set([...nextStale, ...prevRemaining]));
          }

          const mapped = Array.from(combinedMappedById.values());
          const addedCount = mapped.filter((m) => !prevIds.has(m.id)).length;
          const refreshedSuburbs = Array.from(allRefreshedSet);
          const staleSuburbs = remainingStale;

          // Verify saved/imported favourites against live availability & refresh metadata
          let expiredFavsRemoved = 0;
          if (!circuitOpen && importedFavourites.length > 0) {
            try {
              const mappedByP24Id = new Map(
                mapped.map((m) => [String((m as any).p24_id || m.id).replace('p24-', ''), m])
              );
              const verifyRes = await fetch(`${backendBase}/api/p24/verify-favourites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  items: importedFavourites.map((f) => ({
                    id: f.id,
                    p24_id: String((f as any).p24_id || f.id).replace('p24-', ''),
                    url: f.url || null,
                  })),
                  active_live_ids: Array.from(mappedByP24Id.keys()),
                  force_fresh: true,
                }),
              });

              const expiredSet = new Set<string>();
              if (verifyRes.ok) {
                const vData = await verifyRes.json();
                for (const eid of (vData.expired_ids || []) as string[]) {
                  expiredSet.add(String(eid).replace('p24-', ''));
                }
              }

              expiredFavsRemoved = importedFavourites.filter((fav) => {
                const pid = String((fav as any).p24_id || fav.id).replace('p24-', '');
                return expiredSet.has(fav.id) || expiredSet.has(pid);
              }).length;

              if (expiredSet.size > 0 || mappedByP24Id.size > 0) {
                setImportedFavourites((prevFavs) => {
                  const nextFavs: PropertyMapItem[] = [];
                  for (const fav of prevFavs) {
                    const pid = String((fav as any).p24_id || fav.id).replace('p24-', '');
                    if (expiredSet.has(fav.id) || expiredSet.has(pid)) {
                      continue;
                    }
                    const freshMatch = mappedByP24Id.get(pid);
                    nextFavs.push(freshMatch ? { ...fav, ...freshMatch, is_favorite: true } : fav);
                  }
                  return nextFavs;
                });

                if (expiredSet.size > 0) {
                  setFavouritePropertyIds((prevFavIds) => {
                    const nextIds = prevFavIds.filter(
                      (fid) => !expiredSet.has(fid) && !expiredSet.has(fid.replace('p24-', ''))
                    );
                    try {
                      localStorage.setItem('homeseek_p24_favourite_ids', JSON.stringify(nextIds));
                    } catch { }
                    return nextIds;
                  });
                  setProperties((prev) =>
                    prev.filter((p) => {
                      const pid = String((p as any).p24_id || p.id).replace('p24-', '');
                      return !expiredSet.has(p.id) && !expiredSet.has(pid);
                    })
                  );
                }
              }
            } catch (favErr) {
              console.warn('Favourite expiry verification skipped:', favErr);
            }
          }

          const totalExpiredRemoved = removedStaleCount + expiredFavsRemoved;
          if (circuitOpen) {
            const mins = Math.ceil(cooldownSecs / 60);
            setScrapeStatusText(`🛡️ P24 Rate-Limit Shield Active (${mins}m cooldown). Serving ${mapped.length} cached listings to prevent IP block.`);
          } else if (staleSuburbs.length > 0) {
            setScrapeStatusText(
              `⚡ Refreshed ${refreshedSuburbs.join(', ') || 'batch'}${totalExpiredRemoved > 0 ? ` (removed ${totalExpiredRemoved} expired)` : ''}. ${staleSuburbs.join(', ')} still cached — click Scrape P24 again to retry.`
            );
          } else if (totalExpiredRemoved > 0) {
            setScrapeStatusText(
              `🔄 Refreshed ${selectedSuburbs.join(', ')}: removed ${totalExpiredRemoved} expired listing${totalExpiredRemoved === 1 ? '' : 's'}, ${mapped.length} active.`
            );
          } else if (addedCount > 0) {
            setScrapeStatusText(`✨ Found ${addedCount} new live listings from Property24 (${mapped.length} active for ${selectedSuburbs.join(', ')})!`);
          } else if (refreshedSuburbs.length > 0) {
            setScrapeStatusText(`✨ Property24 live check complete: Refreshed ${mapped.length} active listings for ${refreshedSuburbs.join(', ')}.`);
          } else {
            setScrapeStatusText(`⚡ Serving ${mapped.length} cached listings for ${selectedSuburbs.join(', ')} (scraped under 15 min ago).`);
          }
        } else if (data.status === 'cooldown') {
          const mins = Math.ceil((data.rate_guard?.cooldown_remaining_seconds || 180) / 60);
          setScrapeStatusText(`🛡️ Property24 rate-limit shield active (${mins}m cooldown). Showing ${data.count || 0} cached listings.`);
        } else {
          setScrapeStatusText(`No new direct listings matched on Property24 for ${selectedSuburbs.join(', ')}. Showing cached listings.`);
        }
      } else {
        setScrapeStatusText('Live portal connection timed out. Showing cached contenders.');
      }
    } catch (err) {
      console.error('Scrape error:', err);
      setScrapeStatusText('Could not connect to live portal. Using cached high-trust properties.');
    } finally {
      setIsScraping(false);
      setTimeout(() => setScrapeStatusText(''), 6000);
    }
  };

  // Combine live/scraped properties with user imported favourites
  const allCandidateProperties = useMemo(() => {
    const list: PropertyMapItem[] = [...properties];
    const seenP24Ids = new Set(list.map((p) => String((p as any).p24_id || p.id).replace('p24-', '')));
    const seenIds = new Set(list.map((p) => p.id));

    for (const fav of importedFavourites) {
      const p24Id = String((fav as any).p24_id || fav.id).replace('p24-', '');
      if (!seenIds.has(fav.id) && (!p24Id || !seenP24Ids.has(p24Id))) {
        list.push({ ...fav, is_favorite: true });
        seenIds.add(fav.id);
        if (p24Id) seenP24Ids.add(p24Id);
      }
    }
    return list;
  }, [properties, importedFavourites]);

  // Strictly filter properties by selected suburbs, budget, and bedroom criteria
  const { sortedProperties, radiusExcludedCount } = useMemo(() => {
    let excludedByRadius = 0;
    const suburbCoords = selectedSuburbs.map((s) => ({
      name: s.toLowerCase().trim(),
      ...resolveLocationCoords(s),
    }));

    const minP = parseInt(minPrice) || 0;
    const maxP = parseInt(maxPrice) || 999999;
    const minBeds = parseFloat(bedrooms.replace(/[^0-9.]/g, '')) || 0;

    // 1. Strict Suburb Match (bypassed when viewing Favourites so all saved/imported favs appear)
    const suburbMatched = showOnlyFavourites
      ? allCandidateProperties.filter((prop) =>
        Boolean(
          favouritePropertyIds.includes(prop.id) ||
          prop.is_favorite ||
          importedFavourites.some((fav) => fav.id === prop.id || ((fav as any).p24_id && (fav as any).p24_id === (prop as any).p24_id))
        )
      )
      : allCandidateProperties.filter((prop) => {
        if (suburbCoords.length === 0) return true;
        const propSub = String((prop as any).suburb || '').toLowerCase().trim();
        if (propSub && suburbCoords.some((sc) => sc.name === propSub)) return true;
        const addrLower = `${prop.address || ''}`.toLowerCase();
        const matchesAddrSuburb = suburbCoords.some((sc) => {
          if (sc.name === 'gardens' && addrLower.includes('dormax gardens') && !propSub.includes('gardens')) {
            return false;
          }
          return addrLower.includes(`, ${sc.name}`) || addrLower.startsWith(`${sc.name},`) || propSub === sc.name;
        });
        if (matchesAddrSuburb) return true;
        return suburbCoords.some((sc) => getDistanceKm(prop.lat, prop.lng, sc.lat, sc.lng) <= 1.8);
      });

    // 2. Apply budget, bedroom, minimum floor size (sqm) & structured feature filters (bypassed in Favs mode)
    const criteriaMatched = showOnlyFavourites ? suburbMatched : suburbMatched.filter((prop) => {
      if (minP > 0 && prop.price > 0 && prop.price < minP) return false;
      if (maxP > 0 && prop.price > maxP) return false;
      if (minBeds > 0 && prop.bedrooms < minBeds) return false;
      if (minSqm > 0) {
        const propSqm =
          prop.sqm ||
          (() => {
            const m = `${prop.title} ${prop.address}`.match(/(\d+)\s*(?:m²|sqm|m2)/i);
            return m ? parseInt(m[1], 10) : 0;
          })();
        if (propSqm > 0 && propSqm < minSqm) return false;
      }

      // Safe-ish crime filter (ON by default): hides properties within radius of High Risk crime hotspot
      if (safeishFilter && isPropertyInHighRiskCrimeZone(prop.lat, prop.lng)) {
        return false;
      }

      // Off-Bars & Clubs filter: hides properties within close nightlife/bar noise radius
      if (offBarsFilter && getPropertyBarNoiseExposure(prop).isExposed) {
        return false;
      }

      // 1. Fibre ready filter
      if (fibreFilter) {
        const text = `${prop.title} ${prop.address}`.toLowerCase();
        const hasFibre = Boolean(prop.fibre_ready) || text.includes('fibre') || text.includes('fiber') || text.includes('wifi');
        if (!hasFibre) return false;
      }

      // 3. Off-street parking filter (excludes street parking)
      if (parkingFilter) {
        const text = `${prop.title} ${prop.address}`.toLowerCase();
        const isStreetOnly =
          prop.parking_type === 'street' ||
          prop.parking_type === 'none' ||
          text.includes('street parking only') ||
          text.includes('on-street parking only');
        const hasOffStreetParking =
          Boolean(prop.has_garage) ||
          (prop.parking_type && prop.parking_type !== 'none' && prop.parking_type !== 'street') ||
          (!isStreetOnly &&
            (text.includes('garage') ||
              text.includes('off-street') ||
              text.includes('off street') ||
              text.includes('secure bay') ||
              text.includes('parking bay') ||
              text.includes('basement parking') ||
              text.includes('undercover parking') ||
              text.includes('carport') ||
              text.includes('bay')));
        if (!hasOffStreetParking) return false;
      }

      // 4. Pet-friendly filter
      if (petFriendlyFilter) {
        const text = `${prop.title} ${prop.address}`.toLowerCase();
        const isPet = Boolean(prop.pet_friendly) || text.includes('pet');
        if (!isPet) return false;
      }

      // 6. 100% Private Standalone filter (excludes cottages/flatlets on landlord property)
      if (privateOnlyFilter && isLandlordOnSiteProperty(prop)) {
        return false;
      }

      // 7. Off-Main Road filter (ON by default): excludes properties directly on busy arterial corridors (Main Rd, Victoria Rd, etc.)
      if (offMainRoadFilter && isMainRoadProperty(prop.address, prop.title)) {
        return false;
      }

      // 8. Selected Location Radius Filter (ON by default):
      // When withinRadiusFilter is active and an anchor location is selected,
      // properties outside the chosen radius buffer are filtered out of the top fits.
      if (withinRadiusFilter && activeAnchor) {
        const distKm = getDistanceKm(prop.lat, prop.lng, activeAnchor.lat, activeAnchor.lng);
        if (distKm > locationRadiusKm) {
          excludedByRadius += 1;
          return false;
        }
      }

      return true;
    });

    // 3. Deterministic Spec, Acoustic & Personal Preferences Matching
    const scoredList = criteriaMatched.map((prop) => {
      let baseScore = prop.fit_score || 88;
      const text = `${prop.title} ${prop.address} ${(prop as any).suburb || ''}`.toLowerCase();
      const pref = personalPreferences.toLowerCase();

      // Selected Location Proximity & Radius Fit Penalty/Boost
      let distToAnchor: number | null = null;
      let isOutsideRadius = false;
      if (activeAnchor) {
        distToAnchor = getDistanceKm(prop.lat, prop.lng, activeAnchor.lat, activeAnchor.lng);
        if (distToAnchor > locationRadiusKm) {
          isOutsideRadius = true;
          // Severe penalty: outside of user-selected radius is NOT a good fit
          baseScore -= 35;
        } else {
          // Within radius: award proximity boost based on closeness
          if (distToAnchor <= 1.5) {
            baseScore += 6;
          } else if (distToAnchor <= 3.0) {
            baseScore += 4;
          } else {
            baseScore += 2;
          }
        }
      }

      // Main Road Arterial Traffic Penalty (continuous noise & opportunistic street crime)
      const busyRoadInfo = getPropertyBusyRoadExposure(prop);
      const isMainRoad = Boolean(prop.is_main_road) || isMainRoadProperty(prop.address, prop.title) || busyRoadInfo.isDirectlyOnRoad;
      if (isMainRoad) {
        baseScore -= 18;
      } else if (busyRoadInfo.isNearBusyRoad) {
        baseScore -= 10;
      }

      // Privacy / No Landlord On-Site Preference Matching
      const wantsPrivate =
        pref.includes('private') ||
        pref.includes('landlord') ||
        pref.includes('cottage') ||
        pref.includes('on-site') ||
        privateOnlyFilter;

      const isLandlordOnSite = isLandlordOnSiteProperty(prop);

      if (wantsPrivate) {
        if (isLandlordOnSite) {
          // Substantial penalty when user specifies private / no landlord on site
          baseScore -= 24;
        } else {
          // Significant boost for standalone, private residences (apartments, townhouses, houses)
          baseScore += 8;
        }
      }

      // Work style / remote work preference matching
      const wantsWfh = pref.includes('work from home') || pref.includes('wfh') || pref.includes('remote work');
      const wantsWfhFullTime = pref.includes('full-time') && (pref.includes('wfh') || pref.includes('work from home'));
      const wantsWfhPartTime = pref.includes('part-time') && (pref.includes('wfh') || pref.includes('work from home'));
      const wantsCafes = pref.includes('cafes') || pref.includes('coffee');
      const wantsOffice = pref.includes('office');

      if (wantsWfhFullTime) {
        if (prop.fibre_ready) baseScore += 6;
        if (prop.noise_risk === 'sanctuary') baseScore += 6;
        else if (isMainRoad || prop.noise_risk === 'high') baseScore -= 14;
        if (prop.sqm && prop.sqm >= 65) baseScore += 4;
        else if (prop.sqm && prop.sqm < 40) baseScore -= 8;
      } else if (wantsWfhPartTime || wantsWfh) {
        if (prop.fibre_ready) baseScore += 4;
        if (prop.noise_risk === 'sanctuary') baseScore += 3;
        else if (isMainRoad) baseScore -= 8;
      }

      if (wantsCafes) {
        const hasCafeProximity = Array.isArray(prop.location_proximity) && prop.location_proximity.some((p: any) =>
          String(p.name || p.category || '').toLowerCase().includes('cafe') ||
          String(p.name || p.category || '').toLowerCase().includes('coffee')
        );
        if (hasCafeProximity) baseScore += 5;
      }

      if (wantsOffice && activeAnchor) {
        if (distToAnchor !== null && distToAnchor <= 5.0) baseScore += 6;
        else if (distToAnchor !== null && distToAnchor > 12.0) baseScore -= 8;
      }

      // Sound sanctuary boost/penalty
      if (pref.includes('quiet') || pref.includes('sanctuary')) {
        if (prop.noise_risk === 'sanctuary') baseScore += 5;
        else if (prop.noise_risk === 'high' || isMainRoad) baseScore -= 10;
      }
      // Sunlight & orientation match
      if (pref.includes('north') && ((prop.acoustic_audit?.facing_direction || '').toLowerCase().includes('north') || text.includes('north'))) {
        baseScore += 3;
      }
      // View match
      if ((pref.includes('view') || pref.includes('ocean') || pref.includes('mountain')) && (text.includes('view') || text.includes('ocean') || text.includes('mountain') || text.includes('beach') || text.includes('sea'))) {
        baseScore += 3;
      }
      // Gas cooking match
      if (pref.includes('gas') && (prop.stove_type === 'gas' || text.includes('gas'))) {
        baseScore += 2;
      }
      // Fibre match
      if (pref.includes('fibre') && (prop.fibre_ready || text.includes('fibre'))) {
        baseScore += 2;
      }
      // Pets match
      if ((pref.includes('dog') || pref.includes('pet')) && prop.pet_friendly) {
        baseScore += 3;
      }

      const privacyInfo = getDwellingPrivacyInfo(prop);
      const agencyRep = getAgencyReputationInfo(prop);
      const barNoiseInfo = getPropertyBarNoiseExposure(prop);
      const marketVal = getRiskAdjustedValuation(prop, allCandidateProperties);
      if (marketVal) {
        if (marketVal.pctDiff >= 30) {
          baseScore -= 24;
        } else if (marketVal.pctDiff >= 15) {
          baseScore -= 14;
        } else if (marketVal.pctDiff >= 5) {
          baseScore -= 6;
        } else if (marketVal.pctDiff <= -15) {
          baseScore += 10;
        } else if (marketVal.pctDiff <= -5) {
          baseScore += 5;
        }
      }
      if (agencyRep.isPoorAgency) {
        baseScore -= 28;
      }
      if (barNoiseInfo.isExposed) {
        baseScore -= barNoiseInfo.severity === 'high' ? 14 : 8;
      }
      const crimePerimeter = getCrimePerimeterInfo(prop);
      if (crimePerimeter.isNearHighRisk) {
        if (!crimePerimeter.hasEstateSecurity) {
          baseScore -= crimePerimeter.isInsideCore ? 16 : 10;
        } else {
          baseScore -= 3;
        }
      }
      const walkableNotes: string[] = [];
      let walkableHits = 0;
      if (walkablePlaces.length > 0 && prop.lat && prop.lng) {
        for (const wp of walkablePlaces) {
          const walkKm = getDistanceKm(prop.lat, prop.lng, wp.lat, wp.lng);
          if (walkKm <= 0.6) {
            baseScore += 8;
            walkableHits += 1;
            walkableNotes.push(`🚶 ${Math.round(walkKm * 1000)}m to ${wp.label}`);
          } else if (walkKm <= 1.2) {
            baseScore += 4;
            walkableHits += 1;
            walkableNotes.push(`🚶 ${walkKm.toFixed(1)} km to ${wp.label}`);
          }
        }
      }
      // If outside the chosen location radius, cap fit score at 55% max (never ranked as Top Fit)
      const finalFit = isOutsideRadius
        ? Math.min(55, Math.max(15, baseScore))
        : Math.min(99, Math.max(15, baseScore));

      const radiusNote = isOutsideRadius && activeAnchor && distToAnchor !== null
        ? `📍 Outside ${activeAnchor.label} radius (${distToAnchor.toFixed(1)} km > ${locationRadiusKm.toFixed(1)} km) · `
        : '';
      const privacyNote = privacyInfo.aiInsightNote;
      const acousticNote = busyRoadInfo.isNearBusyRoad && busyRoadInfo.road
        ? `🛣️ ${busyRoadInfo.isDirectlyOnRoad ? 'On' : 'Near'} ${busyRoadInfo.road.shortName} (~${busyRoadInfo.distanceM}m · ${busyRoadInfo.road.base_db} dB traffic)`
        : isMainRoad
          ? '⚠️ High-traffic arterial corridor (Main Rd)'
          : barNoiseInfo.isExposed && barNoiseInfo.hotspot
            ? `🔊 Near ${barNoiseInfo.hotspot.shortName || barNoiseInfo.hotspot.name} (~${barNoiseInfo.distanceM}m · ${barNoiseInfo.hotspot.base_db} dB)`
            : (prop.noise_risk === 'sanctuary' ? 'Code-verified <38 dB quiet zone' : 'Residential street buffer');
      const specNote = `${prop.bedrooms} bed · ${prop.sqm || 68}m² · ${prop.fibre_ready ? 'Fibre' : 'Standard'}`;
      const agencyNote = agencyRep.isPoorAgency
        ? `🚩 Poor Agency (${agencyRep.agencyName}: ${agencyRep.rating}★) · `
        : '';

      return {
        ...prop,
        fit_score: finalFit,
        is_landlord_on_site: isLandlordOnSite,
        is_main_road: isMainRoad,
        is_outside_radius: isOutsideRadius,
        distance_to_anchor_km: distToAnchor,
        walkable_hits: walkableHits,
        ai_insight: `${radiusNote}${agencyNote}${walkableNotes.length ? `${walkableNotes.join(' · ')} · ` : ''}${privacyNote} · ${acousticNote} · ${specNote}`,
      };
    });

    const sorted = [...scoredList].sort((a, b) => {
      if (sortBy === 'fit') {
        // Properties inside the chosen location radius ALWAYS rank above properties outside the radius
        if (activeAnchor) {
          const aDist = getDistanceKm(a.lat, a.lng, activeAnchor.lat, activeAnchor.lng);
          const bDist = getDistanceKm(b.lat, b.lng, activeAnchor.lat, activeAnchor.lng);
          const aWithin = aDist <= locationRadiusKm;
          const bWithin = bDist <= locationRadiusKm;
          if (aWithin !== bWithin) return aWithin ? -1 : 1;
        }
        const fitDiff = (b.fit_score || 0) - (a.fit_score || 0);
        if (fitDiff !== 0) return fitDiff;
        return ((b as any).walkable_hits || 0) - ((a as any).walkable_hits || 0);
      }
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'distance' && activeAnchor) {
        const distA = getDistanceKm(a.lat, a.lng, activeAnchor.lat, activeAnchor.lng);
        const distB = getDistanceKm(b.lat, b.lng, activeAnchor.lat, activeAnchor.lng);
        return distA - distB;
      }
      return (b.fit_score || 0) - (a.fit_score || 0);
    });

    // 4. Generate Forensic AI Reports for every listing
    return {
      sortedProperties: sorted.map((prop, idx) => {
        const rank = idx + 1;
        return {
          ...prop,
          rank,
          is_hidden: hiddenPropertyIds.includes(prop.id),
          deep_ai_audit: prop.deep_ai_audit || generatePropertyAiAudit(prop, rank, personalPreferences),
        };
      }),
      radiusExcludedCount: excludedByRadius,
    };
  }, [allCandidateProperties, selectedSuburbs, minPrice, maxPrice, bedrooms, minSqm, safeishFilter, offMainRoadFilter, offBarsFilter, withinRadiusFilter, locationRadiusKm, fibreFilter, parkingFilter, petFriendlyFilter, privateOnlyFilter, personalPreferences, walkablePlaces, sortBy, activeAnchor, deepAiRunCount, hiddenPropertyIds, empiricalMediansLoaded, showOnlyFavourites, favouritePropertyIds, importedFavourites]);

  // Derived visible properties based on whether user toggled "Show Hidden" and "Show Favourites"
  const displayProperties = useMemo(() => {
    // 1. Tag is_favorite status from favouritePropertyIds & importedFavourites
    const tagged = sortedProperties.map((prop) => ({
      ...prop,
      is_favorite: Boolean(
        favouritePropertyIds.includes(prop.id) ||
        prop.is_favorite ||
        importedFavourites.some((fav) => fav.id === prop.id || ((fav as any).p24_id && (fav as any).p24_id === (prop as any).p24_id))
      ),
    }));

    // 2. Filter hidden if showHidden is false
    const visible = showHidden ? tagged : tagged.filter((prop) => !hiddenPropertyIds.includes(prop.id));

    // 3. Filter favourites if showOnlyFavourites is true
    const candidateList = showOnlyFavourites ? visible.filter((prop) => prop.is_favorite) : visible;

    // 4. Intelligent Multi-Listing Cross-Agency De-duplication
    // Detects and merges duplicate listings of the same apartment uploaded by different agencies
    const deduped: PropertyMapItem[] = [];
    const seenP24Ids = new Set<string>();
    const seenImgFingerprints = new Map<string, number>();
    const seenStreetSpecs = new Map<string, number>();

    const getImgFingerprint = (p: PropertyMapItem): string | null => {
      const src = (p.images && p.images[0]) || (p as any).image || '';
      const match = src.match(/images\.prop24\.com\/(\d+)/);
      return match ? match[1] : null;
    };

    const getStreetKey = (p: PropertyMapItem): string | null => {
      const addr = (p.address || '').toLowerCase().trim();
      if (!addr || addr.includes('contact agent') || addr.includes('withheld') || addr.includes('to rent in')) return null;
      const streetClues = ['street', 'st', 'road', 'rd', 'avenue', 'ave', 'drive', 'dr', 'circle', 'lane', 'close', 'crescent', 'cres', 'way', 'walk', 'court', 'terrace', 'terraces', 'boulevard', 'blvd'];
      const hasClue = streetClues.some(c => new RegExp(`\\b${c}\\b`).test(addr));
      if (!hasClue) return null;
      const cleanAddr = addr.replace(/^(?:unit|apt|apartment|flat)\s*\d+[a-zA-Z]?\s*,\s*/i, '').replace(/,\s*cape town.*$/i, '').trim();
      const beds = p.bedrooms || 1;
      const sqm = (p as any).sqm || 0;
      return `${cleanAddr}|${beds}|${sqm}`;
    };

    for (const prop of candidateList) {
      const p24Id = String((prop as any).p24_id || prop.id || '').replace('p24-', '');
      if (p24Id && seenP24Ids.has(p24Id)) continue;

      const imgFp = getImgFingerprint(prop);
      const stKey = getStreetKey(prop);

      let existingIdx: number | undefined = undefined;
      if (imgFp && seenImgFingerprints.has(imgFp)) {
        existingIdx = seenImgFingerprints.get(imgFp);
      } else if (stKey && seenStreetSpecs.has(stKey)) {
        existingIdx = seenStreetSpecs.get(stKey);
      }

      if (existingIdx !== undefined) {
        // Duplicate detected! Keep the one with the better price
        const prev = deduped[existingIdx];
        if (prop.price && prev.price && prop.price < prev.price) {
          seenP24Ids.delete(String((prev as any).p24_id || prev.id || '').replace('p24-', ''));
          seenP24Ids.add(p24Id);
          deduped[existingIdx] = prop;
          if (imgFp) seenImgFingerprints.set(imgFp, existingIdx);
          if (stKey) seenStreetSpecs.set(stKey, existingIdx);
        }
        continue;
      }

      const idx = deduped.length;
      if (p24Id) seenP24Ids.add(p24Id);
      if (imgFp) seenImgFingerprints.set(imgFp, idx);
      if (stKey) seenStreetSpecs.set(stKey, idx);
      deduped.push(prop);
    }

    return deduped;
  }, [sortedProperties, importedFavourites, favouritePropertyIds, hiddenPropertyIds, showHidden, showOnlyFavourites]);

  const hiddenCount = useMemo(() => {
    return sortedProperties.filter((prop) => hiddenPropertyIds.includes(prop.id)).length;
  }, [sortedProperties, hiddenPropertyIds]);

  const favouriteCount = useMemo(() => {
    return displayProperties.filter((p) => p.is_favorite).length;
  }, [displayProperties]);

  const totalFavouritesCount = useMemo(() => {
    const ids = new Set(favouritePropertyIds);
    for (const f of importedFavourites) ids.add(f.id);
    return ids.size;
  }, [favouritePropertyIds, importedFavourites]);

  // Whenever the Areas filter (selectedSuburbs) changes, clear any selected listing and frame the area cleanly
  const areasFilterKey = selectedSuburbs.map((s) => s.toLowerCase().trim()).join('|');
  useEffect(() => {
    setSelectedPropertyId(null);
    if (displayProperties.length > 0) {
      const topListing = displayProperties[0];
      setFocusTarget({
        lat: topListing.lat,
        lng: topListing.lng,
        zoom: 13.6,
        timestamp: Date.now(),
      });
    } else if (selectedSuburbs.length > 0) {
      const coords = resolveLocationCoords(selectedSuburbs[0]);
      setFocusTarget({
        lat: coords.lat,
        lng: coords.lng,
        zoom: 13.6,
        timestamp: Date.now(),
      });
    }
  }, [areasFilterKey]);

  // Auto-scroll left sidebar to selected property when clicked/highlighted on map
  useEffect(() => {
    if (!selectedPropertyId) return;
    if (isListCollapsed) {
      setIsListCollapsed(false);
    }
    const timer = setTimeout(() => {
      const el = document.getElementById(`property-card-${selectedPropertyId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedPropertyId, isListCollapsed]);

  // Photos and galleries are fetched strictly on-demand when user clicks card navigation,
  // preventing automated background request bursts to Property24.

  return (
    <div className="fixed inset-0 top-16 bg-zinc-50 flex flex-col font-sans select-none overflow-hidden z-10">
      <Navbar user={user} profile={profile} handleLogout={logout} />

      {/* Live Scrape & AI Analysis Floating Toast Notification */}
      {scrapeStatusText && (
        <div className="fixed top-20 right-6 z-[150] animate-in fade-in slide-in-from-top-3 duration-200">
          <div className={`px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-2.5 text-xs font-bold ${scrapeStatusText.includes('Found') || scrapeStatusText.includes('complete')
            ? 'bg-emerald-950/95 text-emerald-100 border-emerald-500/60 shadow-emerald-950/40'
            : scrapeStatusText.includes('Scraping') || scrapeStatusText.includes('Running') || scrapeStatusText.includes('Connecting')
              ? 'bg-indigo-950/95 text-indigo-100 border-indigo-500/60 shadow-indigo-950/40'
              : 'bg-zinc-950/95 text-zinc-100 border-zinc-700/60 shadow-black/40'
            }`}>
            {scrapeStatusText.includes('Scraping') || scrapeStatusText.includes('Running') || scrapeStatusText.includes('Connecting') ? (
              <CircleNotch size={16} className="animate-spin text-indigo-400 shrink-0" />
            ) : scrapeStatusText.includes('Found') || scrapeStatusText.includes('complete') ? (
              <CheckCircle size={16} weight="fill" className="text-emerald-400 shrink-0" />
            ) : (
              <Info size={16} weight="bold" className="text-amber-400 shrink-0" />
            )}
            <span>{scrapeStatusText}</span>
            <button
              type="button"
              onClick={() => setScrapeStatusText('')}
              className="ml-1.5 p-0.5 text-zinc-400 hover:text-white rounded-md cursor-pointer transition-colors"
              aria-label="Dismiss message"
            >
              <X size={12} weight="bold" />
            </button>
          </div>
        </div>
      )}

      {/* TOP COMPACT CRITERIA BAR (Sticky below Navbar) */}
      <header className="sticky top-0 w-full bg-white/98 backdrop-blur-md border-b border-zinc-200 z-[100] px-3 py-2 shadow-xs shrink-0">
        <div className="w-full flex items-center justify-between flex-wrap gap-2">

          {/* Left Group: Areas & Core Property Selectors */}
          <div className="flex items-center flex-wrap gap-1.5 min-w-0">
            {/* 0. Areas (Area Group Templates Selector) */}
            <div className="relative shrink-0 flex items-center" ref={savedSearchMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsSavedSearchMenuOpen(!isSavedSearchMenuOpen);
                  setIsAnchorMenuOpen(false);
                  setIsBudgetMenuOpen(false);
                }}
                className="h-7 flex items-center gap-1.5 px-2.5 rounded-xl text-[11px] font-extrabold bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 border border-zinc-200 transition-all cursor-pointer shadow-2xs leading-none"
                title="Switch or Save Area Group Templates"
              >
                <MapPin size={13} weight="fill" className="text-indigo-600 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Areas:</span>
                <span className="truncate max-w-[210px]">
                  {savedSearches.find(s => s.id === activeSavedSearchId)?.name || 'Select Area Group'}
                </span>
                <CaretDown size={11} weight="bold" className="text-zinc-500 shrink-0" />
              </button>

              {/* Areas (Templates) Dropdown Popover */}
              {isSavedSearchMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-zinc-200 p-3 z-[110] animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <span className="font-extrabold text-xs text-zinc-950 flex items-center gap-1.5">
                      <MapPin size={14} className="text-indigo-600" weight="fill" />
                      Areas (Suburb Group Templates)
                    </span>
                    <button onClick={() => setIsSavedSearchMenuOpen(false)} className="text-zinc-400 hover:text-zinc-700 p-0.5 cursor-pointer">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1.5 py-2">
                    {savedSearches.map((preset) => (
                      <div
                        key={preset.id}
                        onClick={() => applySavedSearch(preset)}
                        className={`p-2.5 rounded-xl text-xs cursor-pointer transition-all border ${activeSavedSearchId === preset.id
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-950 font-bold shadow-2xs'
                          : 'bg-zinc-50/60 hover:bg-zinc-100 border-zinc-200/60 text-zinc-700'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-extrabold text-xs text-zinc-950 truncate">{preset.name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="px-1.5 py-0.5 rounded-md bg-indigo-100/80 text-indigo-800 text-[9px] font-black">
                              {preset.suburbs.length} {preset.suburbs.length === 1 ? 'area' : 'areas'}
                            </span>
                            {preset.isCustom && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteSavedSearch(preset.id, e)}
                                className="text-zinc-400 hover:text-rose-600 p-1"
                                title="Delete area template"
                              >
                                <Trash size={12} weight="bold" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center flex-wrap gap-1 mt-1">
                          {preset.suburbs.map((sub) => (
                            <span
                              key={sub}
                              className="px-1.5 py-0.5 rounded-md bg-white border border-zinc-200/80 text-[10px] font-semibold text-zinc-600"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save Current Area Group Form */}
                  <div className="pt-2 border-t border-zinc-100">
                    {!isSavingSearch ? (
                      <button
                        type="button"
                        onClick={() => setIsSavingSearch(true)}
                        className="w-full py-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={13} weight="bold" className="text-indigo-600" />
                        <span>Save Current Areas As Template</span>
                      </button>
                    ) : (
                      <div className="space-y-1.5 animate-in fade-in duration-100">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Area Group Name:</span>
                        <input
                          type="text"
                          placeholder="e.g. Atlantic Seaboard & Surfs"
                          value={newSearchName}
                          onChange={(e) => setNewSearchName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveCurrentSearch();
                          }}
                          className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-zinc-200 focus:outline-none focus:border-indigo-600"
                          autoFocus
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleSaveCurrentSearch}
                            className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <FloppyDisk size={13} weight="bold" />
                            <span>Save Areas</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsSavingSearch(false);
                              setNewSearchName('');
                            }}
                            className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl text-xs font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 1. Budget Interactive Dual-Slider Filter (In & Out Points) */}
            <div className="relative shrink-0 flex items-center" ref={budgetMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsBudgetMenuOpen(!isBudgetMenuOpen);
                  setIsSavedSearchMenuOpen(false);
                  setIsAnchorMenuOpen(false);
                }}
                className={`h-7 w-[172px] sm:w-[185px] shrink-0 flex items-center justify-between gap-1 px-2.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer leading-none shadow-2xs ${isBudgetMenuOpen
                  ? 'bg-zinc-950 text-white border-zinc-950 ring-2 ring-zinc-950/20 shadow-xs'
                  : (minPrice && minPrice !== '0') || (maxPrice && maxPrice !== '50000' && maxPrice !== '999999')
                    ? 'bg-indigo-50 hover:bg-indigo-100/70 border-indigo-300 text-indigo-950 font-extrabold'
                    : 'bg-zinc-100 hover:bg-zinc-200/80 border-zinc-200 text-zinc-700'
                  }`}
                title="Click to adjust monthly budget range with in & out slider handles"
              >
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">Budget:</span>
                  <span className="font-extrabold tabular-nums truncate">
                    {(() => {
                      const minNum = parseInt(minPrice) || 0;
                      const maxNum = parseInt(maxPrice) || 0;
                      if (!minNum && (!maxNum || maxNum >= 50000)) return 'Any';
                      if (!minNum && maxNum) return `< R ${formatPriceAbbr(maxNum)}`;
                      if (minNum && (!maxNum || maxNum >= 50000)) return `> R ${formatPriceAbbr(minNum)}`;
                      return `R ${formatPriceAbbr(minNum)} – R ${formatPriceAbbr(maxNum)}`;
                    })()}
                  </span>
                </div>
                <SlidersHorizontal size={12} weight="bold" className={`shrink-0 ${isBudgetMenuOpen ? 'text-indigo-400' : 'text-zinc-500'}`} />
              </button>

              {/* Budget Slider Popover with In & Out points */}
              {isBudgetMenuOpen && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="absolute left-0 top-full mt-2 w-80 sm:w-88 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200 p-4 z-[110] animate-in fade-in zoom-in-95 duration-150 select-none"
                >
                  {/* Popover Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
                        <SlidersHorizontal size={14} weight="bold" />
                      </div>
                      <div>
                        <span className="font-extrabold text-xs text-zinc-950 block">Monthly Budget</span>
                        <span className="text-[10px] text-zinc-400 font-medium block">Drag in &amp; out points to filter</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBudgetMenuOpen(false)}
                      className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* In-Point (Min) and Out-Point (Max) Input Boxes */}
                  {(() => {
                    const SLIDER_MIN = 5000;
                    const SLIDER_MAX = 50000;
                    const SLIDER_STEP = 500;
                    const currMin = parseInt(minPrice) || SLIDER_MIN;
                    const currMax = parseInt(maxPrice) || SLIDER_MAX;
                    const clampedMin = Math.max(SLIDER_MIN, Math.min(currMin, SLIDER_MAX - SLIDER_STEP));
                    const clampedMax = Math.max(clampedMin + SLIDER_STEP, Math.min(currMax, SLIDER_MAX));
                    const minPercent = ((clampedMin - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
                    const maxPercent = ((clampedMax - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;

                    return (
                      <div className="py-3.5 space-y-4">
                        {/* Dual Number Display / Inputs */}
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 p-2 rounded-xl bg-zinc-50 border border-zinc-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                            <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-400">
                              In-Point (Min)
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs font-black text-indigo-600">R</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={minPrice}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^0-9]/g, '');
                                  setMinPrice(v);
                                }}
                                className="w-full text-xs font-black tabular-nums text-zinc-900 bg-transparent focus:outline-none"
                                placeholder="5000"
                              />
                            </div>
                          </div>

                          <div className="text-zinc-400 font-black text-xs shrink-0">to</div>

                          <div className="flex-1 p-2 rounded-xl bg-zinc-50 border border-zinc-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                            <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-400">
                              Out-Point (Max)
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs font-black text-indigo-600">R</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={maxPrice}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^0-9]/g, '');
                                  setMaxPrice(v);
                                }}
                                className="w-full text-xs font-black tabular-nums text-zinc-900 bg-transparent focus:outline-none"
                                placeholder="50000"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Dual-Handle Range Slider (In-point & Out-point) */}
                        <div className="relative pt-2 pb-1 px-1">
                          {/* Background Base Track */}
                          <div className="relative h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                            <div
                              className="absolute h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
                              style={{
                                left: `${minPercent}%`,
                                width: `${Math.max(0, maxPercent - minPercent)}%`,
                              }}
                            />
                          </div>

                          {/* In-Point Range Input (Min) */}
                          <input
                            type="range"
                            min={SLIDER_MIN}
                            max={SLIDER_MAX}
                            step={SLIDER_STEP}
                            value={clampedMin}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const nextMin = Math.min(val, clampedMax - SLIDER_STEP);
                              setMinPrice(String(nextMin));
                            }}
                            style={{ zIndex: clampedMin > (SLIDER_MAX - SLIDER_MIN) * 0.7 ? 35 : 25 }}
                            className="absolute inset-x-1 top-1.5 w-[calc(100%-8px)] h-3 appearance-none bg-transparent pointer-events-none
                                  [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
                                  [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full
                                  [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[2.5px] [&::-webkit-slider-thumb]:border-indigo-600
                                  [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
                                  [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                                  [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[2.5px]
                                  [&::-moz-range-thumb]:border-indigo-600 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab
                                  [&::-moz-range-thumb]:active:cursor-grabbing"
                            aria-label="Minimum price in-point slider"
                          />

                          {/* Out-Point Range Input (Max) */}
                          <input
                            type="range"
                            min={SLIDER_MIN}
                            max={SLIDER_MAX}
                            step={SLIDER_STEP}
                            value={clampedMax}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const nextMax = Math.max(val, clampedMin + SLIDER_STEP);
                              setMaxPrice(String(nextMax));
                            }}
                            style={{ zIndex: clampedMin > (SLIDER_MAX - SLIDER_MIN) * 0.7 ? 25 : 35 }}
                            className="absolute inset-x-1 top-1.5 w-[calc(100%-8px)] h-3 appearance-none bg-transparent pointer-events-none
                                  [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
                                  [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full
                                  [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[2.5px] [&::-webkit-slider-thumb]:border-indigo-600
                                  [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
                                  [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                                  [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[2.5px]
                                  [&::-moz-range-thumb]:border-indigo-600 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab
                                  [&::-moz-range-thumb]:active:cursor-grabbing"
                            aria-label="Maximum price out-point slider"
                          />

                          {/* Scale Markers */}
                          <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 mt-3 px-0.5">
                            <span>R 5k</span>
                            <span>R 15k</span>
                            <span>R 25k</span>
                            <span>R 35k</span>
                            <span>R 50k+</span>
                          </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="pt-2.5 border-t border-zinc-100">
                          <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                            Quick Presets
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: '< R 12k', min: '5000', max: '12000' },
                              { label: 'R 10k–16k', min: '10000', max: '16000' },
                              { label: 'R 14k–20k', min: '14000', max: '20000' },
                              { label: 'R 18k–30k', min: '18000', max: '30000' },
                              { label: 'Any', min: '5000', max: '50000' },
                            ].map((preset) => {
                              const isSelected = minPrice === preset.min && maxPrice === preset.max;
                              return (
                                <button
                                  key={preset.label}
                                  type="button"
                                  onClick={() => {
                                    setMinPrice(preset.min);
                                    setMaxPrice(preset.max);
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${isSelected
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                                    }`}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Popover Footer: Live Count & Done Button */}
                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-500">
                      <strong className="text-zinc-950 font-extrabold tabular-nums inline-block min-w-[14px]">{displayProperties.length}</strong> listings in range
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsBudgetMenuOpen(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="h-7 flex items-center gap-1 bg-zinc-100 px-2.5 rounded-xl text-[11px] border border-zinc-200 leading-none">
              <span className="text-[10px] font-bold text-zinc-400">Beds:</span>
              <select
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="font-bold text-zinc-800 bg-transparent focus:outline-none cursor-pointer leading-none"
              >
                <option value="0.5+">0.5+ Bed</option>
                <option value="1+">1+ Bed</option>
                <option value="2+">2+ Beds</option>
                <option value="3+">3+ Beds</option>
                <option value="any">Any</option>
              </select>
            </div>

            {/* 2B. Minimum Size (sqm) Slider Filter */}
            <div className="relative shrink-0 flex items-center" ref={sizeMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsSizeMenuOpen(!isSizeMenuOpen);
                  setIsBudgetMenuOpen(false);
                  setIsSavedSearchMenuOpen(false);
                  setIsAnchorMenuOpen(false);
                }}
                className={`h-7 shrink-0 flex items-center justify-between gap-1.5 px-2.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer leading-none shadow-2xs ${isSizeMenuOpen
                  ? 'bg-zinc-950 text-white border-zinc-950 ring-2 ring-zinc-950/20 shadow-xs'
                  : minSqm > 0
                    ? 'bg-indigo-50 hover:bg-indigo-100/70 border-indigo-300 text-indigo-950 font-extrabold'
                    : 'bg-zinc-100 hover:bg-zinc-200/80 border-zinc-200 text-zinc-700'
                  }`}
                title="Filter by minimum floor size in square metres (m²)"
              >
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <Ruler size={12} weight="bold" className={isSizeMenuOpen ? 'text-indigo-400' : minSqm > 0 ? 'text-indigo-600' : 'text-zinc-500'} />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Size:</span>
                  <span className="font-extrabold tabular-nums">
                    {minSqm > 0 ? `${minSqm}+ m²` : 'Any'}
                  </span>
                </div>
                <CaretDown size={10} weight="bold" className={`shrink-0 ${isSizeMenuOpen ? 'text-indigo-400' : 'text-zinc-500'}`} />
              </button>

              {/* Minimum Size Slider Popover */}
              {isSizeMenuOpen && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200 p-4 z-[110] animate-in fade-in zoom-in-95 duration-150 select-none"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
                        <Ruler size={14} weight="bold" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs text-zinc-950 leading-tight">Minimum Floor Size</h4>
                        <p className="text-[10px] text-zinc-400 font-medium">Drag slider to filter by minimum m²</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSizeMenuOpen(false)}
                      className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
                    >
                      <X size={14} weight="bold" />
                    </button>
                  </div>

                  <div className="py-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                        Minimum Size
                      </span>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-50 border border-zinc-200">
                        <input
                          type="number"
                          min={0}
                          max={200}
                          step={5}
                          value={minSqm}
                          onChange={(e) => setMinSqm(Math.max(0, Math.min(200, parseInt(e.target.value) || 0)))}
                          className="w-12 text-xs font-black text-zinc-950 bg-transparent focus:outline-none text-right tabular-nums"
                        />
                        <span className="text-[11px] font-bold text-zinc-500">m²</span>
                      </div>
                    </div>

                    {/* Interactive Range Slider */}
                    <div className="relative pt-1 pb-1">
                      <div className="relative h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full"
                          style={{ width: `${Math.min(100, (minSqm / 120) * 100)}%` }}
                        />
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={120}
                        step={5}
                        value={Math.min(120, minSqm)}
                        onChange={(e) => setMinSqm(Number(e.target.value))}
                        className="absolute inset-x-0 top-0 w-full h-4 appearance-none bg-transparent cursor-pointer
                              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[2.5px]
                              [&::-webkit-slider-thumb]:border-indigo-600 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab
                              [&::-webkit-slider-thumb]:active:cursor-grabbing
                              [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
                              [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[2.5px] [&::-moz-range-thumb]:border-indigo-600
                              [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab"
                        aria-label="Minimum size in square metres"
                      />
                      <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 mt-3 px-0.5">
                        <span>Any</span>
                        <span>40m²</span>
                        <span>55m²</span>
                        <span>75m²</span>
                        <span>100m²+</span>
                      </div>
                    </div>

                    {/* Quick Size Presets */}
                    <div className="pt-2.5 border-t border-zinc-100">
                      <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                        Quick Size Presets
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: 'Any', val: 0 },
                          { label: '45+ m²', val: 45 },
                          { label: '55+ m²', val: 55 },
                          { label: '65+ m²', val: 65 },
                          { label: '80+ m²', val: 80 },
                          { label: '100+ m²', val: 100 },
                        ].map((preset) => {
                          const isSelected = minSqm === preset.val;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => setMinSqm(preset.val)}
                              className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${isSelected
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                                }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-500">
                      <strong className="text-zinc-950 font-extrabold tabular-nums inline-block min-w-[14px]">{displayProperties.length}</strong> listings match
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSizeMenuOpen(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Desirable Locations & Trailheads Button */}
            <div className="relative flex items-center" ref={anchorMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsAnchorMenuOpen(!isAnchorMenuOpen);
                  setIsSavedSearchMenuOpen(false);
                  setIsBudgetMenuOpen(false);
                  setIsSizeMenuOpen(false);
                }}
                title={
                  activeAnchor
                    ? withinRadiusFilter
                      ? `Filtering properties within ${locationRadiusKm.toFixed(1)} km of ${activeAnchor.label}. Click to change location or mode.`
                      : `Ranking properties near ${activeAnchor.label} (≤${locationRadiusKm.toFixed(1)} km boosted, all shown). Click to change location or mode.`
                    : 'Select an attraction or amenity anchor'
                }
                className={`h-7 flex items-center gap-1.5 px-2.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer leading-none ${activeAnchor
                  ? withinRadiusFilter
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-950 shadow-xs ring-1 ring-indigo-500/25'
                    : activeAnchor.iconType === 'gym'
                      ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs'
                      : activeAnchor.iconType === 'cafe'
                        ? 'bg-orange-50 border-orange-300 text-orange-950 shadow-xs'
                        : activeAnchor.iconType === 'shop'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                          : activeAnchor.iconType === 'surf' || activeAnchor.iconType === 'beach'
                            ? 'bg-cyan-50 border-cyan-300 text-cyan-950 shadow-xs'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-700'
                  }`}
              >
                {activeAnchor?.iconType === 'gym' ? (
                  <Dumbbell size={13} className="text-amber-600 shrink-0" />
                ) : activeAnchor?.iconType === 'cafe' ? (
                  <Coffee size={13} weight="fill" className="text-orange-600 shrink-0" />
                ) : activeAnchor?.iconType === 'shop' ? (
                  <ShoppingBag size={13} className="text-emerald-600 shrink-0" />
                ) : activeAnchor?.iconType === 'surf' || activeAnchor?.iconType === 'beach' ? (
                  <Waves size={13} weight="fill" className="text-cyan-600 shrink-0" />
                ) : activeAnchor?.iconType === 'trail' ? (
                  <Tree size={13} weight="bold" className="text-emerald-600 shrink-0" />
                ) : (
                  <Target size={13} weight="bold" className="text-indigo-600 shrink-0" />
                )}
                <span className="truncate max-w-[125px]">{activeAnchor ? activeAnchor.label : 'Select Attraction'}</span>
                {activeAnchor ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setWithinRadiusFilter(!withinRadiusFilter);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        setWithinRadiusFilter(!withinRadiusFilter);
                      }
                    }}
                    title={
                      withinRadiusFilter
                        ? `Filter mode ON (hiding properties > ${locationRadiusKm.toFixed(1)} km). Click to switch to Rank only.`
                        : `Rank mode ON (showing all properties, boosting ≤ ${locationRadiusKm.toFixed(1)} km). Click to switch to Filter.`
                    }
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold leading-none tabular-nums transition-colors ${withinRadiusFilter
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-white/85 text-zinc-700 border border-zinc-200/80 hover:bg-zinc-100'
                      }`}
                  >
                    ≤{locationRadiusKm.toFixed(1)} km · {withinRadiusFilter ? 'Filter' : 'Rank'}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-zinc-200/80 rounded-md text-[10px] font-extrabold text-zinc-800 leading-none">
                    {templateAttractions.length + templateGyms.length + templateCafes.length + templateShops.length}
                  </span>
                )}
              </button>

              {/* Anchor Dropdown Popover */}
              {isAnchorMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-84 bg-white rounded-2xl shadow-2xl border border-zinc-200 p-3 z-[110] animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <span className="font-extrabold text-xs text-zinc-950 flex items-center gap-1.5">
                      <Compass size={14} className="text-indigo-600" weight="bold" />
                      Amenities & POIs · {activeTemplate?.name ? activeTemplate.name.replace(/^[^\w\s]+\s*/, '') : 'Area'}
                    </span>
                    <button onClick={() => setIsAnchorMenuOpen(false)} className="text-zinc-400 hover:text-zinc-700 p-0.5">
                      <X size={14} />
                    </button>
                  </div>

                  {activeAnchor && (
                    <div className="py-2 border-b border-zinc-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
                          Radius Mode (≤{locationRadiusKm.toFixed(1)} km)
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate">
                          {withinRadiusFilter ? 'Hiding properties outside circle' : 'Showing all · boosting inside circle'}
                        </div>
                      </div>
                      <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 border border-zinc-200 shrink-0">
                        <button
                          type="button"
                          onClick={() => setWithinRadiusFilter(false)}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${!withinRadiusFilter
                            ? 'bg-white text-zinc-950 shadow-2xs'
                            : 'text-zinc-500 hover:text-zinc-800'
                            }`}
                        >
                          Rank
                        </button>
                        <button
                          type="button"
                          onClick={() => setWithinRadiusFilter(true)}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${withinRadiusFilter
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-zinc-500 hover:text-zinc-800'
                            }`}
                        >
                          Filter
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="max-h-80 overflow-y-auto space-y-3 py-2 pr-1">
                    {/* 1. Gyms Group */}
                    {templateGyms.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
                          <span className="flex items-center gap-1">
                            <Dumbbell size={11} /> Gyms in Area
                          </span>
                          <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md font-black text-[9px]">
                            {templateGyms.length}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {templateGyms.map((anc) => (
                            <div
                              key={anc.id}
                              onClick={() => {
                                setActiveAnchorId(anc.id);
                                setIsAnchorMenuOpen(false);
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                                ? 'bg-amber-50 text-amber-950 font-bold border border-amber-300'
                                : 'hover:bg-zinc-50 text-zinc-700'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Dumbbell size={14} className="text-amber-600 shrink-0" />
                                <span className="truncate">{anc.label}</span>
                              </div>
                              {activeAnchorId === anc.id && (
                                <Check size={14} weight="bold" className="text-amber-600 shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. Cafes & Bakeries Group */}
                    {templateCafes.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-orange-700">
                          <span className="flex items-center gap-1">
                            <Coffee size={11} weight="fill" /> Cafes & Bakeries
                          </span>
                          <span className="bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded-md font-black text-[9px]">
                            {templateCafes.length}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {templateCafes.map((anc) => (
                            <div
                              key={anc.id}
                              onClick={() => {
                                setActiveAnchorId(anc.id);
                                setIsAnchorMenuOpen(false);
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                                ? 'bg-orange-50 text-orange-950 font-bold border border-orange-300'
                                : 'hover:bg-zinc-50 text-zinc-700'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Coffee size={14} weight="fill" className="text-orange-600 shrink-0" />
                                <span className="truncate">{anc.label}</span>
                              </div>
                              {activeAnchorId === anc.id && (
                                <Check size={14} weight="bold" className="text-orange-600 shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. Shops & Retail Centres Group */}
                    {templateShops.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                          <span className="flex items-center gap-1">
                            <ShoppingBag size={11} /> Shops & Retail
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-md font-black text-[9px]">
                            {templateShops.length}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {templateShops.map((anc) => (
                            <div
                              key={anc.id}
                              onClick={() => {
                                setActiveAnchorId(anc.id);
                                setIsAnchorMenuOpen(false);
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                                ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-300'
                                : 'hover:bg-zinc-50 text-zinc-700'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <ShoppingBag size={14} className="text-emerald-600 shrink-0" />
                                <span className="truncate">{anc.label}</span>
                              </div>
                              {activeAnchorId === anc.id && (
                                <Check size={14} weight="bold" className="text-emerald-600 shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4. Main Outdoors & Attractions */}
                    {templateAttractions.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-cyan-800">
                          <span className="flex items-center gap-1">
                            <Waves size={11} weight="bold" /> Outdoors & Attractions
                          </span>
                          <span className="bg-cyan-100 text-cyan-800 px-1.5 py-0.2 rounded-md font-black text-[9px]">
                            {templateAttractions.length}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {templateAttractions.map((anc) => (
                            <div
                              key={anc.id}
                              onClick={() => {
                                setActiveAnchorId(anc.id);
                                setIsAnchorMenuOpen(false);
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                                ? 'bg-cyan-50 text-cyan-950 font-bold border border-cyan-300'
                                : 'hover:bg-zinc-50 text-zinc-700'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {anc.iconType === 'trail' ? (
                                  <Tree size={14} weight="fill" className="text-emerald-600 shrink-0" />
                                ) : anc.iconType === 'surf' || anc.iconType === 'beach' ? (
                                  <Waves size={14} weight="fill" className="text-cyan-600 shrink-0" />
                                ) : anc.iconType === 'cafe' ? (
                                  <Coffee size={14} weight="fill" className="text-amber-600 shrink-0" />
                                ) : (
                                  <Compass size={14} weight="bold" className="text-indigo-600 shrink-0" />
                                )}
                                <span className="truncate">{anc.label}</span>
                              </div>
                              {activeAnchorId === anc.id && (
                                <Check size={14} weight="bold" className="text-cyan-600 shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 5. Other Regional Hubs */}
                    {otherAnchors.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                          <span>Other Regional Hubs</span>
                          <span className="text-[9px] font-bold text-zinc-400">{otherAnchors.length}</span>
                        </div>
                        <div className="space-y-1">
                          {otherAnchors.slice(0, 6).map((anc) => (
                            <div
                              key={anc.id}
                              onClick={() => {
                                setActiveAnchorId(anc.id);
                                setIsAnchorMenuOpen(false);
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                                ? 'bg-zinc-100 text-zinc-950 font-bold border border-zinc-300'
                                : 'hover:bg-zinc-50 text-zinc-600'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {anc.iconType === 'gym' ? (
                                  <Dumbbell size={14} className="text-zinc-500 shrink-0" />
                                ) : anc.iconType === 'cafe' ? (
                                  <Coffee size={14} weight="fill" className="text-zinc-500 shrink-0" />
                                ) : anc.iconType === 'shop' ? (
                                  <ShoppingBag size={14} className="text-zinc-500 shrink-0" />
                                ) : anc.iconType === 'trail' ? (
                                  <Tree size={14} weight="fill" className="text-zinc-500 shrink-0" />
                                ) : anc.iconType === 'surf' || anc.iconType === 'beach' ? (
                                  <Waves size={14} weight="fill" className="text-zinc-500 shrink-0" />
                                ) : (
                                  <Target size={14} weight="bold" className="text-zinc-500 shrink-0" />
                                )}
                                <span className="truncate">{anc.label}</span>
                              </div>
                              {activeAnchorId === anc.id && (
                                <Check size={14} weight="bold" className="text-zinc-900 shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Add Custom Spot Form with Real-Time Auto-Suggestions */}
                  <div className="pt-2 border-t border-zinc-100 space-y-1.5 relative">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Add Custom Location:
                    </span>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Type location (e.g. Scarborough Beach, Deer Park)"
                        value={newAnchorLabel}
                        onChange={(e) => {
                          setNewAnchorLabel(e.target.value);
                          setIsAnchorInputFocused(true);
                          setAnchorAutoIndex(0);
                        }}
                        onFocus={() => setIsAnchorInputFocused(true)}
                        onBlur={() => {
                          // Delay closing so onMouseDown on suggestions registers
                          setTimeout(() => setIsAnchorInputFocused(false), 200);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setAnchorAutoIndex((prev) => (prev + 1) % Math.max(1, anchorSuggestions.length));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setAnchorAutoIndex((prev) => (prev - 1 + anchorSuggestions.length) % Math.max(1, anchorSuggestions.length));
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (anchorSuggestions.length > 0 && anchorSuggestions[anchorAutoIndex]) {
                              handleSelectSuggestedPlace(anchorSuggestions[anchorAutoIndex]);
                            } else {
                              handleAddCustomAnchor();
                            }
                          } else if (e.key === 'Escape') {
                            setIsAnchorInputFocused(false);
                          }
                        }}
                        className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-zinc-200 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 font-medium"
                      />

                      {/* Auto-suggestions Dropdown Popover */}
                      {isAnchorInputFocused && newAnchorLabel.trim().length > 0 && anchorSuggestions.length > 0 && (
                        <div className="absolute bottom-full mb-1.5 inset-x-0 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200 p-1.5 z-[115] max-h-52 overflow-y-auto animate-in fade-in duration-100">
                          <div className="px-2 py-1 text-[9.5px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 flex items-center justify-between">
                            <span>Suggested Locations</span>
                            <span className="text-[9px] text-zinc-400 font-normal">Press Enter ↵</span>
                          </div>
                          <div className="space-y-0.5 mt-1">
                            {anchorSuggestions.map((place, idx) => (
                              <div
                                key={place.name + place.lat}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectSuggestedPlace(place);
                                }}
                                className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors ${idx === anchorAutoIndex
                                  ? 'bg-indigo-50 text-indigo-950 font-bold border border-indigo-200/80 shadow-2xs'
                                  : 'hover:bg-zinc-50 text-zinc-800'
                                  }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  {place.iconType === 'gym' ? (
                                    <Dumbbell size={13} className="text-amber-600 shrink-0" />
                                  ) : place.iconType === 'surf' || place.iconType === 'beach' ? (
                                    <Waves size={13} weight="fill" className="text-cyan-600 shrink-0" />
                                  ) : place.iconType === 'trail' ? (
                                    <Tree size={13} weight="fill" className="text-emerald-600 shrink-0" />
                                  ) : place.iconType === 'cafe' ? (
                                    <Coffee size={13} weight="fill" className="text-amber-600 shrink-0" />
                                  ) : (
                                    <Target size={13} weight="bold" className="text-indigo-600 shrink-0" />
                                  )}
                                  <div className="truncate text-left">
                                    <span className="block font-bold text-zinc-950 leading-tight truncate">{place.name}</span>
                                    <span className="block text-[10px] text-zinc-400 leading-tight truncate">{place.category}</span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-extrabold text-indigo-600 shrink-0 ml-1.5 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200/60">
                                  + Add
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCustomAnchor}
                      className="w-full py-1.5 bg-zinc-950 hover:bg-black text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      + Add to Map
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Inline Proximity Radius Slider (next to location dropdown) */}
            {activeAnchor && (
              <div className="h-7 flex items-center gap-1.5 px-2.5 rounded-xl bg-zinc-50 border border-zinc-200/90 shrink-0">
                <Target size={12} weight="bold" className="text-indigo-600 shrink-0" />
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={0.5}
                  value={locationRadiusKm}
                  onChange={(e) => setLocationRadiusKm(parseFloat(e.target.value))}
                  className="w-20 sm:w-24 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                  aria-label="Location Radius Ring Slider"
                  title={`Adjust radius around ${activeAnchor.label}: ${locationRadiusKm.toFixed(1)} km`}
                />
                <span className="text-[11px] font-extrabold text-indigo-700 tabular-nums whitespace-nowrap">
                  {locationRadiusKm.toFixed(1)} km
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: Left = Selected Area Pills & "+ Add area..." | Right = Top 10 Rank & Scrape P24 */}
        <div className="w-full flex items-center justify-between flex-wrap gap-2 pt-1.5 mt-1.5 border-t border-zinc-100">
          {/* Left: Suburb Pills + Autocomplete */}
          <div className="flex items-center flex-wrap gap-1.5 min-w-0">
            {selectedSuburbs.map((suburb) => (
              <span
                key={suburb}
                onClick={() => handleFocusSuburb(suburb)}
                title={`Click to pan map to ${suburb}`}
                className="h-6 inline-flex items-center gap-1 px-2.5 rounded-full text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 active:scale-95 border border-indigo-200 hover:border-indigo-300 text-indigo-900 shrink-0 cursor-pointer transition-all leading-none group"
              >
                <span>{suburb}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveSuburb(suburb);
                  }}
                  className="hover:text-rose-600 p-0.5 rounded-full transition-colors cursor-pointer flex items-center justify-center"
                  title={`Remove ${suburb}`}
                >
                  <X size={10} weight="bold" />
                </button>
              </span>
            ))}

            {/* Places Autocomplete Typeahead Input */}
            <div className="relative flex items-center shrink-0">
              <input
                type="text"
                placeholder="+ Add area..."
                value={suburbInput}
                onFocus={() => {
                  setIsInputFocused(true);
                  setAutoIndex(0);
                }}
                onBlur={() => {
                  setTimeout(() => setIsInputFocused(false), 200);
                }}
                onChange={(e) => {
                  setSuburbInput(e.target.value);
                  setIsInputFocused(true);
                  setAutoIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setAutoIndex((prev) => (prev + 1) % Math.max(1, autocompleteSuggestions.length));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setAutoIndex((prev) => (prev - 1 + autocompleteSuggestions.length) % Math.max(1, autocompleteSuggestions.length));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (autocompleteSuggestions.length > 0 && autocompleteSuggestions[autoIndex]) {
                      handleAddSuburb(autocompleteSuggestions[autoIndex].name);
                    } else if (suburbInput.trim()) {
                      handleAddSuburb(suburbInput);
                    }
                  } else if (e.key === 'Escape') {
                    setIsInputFocused(false);
                  }
                }}
                className="h-6 w-28 focus:w-44 text-[11px] px-2.5 rounded-full border border-zinc-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all placeholder:text-zinc-400 bg-zinc-50/80 font-medium leading-none"
              />

              {/* Autocomplete Suggestions Menu */}
              {isInputFocused && suburbInput.trim().length > 0 && (
                <div className="absolute top-full left-0 mt-1.5 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200 py-1.5 z-[110] animate-in fade-in zoom-in-95 duration-100 overflow-hidden divide-y divide-zinc-50">
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                    <span>Neighborhoods</span>
                    <span className="text-[9px] text-zinc-400 font-normal">Press Enter ↵</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {autocompleteSuggestions.length > 0 ? (
                      autocompleteSuggestions.map((sub, idx) => (
                        <div
                          key={sub.name}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleAddSuburb(sub.name);
                          }}
                          className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${idx === autoIndex ? 'bg-indigo-50/90 text-indigo-950 font-bold' : 'hover:bg-zinc-50 text-zinc-800'
                            }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${idx === autoIndex ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                              <MapPin size={12} weight="bold" />
                            </div>
                            <div className="truncate">
                              <span className="font-extrabold text-xs block leading-tight truncate">{sub.name}</span>
                              <span className="text-[10px] text-zinc-400 font-medium block leading-tight truncate">{sub.region}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md shrink-0">
                            + Add
                          </span>
                        </div>
                      ))
                    ) : (
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAddSuburb(suburbInput);
                        }}
                        className="px-3 py-2.5 text-xs text-zinc-500 hover:bg-zinc-50 cursor-pointer flex items-center justify-between"
                      >
                        <span className="truncate">Add "{suburbInput.trim()}"</span>
                        <span className="text-[10px] font-bold text-indigo-600">+ Add</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Primary Actions (Top 10 Rank & Scrape P24) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {/* Top 10 Data-Driven Match Ranker Button */}
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="h-7 flex items-center gap-1.5 px-3 rounded-xl text-[11px] font-black border transition-all cursor-pointer leading-none shadow-xs bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white border-indigo-500 ring-2 ring-purple-400/20 active:scale-[0.98] shrink-0 whitespace-nowrap"
              title="Configure walkable places & criteria to rank Top 10 matches locally ($0)"
            >
              <Sparkle size={13} weight="fill" className="text-amber-300 shrink-0" />
              <span>Rank Top 10</span>
            </button>

            {/* 4. SCRAPE P24 ACTION BUTTON */}
            <button
              type="button"
              onClick={handleScrapeP24}
              disabled={isScraping || Date.now() < rateGuardUntil}
              className={`h-7 flex items-center gap-1.5 px-3 rounded-xl text-[11px] font-extrabold shadow-md transition-all leading-none shrink-0 whitespace-nowrap ${isScraping
                ? 'bg-indigo-850 text-indigo-200 cursor-wait ring-2 ring-indigo-400'
                : Date.now() < rateGuardUntil
                  ? 'bg-amber-600/90 text-white cursor-not-allowed opacity-90'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white shadow-indigo-600/20 cursor-pointer'
                }`}
              title={Date.now() < rateGuardUntil ? 'Rate-Limit Shield active — cooling down to prevent Property24 IP blocks' : 'Scrape Property24 live listings for selected suburbs'}
            >
              {isScraping ? (
                <CircleNotch size={13} className="animate-spin text-white shrink-0" />
              ) : (
                <Sparkle size={13} weight="fill" className="text-amber-300 shrink-0" />
              )}
              <span>{isScraping ? 'Scraping P24...' : Date.now() < rateGuardUntil ? 'Shield Cooldown' : 'Scrape P24'}</span>
            </button>
          </div>
        </div>

        {/* ROW 3: Feature Filter Buttons */}
        <div className="w-full flex items-center flex-wrap gap-1.5 pt-1.5 mt-1.5 border-t border-zinc-100/80">
          <button
            type="button"
            onClick={() => setFibreFilter(!fibreFilter)}
            className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${fibreFilter
              ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-1 ring-zinc-700'
              : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
              }`}
            title="Filter listings: Fibre ready internet only"
          >
            <span className={fibreFilter ? "text-cyan-300" : "text-zinc-500"}>🌐</span>
            <span>Fibre ready</span>
          </button>

          {/* Safe-ish Crime Hotspot Filter Button (ON by default) */}
          <button
            type="button"
            onClick={() => setSafeishFilter(!safeishFilter)}
            className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${safeishFilter
              ? 'bg-emerald-950 text-emerald-300 border-emerald-800 shadow-2xs ring-1 ring-emerald-500/30'
              : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200/70'
              }`}
            title={
              safeishFilter
                ? "Safe-ish: ON (Default: hiding properties within High-Risk crime radii). Click to show all properties."
                : "Safe-ish: OFF (Showing all properties including those near High-Risk crime zones). Click to filter."
            }
          >
            <span className={safeishFilter ? "text-emerald-400" : "text-zinc-400"}>🛡️</span>
            <span>Safe-ish</span>
            {safeishFilter && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>

          {/* Off-Main Rd Traffic & Noise Filter Button (ON by default) */}
          <button
            type="button"
            onClick={() => setOffMainRoadFilter(!offMainRoadFilter)}
            className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${offMainRoadFilter
              ? 'bg-amber-950 text-amber-300 border-amber-800 shadow-2xs ring-1 ring-amber-500/30'
              : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200/70'
              }`}
            title={
              offMainRoadFilter
                ? "Off-Main Rd: ON (Default: hiding noisy arterial road properties like Main Rd/M4). Click to show all properties."
                : "Off-Main Rd: OFF (Showing all properties including noisy arterial road corridors). Click to filter."
            }
          >
            <span className={offMainRoadFilter ? "text-amber-400" : "text-zinc-400"}>🔇</span>
            <span>Off-Main Rd</span>
            {offMainRoadFilter && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" />
            )}
          </button>

          {/* Off-Bars & Clubs Filter Button */}
          <button
            type="button"
            onClick={() => setOffBarsFilter(!offBarsFilter)}
            className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${offBarsFilter
              ? 'bg-rose-950 text-rose-200 border-rose-800 shadow-2xs ring-1 ring-rose-500/30'
              : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200/70'
              }`}
            title={
              offBarsFilter
                ? "Off-Bars & Clubs: ON (hiding properties within close bar & nightlife noise radii). Click to show all."
                : "Off-Bars & Clubs: OFF (showing properties near bars & clubs). Click to filter out."
            }
          >
            <span className={offBarsFilter ? "text-rose-300" : "text-zinc-400"}>🍸</span>
            <span>Off-Bars/Clubs</span>
            {offBarsFilter && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse ml-0.5" />
            )}
          </button>

          {/* Within Radius Filter Button (ON by default when activeAnchor is present) */}
          {activeAnchor && (
            <button
              type="button"
              onClick={() => setWithinRadiusFilter(!withinRadiusFilter)}
              className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${withinRadiusFilter
                ? 'bg-indigo-950 text-indigo-300 border-indigo-800 shadow-2xs ring-1 ring-indigo-500/30'
                : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200/70'
                }`}
              title={
                withinRadiusFilter
                  ? `Within ${activeAnchor.label} radius: ON (Only showing properties within ${locationRadiusKm.toFixed(1)} km). Click to show all properties.`
                  : `Within ${activeAnchor.label} radius: OFF (Showing all properties; listings inside ${locationRadiusKm.toFixed(1)} km rank higher). Click to exclude outside listings.`
              }
            >
              <span className={withinRadiusFilter ? "text-indigo-400" : "text-zinc-400"}>🎯</span>
              <span>In Radius (≤{locationRadiusKm.toFixed(1)} km)</span>
              {withinRadiusFilter && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 ml-0.5" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setParkingFilter(!parkingFilter)}
            className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${parkingFilter
              ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-1 ring-zinc-700'
              : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
              }`}
            title="Filter listings: Off-street parking bay, carport, or lock-up garage (excludes street parking)"
          >
            <span className={parkingFilter ? "text-emerald-300" : "text-zinc-500"}>🅿️</span>
            <span>Off-street pkg</span>
          </button>

          <button
            type="button"
            onClick={() => setPetFriendlyFilter(!petFriendlyFilter)}
            className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${petFriendlyFilter
              ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-1 ring-zinc-700'
              : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
              }`}
            title="Filter listings: Verified pet-friendly leases only"
          >
            <span className={petFriendlyFilter ? "text-pink-300" : "text-zinc-500"}>🐾</span>
            <span>Pet-friendly</span>
          </button>

          <button
            type="button"
            onClick={() => setPrivateOnlyFilter(!privateOnlyFilter)}
            className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${privateOnlyFilter
              ? 'bg-purple-950 text-purple-100 border-purple-800 shadow-2xs ring-1 ring-purple-600 font-extrabold'
              : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
              }`}
            title="Filter listings: 100% private standalone homes only (excludes cottages on landlord grounds)"
          >
            <span className={privateOnlyFilter ? "text-purple-300" : "text-zinc-500"}>🔒</span>
            <span>Private</span>
          </button>

          {/* Hidden Posts Visibility Toggle Pill */}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowHidden(!showHidden)}
              className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${showHidden
                ? 'bg-amber-500 text-zinc-950 border-amber-600 shadow-xs ring-1 ring-amber-400 font-extrabold'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
                }`}
              title={showHidden ? "Hide dismissed listings again" : `Show ${hiddenCount} hidden / dismissed listing${hiddenCount > 1 ? 's' : ''}`}
            >
              {showHidden ? <Eye size={12} weight="bold" /> : <EyeSlash size={12} weight="bold" />}
              <span>{showHidden ? 'Showing Hidden' : 'Hidden'}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${showHidden ? 'bg-black/15 text-zinc-950' : 'bg-zinc-200 text-zinc-800'}`}>
                {hiddenCount}
              </span>
            </button>
          )}

          {/* Import Property24 Favourites Button */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all cursor-pointer leading-none shrink-0"
            title="Import your favourited properties from Property24"
          >
            <Heart size={12} weight="fill" className="text-rose-600" />
            <span>Import P24 Favs</span>
          </button>

          {/* Favourites Only Filter Toggle Pill */}
          {totalFavouritesCount > 0 && (
            <button
              type="button"
              onClick={() => setShowOnlyFavourites(!showOnlyFavourites)}
              className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${showOnlyFavourites
                ? 'bg-rose-500 text-white border-rose-600 shadow-xs ring-1 ring-rose-400 font-extrabold'
                : 'bg-rose-50/80 border-rose-200 text-rose-700 hover:bg-rose-100'
                }`}
              title={showOnlyFavourites ? "Show all properties" : `Show only ${favouriteCount} favourite${favouriteCount > 1 ? 's' : ''}`}
            >
              <Heart size={12} weight="fill" className={showOnlyFavourites ? "text-white" : "text-rose-500"} />
              <span>{showOnlyFavourites ? 'Showing Favs' : 'Favs'}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${showOnlyFavourites ? 'bg-white/20 text-white' : 'bg-rose-200/80 text-rose-800'}`}>
                {favouriteCount}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* MAIN VIEWPORT: SPLIT COLUMN + FULL-WIDTH MAP CANVAS */}
      <main className="flex-1 w-full flex relative overflow-hidden min-h-0 z-0">

        {/* LEFT / SIDE COLUMN: PROPERTY CARDS FEED */}
        <aside
          className={`h-full border-r border-zinc-200 bg-white flex flex-col z-20 shadow-md transition-all duration-300 ease-in-out ${isListCollapsed ? 'w-0 overflow-hidden border-none' : 'w-full sm:w-[340px] lg:w-[370px] xl:w-[410px] shrink-0'
            }`}
        >
          {/* Column Header */}
          <div className="shrink-0 px-3.5 py-2.5 border-b border-zinc-100 bg-white/95 backdrop-blur-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-extrabold text-sm text-zinc-950 whitespace-nowrap">
                    {displayProperties.length} Properties
                  </h2>
                  {isScraping ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                      <CircleNotch size={11} className="animate-spin text-indigo-600" />
                      <span>Loading</span>
                    </span>
                  ) : staleDataInfo?.isStale ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-300 shrink-0">
                      Stale
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                      Live
                    </span>
                  )}
                </div>
                <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                  <p className="text-[11px] text-zinc-400 font-medium truncate max-w-[160px]">
                    {selectedSuburbs.join(', ')}
                  </p>
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowHidden(!showHidden)}
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border transition-all cursor-pointer whitespace-nowrap shrink-0 ${showHidden
                        ? 'bg-amber-500 text-zinc-950 border-amber-600 shadow-2xs'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200 hover:text-zinc-900'
                        }`}
                      title={showHidden ? "Hide dismissed listings again" : `Show ${hiddenCount} hidden listing${hiddenCount > 1 ? 's' : ''}`}
                    >
                      {showHidden ? <Eye size={11} weight="bold" /> : <EyeSlash size={11} weight="bold" />}
                      <span>{showHidden ? `Hide (${hiddenCount})` : `${hiddenCount} Hidden`}</span>
                    </button>
                  )}
                  {showHidden && hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={unhideAllProperties}
                      className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 underline transition-colors cursor-pointer"
                      title="Restore all hidden listings"
                    >
                      Unhide All
                    </button>
                  )}
                </div>
                {withinRadiusFilter && activeAnchor && radiusExcludedCount > 0 && (
                  <div className="mt-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-indigo-900 truncate">
                      🎯 <strong className="font-extrabold tabular-nums">{radiusExcludedCount}</strong> outside {locationRadiusKm.toFixed(1)} km hidden
                    </span>
                    <button
                      type="button"
                      onClick={() => setWithinRadiusFilter(false)}
                      className="font-extrabold text-indigo-700 hover:text-indigo-950 underline shrink-0 cursor-pointer"
                    >
                      Show all {displayProperties.length + radiusExcludedCount}
                    </button>
                  </div>
                )}
                {staleDataInfo?.isStale && !isScraping && (
                  <div className="mt-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-300/90 flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-amber-950 leading-snug">
                      ⏳ {staleDataInfo.oldestAgeSeconds >= 86400
                        ? `Cached data is ${Math.floor(staleDataInfo.oldestAgeSeconds / 86400)}d+ old`
                        : 'Some suburb data is stale'} — scrape to refresh.
                    </span>
                    <button
                      type="button"
                      onClick={handleScrapeP24}
                      disabled={isScraping || Date.now() < rateGuardUntil}
                      className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-extrabold text-[10.5px] shrink-0 cursor-pointer shadow-2xs transition-colors"
                    >
                      {Date.now() < rateGuardUntil ? 'Cooldown' : 'Scrape Now'}
                    </button>
                  </div>
                )}
              </div>

              {/* View Mode Toggle, Sorting Dropdown & Collapse Toggle */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-zinc-100 border border-zinc-200 rounded-xl p-0.5" title="Switch feed view mode">
                  <button
                    type="button"
                    onClick={() => setFeedViewMode('cards')}
                    className={`p-1 rounded-lg transition-colors cursor-pointer ${feedViewMode === 'cards'
                      ? 'bg-white text-zinc-950 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    title="Cards View"
                    aria-label="Cards View"
                  >
                    <SquaresFour size={14} weight={feedViewMode === 'cards' ? 'fill' : 'bold'} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedViewMode('list')}
                    className={`p-1 rounded-lg transition-colors cursor-pointer ${feedViewMode === 'list'
                      ? 'bg-white text-zinc-950 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    title="Compact List View"
                    aria-label="Compact List View"
                  >
                    <ListBullets size={14} weight={feedViewMode === 'list' ? 'fill' : 'bold'} />
                  </button>
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs font-bold text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-xl px-2 py-1 focus:outline-none cursor-pointer"
                >
                  {enableFitScore && <option value="fit">Top Fit</option>}
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="distance">Nearest to Trailhead</option>
                </select>

                <button
                  type="button"
                  onClick={() => setIsListCollapsed(true)}
                  className="p-1 text-zinc-400 hover:text-zinc-800 rounded-lg hover:bg-zinc-100 transition-colors"
                  title="Collapse Card List (Full Screen Map)"
                >
                  <CaretLeft size={16} weight="bold" />
                </button>
              </div>
            </div>

            {/* Scrape / Status Banner in Feed Header */}
            {scrapeStatusText && (
              <div className={`mt-2 p-2 rounded-xl text-[11px] font-bold flex items-center justify-between gap-2 border animate-in fade-in duration-150 ${scrapeStatusText.includes('Found') || scrapeStatusText.includes('complete')
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : scrapeStatusText.includes('Scraping') || scrapeStatusText.includes('Connecting') || scrapeStatusText.includes('Running')
                  ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                  : 'bg-zinc-50 text-zinc-800 border-zinc-200'
                }`}>
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  {scrapeStatusText.includes('Scraping') || scrapeStatusText.includes('Connecting') || scrapeStatusText.includes('Running') ? (
                    <CircleNotch size={13} className="animate-spin text-indigo-600 shrink-0" />
                  ) : scrapeStatusText.includes('Found') || scrapeStatusText.includes('complete') ? (
                    <CheckCircle size={13} weight="fill" className="text-emerald-600 shrink-0" />
                  ) : (
                    <Info size={13} weight="bold" className="text-zinc-600 shrink-0" />
                  )}
                  <span className="truncate">{scrapeStatusText}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScrapeStatusText('')}
                  className="p-0.5 text-zinc-400 hover:text-zinc-700 rounded-md cursor-pointer shrink-0"
                  title="Dismiss"
                >
                  <X size={11} weight="bold" />
                </button>
              </div>
            )}
          </div>

          {/* Scrollable Property Cards Feed */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3.5">
            {(() => {
              const renderPropertyCard = (prop: PropertyMapItem) => {
                const isSelected = selectedPropertyId === prop.id;
                const isHoveredOnMap = hoveredPropertyId === prop.id;
                const isHidden = hiddenPropertyIds.includes(prop.id);
                const privacyInfo = getDwellingPrivacyInfo(prop);
                const agencyRep = getAgencyReputationInfo(prop);
                const barNoiseInfo = getPropertyBarNoiseExposure(prop);
                const busyRoadInfo = getPropertyBusyRoadExposure(prop);
                const crimePerimeter = getCrimePerimeterInfo(prop);
                const marketVal = getRiskAdjustedValuation(prop, allCandidateProperties);
                const isLandlordOnSite = privacyInfo.isLandlordOnSite;
                const distToAnchor = activeAnchor ? getDistanceKm(prop.lat, prop.lng, activeAnchor.lat, activeAnchor.lng) : null;
                const isWalkingAnchor = distToAnchor !== null && (activeAnchor?.commute_mode === 'walking' || (activeAnchor?.commute_mode !== 'driving' && distToAnchor <= 1.2));
                const isBikingAnchor = activeAnchor?.commute_mode === 'bicycling';
                const commuteDurMins = distToAnchor !== null
                  ? (isWalkingAnchor
                    ? Math.max(1, Math.round((distToAnchor / 4.8) * 60))
                    : isBikingAnchor
                      ? Math.max(1, Math.round((distToAnchor / 15.0) * 60))
                      : Math.max(2, Math.round((distToAnchor / 35.0) * 60)))
                  : null;
                const commuteModeLabel = isWalkingAnchor ? 'walk' : isBikingAnchor ? 'bike' : 'drive';

                if (feedViewMode === 'list') {
                  const shortAddr = (prop.address || prop.suburb || 'Address withheld')
                    .replace(/\s*\(Street Address Withheld\)/i, '')
                    .trim();
                  return (
                    <div
                      key={prop.id}
                      id={`property-card-${prop.id}`}
                      onClick={() => {
                        setSelectedPropertyId(prop.id);
                        setFocusTarget({ lat: prop.lat, lng: prop.lng, zoom: 16.8, timestamp: Date.now() });
                      }}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${isSelected
                        ? 'bg-purple-50/70 border-purple-400 ring-1 ring-purple-300'
                        : isHoveredOnMap
                          ? 'bg-indigo-50/40 border-indigo-200'
                          : 'bg-white border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50/60'
                        } ${isHidden ? 'opacity-50' : ''}`}
                      title="Click to focus on map"
                    >
                      <img
                        src={prop.image || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=160&q=70'}
                        alt={prop.title}
                        className="w-12 h-12 rounded-lg object-cover shrink-0 border border-zinc-200/80 bg-zinc-100"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1 min-w-0">
                            {prop.rank && (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-white text-[9.5px] font-black shrink-0">
                                #{prop.rank}
                              </span>
                            )}
                            <span className="text-xs font-extrabold text-zinc-950 truncate">
                              R {formatPrice(prop.price)}
                            </span>
                            {prop.fit_score && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9.5px] font-black shrink-0">
                                {prop.fit_score}%
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCompareProperty(prop);
                              }}
                              className={`px-1.5 py-1 rounded-md text-[10px] font-bold border cursor-pointer ${compareIds.includes(prop.id)
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-purple-50'
                                }`}
                              title={compareIds.includes(prop.id) ? 'In Compare' : 'Add to Compare'}
                            >
                              <Scales size={11} weight="bold" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePropertyAiReport(prop);
                              }}
                              className="px-2 py-1 rounded-md bg-purple-700 hover:bg-purple-800 text-white text-[10px] font-black flex items-center gap-0.5 cursor-pointer"
                              title="AI Forensic Analysis"
                            >
                              <Sparkle size={10} weight="fill" className="text-amber-300" />
                              <span>AI</span>
                            </button>
                            <a
                              href={resolveProperty24Url(prop)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => openProperty24Url(e, resolveProperty24Url(prop))}
                              className="px-1.5 py-1 rounded-md bg-zinc-900 hover:bg-indigo-600 text-white text-[10px] font-black cursor-pointer"
                              title="Open on Property24"
                            >
                              P24
                            </a>
                          </div>
                        </div>

                        <p className="text-[11px] font-bold text-zinc-800 truncate mt-0.5">
                          {prop.title}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5 truncate">
                          <span className="truncate">{shortAddr}</span>
                          <span>·</span>
                          <span className="shrink-0">{prop.bedrooms}bd{prop.sqm ? ` · ${prop.sqm}m²` : ''}</span>
                          {marketVal && (
                            <span
                              className={`shrink-0 font-bold ${marketVal.isUnderpriced
                                ? 'text-emerald-700'
                                : marketVal.isOverpriced
                                  ? 'text-rose-700'
                                  : 'text-zinc-500'
                                }`}
                            >
                              · {marketVal.isUnderpriced ? `-${Math.abs(marketVal.pctDiff)}%` : marketVal.isOverpriced ? `+${Math.abs(marketVal.pctDiff)}%` : 'Fair'}
                            </span>
                          )}
                          {crimePerimeter.isNearHighRisk && !crimePerimeter.hasEstateSecurity && (
                            <span className="shrink-0 font-bold text-amber-700" title={crimePerimeter.tooltipReason}>
                              · ⚠️ {crimePerimeter.distanceKm}km
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={prop.id}
                    id={`property-card-${prop.id}`}
                    onClick={() => {
                      setSelectedPropertyId(prop.id);
                      setFocusTarget({ lat: prop.lat, lng: prop.lng, zoom: 16.8, timestamp: Date.now() });
                    }}
                    title="Click to focus and zoom in on this property on the map"
                    className={`pt-3.5 first:pt-0 rounded-2xl p-2.5 transition-all cursor-pointer border ${isSelected
                      ? 'bg-purple-50/85 border-purple-500 ring-2 ring-purple-500/40 shadow-xl'
                      : isHidden
                        ? 'bg-amber-50/30 border-dashed border-amber-300 opacity-75 hover:opacity-100'
                        : isHoveredOnMap
                          ? 'bg-purple-50/40 border-purple-300 ring-1 ring-purple-400/30 shadow-md'
                          : 'hover:bg-zinc-50/80 border-transparent hover:border-zinc-200'
                      }`}
                  >
                    {/* Highlighted on Map Banner */}
                    {isSelected && (
                      <div className="mb-2.5 flex items-center justify-between px-3 py-1.5 rounded-xl bg-purple-700 text-white text-[11px] font-extrabold shadow-sm animate-in fade-in slide-in-from-top-1 duration-150">
                        <span className="flex items-center gap-1.5">
                          <MapPin size={13} weight="fill" className="text-amber-300" />
                          <span>Selected on Map</span>
                        </span>
                        <span className="text-[10px] text-purple-200 font-semibold">
                          Top Fit #{prop.rank || ''}
                        </span>
                      </div>
                    )}
                    {/* Photo Gallery & RealView™ Rectifier (Wide-Angle to Normal Eye Perspective Converter) */}
                    {(() => {
                      const photosList: string[] = (prop.images && prop.images.length > 0)
                        ? prop.images
                        : (cardGalleries[prop.id] && cardGalleries[prop.id].length > 0)
                          ? cardGalleries[prop.id]
                          : [prop.image].filter(Boolean);

                      const activePhotoIdx = cardImageIndices[prop.id] || 0;
                      const activeRawPhoto = photosList[activePhotoIdx] || prop.image;
                      const convertedPhotoUrl = getRectifiedUrl(activeRawPhoto);

                      const handlePrevPhoto = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (photosList.length <= 1 && prop.url && !cardGalleries[prop.id]) {
                          fetchCardGallery(prop.id, prop.url);
                        }
                        setCardImageIndices((prev) => {
                          const cur = prev[prop.id] || 0;
                          return { ...prev, [prop.id]: cur > 0 ? cur - 1 : Math.max(0, photosList.length - 1) };
                        });
                      };

                      const handleNextPhoto = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (photosList.length <= 1 && prop.url && !cardGalleries[prop.id]) {
                          fetchCardGallery(prop.id, prop.url);
                        }
                        setCardImageIndices((prev) => {
                          const cur = prev[prop.id] || 0;
                          return { ...prev, [prop.id]: cur < photosList.length - 1 ? cur + 1 : 0 };
                        });
                      };

                      const p24Href = resolveProperty24Url(prop);

                      return (
                        <div className="relative w-full h-44 rounded-xl overflow-hidden bg-zinc-950 shadow-xs mb-2.5 group/slider select-none">
                          {/* Main Converted Photo (Wide Angle -> Human Eye Normal Perspective via RealView™) */}
                          <a
                            href={p24Href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => openProperty24Url(e, p24Href)}
                            title="Open original listing on Property24 (new tab)"
                            className="block w-full h-full cursor-pointer"
                          >
                            <img
                              src={convertedPhotoUrl}
                              alt={`${prop.title} - Photo ${activePhotoIdx + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover/slider:scale-102 transition-transform duration-300"
                              loading="lazy"
                              onError={(e) => {
                                // If rectifier fails, fall back gracefully to original raw photo
                                if (e.currentTarget.src !== activeRawPhoto) {
                                  e.currentTarget.src = activeRawPhoto;
                                }
                              }}
                            />
                          </a>

                          {/* Image Slider: Previous Photo Button */}
                          <button
                            type="button"
                            onClick={handlePrevPhoto}
                            className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-zinc-950/75 hover:bg-zinc-950 text-white flex items-center justify-center backdrop-blur-xs transition-all shadow-md cursor-pointer hover:scale-110 active:scale-95 opacity-80 group-hover/slider:opacity-100"
                            title="Previous photo"
                            aria-label="Previous photo"
                          >
                            <CaretLeft size={16} weight="bold" />
                          </button>

                          {/* Image Slider: Next Photo Button */}
                          <button
                            type="button"
                            onClick={handleNextPhoto}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-zinc-950/75 hover:bg-zinc-950 text-white flex items-center justify-center backdrop-blur-xs transition-all shadow-md cursor-pointer hover:scale-110 active:scale-95 opacity-80 group-hover/slider:opacity-100"
                            title="Next photo"
                            aria-label="Next photo"
                          >
                            <CaretRight size={16} weight="bold" />
                          </button>

                          {/* Top Bar Overlay: Full-width responsive flex container preventing badge collision */}
                          <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between gap-1.5 pointer-events-none">
                            <div className="flex items-center gap-1.5 min-w-0 shrink">
                              {isHidden && (
                                <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-zinc-950 font-black text-[10px] shadow-md flex items-center gap-1 shrink-0">
                                  <EyeSlash size={10} weight="bold" />
                                  <span>Hidden</span>
                                </span>
                              )}
                              <span className="px-2.5 py-1 rounded-lg bg-zinc-950/85 text-white font-extrabold text-xs shadow-md backdrop-blur-xs shrink-0 whitespace-nowrap">
                                R {formatPrice(prop.price)} <span className="text-[10px] text-zinc-400 font-normal">/mo</span>
                              </span>
                              {marketVal && (
                                <span
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black shadow-sm backdrop-blur-xs flex items-center gap-0.5 shrink-0 whitespace-nowrap ${marketVal.isUnderpriced
                                    ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-500/40'
                                    : marketVal.isOverpriced
                                      ? 'bg-rose-950/90 text-rose-400 border border-rose-500/40'
                                      : 'bg-zinc-900/90 text-zinc-300 border border-zinc-700/50'
                                    }`}
                                  title={marketVal.badgeTooltip}
                                >
                                  <span>{marketVal.badgeText}</span>
                                </span>
                              )}
                              {enableFitScore && prop.fit_score && (
                                <span className={`px-2 py-0.5 rounded-lg bg-zinc-950/85 font-black text-[10px] shadow-sm backdrop-blur-xs flex items-center gap-1 shrink-0 whitespace-nowrap ${prop.is_outside_radius
                                  ? 'text-amber-400 border border-amber-500/30'
                                  : 'text-emerald-400'
                                  }`}>
                                  <span>{prop.fit_score}% Fit</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
                              {/* Heart Toggle Button */}
                              <button
                                type="button"
                                onClick={(e) => toggleFavouriteProperty(prop, e)}
                                className={`p-1.5 rounded-lg backdrop-blur-md border shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95 ${prop.is_favorite
                                  ? 'bg-rose-500 text-white border-rose-400 hover:bg-rose-600 font-black'
                                  : 'bg-zinc-950/80 hover:bg-zinc-950 text-zinc-300 hover:text-rose-400 border-white/20 hover:border-rose-400/40'
                                  }`}
                                title={prop.is_favorite ? "Remove from favourites" : "Add to favourites (or import from P24)"}
                                aria-label={prop.is_favorite ? "Remove from favourites" : "Add to favourites"}
                              >
                                <Heart size={13} weight={prop.is_favorite ? "fill" : "bold"} className={prop.is_favorite ? "text-white" : "text-zinc-200"} />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => toggleHideProperty(prop.id, e)}
                                className={`p-1.5 rounded-lg backdrop-blur-md border shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95 ${isHidden
                                  ? 'bg-amber-500 text-zinc-950 border-amber-400 hover:bg-amber-400 font-black'
                                  : 'bg-zinc-950/80 hover:bg-zinc-950 text-zinc-300 hover:text-white border-white/20 hover:border-white/40'
                                  }`}
                                title={isHidden ? "Unhide this listing (restore to active feed)" : "Hide listing (dismiss from feed & map)"}
                                aria-label={isHidden ? "Unhide listing" : "Hide listing"}
                              >
                                {isHidden ? <Eye size={13} weight="bold" /> : <EyeSlash size={13} weight="bold" />}
                              </button>
                            </div>
                          </div>

                          {/* Bottom-Center: Photo Counter Pill */}
                          {photosList.length > 1 && (
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full bg-zinc-950/80 backdrop-blur-xs text-[10px] font-bold text-white tracking-wider flex items-center gap-1 shadow-xs pointer-events-none">
                              <span>{activePhotoIdx + 1}</span>
                              <span className="text-zinc-400">/</span>
                              <span>{photosList.length}</span>
                            </div>
                          )}

                          {/* Bottom-Left: Critical Agency Warning only (keeps photo clean; feature chips below display full acoustic/privacy status) */}
                          {agencyRep.isPoorAgency && agencyRep.shortFlag && (
                            <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
                              <div
                                className="px-2 py-0.5 rounded-md text-[9.5px] font-black flex items-center gap-1 backdrop-blur-xs shadow-md bg-rose-950/95 text-rose-200 border border-rose-500/70"
                                title={agencyRep.tooltipReason}
                              >
                                <WarningCircle size={11} weight="fill" className="text-rose-400 shrink-0" />
                                <span>{agencyRep.shortFlag}</span>
                              </div>
                            </div>
                          )}

                          <a
                            href={p24Href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => openProperty24Url(e, p24Href)}
                            title="Open original listing on Property24"
                            className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-zinc-950/90 hover:bg-indigo-600 text-white text-[10px] font-extrabold flex items-center gap-1 backdrop-blur-xs shadow-sm transition-colors z-20 cursor-pointer"
                          >
                            <span>Property24</span>
                            <ArrowSquareOut size={11} weight="bold" />
                          </a>
                        </div>
                      );
                    })()}

                    {/* Title & Address */}
                    <h3 className="font-extrabold text-xs text-zinc-950 line-clamp-1 mb-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setSelectedPropertyId(prop.id);
                          setFocusTarget({ lat: prop.lat, lng: prop.lng, zoom: 16.8, timestamp: Date.now() });
                        }}
                        className="text-left hover:text-indigo-600 hover:underline transition-colors cursor-pointer"
                        title="Show and center this listing on the map"
                      >
                        {prop.title}
                      </button>
                    </h3>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-[11px] text-zinc-500 font-medium truncate">
                        {prop.address}
                      </p>
                      {isMissingAddressListing(prop) && editingAddressPropId !== prop.id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingAddressPropId(prop.id);
                            setManualAddressInput('');
                            setManualAddressError(null);
                          }}
                          className="shrink-0 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold transition-colors cursor-pointer"
                          title="Know the street address? Submit it to save for everyone"
                        >
                          + Add Address
                        </button>
                      )}
                    </div>
                    {isMissingAddressListing(prop) && editingAddressPropId === prop.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mb-2.5 p-2 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={manualAddressInput}
                            onChange={(e) => setManualAddressInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSubmitManualAddress(prop);
                              if (e.key === 'Escape') setEditingAddressPropId(null);
                            }}
                            placeholder={`e.g. 14 Derwent Rd, ${(prop as any).suburb || 'Gardens'}`}
                            className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white border border-indigo-200 text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={isSubmittingAddress}
                            onClick={() => handleSubmitManualAddress(prop)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-bold cursor-pointer"
                          >
                            {isSubmittingAddress ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAddressPropId(null);
                              setManualAddressError(null);
                            }}
                            className="px-2 py-1 rounded-lg bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200 text-[10px] font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                        {manualAddressError && (
                          <p className="text-[10px] text-rose-600 font-semibold">{manualAddressError}</p>
                        )}
                      </div>
                    )}

                    {/* Primary Spec Chips: Beds, Baths, Sqm */}
                    <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-semibold text-zinc-600 mb-1.5">
                      <span className="bg-zinc-100 px-2 py-0.5 rounded-md">
                        🛏️ {prop.bedrooms} Bed{prop.bedrooms > 1 ? 's' : ''}
                      </span>
                      <span className="bg-zinc-100 px-2 py-0.5 rounded-md">
                        🚿 {prop.bathrooms} Bath
                      </span>
                      {prop.sqm && (
                        <span className="bg-zinc-100 px-2 py-0.5 rounded-md">
                          📐 {prop.sqm} m²
                        </span>
                      )}
                    </div>

                    {/* Visual Feature Gauges: Poor Agency Flag, Dwelling Privacy Badge, Stove, Garage, Pets, Inverter, Fibre */}
                    <div className="flex items-center flex-wrap gap-1 mb-2.5">
                      {marketVal && (
                        <span
                          className={`border px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs ${marketVal.isUnderpriced
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : marketVal.isOverpriced
                              ? 'bg-rose-50 text-rose-950 border-rose-300'
                              : 'bg-zinc-100 text-zinc-800 border-zinc-300'
                            }`}
                          title={marketVal.badgeTooltip}
                        >
                          <span>{marketVal.isUnderpriced ? '📉' : marketVal.isOverpriced ? '📈' : '⚖️'}</span>
                          <span>{marketVal.badgeText}</span>
                        </span>
                      )}
                      {prop.is_favorite && (
                        <span
                          className="bg-rose-50 text-rose-700 border border-rose-200/90 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs"
                          title="Saved in your Property24 favourites"
                        >
                          <Heart size={11} weight="fill" className="text-rose-600 shrink-0" />
                          <span>P24 Favourite</span>
                        </span>
                      )}
                      {agencyRep.isPoorAgency && agencyRep.badgeLabel && (
                        <span
                          className="bg-rose-600 text-white border border-rose-700 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-xs"
                          title={agencyRep.tooltipReason}
                        >
                          <WarningCircle size={11} weight="fill" className="text-white shrink-0" />
                          <span>{agencyRep.badgeLabel}</span>
                        </span>
                      )}
                      {barNoiseInfo.isExposed && barNoiseInfo.shortFlag && (
                        <span
                          className="bg-rose-50 text-rose-950 border border-rose-300 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs"
                          title={barNoiseInfo.tooltipReason}
                        >
                          <SpeakerHigh size={11} weight="fill" className="text-rose-600 shrink-0" />
                          <span>{barNoiseInfo.shortFlag}</span>
                        </span>
                      )}
                      {busyRoadInfo.isNearBusyRoad && busyRoadInfo.shortFlag && (
                        <span
                          className="bg-amber-50 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs"
                          title={busyRoadInfo.tooltipReason}
                        >
                          <Car size={11} weight="fill" className="text-amber-700 shrink-0" />
                          <span>{busyRoadInfo.shortFlag}</span>
                        </span>
                      )}
                      {crimePerimeter.isNearHighRisk && crimePerimeter.shortFlag && (
                        <span
                          className={`border px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs ${crimePerimeter.hasEstateSecurity
                            ? 'bg-slate-50 text-slate-800 border-slate-300'
                            : 'bg-amber-50 text-amber-950 border-amber-300'
                            }`}
                          title={crimePerimeter.tooltipReason}
                        >
                          <ShieldWarning
                            size={11}
                            weight="fill"
                            className={crimePerimeter.hasEstateSecurity ? 'text-emerald-600 shrink-0' : 'text-amber-600 shrink-0'}
                          />
                          <span>{crimePerimeter.shortFlag}</span>
                        </span>
                      )}
                      {privacyInfo.badgeLabel && (
                        <span
                          className={`border px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs ${privacyInfo.isExplicitLandlord
                            ? 'bg-rose-50 text-rose-950 border-rose-300'
                            : 'bg-amber-50 text-amber-950 border-amber-300'
                            }`}
                          title={privacyInfo.isExplicitLandlord ? "Landlord / Owner lives on property" : "Garden cottage / flatlet on shared property"}
                        >
                          {privacyInfo.isExplicitLandlord ? (
                            <>
                              <WarningCircle size={11} weight="fill" className="text-rose-600 shrink-0" />
                              <span>{privacyInfo.badgeLabel.replace(/^⚠️\s*/, '')}</span>
                            </>
                          ) : (
                            <span>{privacyInfo.badgeLabel}</span>
                          )}
                        </span>
                      )}
                      {/* Listing Date / Stale Listing Badge */}
                      {(() => {
                        const firstSeen = (prop as any).first_seen_at;
                        const availFrom = (prop as any).available_from;
                        const nodes: React.ReactNode[] = [];
                        if (firstSeen && typeof firstSeen === 'number') {
                          const days = Math.max(0, Math.floor((Date.now() / 1000 - firstSeen) / 86400));
                          const dateStr = new Date(firstSeen * 1000).toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'short',
                          });
                          if (days >= 21) {
                            nodes.push(
                              <span
                                key="listed-stale"
                                className="border border-amber-300 bg-amber-50 text-amber-950 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs"
                                title={`First seen ${dateStr} (${days} days ago) — still unrented`}
                              >
                                <span>⏳</span>
                                <span>Listed {dateStr} ({days}d+ Stale)</span>
                              </span>
                            );
                          } else {
                            nodes.push(
                              <span
                                key="listed-date"
                                className="bg-zinc-100 text-zinc-700 border border-zinc-200/80 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1"
                                title={`First seen on HomeSeek: ${dateStr}${days > 0 ? ` (${days}d ago)` : ' (today)'} — Property24 does not publish upload dates`}
                              >
                                <span>📅</span>
                                <span>Seen {dateStr}{days > 0 ? ` · ${days}d` : ''}</span>
                              </span>
                            );
                          }
                        }
                        if (availFrom) {
                          nodes.push(
                            <span
                              key="avail-from"
                              className="bg-sky-50 text-sky-900 border border-sky-200/80 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1"
                              title={`Available from ${availFrom}`}
                            >
                              <span>🗓️</span>
                              <span>Avail {availFrom}</span>
                            </span>
                          );
                        }
                        return nodes.length > 0 ? <>{nodes}</> : null;
                      })()}
                      {/* Stove Badge */}
                      {prop.stove_type === 'gas' ? (
                        <span
                          className="bg-amber-50 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
                          title="Gas Hob / Cooker (No load-shedding disruption)"
                        >
                          <span>🔥 Gas Hob</span>
                        </span>
                      ) : prop.stove_type === 'induction' ? (
                        <span
                          className="bg-cyan-50 text-cyan-900 border border-cyan-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
                          title="Modern induction cooktop"
                        >
                          <span>🌀 Induction</span>
                        </span>
                      ) : (
                        <span
                          className="bg-zinc-100 text-zinc-700 border border-zinc-200/80 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1"
                          title="Electric stove / hob"
                        >
                          <span>⚡ Electric</span>
                        </span>
                      )}

                      {/* Parking Badges (Garage and/or Off-Street Bay) */}
                      {prop.has_garage && (
                        <span
                          className="bg-emerald-50 text-emerald-900 border border-emerald-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
                          title="Lock-up / automated private garage"
                        >
                          <span>🚗 Garage</span>
                        </span>
                      )}
                      {(prop.has_secure_bay || (!prop.has_garage && prop.parking_type === 'secure_bay')) && (
                        <span
                          className="bg-zinc-100 text-zinc-700 border border-zinc-200/80 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1"
                          title="Allocated secure parking bay / off-street parking"
                        >
                          <span>🅿️ Off-Street Bay</span>
                        </span>
                      )}
                      {!prop.has_garage && !prop.has_secure_bay && prop.parking_type !== 'secure_bay' && prop.parking_type !== 'garage' && (
                        <span
                          className="bg-zinc-100 text-zinc-500 border border-zinc-200/80 px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1"
                          title="Street parking / unassigned"
                        >
                          <span>🚗 Street Pkg</span>
                        </span>
                      )}

                      {/* Pet Friendly Badge */}
                      {prop.pet_friendly && (
                        <span
                          className="bg-indigo-50 text-indigo-900 border border-indigo-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
                          title="Verified pet-friendly lease"
                        >
                          <span>🐾 Pet Friendly</span>
                        </span>
                      )}

                      {/* Inverter / Solar Badge */}
                      {prop.has_inverter && (
                        <span
                          className="bg-teal-50 text-teal-900 border border-teal-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
                          title="Inverter / solar battery backup power"
                        >
                          <span>🔋 Inverter</span>
                        </span>
                      )}

                      {/* Fibre Internet Badge */}
                      {prop.fibre_ready && (
                        <span
                          className="bg-purple-50 text-purple-900 border border-purple-300/80 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1"
                          title="High-speed fibre ready connection"
                        >
                          <span>🌐 Fibre</span>
                        </span>
                      )}
                    </div>

                    {/* Deterministic Match Deduction */}
                    {enableFitScore && prop.ai_insight && (
                      <div className={`mb-2 px-2.5 py-1.5 rounded-xl border flex items-start gap-1.5 text-[10.5px] font-semibold leading-snug ${agencyRep.isPoorAgency
                        ? 'bg-rose-50/95 border-rose-300 text-rose-950'
                        : barNoiseInfo.isExposed
                          ? 'bg-rose-50/85 border-rose-200 text-rose-950'
                          : busyRoadInfo.isNearBusyRoad
                            ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                            : (isLandlordOnSite || privacyInfo.isPossibleSharedProperty)
                              ? 'bg-amber-50/90 border-amber-300/80 text-amber-950'
                              : 'bg-zinc-50 border-zinc-200/90 text-zinc-700'
                        }`}
                        title={
                          agencyRep.isPoorAgency
                            ? agencyRep.tooltipReason
                            : barNoiseInfo.isExposed
                              ? barNoiseInfo.tooltipReason
                              : busyRoadInfo.isNearBusyRoad
                                ? busyRoadInfo.tooltipReason
                                : undefined
                        }
                      >
                        {agencyRep.isPoorAgency ? (
                          <WarningCircle size={13} weight="fill" className="text-rose-600 shrink-0 mt-0.5" />
                        ) : barNoiseInfo.isExposed ? (
                          <SpeakerHigh size={13} weight="fill" className="text-rose-600 shrink-0 mt-0.5" />
                        ) : busyRoadInfo.isNearBusyRoad ? (
                          <Car size={13} weight="fill" className="text-amber-600 shrink-0 mt-0.5" />
                        ) : (isLandlordOnSite || privacyInfo.isPossibleSharedProperty) ? (
                          <WarningCircle size={13} weight="fill" className="text-amber-600 shrink-0 mt-0.5" />
                        ) : (
                          <ShieldCheck size={12} weight="bold" className="text-zinc-600 shrink-0 mt-0.5" />
                        )}
                        <span className="line-clamp-3 leading-snug break-words flex-1 min-w-0">{prop.ai_insight}</span>
                        {privacyInfo.isPossibleSharedProperty && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePropertyAiReport(prop);
                            }}
                            className="ml-1 shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/90 hover:bg-purple-50 border border-amber-300/90 hover:border-purple-300 text-[9.5px] font-bold text-purple-800 transition-colors cursor-pointer whitespace-nowrap"
                            title="Run AI photo & copy inspection to check for shared driveway or attached main house"
                          >
                            <Sparkle size={10} weight="fill" className="text-purple-600 shrink-0" />
                            <span>Analyze with AI</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Trailhead / Desirable Location Proximity Pill */}
                    {activeAnchor && distToAnchor !== null && (
                      <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-zinc-100/90 border border-zinc-200/80 mb-1.5">
                        <span className="font-semibold text-zinc-700 flex items-center gap-1.5 truncate max-w-[210px]">
                          {activeAnchor.iconType === 'gym' ? (
                            <Dumbbell size={13} className="text-amber-600 shrink-0" />
                          ) : activeAnchor.iconType === 'trail' ? (
                            <Tree size={13} weight="fill" className="text-emerald-600 shrink-0" />
                          ) : activeAnchor.iconType === 'surf' || activeAnchor.iconType === 'beach' ? (
                            <Waves size={13} weight="fill" className="text-cyan-600 shrink-0" />
                          ) : activeAnchor.iconType === 'cafe' ? (
                            <Coffee size={13} weight="fill" className="text-amber-600 shrink-0" />
                          ) : (
                            <Compass size={13} weight="bold" className="text-indigo-600 shrink-0" />
                          )}
                          <span className="truncate">{activeAnchor.label}</span>
                        </span>
                        <span className="font-black text-indigo-700 shrink-0">
                          {distToAnchor} km · ~{commuteDurMins}m {commuteModeLabel}
                        </span>
                      </div>
                    )}

                    {/* Gym Proximity Row in Area */}
                    {(() => {
                      const gymsList = templateGyms.length > 0 ? templateGyms : anchors.filter((a) => a.category === 'gym' || a.iconType === 'gym');
                      if (gymsList.length === 0) return null;
                      let closestGym = gymsList[0];
                      let minD = getDistanceKm(prop.lat, prop.lng, closestGym.lat, closestGym.lng);
                      for (let i = 1; i < gymsList.length; i++) {
                        const d = getDistanceKm(prop.lat, prop.lng, gymsList[i].lat, gymsList[i].lng);
                        if (d < minD) {
                          minD = d;
                          closestGym = gymsList[i];
                        }
                      }
                      if (activeAnchor?.id === closestGym.id) return null;
                      const gymMins = Math.max(2, Math.round((minD / 35.0) * 60));
                      return (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveAnchorId(closestGym.id);
                            setFocusTarget({
                              lat: closestGym.lat,
                              lng: closestGym.lng,
                              zoom: 15.2,
                              timestamp: Date.now()
                            });
                          }}
                          className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/80 mb-2 transition-colors cursor-pointer group/gym"
                          title={`Click to set ${closestGym.label} as active focal anchor`}
                        >
                          <span className="font-semibold text-zinc-800 flex items-center gap-1.5 truncate max-w-[210px]">
                            <Dumbbell size={13} className="text-amber-600 shrink-0 group-hover/gym:scale-110 transition-transform" />
                            <span className="truncate">{closestGym.label}</span>
                          </span>
                          <span className="font-black text-amber-900 shrink-0">
                            {minD} km · ~{gymMins}m
                          </span>
                        </div>
                      );
                    })()}

                    {/* Links / Action Footer */}
                    <div className="flex items-center justify-between flex-wrap gap-1.5 pt-2.5 mt-1.5 border-t border-zinc-100 text-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedPropertyId === prop.id) {
                            setSelectedPropertyId(null);
                          } else {
                            setSelectedPropertyId(prop.id);
                            setFocusTarget({ lat: prop.lat, lng: prop.lng, zoom: 16.8, timestamp: Date.now() });
                          }
                        }}
                        className="text-[11px] text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        title="Focus and highlight this property on the map"
                      >
                        <span>Focus on map</span>
                        <NavigationArrow size={11} weight="fill" />
                      </button>

                      <div className="flex items-center flex-wrap gap-1 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCompareProperty(prop);
                          }}
                          className={`px-2 py-1.5 rounded-lg text-[10.5px] font-bold flex items-center gap-1 border transition-colors whitespace-nowrap cursor-pointer ${compareIds.includes(prop.id)
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-white hover:bg-purple-50 border-zinc-200 text-zinc-700 hover:border-purple-200'
                            }`}
                          title={compareIds.includes(prop.id) ? 'Remove from AI Compare' : 'Add to AI Compare (2–4 properties)'}
                        >
                          <Scales size={12} weight="bold" className="shrink-0" />
                          <span>{compareIds.includes(prop.id) ? '✓' : '+'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePropertyAiReport(prop);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1 shadow-2xs transition-all cursor-pointer whitespace-nowrap ${viewingAiReportProp?.id === prop.id
                            ? 'bg-purple-950 text-white ring-2 ring-purple-400/50'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
                            }`}
                          title={viewingAiReportProp?.id === prop.id ? "Close AI Forensic Report" : "Get AI Report for this property"}
                        >
                          <Sparkle size={12} weight="fill" className="text-amber-300 shrink-0" />
                          <span>{viewingAiReportProp?.id === prop.id ? 'Close' : 'AI Analysis'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCommentsModal(prop);
                          }}
                          className={`px-2 py-1.5 rounded-lg text-[10.5px] font-bold flex items-center gap-1 border transition-colors whitespace-nowrap cursor-pointer ${(commentCounts[prop.id] || 0) > 0
                            ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border-zinc-200'
                            }`}
                          title={(commentCounts[prop.id] || 0) > 0 ? `Open ${commentCounts[prop.id]} comment(s)` : 'Add a comment on this listing'}
                        >
                          <span>💬</span>
                          {(commentCounts[prop.id] || 0) > 0 && <span>{commentCounts[prop.id]}</span>}
                        </button>

                        <a
                          href={resolveGoogleMapsUrl(prop)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-1.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 text-[10.5px] font-bold flex items-center gap-1 border border-zinc-200 transition-colors whitespace-nowrap cursor-pointer"
                          title="Show exact address / location on Google Maps (opens in a new tab)"
                        >
                          <MapPin size={12} weight="bold" className="text-rose-500 shrink-0" />
                          <span>Maps</span>
                          <ArrowSquareOut size={10} weight="bold" className="text-zinc-400 shrink-0" />
                        </a>

                        <a
                          href={resolveProperty24Url(prop)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => openProperty24Url(e, resolveProperty24Url(prop))}
                          className="px-2 py-1.5 rounded-lg bg-zinc-900 hover:bg-indigo-600 text-white text-[11px] font-extrabold flex items-center gap-1 shadow-2xs transition-colors whitespace-nowrap cursor-pointer"
                          title="Open original listing on Property24"
                        >
                          <span>P24</span>
                          <ArrowSquareOut size={11} weight="bold" className="shrink-0" />
                        </a>
                      </div>
                    </div>
                    {recentComments[prop.id] && recentComments[prop.id].length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCommentsModal(prop);
                        }}
                        className="w-full text-left mt-2 px-2.5 py-2 rounded-xl bg-indigo-50/75 hover:bg-indigo-100/75 border border-indigo-200/70 text-[11px] text-zinc-700 transition-colors cursor-pointer space-y-1"
                        title="Click to view or add comments"
                      >
                        {recentComments[prop.id].slice(0, 3).map((c) => (
                          <div key={c.id} className="leading-snug line-clamp-2">
                            <span className="font-extrabold text-indigo-800">u/{c.nickname}:</span>{' '}
                            <span className="text-zinc-700">{c.body}</span>
                          </div>
                        ))}
                        {(commentCounts[prop.id] || 0) > 3 && (
                          <div className="text-[10px] font-bold text-indigo-600 pt-0.5">
                            View all {commentCounts[prop.id]} comments →
                          </div>
                        )}
                      </button>
                    )}
                  </div>
                );
              };

              if (displayProperties.length === 0) {
                return null;
              }

              const getKnownSqm = (p: PropertyMapItem) => {
                if (p.sqm && p.sqm > 0) return p.sqm;
                const m = `${p.title} ${p.address}`.match(/(\d+)\s*(?:m²|sqm|m2)/i);
                return m ? parseInt(m[1], 10) : 0;
              };

              const knownSizeProps = displayProperties.filter((p) => getKnownSqm(p) > 0);
              const unknownSizeProps = displayProperties.filter((p) => getKnownSqm(p) <= 0);

              const inRadiusProps = activeAnchor ? knownSizeProps.filter((p) => !p.is_outside_radius) : [];
              const outOfRadiusProps = activeAnchor ? knownSizeProps.filter((p) => p.is_outside_radius) : knownSizeProps;

              return (
                <>
                  {activeAnchor && inRadiusProps.length > 0 && (
                    <div className="rounded-2xl bg-indigo-50/75 border border-indigo-200/80 p-2.5 space-y-3">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5 min-w-0">
                          <Target size={13} weight="bold" className="text-indigo-600 shrink-0" />
                          <span className="truncate">Within Radius to {activeAnchor.label}</span>
                        </span>
                        <span className="text-[10px] font-extrabold text-indigo-700 bg-white/90 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0">
                          {inRadiusProps.length} · ≤{locationRadiusKm.toFixed(1)} km
                        </span>
                      </div>
                      <div className="space-y-3">
                        {inRadiusProps.map(renderPropertyCard)}
                      </div>
                    </div>
                  )}

                  {outOfRadiusProps.length > 0 && (
                    <div className="space-y-3 pt-1">
                      {activeAnchor && (
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-400">
                            Outside {locationRadiusKm.toFixed(1)} km radius
                          </span>
                          <span className="text-[10px] font-bold text-zinc-400">
                            {outOfRadiusProps.length}
                          </span>
                        </div>
                      )}
                      {outOfRadiusProps.map(renderPropertyCard)}
                    </div>
                  )}

                  {unknownSizeProps.length > 0 && (
                    <div className="rounded-2xl bg-amber-50/75 border border-amber-200/80 p-2.5 space-y-3">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5 min-w-0">
                          <span>📐</span>
                          <span className="truncate">Size Unknown</span>
                        </span>
                        <span className="text-[10px] font-extrabold text-amber-800 bg-white/90 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                          {unknownSizeProps.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {unknownSizeProps.map(renderPropertyCard)}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {displayProperties.length === 0 && (
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400">
                  <EyeSlash size={24} weight="bold" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-sm text-zinc-900">
                    {hiddenCount > 0 ? 'All Matching Listings Are Hidden' : 'No Properties Scraped Yet'}
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-[260px] mx-auto">
                    {hiddenCount > 0
                      ? `You have hidden ${hiddenCount} listing${hiddenCount > 1 ? 's' : ''}. Toggle visibility to review or restore them.`
                      : 'Click "Scrape P24" to fetch real listings for your selected suburbs, or paste favourites.'}
                  </p>
                </div>
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowHidden(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Eye size={13} weight="bold" />
                    <span>Show {hiddenCount} Hidden Listing{hiddenCount > 1 ? 's' : ''}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleScrapeP24}
                    disabled={isScraping}
                    className="mt-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <MagnifyingGlass size={14} weight="bold" />
                    <span>{isScraping ? 'Scraping P24...' : 'Scrape P24 Live'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* EXPAND BUTTON (Visible when list is collapsed) */}
        {isListCollapsed && (
          <button
            type="button"
            onClick={() => setIsListCollapsed(false)}
            className="absolute top-4 left-4 z-30 px-3.5 py-2 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-zinc-200 text-xs font-extrabold text-zinc-900 flex items-center gap-2 hover:bg-zinc-50 transition-all cursor-pointer"
            title="Open Properties Column"
          >
            <Sliders size={15} weight="bold" className="text-indigo-600" />
            <span>Show {displayProperties.length} Properties</span>
            <CaretRight size={14} weight="bold" />
          </button>
        )}

        {/* RIGHT / FULL-WIDTH MAP CANVAS */}
        <div className="flex-1 h-full w-full relative bg-zinc-100 overflow-hidden">
          <PropertyMap
            mode="default"
            properties={displayProperties}
            anchors={displayedAnchors}
            selectedPropertyId={selectedPropertyId}
            selectedAnchorId={activeAnchorId}
            enableAiAnalysis={enableFitScore}
            focusTarget={focusTarget}
            onSelectProperty={(p: PropertyMapItem) => setSelectedPropertyId(selectedPropertyId === p.id ? null : p.id)}
            onDeselectProperty={() => setSelectedPropertyId(null)}
            onHoverProperty={(p: PropertyMapItem | null) => setHoveredPropertyId(p ? p.id : null)}
            showCardPopupOnMap={false}
            onSelectAnchor={(a: ProximityAnchor) => setActiveAnchorId(a.id)}
            selectedSuburbs={selectedSuburbs}
            onAddSuburb={(suburb: string) => handleAddSuburb(suburb)}
            onOpenAiReport={(p: PropertyMapItem) => handleTogglePropertyAiReport(p)}
            commentCounts={commentCounts}
            onOpenComments={(p: PropertyMapItem) => openCommentsModal(p)}
            proximityFilter={activeAnchor ? { label: activeAnchor.label, lat: activeAnchor.lat, lng: activeAnchor.lng, radiusKm: locationRadiusKm } : null}
            onRadiusChange={(r) => setLocationRadiusKm(r)}
            withinRadiusFilter={withinRadiusFilter}
            onToggleWithinRadiusFilter={(next) => setWithinRadiusFilter(next)}
            className="w-full h-full"
          />
        </div>

      </main>

      {/* LISTING COMMENTS MODAL */}
      <CommentsModal
        prop={commentModalProp}
        comments={listingComments}
        isLoading={isLoadingComments}
        newCommentText={newCommentText}
        isPosting={isPostingComment}
        editingCommentId={editingCommentId}
        editingCommentText={editingCommentText}
        commentError={commentError}
        activeCommentUid={activeCommentUid}
        activeCommentNickname={activeCommentNickname}
        isSignedIn={Boolean(user)}
        onClose={() => setCommentModalProp(null)}
        onChangeNewComment={setNewCommentText}
        onCreateComment={handleCreateComment}
        onStartEdit={(id, body) => {
          setEditingCommentId(id);
          setEditingCommentText(body);
        }}
        onCancelEdit={() => setEditingCommentId(null)}
        onChangeEditText={setEditingCommentText}
        onSaveEdit={handleUpdateComment}
        onDeleteComment={handleDeleteComment}
      />

      <TopTenRankerModal
        isOpen={isAiModalOpen}
        matchingCount={displayProperties.length}
        selectedSuburbs={selectedSuburbs}
        minPrice={minPrice}
        maxPrice={maxPrice}
        bedrooms={bedrooms}
        safeishFilter={safeishFilter}
        withinRadiusFilter={withinRadiusFilter}
        activeAnchorLabel={activeAnchor?.label ?? null}
        locationRadiusKm={locationRadiusKm}
        fibreFilter={fibreFilter}
        parkingFilter={parkingFilter}
        petFriendlyFilter={petFriendlyFilter}
        personalPreferences={personalPreferences}
        walkablePlaces={walkablePlaces}
        isRunningDeepAi={isRunningDeepAi}
        onClose={() => setIsAiModalOpen(false)}
        onUpdatePreferences={handleUpdatePreferences}
        onAddWalkablePlace={handleAddWalkablePlace}
        onRemoveWalkablePlace={handleRemoveWalkablePlace}
        onRunAnalysis={handleRunDeepAiAnalysis}
      />

      <AiPropertyReportModal
        viewingAiReportProp={viewingAiReportProp}
        setViewingAiReportProp={setViewingAiReportProp}
        selectedSuburbs={selectedSuburbs}
        minPrice={minPrice}
        maxPrice={maxPrice}
        bedrooms={bedrooms}
        safeishFilter={safeishFilter}
        withinRadiusFilter={withinRadiusFilter}
        activeAnchor={activeAnchor}
        locationRadiusKm={locationRadiusKm}
        fibreFilter={fibreFilter}
        parkingFilter={parkingFilter}
        petFriendlyFilter={petFriendlyFilter}
        minSqm={minSqm}
        offMainRoadFilter={offMainRoadFilter}
        offBarsFilter={offBarsFilter}
        privateOnlyFilter={privateOnlyFilter}
        personalPreferences={personalPreferences}
        handleUpdatePreferences={handleUpdatePreferences}
        planSummary={planSummary}
        uploadedViewingPhotos={uploadedViewingPhotos}
        setUploadedViewingPhotos={setUploadedViewingPhotos}
        handleUploadViewingPhotos={handleUploadViewingPhotos}
        photoSourceMode={photoSourceMode}
        setPhotoSourceMode={setPhotoSourceMode}
        runForensicAiInspection={runForensicAiInspection}
        compareIds={compareIds}
        toggleCompareProperty={toggleCompareProperty}
        snagCopied={snagCopied}
        handleCopySnagReport={handleCopySnagReport}
        isExportingPdf={isExportingPdf}
        handleDownloadReportPdf={handleDownloadReportPdf}
        isEmailPdfOpen={isEmailPdfOpen}
        setIsEmailPdfOpen={setIsEmailPdfOpen}
        emailPdfTarget={emailPdfTarget}
        setEmailPdfTarget={setEmailPdfTarget}
        isSendingEmailPdf={isSendingEmailPdf}
        emailPdfStatus={emailPdfStatus}
        setEmailPdfStatus={setEmailPdfStatus}
        handleEmailReportPdf={handleEmailReportPdf}
        userEmail={user?.email ?? null}
        cardGalleries={cardGalleries}
        getAgencyReputationInfo={getAgencyReputationInfo}
        getPropertyBarNoiseExposure={getPropertyBarNoiseExposure}
        getPropertyBusyRoadExposure={getPropertyBusyRoadExposure}
        isLandlordOnSiteProperty={isLandlordOnSiteProperty}
        resolveGoogleMapsUrl={resolveGoogleMapsUrl}
        resolveProperty24Url={resolveProperty24Url}
        openProperty24Url={openProperty24Url}
      />

      <FavouritesImportModal
        isOpen={isImportModalOpen}
        importInputText={importInputText}
        importedCount={importedFavourites.length}
        isImporting={isImporting}
        importStatusMsg={importStatusMsg}
        onClose={() => setIsImportModalOpen(false)}
        onChangeInput={setImportInputText}
        onClearAll={clearAllFavourites}
        onImport={handleImportFavourites}
      />

    </div>
  );
}
