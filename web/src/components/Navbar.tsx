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
  Buildings, 
  ChatCircleDots,
  List,
  X,
  Check,
  Bell
} from '@phosphor-icons/react';

interface NavbarProps {
  user: any;
  profile: any;
  loading?: boolean;
  handleLogout: () => void;
  handleLogin?: () => void;
  onUpdateProfile?: (updates: any) => Promise<void>;
}

const NAV_ITEMS = [
  { label: 'Home', href: '/', icon: House },
  { label: 'Search', href: '/search', icon: MagnifyingGlass },
  { label: 'Properties', href: '/properties', icon: Buildings },
  { label: 'Alerts', href: '/alerts', icon: Bell },
  { label: 'Contact', href: '/contact', icon: ChatCircleDots },
];

export const Navbar: React.FC<NavbarProps> = ({ 
  user, 
  profile, 
  loading, 
  handleLogout, 
  handleLogin, 
  onUpdateProfile 
}) => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [whatsappInput, setWhatsappInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile?.whatsapp) setWhatsappInput(profile.whatsapp);
  }, [profile?.whatsapp]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
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

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/90 backdrop-blur-md border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-zinc-950 text-white rounded-xl flex items-center justify-center font-bold text-base shadow-sm group-hover:bg-zinc-800 transition-colors">
              H
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-zinc-950 block leading-tight">
                Home<span className="text-zinc-600 font-semibold">Seek</span>
              </span>
              <span className="text-[10px] text-zinc-600 font-medium tracking-wide uppercase block">
                Property Radar
              </span>
            </div>
          </Link>

          {/* Desktop Navigation - Strictly 4 Pages */}
          <div className="hidden md:flex items-center gap-1 bg-zinc-100/80 p-1 rounded-xl border border-zinc-200/60">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/50'
                  }`}
                >
                  <Icon size={14} weight={active ? "fill" : "regular"} className={active ? "text-zinc-950" : "text-zinc-700"} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Controls & Mobile Toggle */}
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="w-9 h-9 rounded-full bg-zinc-100 animate-pulse border border-zinc-200" />
            ) : user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  suppressHydrationWarning
                  className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 pl-1.5 pr-3 py-1 rounded-full hover:bg-zinc-100 transition-colors"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} className="w-7 h-7 rounded-full object-cover border border-zinc-200" alt="avatar" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-xs uppercase">
                      {user.email?.[0] || 'U'}
                    </div>
                  )}
                  <span className="text-xs font-medium text-zinc-700 max-w-[90px] truncate hidden sm:inline">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <CaretDown size={12} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} weight="bold" />
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden p-2 z-[100] animate-in fade-in duration-150">
                    <div className="p-3 border-b border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Signed in as</p>
                      <p className="text-xs font-semibold text-zinc-950 truncate">{user.displayName || 'HomeSeek User'}</p>
                      <p className="text-[11px] text-zinc-600 truncate">{user.email}</p>
                    </div>

                    <div className="p-2 space-y-1">
                      {/* Manage Alerts Link */}
                      <Link
                        href="/alerts"
                        onClick={() => setIsOpen(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-800 hover:bg-zinc-100 text-xs font-semibold transition-colors"
                      >
                        <Bell size={16} weight="bold" className="text-zinc-900" />
                        <span>Manage Radar Alerts</span>
                      </Link>
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
            ) : (
              <button
                onClick={handleLogin}
                suppressHydrationWarning
                className="bg-zinc-950 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-xs"
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
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <Icon size={18} weight={active ? "fill" : "regular"} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </nav>
  );
};
