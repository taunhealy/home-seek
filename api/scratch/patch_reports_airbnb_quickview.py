import sys

path = 'web/src/app/reports/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Update report selection logic so it never picks an empty report
for i, l in enumerate(lines):
    if "if (data.reports.length > 0 && !selectedReport) {" in l:
        lines[i] = "          const validReport = data.reports.find((r: any) => r.ranked_listings && r.ranked_listings.length > 0) || data.reports[0];\n          if (!selectedReport || !selectedReport.ranked_listings || selectedReport.ranked_listings.length === 0) {\n            setSelectedReport(validReport);\n          }\n"
        break

# 2. Find start and end of filteredRankedListings.map in split view
start_idx = None
end_idx = None

for i, l in enumerate(lines):
    if "{filteredRankedListings.map((item, idx) => {" in l and start_idx is None:
        start_idx = i
    if "Right: Fixed Interactive Map" in l and start_idx is not None:
        # Search backwards for the closing of map
        for j in range(i-1, start_idx, -1):
            if "})}" in lines[j]:
                end_idx = j
                break
        break

print(f"Card list range found: start={start_idx+1}, end={end_idx+1}")

airbnb_quick_view_cards = """                        {filteredRankedListings.map((item, idx) => {
                          const isSelectedCard = selectedPropertyId === (item.id || item.listing_id);
                          const detailUrl = `/reports/listing?reportId=${selectedReport?.id || ''}&id=${item.listing_id || item.id}`;
                          const isShielded = item.acoustic_audit?.is_shielded ?? (item.noise_risk !== 'high');
                          const estDb = item.acoustic_audit?.estimated_db ?? (isShielded ? 40 : 73);

                          return (
                            <div
                              key={item.id || item.listing_id}
                              id={`listing-card-${item.id || item.listing_id}`}
                              onClick={() => {
                                setSelectedPropertyId(item.id || item.listing_id);
                              }}
                              className={`group relative bg-white border rounded-3xl p-4 sm:p-5 transition-all duration-200 cursor-pointer hover:shadow-lg ${
                                isSelectedCard
                                  ? 'border-zinc-950 shadow-md ring-2 ring-zinc-950/20'
                                  : 'border-zinc-200 hover:border-zinc-400/80 shadow-2xs'
                              }`}
                            >
                              {/* 1. Airbnb-Style Image Thumbnail with Rank, Fit & Price Pills */}
                              <div className="relative w-full h-48 sm:h-52 rounded-2xl overflow-hidden bg-zinc-100 mb-3.5">
                                <img
                                  src={item.image || (item.images && item.images[0]) || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80'}
                                  alt={item.title}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                                />

                                {/* Top Left: Rank and Fit Score Badges */}
                                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
                                  <span className="w-6 h-6 rounded-lg bg-zinc-950/90 text-white font-black text-xs flex items-center justify-center backdrop-blur-md shadow-sm">
                                    #{idx + 1}
                                  </span>
                                  <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black backdrop-blur-md shadow-sm ${
                                    item.fit_score >= 75
                                      ? 'bg-emerald-600/90 text-white'
                                      : 'bg-amber-500/90 text-white'
                                  }`}>
                                    {item.fit_score}% Fit
                                  </span>
                                </div>

                                {/* Top Right: Open in New Window Icon Button */}
                                <a
                                  href={detailUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Open full listing dossier in a new window"
                                  className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-white/90 hover:bg-white text-zinc-900 backdrop-blur-md shadow-md hover:scale-110 transition-all z-10"
                                >
                                  <ArrowSquareOut size={14} weight="bold" />
                                </a>

                                {/* Bottom Right: Rent Price Pill */}
                                <div className="absolute bottom-2.5 right-2.5 bg-zinc-950/90 backdrop-blur-md text-white font-black text-xs px-3 py-1 rounded-xl shadow-md flex items-center gap-1.5">
                                  <span>R {item.price ? item.price.toLocaleString() : 'Contact'}</span>
                                  <span className="text-[10px] text-zinc-300 font-normal">/mo</span>
                                </div>

                                {/* Off-Market Indicator Overlay if rented */}
                                {item.is_available === false && (
                                  <div className="absolute inset-x-0 bottom-0 py-1 bg-rose-600/90 backdrop-blur-xs text-white text-[10px] font-extrabold text-center tracking-wider uppercase">
                                    Off-Market / Let Agreed
                                  </div>
                                )}
                              </div>

                              {/* 2. Title & Suburb Row */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500">
                                  <span className="truncate uppercase tracking-wider">
                                    {item.area || 'Cape Town'} · {item.address.split(',')[0]}
                                  </span>
                                  {item.price_value_pct !== undefined && item.price_value_pct !== null && (
                                    <span className={`shrink-0 font-extrabold px-1.5 py-0.2 rounded ${
                                      item.price_value_pct < -5
                                        ? 'text-emerald-700 bg-emerald-50'
                                        : item.price_value_pct > 10
                                        ? 'text-amber-700 bg-amber-50'
                                        : 'text-zinc-600 bg-zinc-100'
                                    }`}>
                                      {item.price_value_pct < 0 ? `${Math.abs(item.price_value_pct)}% underpriced` : 'Fair Value'}
                                    </span>
                                  )}
                                </div>

                                <h4 className="font-extrabold text-zinc-950 text-sm leading-snug line-clamp-1 group-hover:text-indigo-600 transition-colors">
                                  {item.title}
                                </h4>
                              </div>

                              {/* 3. Fundamental Metrics Quick-View Row */}
                              <div className="flex flex-wrap items-center gap-2 pt-2.5 pb-1 text-xs font-semibold text-zinc-700">
                                <div className="inline-flex items-center gap-1 bg-zinc-100 px-2.5 py-1 rounded-lg">
                                  <Bed size={13} weight="bold" className="text-zinc-500" />
                                  <span>{item.bedrooms || 1} Bed{item.bedrooms && item.bedrooms > 1 ? 's' : ''}</span>
                                </div>

                                <div className="inline-flex items-center gap-1 bg-zinc-100 px-2.5 py-1 rounded-lg">
                                  <Bathtub size={13} weight="bold" className="text-zinc-500" />
                                  <span>{item.bathrooms || 1} Bath</span>
                                </div>

                                <div className="inline-flex items-center gap-1 bg-zinc-100 px-2.5 py-1 rounded-lg">
                                  <Ruler size={13} weight="bold" className="text-zinc-500" />
                                  <span>{item.sqm ? `${item.sqm} m²` : 'Standard'}</span>
                                </div>

                                {item.floor_number && (
                                  <div className="inline-flex items-center gap-1 bg-zinc-100 px-2.5 py-1 rounded-lg">
                                    <Buildings size={13} className="text-zinc-500" />
                                    <span>{item.floor_number}</span>
                                    {item.has_lift === 'yes' && <span className="text-[10px] text-emerald-700 font-bold ml-0.5">· 🛗 Lift</span>}
                                  </div>
                                )}
                              </div>

                              {/* 4. Acoustic Decibel & Sound Shadow Status Badge */}
                              <div className="pt-1.5">
                                <div className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-xs ${
                                  isShielded
                                    ? 'bg-emerald-50/80 text-emerald-950 border-emerald-200/80'
                                    : 'bg-rose-50/80 text-rose-950 border-rose-200/80'
                                }`}>
                                  <div className="flex items-center gap-1.5 truncate">
                                    {isShielded ? (
                                      <ShieldCheck size={14} weight="bold" className="text-emerald-600 shrink-0" />
                                    ) : (
                                      <SpeakerHigh size={14} weight="bold" className="text-rose-600 shrink-0" />
                                    )}
                                    <span className="font-bold truncate text-[11px]">
                                      {item.acoustic_audit?.sound_shadow_status || (isShielded ? 'In Sound Shadow (Shielded)' : 'Direct Sound Corridor')}
                                    </span>
                                  </div>
                                  <span className={`font-black text-xs shrink-0 ${isShielded ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {estDb} dBA
                                  </span>
                                </div>
                              </div>

                              {/* 5. Commute & Agency Footer */}
                              <div className="flex items-center justify-between pt-2.5 border-t border-zinc-100 text-[11px]">
                                <div className="flex items-center gap-1 text-zinc-500 font-medium truncate max-w-[170px]">
                                  <Car size={13} weight="fill" className="text-indigo-600 shrink-0" />
                                  <span className="truncate">
                                    {item.location_proximity && item.location_proximity[0]
                                      ? `${item.location_proximity[0].duration_text} · ${item.location_proximity[0].distance_text}`
                                      : '~8 mins drive'}
                                  </span>
                                </div>

                                <div className="text-right shrink-0">
                                  {isLandlordListing(item) ? (
                                    <span className="font-extrabold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/80">
                                      Direct Landlord
                                    </span>
                                  ) : (
                                    <span className="font-bold text-zinc-600 truncate max-w-[130px] inline-block">
                                      {item.agency_name || 'Verified Agency'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 6. Click to Open Full Details Action Button */}
                              <div className="pt-2.5">
                                <a
                                  href={detailUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full py-2 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs group-hover:bg-indigo-600 cursor-pointer"
                                >
                                  <span>Open Full Details in New Window</span>
                                  <ArrowSquareOut size={13} weight="bold" />
                                </a>
                              </div>
                            </div>
                          );
                        })}"""

# Replace lines from start_idx to end_idx with airbnb_quick_view_cards
new_lines = lines[:start_idx] + [airbnb_quick_view_cards + "\n"] + lines[end_idx+1:]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("SUCCESS: Reports page patched with Airbnb-style quick-view cards!")
