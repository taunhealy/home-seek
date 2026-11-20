'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DeviceMobile,
  Envelope,
  SignOut,
  CaretDown,
  House,
  MagnifyingGlass,
  ChatCircleDots,
  List,
  X,
  Check,
  Bell,
  Sparkle,
  Scales,
  Crown,
  Heart
} from '@phosphor-icons/react';
import { getCompareList, getPlanSummary, type PlanSummary } from '@/lib/pro-plan';
import { useAuth } from '@/lib/auth-context';
import { KnightAvatar } from '@/components/KnightAvatar';

interface NavbarProps {
  user?: any;
  profile?: any;
  loading?: boolean;
  handleLogout?: () => void;
  handleLogin?: () => void;
  onUpdateProfile?: (updates: any) => Promise<void>;
}

const MARKETING_NAV_ITEMS = [
  { label: 'Home', href: '/', icon: House },
  { label: 'Features', href: '/#features', icon: Sparkle },
  { label: 'Pricing', href: '/pricing', icon: Crown },
  { label: 'Contact', href: '/contact', icon: ChatCircleDots },
];

const APP_NAV_ITEMS = [
  { label: 'Search', href: '/search', icon: MagnifyingGlass, requiresAuth: false },
  { label: 'Compare', href: '/compare', icon: Scales, requiresAuth: false },
  { label: 'Inspection', href: '/inspection', icon: Check, requiresAuth: false },
  { label: 'Dashboard', href: '/alerts', icon: House, requiresAuth: true },
];

const MARKETING_ROUTES = ['/', '/pricing', '/contact', '/suburbs', '/legal', '/privacy', '/terms'];

function isMarketingPath(pathname: string | null): boolean {
  if (!pathname || pathname === '/') return true;
  return MARKETING_ROUTES.some((r) => r !== '/' && (pathname === r || pathname.startsWith(`${r}/`)));
}

