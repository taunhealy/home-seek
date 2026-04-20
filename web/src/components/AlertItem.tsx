import React from 'react';
import { Dog } from "@phosphor-icons/react";
import { formatCurrency } from '@/lib/utils';

interface AlertItemProps {
  alert: any;
  deleteAlert: (id: string) => void;
}

export const AlertItem: React.FC<AlertItemProps> = ({ alert, deleteAlert }) => {
  const displayQuery = alert.search_query.split('(')[0].trim();
  const isPetFriendly = alert.search_query.toLowerCase().includes('pet friendly');
  
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex justify-between items-center group transition-all hover:bg-white/[0.05] hover:border-white/20">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h4 className="text-sm font-bold">{displayQuery}</h4>
          {isPetFriendly && (
             <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter border border-emerald-500/20 flex items-center gap-1">
               <Dog size={10} weight="fill" /> Pet-Sit Priority
             </span>
          )}
        </div>
        <div className="flex gap-4 text-[10px] font-bold text-white/30 uppercase tracking-widest items-center">
          <div className="flex items-center gap-1.5 grayscale opacity-50">
            🏗️ {alert.min_bedrooms ? 
                (Array.isArray(alert.min_bedrooms) ? alert.min_bedrooms.join(', ') : alert.min_bedrooms) + '+' : 
                'Any'} Beds
          </div>
          <div className="flex items-center gap-1.5">
            💰 {formatCurrency(alert.max_price)} Max
          </div>
        </div>
      </div>
      <button 
        onClick={() => deleteAlert(alert.id || alert.search_id)}
        className="text-white/10 group-hover:text-red-500/60 text-[10px] font-bold uppercase tracking-widest transition-all px-4 py-2 hover:bg-red-500/5 rounded-xl border border-transparent hover:border-red-500/10"
      >
        Delete
      </button>
    </div>
  );
};
