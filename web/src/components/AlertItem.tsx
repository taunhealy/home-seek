import { Dog, House, SunHorizon, Globe, Stack, UsersThree, Trash, MagnifyingGlass, Gear } from "@phosphor-icons/react";
import { formatCurrency } from '@/lib/utils';

interface AlertItemProps {
  alert: any;
  deleteAlert: (id: string) => void;
  updateAlert: (id: string, updates: any) => void;
}

export const AlertItem: React.FC<AlertItemProps> = ({ alert, deleteAlert, updateAlert }) => {
  const displayTitle = alert.target_area || alert.search_query.split('(')[0].trim();
  const displayContext = alert.target_area ? alert.search_query : "";
  
  const rentalTypes = [
    { id: 'all', icon: Globe, label: 'All' },
    { id: 'long-term', icon: House, label: 'Long' },
    { id: 'short-term', icon: SunHorizon, label: 'Short' },
    { id: 'pet-sitting', icon: Dog, label: 'Pet-Sit' },
    { id: 'looking-for', icon: MagnifyingGlass, label: 'Wanted' }
  ];

  const layouts = [
    { id: 'all', icon: Globe, label: 'Any' },
    { id: 'Whole', icon: Stack, label: 'Whole' },
    { id: 'Shared', icon: UsersThree, label: 'Shared' }
  ];

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-6 group transition-all hover:bg-white/[0.05] hover:border-white/20">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors tracking-tight">{displayTitle}</h4>
            {alert.pet_friendly && (
               <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter border border-emerald-500/20 flex items-center gap-1">
                 <Dog size={10} weight="fill" /> Pet-Friendly
               </span>
            )}
          </div>
          {displayContext && (
            <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest max-w-[200px] truncate">Context: {displayContext}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => updateAlert(alert.id || alert.search_id, { is_active: alert.is_active === false })}
            className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-full border transition-all ${
              alert.is_active !== false 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                : 'bg-red-500/10 border-red-500/30 text-red-500'
            }`}
          >
            {alert.is_active !== false ? '● Active' : '○ Standby'}
          </button>

          <button 
             onClick={() => (window as any).openEditModal?.(alert)}
             className="text-white/20 hover:text-white transition-all p-2 rounded-xl hover:bg-white/5"
             title="Edit Parameters"
          >
            <Gear size={18} weight="bold" />
          </button>

          <button 
            onClick={() => deleteAlert(alert.id || alert.search_id)}
            className="text-white/10 hover:text-red-500 transition-all p-2 rounded-xl hover:bg-red-500/10"
            title="Terminate Sniper"
          >
            <Trash size={18} weight="bold" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5">
        {/* Settings HUD */}
        <div className="space-y-4">
          <div>
            <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] block mb-2">Rental Class</span>
            <div className="flex gap-1">
              {rentalTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => updateAlert(alert.id || alert.search_id, { rental_type: type.id })}
                  className={`px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase transition-all flex items-center gap-1 border ${
                    alert.rental_type === type.id 
                      ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                      : 'bg-white/5 border-white/5 text-white/30 hover:text-white'
                  }`}
                >
                  <type.icon size={10} weight={alert.rental_type === type.id ? "fill" : "bold"} />
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] block mb-2">Occupancy Mode</span>
            <div className="flex gap-1">
              {layouts.map(layout => (
                <button
                  key={layout.id}
                  onClick={() => updateAlert(alert.id || alert.search_id, { property_sub_type: layout.id })}
                  className={`px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase transition-all flex items-center gap-1 border ${
                    alert.property_sub_type === layout.id 
                      ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                      : 'bg-white/5 border-white/5 text-white/30 hover:text-white'
                  }`}
                >
                  <layout.icon size={10} weight={alert.property_sub_type === layout.id ? "fill" : "bold"} />
                  {layout.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Price & Beds */}
        <div className="flex flex-col justify-end items-end space-y-4">
            <div className="text-right">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] block mb-1">Max Ceiling</span>
              <p className="text-lg font-black text-white">{formatCurrency(alert.max_price)}</p>
            </div>
            <div className="flex gap-4">
               <div className="text-right">
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] block mb-0.5">Beds</span>
                  <p className="text-[10px] font-bold text-white/60 uppercase">
                    {alert.min_bedrooms ? 
                      (Array.isArray(alert.min_bedrooms) ? alert.min_bedrooms.join(', ') : alert.min_bedrooms) + '+' : 
                      'Any'}
                  </p>
               </div>
               <div className="text-right">
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] block mb-0.5">Pet Policy</span>
                  <p className={`text-[10px] font-bold uppercase ${alert.pet_friendly ? 'text-emerald-500' : 'text-white/20'}`}>
                    {alert.pet_friendly ? 'Verified' : 'Relaxed'}
                  </p>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
};
