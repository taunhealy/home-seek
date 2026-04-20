import React, { useState, useRef, useEffect } from 'react';
import { Bell, DeviceMobile, Envelope, SignOut, CaretDown, Check } from '@phosphor-icons/react';

interface NavbarProps {
  user: any;
  profile: any;
  handleLogout: () => void;
  onUpdateProfile?: (updates: any) => Promise<void>;
}

export const Navbar: React.FC<NavbarProps> = ({ user, profile, handleLogout, onUpdateProfile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/5 px-6 md:px-12 py-4">
      <div className="max-w-[1400px] mx-auto flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
            <span className="text-black font-black text-xl">H</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Home-Seek</h1>
            <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest leading-none">Intelligence Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-6 mr-4 border-r border-white/10 pr-8">
            <a href="/" className="text-[10px] font-bold text-white/40 uppercase tracking-widest hover:text-white transition-all">Home</a>
            <a href="/explore" className="text-[10px] font-bold text-white/40 uppercase tracking-widest hover:text-white transition-all">Explore</a>
            <a href="/discover" className="text-[10px] font-bold text-white uppercase tracking-widest border-b-2 border-emerald-500 pb-1">Alerts</a>
          </div>

          <div className="text-right hidden lg:block">
            <p className="text-[9px] uppercase tracking-[0.3em] text-emerald-500 font-bold mb-0.5">Terminal Active</p>
            <p className="text-white/20 text-[9px] uppercase tracking-widest font-bold">ZAF Nodes Connected</p>
          </div>

          {user && (
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 bg-white/5 border border-white/10 pl-2 pr-4 py-1.5 rounded-2xl hover:bg-white/10 transition-all outline-none"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} className="w-8 h-8 rounded-full border border-white/10" alt="avatar" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-xs uppercase">
                    {user.email?.[0] || 'U'}
                  </div>
                )}
                <CaretDown size={14} className={`text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} weight="bold" />
              </button>

              {isOpen && (
                <div className="absolute right-0 mt-4 w-72 bg-[#0A0A0A]/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden p-2 z-[100] animate-in fade-in slide-in-from-top-4 duration-200">
                  <div className="p-4 border-b border-white/5 space-y-1">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Operator Linked</p>
                    <p className="text-sm font-bold text-white truncate">{user.displayName || 'Anonymous Hunter'}</p>
                    <p className="text-[10px] text-white/30 font-bold uppercase truncate">{user.email}</p>
                  </div>

                  <div className="p-2 space-y-1">
                    <p className="px-4 py-2 text-[9px] font-black text-white/20 uppercase tracking-widest">Signal Preferences</p>
                    
                    {/* WhatsApp Toggle */}
                    <button 
                      onClick={() => toggleSetting('notify_whatsapp', !!profile?.notify_whatsapp)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white/5 transition-all group"
                    >
                      <div className="flex items-center gap-3 text-white/60 group-hover:text-white">
                        <DeviceMobile size={18} weight={profile?.notify_whatsapp ? "fill" : "bold"} className={profile?.notify_whatsapp ? "text-emerald-500" : ""} />
                        <span className="text-[11px] font-bold uppercase">WhatsApp Alerts</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full relative transition-all ${profile?.notify_whatsapp ? 'bg-emerald-500' : 'bg-white/10'}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${profile?.notify_whatsapp ? 'left-4.5 shadow-sm' : 'left-0.5'}`} />
                      </div>
                    </button>

                    {/* Email Toggle */}
                    <button 
                      onClick={() => toggleSetting('notify_email', !!profile?.notify_email)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white/5 transition-all group"
                    >
                      <div className="flex items-center gap-3 text-white/60 group-hover:text-white">
                        <Envelope size={18} weight={profile?.notify_email ? "fill" : "bold"} className={profile?.notify_email ? "text-emerald-500" : ""} />
                        <span className="text-[11px] font-bold uppercase">Email Alerts</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full relative transition-all ${profile?.notify_email ? 'bg-emerald-500' : 'bg-white/10'}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${profile?.notify_email ? 'left-4.5 shadow-sm' : 'left-0.5'}`} />
                      </div>
                    </button>
                  </div>

                  <div className="p-2 mt-2 border-t border-white/5">
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500/60 hover:text-red-500 hover:bg-red-500/5 transition-all"
                    >
                      <SignOut size={18} weight="bold" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Deactivate Terminal</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
