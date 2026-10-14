'use client';

import React from 'react';
import { X } from 'lucide-react';

interface FilterBadgeProps {
  label: string;
  icon?: any;
  onRemove: () => void;
  active?: boolean;
}

export const FilterBadge = ({ label, icon: Icon, onRemove, active = false }: FilterBadgeProps) => (
  <button 
    onClick={onRemove}
    className={`group flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${
      active 
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black' 
        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
    }`}
  >
    {Icon && <Icon size={10} weight="fill" />}
    {label}
    <X size={10} className="group-hover:rotate-90 transition-transform" />
  </button>
);
