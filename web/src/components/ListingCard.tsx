import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';
import React from 'react';
import { ArrowSquareOut } from '@phosphor-icons/react';

interface ListingCardProps {
  listing: any;
  idx: number;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing: l, idx }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay: idx * 0.05 }}
      className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 group hover:border-white/20 transition-all shadow-[0_4px_30px_rgba(0,0,0,0.1)]"
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h4 className="font-bold text-xl">{l.title}</h4>
            {l.view_category === 'Sea' && <span title="Sea View" className="text-lg">🌊</span>}
            {l.view_category === 'Mountain' && <span title="Mountain View" className="text-lg">🏔️</span>}
          </div>
          <p className="text-xs text-white/40 font-bold uppercase tracking-[0.2em]">{l.address}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-tighter">{formatCurrency(l.price)}</p>
          <div className="flex flex-col items-end gap-1 mb-2 mt-1">
            {l.property_sub_type === 'Shared' ? (
                <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest border border-orange-400/30 px-2 py-0.5 rounded-md">Shared Room</span>
            ) : (
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest border border-emerald-400/30 px-2 py-0.5 rounded-md">{l.property_type || 'Unit'}</span>
            )}
            {l.available_date && (
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-tighter">Available: {l.available_date}</span>
            )}
          </div>
        </div>
      </div>
      
      {/* 🚀 TACTICAL PILLS (Spec Breakdown) */}
      <div className="flex flex-wrap gap-2 mb-6">
          <div className="px-3 py-1.5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
            <span>🏗️</span> {l.bedrooms && l.bedrooms > 0 ? `${l.bedrooms} Bed` : 'Any Beds'}
          </div>
          <div className="px-3 py-1.5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
            <span>🚿</span> {l.bathrooms || 1} Bath
          </div>
          {l.is_furnished && (
            <div className="px-3 py-1.5 border border-emerald-500/20 bg-emerald-500/5 rounded-full text-[9px] font-black uppercase tracking-widest text-emerald-500/80 flex items-center gap-2">
              <span>🏠</span> Furnished
            </div>
          )}
          {l.is_pet_friendly && (
            <div className="px-3 py-1.5 border border-blue-500/20 bg-blue-500/5 rounded-full text-[9px] font-black uppercase tracking-widest text-blue-400/80 flex items-center gap-2">
              <span>🐾</span> Pet Friendly
            </div>
          )}
          {l.property_sub_type !== 'Shared' && (
            <div className="px-3 py-1.5 border border-purple-500/20 bg-purple-500/5 rounded-full text-[9px] font-black uppercase tracking-widest text-purple-400/80 flex items-center gap-2">
              <span>🗝️</span> Whole Unit
            </div>
          )}
      </div>

      {l.match_reason && (
        <p className="text-sm text-white/60 mb-6 border-l-2 border-emerald-500/30 pl-6 py-1 leading-relaxed">
          "{l.match_reason}"
        </p>
      )}
      
      {/* Amenities (Sub-specs) */}
      {l.amenities && l.amenities.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8 ml-2">
           {l.amenities.slice(0, 6).map((a: string) => (
             <span key={a} className="text-[8px] font-black text-white/20 border border-white/5 bg-white/[0.01] px-2 py-1 rounded-md uppercase tracking-widest">
               {a}
             </span>
           ))}
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row gap-4 items-center pt-2">
        <a 
          href={l.source_url} 
          target="_blank" 
          className="w-full sm:flex-1 bg-emerald-500 hover:bg-emerald-400 text-black px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-95"
        >
          <ArrowSquareOut size={16} weight="bold" />
          View Property
        </a>
        <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
           <span className="w-full sm:w-auto bg-white/5 border border-white/10 px-6 py-4 rounded-2xl text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center justify-center mb-1">
             {l.platform}
           </span>
           {l.created_at && (
             <span className="text-[8px] font-black text-white/10 uppercase tracking-[0.3em]">
               Captured: {new Date(l.created_at).toLocaleDateString('en-ZA')}
             </span>
           )}
        </div>
      </div>
    </motion.div>
  );
};