export const Navbar: React.FC<NavbarProps> = ({
  user: propUser,
  profile: propProfile,
  loading: propLoading,
  handleLogout: propLogout,
  handleLogin: propLogin,
  onUpdateProfile
}) => {
  const pathname = usePathname();
  const {
    user: ctxUser,
    profile: ctxProfile,
    loading: ctxLoading,
    logout: ctxLogout,
    login: ctxLogin,
    loginWithEmail,
    registerWithEmail,
    refreshProfile,
  } = useAuth();
  const user = propUser !== undefined ? propUser : ctxUser;
  const profile = propProfile !== undefined ? propProfile : ctxProfile;
  const loading = propLoading !== undefined ? propLoading : ctxLoading;
  const handleLogout = propLogout || ctxLogout;
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null);

  useEffect(() => {
    setPlanSummary(getPlanSummary());
    const syncPlan = () => setPlanSummary(getPlanSummary());
    window.addEventListener('homeseek-plan-updated', syncPlan);
    window.addEventListener('storage', syncPlan);
    return () => {
      window.removeEventListener('homeseek-plan-updated', syncPlan);
      window.removeEventListener('storage', syncPlan);
    };
  }, []);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  const handleOpenAuthModal = () => {
    setAuthError(null);
    setIsAuthModalOpen(true);
  };

  const handleGoogleAuth = async () => {
    setAuthError(null);
    setIsAuthSubmitting(true);
    try {
      if (propLogin) {
        await propLogin();
      } else {
        await ctxLogin();
      }
      setIsAuthModalOpen(false);
    } catch {
      setAuthError('Google sign-in failed.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthSubmitting(true);
    try {
      const res =
        authMode === 'register'
          ? await registerWithEmail(authEmail, authPassword, authDisplayName)
          : await loginWithEmail(authEmail, authPassword);
      if (!res.ok) {
        setAuthError(res.error || 'Authentication failed.');
        return;
      }
      setIsAuthModalOpen(false);
      setAuthEmail('');
      setAuthPassword('');
      setAuthDisplayName('');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const [isOpen, setIsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [navAlerts, setNavAlerts] = useState<Array<{
    id: string;
    title: string;
    subtitle: string;
    verdict?: string;
    isActive: boolean;
    href: string;
  }>>([]);
  const [readAlertIds, setReadAlertIds] = useState<string[]>([]);
  const [isLoadingNavAlerts, setIsLoadingNavAlerts] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [whatsappInput, setWhatsappInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [avatarInput, setAvatarInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveMsg, setProfileSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [compareCount, setCompareCount] = useState(0);
  const [hasMounted, setHasMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const alertsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMounted(true);
    setCompareCount(getCompareList().length);
    try {
      const savedRead = localStorage.getItem('homeseek_read_alert_ids');
      if (savedRead) {
        const parsed = JSON.parse(savedRead);
        if (Array.isArray(parsed)) setReadAlertIds(parsed.map(String));
      }
    } catch {}
    const sync = () => setCompareCount(getCompareList().length);
    window.addEventListener('homeseek-compare-updated', sync);
    return () => window.removeEventListener('homeseek-compare-updated', sync);
  }, []);

  // Fetch user's saved Radar Alerts for the notification bell
  useEffect(() => {
    if (!hasMounted || !user) {
      setNavAlerts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingNavAlerts(true);
      try {
        const uid = profile?.id || user.uid || 'taun_test_user';
        const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        const [res, repRes] = await Promise.all([
          fetch(`${backendBase}/searches/${encodeURIComponent(uid)}`),
          fetch(`${backendBase}/reports/${encodeURIComponent(uid)}`).catch(() => null),
        ]);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const rawList = Array.isArray(data?.searches) ? data.searches : Array.isArray(data) ? data : [];
        const repData = repRes && repRes.ok ? await repRes.json().catch(() => null) : null;
        const reportsList = Array.isArray(repData?.reports) ? repData.reports : [];
        const latestTopMatch = reportsList[0]?.ranked_listings?.[0];

        if (!cancelled) {
          setNavAlerts(
            rawList.slice(0, 8).map((item: any, idx: number) => {
              const id = String(item.id || item.search_id || `alert-${idx}`);
              const area = item.target_area || 'Cape Town';
              const maxP = item.max_price ? `up to R${Number(item.max_price).toLocaleString()}` : '';
              const minFit = typeof item.min_fit_score === 'number' ? item.min_fit_score : 80;
              const verdict =
                idx === 0 && latestTopMatch?.match_score
                  ? `${latestTopMatch.match_score}% Fit · ${latestTopMatch.title || latestTopMatch.address || 'Top match'}`
                  : minFit > 0
                    ? `AI Filter: ≥${minFit}% Fit only`
                    : 'AI Scout monitoring active';
              return {
                id,
                title: item.search_query || `AI Radar: ${area}`,
                subtitle: [area, maxP].filter(Boolean).join(' · '),
                verdict,
                isActive: item.is_active !== false,
                href: '/alerts',
              };
            })
          );
        }
      } catch {
        // Non-critical notification bell fetch
      } finally {
        if (!cancelled) setIsLoadingNavAlerts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasMounted, user, profile?.id]);

  const unreadAlertsCount = navAlerts.filter((a) => !readAlertIds.includes(a.id)).length;

  const handleMarkAllAlertsRead = () => {
    const allIds = Array.from(new Set([...readAlertIds, ...navAlerts.map((a) => a.id)]));
    setReadAlertIds(allIds);
    try {
      localStorage.setItem('homeseek_read_alert_ids', JSON.stringify(allIds));
    } catch {}
  };

  useEffect(() => {
    if (profile?.whatsapp) setWhatsappInput(profile.whatsapp);
  }, [profile?.whatsapp]);

  useEffect(() => {
    if (profile?.nickname) setNicknameInput(profile.nickname);
    if (profile?.avatar_url !== undefined) setAvatarInput(profile.avatar_url || '');
  }, [profile?.nickname, profile?.avatar_url]);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          setAvatarInput(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      if (typeof reader.result === 'string') img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfileSettings = async () => {
    if (!user?.uid) return;
    setIsSavingProfile(true);
    setProfileSaveMsg(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/user-profile/${encodeURIComponent(user.uid)}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nicknameInput.trim() || undefined,
          avatar_url: avatarInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileSaveMsg({ type: 'err', text: data?.detail || 'Failed to save.' });
        return;
      }
      await refreshProfile();
      setProfileSaveMsg({ type: 'ok', text: 'Profile updated!' });
    } catch {
      setProfileSaveMsg({ type: 'err', text: 'Network error saving profile.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Persist current route in localStorage so returning to the app restores the user's last page
  useEffect(() => {
    if (!pathname) return;
    try {
      if (pathname !== '/') {
        localStorage.setItem('homeseek_last_page', pathname);
      }
    } catch (e) { }
  }, [pathname]);

  const handleExplicitHomeClick = () => {
    try {
      localStorage.setItem('homeseek_last_page', '/');
      sessionStorage.setItem('homeseek_explicit_home', '1');
    } catch (e) { }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (alertsDropdownRef.current && !alertsDropdownRef.current.contains(event.target as Node)) {
        setIsAlertsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSetting = async (field: string, currentVal: boolean) => {
    if (onUpdateProfile) {
      await onUpdateProfile({ [field]: !currentVal });
    }
  };

  const isMarketing = isMarketingPath(pathname);
  const isAuthedClient = hasMounted && !loading && Boolean(user);
  const activeNavItems = isMarketing
    ? MARKETING_NAV_ITEMS
    : APP_NAV_ITEMS.filter((item) => !item.requiresAuth || isAuthedClient);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href.startsWith('/#')) return false;
    return pathname.startsWith(href);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-[120] bg-white/95 backdrop-blur-md border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">

            {/* Logo */}
            <Link href="/" onClick={handleExplicitHomeClick} className="flex items-center gap-3 group">
              <div className="w-9 h-9 bg-zinc-950 text-white rounded-xl flex items-center justify-center font-bold text-base shadow-sm group-hover:bg-zinc-800 transition-colors">
                H
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-zinc-950 block leading-tight">
                  Home<span className="text-zinc-600 font-semibold">Seek</span>
                </span>
                <span className="text-[10px] text-zinc-600 font-medium tracking-wide uppercase block">
                  {isMarketing ? 'Cape Town Renter Radar' : 'Workspace'}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation — 2-Level Context (Marketing vs App Workspace) */}
            <div className="hidden md:flex items-center gap-1 bg-zinc-100/80 p-1 rounded-xl border border-zinc-200/60">
              {activeNavItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={item.href === '/' ? handleExplicitHomeClick : undefined}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${active
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/50'
                      }`}
                  >
                    <Icon size={14} weight={active ? "fill" : "regular"} className={active ? "text-zinc-950" : "text-zinc-700"} />
                    <span>{item.label}</span>
                    {item.href === '/compare' && compareCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-purple-700 text-white text-[10px] font-black">
                        {compareCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* User Controls & Context CTA */}
            <div className="flex items-center gap-2.5">
              {isMarketing ? (
                <Link
                  href="/search"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs transition-colors"
                >
                  <MagnifyingGlass size={13} weight="bold" />
                  <span>Open App</span>
                </Link>
              ) : (
                <Link
                  href="/pricing"
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-extrabold transition-colors"
                >
                  <Crown size={13} weight="fill" className="text-amber-500" />
                  <span>Pro</span>
                </Link>
              )}
              {(!hasMounted || loading) ? (
                <div className="w-9 h-9 rounded-full bg-zinc-100 animate-pulse border border-zinc-200" />
              ) : isAuthedClient ? (
                <div className="flex items-center gap-2">
                  {/* Alerts Notification Bell */}
                  <div className="relative" ref={alertsDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAlertsOpen(!isAlertsOpen);
                        setIsOpen(false);
                      }}
                      className="relative w-9 h-9 rounded-full bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
                      aria-label="Notifications & Alerts"
                      title="Alerts"
                    >
                      <Bell size={16} weight={unreadAlertsCount > 0 ? 'fill' : 'bold'} className={unreadAlertsCount > 0 ? 'text-indigo-600' : 'text-zinc-700'} />
                      {unreadAlertsCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9.5px] font-black flex items-center justify-center shadow-xs">
                          {unreadAlertsCount}
                        </span>
                      )}
                    </button>

                    {isAlertsOpen && (
                      <div className="absolute right-0 mt-2 w-80 bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden z-[110] animate-in fade-in duration-150">
                        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Bell size={14} weight="fill" className="text-indigo-600" />
                            <span className="text-xs font-black text-zinc-950">Alerts</span>
                          </div>
                          <span className="text-[10.5px] font-bold text-zinc-500">
                            {unreadAlertsCount > 0 ? `${unreadAlertsCount} unread` : 'All caught up'}
                          </span>
                        </div>

                        <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100">
                          {isLoadingNavAlerts ? (
                            <div className="p-4 space-y-2.5">
                              {[0, 1, 2].map((idx) => (
                                <div key={idx} className="flex items-start gap-2.5">
                                  <div className="w-2 h-2 mt-1.5 rounded-full bg-zinc-200 animate-pulse shrink-0" />
                                  <div className="flex-1 space-y-1.5">
                                    <div className="w-3/4 h-3 rounded bg-zinc-200 animate-pulse" />
                                    <div className="w-1/2 h-2.5 rounded bg-zinc-100 animate-pulse" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : navAlerts.length === 0 ? (
                            <div className="p-5 text-center space-y-1.5">
                              <p className="text-xs font-bold text-zinc-800">No Radar Alerts Yet</p>
                              <p className="text-[11px] text-zinc-500">
                                Click &ldquo;Save Alert&rdquo; on the Search page to start monitoring suburbs.
                              </p>
                            </div>
                          ) : (
                            navAlerts.map((alert) => {
                              const isUnread = !readAlertIds.includes(alert.id);
                              return (
                                <Link
                                  key={alert.id}
                                  href={alert.href}
                                  onClick={() => {
                                    if (isUnread) {
                                      const next = Array.from(new Set([...readAlertIds, alert.id]));
                                      setReadAlertIds(next);
                                      try {
                                        localStorage.setItem('homeseek_read_alert_ids', JSON.stringify(next));
                                      } catch {}
                                    }
                                    setIsAlertsOpen(false);
                                  }}
                                  className={`flex items-start gap-2.5 px-4 py-3 hover:bg-zinc-50 transition-colors ${isUnread ? 'bg-indigo-50/40' : ''}`}
                                >
                                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isUnread ? 'bg-indigo-600' : 'bg-zinc-300'}`} />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-zinc-900 truncate">{alert.title}</div>
                                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                                      {alert.subtitle} · {alert.isActive ? 'Active' : 'Paused'}
                                    </div>
                                    {alert.verdict && (
                                      <div className="text-[10.5px] font-bold text-indigo-700 truncate mt-0.5">
                                        {alert.verdict}
                                      </div>
                                    )}
                                  </div>
                                </Link>
                              );
                            })
                          )}
                        </div>

                        <div className="px-3 py-2.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={handleMarkAllAlertsRead}
                            disabled={unreadAlertsCount === 0}
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-zinc-100 disabled:opacity-45 border border-zinc-200 text-[11px] font-bold text-zinc-700 cursor-pointer transition-colors"
                          >
                            Mark all as read
                          </button>
                          <Link
                            href="/alerts"
                            onClick={() => setIsAlertsOpen(false)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold transition-colors"
                          >
                            Manage Alerts
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Profile Avatar Dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => {
                        setIsOpen(!isOpen);
                        setIsAlertsOpen(false);
                      }}
                    suppressHydrationWarning
                    className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 pl-1.5 pr-3 py-1 rounded-full hover:bg-zinc-100 transition-colors"
                  >
                    {(profile?.avatar_url || user.photoURL) ? (
                      <img src={profile?.avatar_url || user.photoURL} className="w-7 h-7 rounded-full object-cover border border-zinc-200" alt="avatar" />
                    ) : (
                      <KnightAvatar size="sm" />
                    )}
                    <span className="text-xs font-medium text-zinc-700 max-w-[110px] truncate hidden sm:inline">
                      {profile?.nickname ? `u/${profile.nickname}` : (user.displayName || user.email?.split('@')[0])}
                    </span>
                    <CaretDown size={12} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} weight="bold" />
                  </button>

                  {/* Dropdown Menu */}
                  {isOpen && (
                    <div className="absolute right-0 mt-2 w-80 max-h-[85vh] overflow-y-auto bg-white border border-zinc-200 rounded-2xl shadow-2xl p-2 z-[100] animate-in fade-in duration-150">
                      <div className="p-3 border-b border-zinc-100 flex items-center gap-2.5">
                        {(avatarInput || profile?.avatar_url || user.photoURL) ? (
                          <img
                            src={avatarInput || profile?.avatar_url || user.photoURL}
                            alt="avatar"
                            className="w-9 h-9 rounded-full object-cover border border-zinc-200 shrink-0"
                          />
                        ) : (
                          <KnightAvatar size="md" />
                        )}
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            {profile?.nickname ? `u/${profile.nickname}` : 'Signed in as'}
                          </p>
                          <p className="text-xs font-semibold text-zinc-950 truncate">{user.displayName || 'HomeSeek User'}</p>
                          <p className="text-[11px] text-zinc-600 truncate">{user.email}</p>
                        </div>
                      </div>

                      <div className="p-2 space-y-1">
                        {/* AI Credits Summary Pill */}
                        <div className="px-2.5 py-2 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/80 flex items-center justify-between gap-2 mb-1.5">
                          <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1">
                              <Sparkle size={11} weight="fill" className="text-purple-600 shrink-0" />
                              <span>{planSummary?.remainingAudits ?? 0} AI Credits</span>
                            </div>
                            <div className="text-[10px] text-zinc-500 font-semibold truncate">
                              {planSummary?.label || 'Free Scout'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Link
                              href="/profile"
                              onClick={() => setIsOpen(false)}
                              className="px-2 py-1 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-[10px] font-bold text-zinc-800"
                            >
                              Profile
                            </Link>
                            <Link
                              href="/pricing"
                              onClick={() => setIsOpen(false)}
                              className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-[10px] font-extrabold text-white"
                            >
                              Top Up
                            </Link>
                          </div>
                        </div>

                        {/* Profile Settings (Nickname & Avatar) */}
                        <div className="p-2 space-y-2 bg-indigo-50/50 border border-indigo-100 rounded-xl mb-1.5">
                          <label className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block">
                            Profile Settings
                          </label>
                          <div className="space-y-1">
                            <input
                              type="text"
                              placeholder="Nickname (3-24 chars)"
                              value={nicknameInput}
                              onChange={(e) => setNicknameInput(e.target.value)}
                              className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-900 focus:outline-none focus:border-indigo-500"
                            />
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                placeholder="Image URL or upload →"
                                value={avatarInput.startsWith('data:image/') ? 'Uploaded image ready' : avatarInput}
                                onChange={(e) => setAvatarInput(e.target.value)}
                                className="flex-1 min-w-0 bg-white border border-zinc-200 rounded-lg px-2 py-1 text-[11px] text-zinc-900 focus:outline-none focus:border-indigo-500"
                              />
                              <label className="px-2 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-[10.5px] font-bold text-zinc-700 cursor-pointer shrink-0">
                                Upload
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleAvatarFileChange}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>
                          {profileSaveMsg && (
                            <p className={`text-[10.5px] font-semibold ${profileSaveMsg.type === 'ok' ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {profileSaveMsg.text}
                            </p>
                          )}
                          <button
                            type="button"
                            disabled={isSavingProfile}
                            onClick={handleSaveProfileSettings}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                          >
                            {isSavingProfile ? 'Saving...' : 'Save Profile'}
                          </button>
                        </div>

                        {/* Account & Alerts Navigation (My HomeSeek) */}
                        <div className="grid grid-cols-2 gap-1 pb-1.5 mb-1 border-b border-zinc-100">
                          <Link
                            href="/alerts"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-zinc-800 hover:bg-zinc-100 text-[11px] font-semibold transition-colors"
                          >
                            <House size={14} weight="bold" className="text-indigo-600" />
                            <span>Dashboard</span>
                          </Link>
                          <Link
                            href="/profile"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-zinc-800 hover:bg-zinc-100 text-[11px] font-semibold transition-colors"
                          >
                            <Crown size={14} weight="bold" className="text-amber-600" />
                            <span>Profile &amp; Plan</span>
                          </Link>
                          <Link
                            href="/alerts"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-zinc-800 hover:bg-zinc-100 text-[11px] font-semibold transition-colors"
                          >
                            <Bell size={14} weight="bold" className="text-purple-600" />
                            <span>Manage Alerts</span>
                          </Link>
                          <Link
                            href="/search"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-zinc-800 hover:bg-zinc-100 text-[11px] font-semibold transition-colors"
                          >
                            <MagnifyingGlass size={14} weight="bold" className="text-emerald-600" />
                            <span>Search Radar</span>
                          </Link>
                          <Link
                            href="/profile?tab=favourites"
                            onClick={() => setIsOpen(false)}
                            className="col-span-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-zinc-800 hover:bg-rose-50 text-[11px] font-semibold transition-colors"
                          >
                            <Heart size={14} weight="fill" className="text-rose-500" />
                            <span>Favourites</span>
                          </Link>
                          <Link
                            href="/inspection"
                            onClick={() => setIsOpen(false)}
                            className="col-span-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-zinc-800 hover:bg-indigo-50 text-[11px] font-semibold transition-colors"
                          >
                            <Check size={14} weight="bold" className="text-indigo-600" />
                            <span>Ingoing Inspection (PDF)</span>
                          </Link>
                        </div>
                        {/* WhatsApp Routing */}
                        <div className="p-2 space-y-1.5 bg-zinc-50 rounded-xl mb-1.5">
                          <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Alert WhatsApp</label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              placeholder="e.g. 27821234567"
                              value={whatsappInput}
                              onChange={(e) => setWhatsappInput(e.target.value)}
                              className="flex-1 bg-white border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                            />
                            <button
                              onClick={() => onUpdateProfile?.({ whatsapp: whatsappInput })}
                              className="bg-zinc-900 text-white px-2.5 py-1 rounded-lg hover:bg-black text-[11px] font-medium"
                            >
                              Save
                            </button>
                          </div>
                        </div>

                        {/* WhatsApp Toggle */}
                        <button
                          onClick={() => toggleSetting('notify_whatsapp', !!profile?.notify_whatsapp)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-zinc-50 text-left transition-colors"
                        >
                          <div className="flex items-center gap-2.5 text-zinc-700">
                            <DeviceMobile size={16} />
                            <span className="text-xs font-medium">WhatsApp Notifications</span>
                          </div>
                          <div className={`w-7 h-4 rounded-full relative transition-colors ${profile?.notify_whatsapp ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${profile?.notify_whatsapp ? 'left-3.5' : 'left-0.5'}`} />
                          </div>
                        </button>

                        {/* Email Toggle */}
                        <button
                          onClick={() => toggleSetting('notify_email', !!profile?.notify_email)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-zinc-50 text-left transition-colors"
                        >
                          <div className="flex items-center gap-2.5 text-zinc-700">
                            <Envelope size={16} />
                            <span className="text-xs font-medium">Email Alerts</span>
                          </div>
                          <div className={`w-7 h-4 rounded-full relative transition-colors ${profile?.notify_email ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${profile?.notify_email ? 'left-3.5' : 'left-0.5'}`} />
                          </div>
                        </button>
                      </div>

                      <div className="pt-2 border-t border-zinc-100">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-medium transition-colors"
                        >
                          <SignOut size={16} />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              ) : (
                <button
                  onClick={handleOpenAuthModal}
                  suppressHydrationWarning
                  className="bg-zinc-950 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
                >
                  Sign In
                </button>
              )}

              {/* Mobile Hamburger Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 rounded-xl transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <List size={20} />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden py-3 border-t border-zinc-200 space-y-1">
              {activeNavItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      if (item.href === '/') handleExplicitHomeClick();
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-700 hover:bg-zinc-100'
                      }`}
                  >
                    <Icon size={18} weight={active ? "fill" : "regular"} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {isMarketing ? (
                <Link
                  href="/search"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white"
                >
                  <MagnifyingGlass size={18} weight="bold" />
                  <span>Open App</span>
                </Link>
              ) : (
                <Link
                  href="/pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold bg-amber-50 text-amber-900 border border-amber-200"
                >
                  <Crown size={18} weight="fill" className="text-amber-500" />
                  <span>Upgrade to Pro</span>
                </Link>
              )}
            </div>
          )}

        </div>
      </nav>

      {/* Sign In / Registration Modal (rendered outside <nav> so backdrop-blur doesn't trap fixed positioning) */}
      {isAuthModalOpen && (
        <div
          className="fixed inset-0 z-[200] bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsAuthModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-zinc-950">
                  {authMode === 'login' ? 'Sign in to HomeSeek' : 'Create HomeSeek Account'}
                </h2>
                <p className="text-[11px] text-zinc-500">
                  {authMode === 'login'
                    ? 'Access your saved alerts, profile, and comments.'
                    : 'Get an auto-generated community nickname on signup.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 cursor-pointer"
                aria-label="Close"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                }}
                className={`py-1.5 rounded-lg transition-all cursor-pointer ${authMode === 'login' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError(null);
                }}
                className={`py-1.5 rounded-lg transition-all cursor-pointer ${authMode === 'register' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'}`}
              >
                Create Account
              </button>
            </div>

            <button
              type="button"
              disabled={isAuthSubmitting}
              onClick={handleGoogleAuth}
              className="w-full py-2 px-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-900 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>G</span>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <div className="flex-1 h-px bg-zinc-200" />
              <span>or with email</span>
              <div className="flex-1 h-px bg-zinc-200" />
            </div>

            <form onSubmit={handleEmailAuthSubmit} className="space-y-2.5">
              {authMode === 'register' && (
                <input
                  type="text"
                  placeholder="Display Name (optional)"
                  value={authDisplayName}
                  onChange={(e) => setAuthDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:border-indigo-500"
                />
              )}
              <input
                type="email"
                required
                placeholder="Email address"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Password (min 6 characters)"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:border-indigo-500"
              />
              {authError && (
                <p className="text-[11px] text-rose-600 font-semibold">{authError}</p>
              )}
              <button
                type="submit"
                disabled={isAuthSubmitting}
                className="w-full py-2 rounded-xl bg-zinc-950 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {isAuthSubmitting
                  ? 'Please wait...'
                  : authMode === 'login'
                    ? 'Sign In'
                    : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
