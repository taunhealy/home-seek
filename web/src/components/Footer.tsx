'use client';

import React from 'react';
import { Target, Mail, Smartphone } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="py-20 px-8 border-t border-white/5 bg-black">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-12">
        <div className="w-full flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex items-center gap-2">
            <Target className="w-8 h-8 text-emerald-500" />
            <span className="text-2xl font-black tracking-tighter text-white">Home<span className="text-emerald-500">Seek</span></span>
          </div>
          <div className="text-white/20 text-sm font-medium text-center md:text-left">
            &copy; 2026 HomeSeek Protocol. All systems nominal.
          </div>
          <div className="flex gap-6">
            <a href="#" className="p-3 bg-white/5 rounded-full hover:bg-emerald-500 transition-all group">
              <Mail className="w-5 h-5 text-white/50 group-hover:text-black transition-colors" />
            </a>
            <a href="#" className="p-3 bg-white/5 rounded-full hover:bg-emerald-500 transition-all group">
              <Smartphone className="w-5 h-5 text-white/50 group-hover:text-black transition-colors" />
            </a>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-8 border-t border-white/5 pt-12 w-full">
          <a href="#" className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] hover:text-emerald-500 transition-all">Terms of Service</a>
          <a href="#" className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] hover:text-emerald-500 transition-all">Privacy Policy</a>
          <a href="/admin" className="text-[10px] font-bold text-white/10 uppercase tracking-[0.2em] hover:text-emerald-500 transition-all">Command Center</a>
        </div>
      </div>
    </footer>
  );
};
