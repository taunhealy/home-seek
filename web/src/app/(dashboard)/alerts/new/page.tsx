'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { SniperForm } from '@/components/SniperForm';
import { ArrowLeft } from '@phosphor-icons/react';

export default function NewAlertPage() {
  const router = useRouter();

  return (
    <div className="max-w-[1400px] mx-auto p-6 md:p-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-12 flex items-center justify-between">
        <div>
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-widest hover:text-emerald-500 transition-all mb-4"
          >
            <ArrowLeft size={14} weight="bold" /> Return to HUD
          </button>
          <h1 className="text-4xl font-black tracking-tighter">DEPLOY NEW SNIPER</h1>
          <p className="text-white/40 text-sm font-medium mt-1 uppercase tracking-widest">Authorize a fresh intelligence mission</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
           <SniperForm 
             isStandalone={true} 
             onSuccess={() => {
                // Success is handled by the component's internal feedback usually,
                // but we might want to redirect.
                router.push('/dashboard');
             }} 
           />
        </div>
        
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-8">
              <h3 className="text-[11px] font-black text-emerald-500 uppercase tracking-widest mb-4">Mission Briefing</h3>
              <ul className="space-y-4 text-xs font-medium text-white/60 leading-relaxed">
                 <li className="flex gap-3">
                    <span className="text-emerald-500 font-black">01.</span>
                    Define your target area and budget constraints to filter noise.
                 </li>
                 <li className="flex gap-3">
                    <span className="text-emerald-500 font-black">02.</span>
                    Enable automated alerts to receive real-time signals via WhatsApp/Email.
                 </li>
                 <li className="flex gap-3">
                    <span className="text-emerald-500 font-black">03.</span>
                    The Sniper will monitor all authorized intelligence sources with the frequency set to your tier.
                 </li>
              </ul>
           </div>

           <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8">
              <h3 className="text-[11px] font-black text-white/40 uppercase tracking-widest mb-4">System Capacity</h3>
              <p className="text-xs text-white/30 font-medium">
                 Your current node supports multi-platform synchronization. Each mission deployed consumes 1 active sniper slot.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
