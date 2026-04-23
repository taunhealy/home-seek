'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Crown, 
  Target, 
  Database, 
  Clock, 
  ShieldCheck,
  TrendUp,
  Activity
} from "@phosphor-icons/react";
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { fetchWithAuth } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && u.email === 'taunhealy@gmail.com') {
        fetchStats(u.uid);
      } else {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchStats = async (uid: string) => {
    try {
      const resp = await fetchWithAuth(`${API_BASE_URL}/admin/stats?user_id=${uid}`);
      if (resp && resp.ok) {
        const data = await resp.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Admin fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.email !== 'taunhealy@gmail.com') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-center p-12">
        <ShieldCheck size={64} className="text-red-500 mb-6" />
        <h1 className="text-4xl font-serif font-bold mb-4">Authorized Personnel Only</h1>
        <p className="text-white/40 max-w-md">Your credentials do not grant access to the Home-Seek Command Center.</p>
        <a href="/" className="mt-12 px-8 py-3 bg-white text-black rounded-full font-black uppercase text-[10px] tracking-widest">Return to Surface</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-emerald-500/30 font-sans">
      
      {/* HUD Header */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-[#050505]/80 backdrop-blur-2xl border-b border-white/5 px-12 py-8 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
            <Activity size={24} weight="fill" className="text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold tracking-tight">Command Center</h1>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest leading-none">Global Network Health & Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Node Online</span>
           </div>
        </div>
      </nav>

      <main className="pt-40 pb-24 px-12 max-w-[1400px] mx-auto space-y-12">
        
        {/* Core Metrics Grid */}
        <div className="grid grid-cols-4 gap-6">
          <StatCard 
            title="Total Citizens" 
            value={stats?.total_users || 0} 
            icon={Users} 
            color="emerald" 
            trend="+12% this week"
          />
          <StatCard 
            title="Active Snipers" 
            value={stats?.active_snipers || 0} 
            icon={Target} 
            color="blue" 
            trend="Live Scanning"
          />
          <StatCard 
            title="Elite Subscribers" 
            value={stats?.recent_sub ? "Active" : "Stable"}
            icon={Crown} 
            color="amber" 
            trend="Premium Retention"
          />
          <StatCard 
            title="Intel Collected" 
            value={stats?.total_listings_found || '1,000+'} 
            icon={Database} 
            color="purple" 
            trend="Verified Listings"
          />
        </div>

        <div className="grid grid-cols-2 gap-12">
          {/* Recent Recon Section */}
          <div className="space-y-6">
            <h2 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-1">Recent Intelligence</h2>
            <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden">
               <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                      <Clock size={20} weight="fill" />
                    </div>
                    <div>
                      <h3 className="font-bold">Latest Discovery</h3>
                      <p className="text-[10px] text-white/30 uppercase font-black">Incoming Personnel Signal</p>
                    </div>
                  </div>
               </div>
               
               <div className="p-8 space-y-8">
                  {stats?.recent_user && (
                    <div className="flex justify-between items-center">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-xl">👤</div>
                          <div>
                            <p className="font-bold text-white uppercase text-xs">{stats.recent_user.email}</p>
                            <p className="text-[10px] text-white/20 font-bold uppercase">ID: {stats.recent_user.id.slice(0, 8)}...</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">New Citizen</p>
                          <p className="text-[9px] text-white/20 uppercase">{new Date(stats.recent_user.created_at || Date.now()).toLocaleDateString()}</p>
                       </div>
                    </div>
                  )}

                  {stats?.recent_sub && (
                    <div className="flex justify-between items-center pt-8 border-t border-white/5">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-xl">👑</div>
                          <div>
                            <p className="font-bold text-amber-500 uppercase text-xs">{stats.recent_sub.email}</p>
                            <p className="text-[10px] text-white/20 font-bold uppercase">TIER: {stats.recent_sub.tier}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Premium authorized</p>
                          <p className="text-[9px] text-white/20 uppercase">Conversion Active</p>
                       </div>
                    </div>
                  )}
               </div>
            </div>
          </div>

          {/* Growth Radar Section */}
          <div className="space-y-6">
            <h2 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-1">Growth Radar</h2>
            <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-10 flex flex-col justify-center items-center text-center space-y-8">
                <div className="w-48 h-48 rounded-full border border-emerald-500/20 flex items-center justify-center relative">
                    <div className="absolute inset-0 border border-emerald-500/10 rounded-full animate-ping opacity-20" />
                    <div className="absolute inset-4 border border-emerald-500/5 rounded-full" />
                    <div className="text-center">
                        <p className="text-4xl font-black text-emerald-500">100%</p>
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Operational</p>
                    </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-serif font-medium">Network Expansion Stable</p>
                  <p className="text-sm text-white/30 max-w-xs leading-relaxed">All regional snipers are responding. Multiplex scanning efficiency is currently at optimal levels.</p>
                </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend }: any) {
  const colorMap: any = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 space-y-6 group hover:bg-white/[0.04] transition-all">
      <div className="flex justify-between items-start">
        <div className={`p-4 rounded-2xl ${colorMap[color]}`}>
          <Icon size={24} weight="fill" />
        </div>
        <div className="flex items-center gap-1 text-emerald-500 text-[9px] font-black uppercase tracking-tighter bg-emerald-500/10 px-2 py-1 rounded-full">
           <TrendUp size={10} weight="bold" />
           {trend}
        </div>
      </div>
      <div>
        <h3 className="text-4xl font-black tracking-tighter mb-1">{value}</h3>
        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">{title}</p>
      </div>
    </div>
  );
}
