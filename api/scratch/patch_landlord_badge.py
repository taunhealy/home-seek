with open("c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add isLandlordListing helper
landlord_helper = """  const isLandlordListing = (item: RankedItem) => {
    if (item.is_direct_landlord) return true;
    if (!item.agency_name) return true;
    const a = item.agency_name.toLowerCase();
    return a.includes('landlord') || a.includes('private') || a.includes('owner') || a === 'none';
  };
"""

target_helper = "  const shouldShowLiftBadge = (floor?: string | null, hasLift?: string | null) => {"
if "isLandlordListing" not in content:
    content = content.replace(target_helper, landlord_helper + "\n" + target_helper, 1)

# 2. Add is_direct_landlord to RankedItem interface
old_interface = "  building_name?: string | null;\n  pro_report?: ProReport | null;"
new_interface = "  building_name?: string | null;\n  is_direct_landlord?: boolean;\n  pro_report?: ProReport | null;"
if "is_direct_landlord?:" not in content:
    content = content.replace(old_interface, new_interface, 1)

# 3. Update Card View Agency / Landlord rendering
old_card_agency = """                                  {item.agency_name && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {/* Clickable Agency Stars & Reviews Link */}
                                      <a
                                        href={item.agency_url || `https://www.google.com/search?q=${encodeURIComponent(item.agency_name + ' Cape Town reviews')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`Click to read verified reviews for ${item.agency_name}`}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-zinc-100 hover:bg-zinc-200/90 text-zinc-800 font-medium border border-zinc-200/80 hover:border-zinc-300 text-[11px] transition-all cursor-pointer group/agency"
                                      >
                                        <Buildings size={12} className="text-zinc-500 group-hover/agency:text-zinc-900" />
                                        <span className="font-semibold group-hover/agency:text-zinc-950">{item.agency_name}</span>
                                        {item.agency_rating && (
                                          <span className="flex items-center gap-0.5 text-amber-700 font-bold ml-0.5">
                                            <Star size={12} weight="fill" className="text-amber-500" />
                                            {item.agency_rating.toFixed(1)}★
                                            {item.agency_review_count ? (
                                              <span className="text-zinc-500 font-normal text-[10px] underline decoration-zinc-300 underline-offset-2">({item.agency_review_count})</span>
                                            ) : null}
                                          </span>
                                        )}
                                        <ArrowSquareOut size={11} className="text-zinc-400 group-hover/agency:text-zinc-700" />
                                      </a>

                                      {/* Agency Risk / Red Flag Badge - Clickable to see reviews */}
                                      {item.agency_risk_level === 'high' || (item.agency_rating && item.agency_rating < 3.0) ? (
                                        <a
                                          href={item.agency_url || `https://www.google.com/search?q=${encodeURIComponent(item.agency_name + ' Cape Town reviews')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={`Warning: Click to read tenant complaints for ${item.agency_name}`}
                                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs transition-all cursor-pointer"
                                        >
                                          <span>🚩</span>
                                          <span>Red Flag: Negative Tenant Reviews</span>
                                          {item.agency_flags && item.agency_flags[0] && (
                                            <span className="text-rose-600 font-semibold text-[10px] hidden sm:inline">({item.agency_flags[0]})</span>
                                          )}
                                          <ArrowSquareOut size={11} className="text-rose-500" />
                                        </a>
                                      ) : item.agency_risk_level === 'moderate' || (item.agency_rating && item.agency_rating < 3.8) ? (
                                        <a
                                          href={item.agency_url || `https://www.google.com/search?q=${encodeURIComponent(item.agency_name + ' Cape Town reviews')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={`Click to read reviews for ${item.agency_name}`}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all cursor-pointer"
                                        >
                                          <span>⚠️</span>
                                          <span>Moderate Reviews</span>
                                          <ArrowSquareOut size={10} className="text-amber-600" />
                                        </a>
                                      ) : item.agency_rating ? (
                                        <a
                                          href={item.agency_url || `https://www.google.com/search?q=${encodeURIComponent(item.agency_name + ' Cape Town reviews')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={`Click to read verified reviews for ${item.agency_name}`}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer"
                                        >
                                          <ShieldCheck size={12} weight="bold" className="text-emerald-600" />
                                          <span>Verified Agency</span>
                                          <ArrowSquareOut size={10} className="text-emerald-600" />
                                        </a>
                                      ) : null}
                                    </div>
                                  )}"""

new_card_agency = """                                  {/* Direct Landlord vs Agency Reviews Badge */}
                                  {isLandlordListing(item) ? (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-teal-50 text-teal-900 font-semibold border border-teal-200/80 text-[11px] shadow-2xs">
                                      <House size={12} weight="fill" className="text-teal-600" />
                                      <span>Direct Landlord</span>
                                      <span className="text-[10px] text-teal-700 bg-teal-100/70 px-1.5 py-0.2 rounded font-normal">No Agency Fees</span>
                                    </div>
                                  ) : item.agency_name ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {/* Clickable Agency Stars & Reviews Link */}
                                      <a
                                        href={item.agency_url || `https://www.google.com/search?q=${encodeURIComponent(item.agency_name + ' Cape Town reviews')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`Click to read verified reviews for ${item.agency_name}`}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-zinc-100 hover:bg-zinc-200/90 text-zinc-800 font-medium border border-zinc-200/80 hover:border-zinc-300 text-[11px] transition-all cursor-pointer group/agency"
                                      >
                                        <Buildings size={12} className="text-zinc-500 group-hover/agency:text-zinc-900" />
                                        <span className="font-semibold group-hover/agency:text-zinc-950">{item.agency_name}</span>
                                        {item.agency_rating && (
                                          <span className="flex items-center gap-0.5 text-amber-700 font-bold ml-0.5">
                                            <Star size={12} weight="fill" className="text-amber-500" />
                                            {item.agency_rating.toFixed(1)}★
                                            {item.agency_review_count ? (
                                              <span className="text-zinc-500 font-normal text-[10px] underline decoration-zinc-300 underline-offset-2">({item.agency_review_count})</span>
                                            ) : null}
                                          </span>
                                        )}
                                        <ArrowSquareOut size={11} className="text-zinc-400 group-hover/agency:text-zinc-700" />
                                      </a>

                                      {/* Agency Risk / Red Flag Badge - Clickable to see reviews */}
                                      {item.agency_risk_level === 'high' || (item.agency_rating && item.agency_rating < 3.0) ? (
                                        <a
                                          href={item.agency_url || `https://www.google.com/search?q=${encodeURIComponent(item.agency_name + ' Cape Town reviews')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={`Warning: Click to read tenant complaints for ${item.agency_name}`}
                                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs transition-all cursor-pointer"
                                        >
                                          <span>🚩</span>
                                          <span>Red Flag: Negative Tenant Reviews</span>
                                          {item.agency_flags && item.agency_flags[0] && (
                                            <span className="text-rose-600 font-semibold text-[10px] hidden sm:inline">({item.agency_flags[0]})</span>
                                          )}
                                          <ArrowSquareOut size={11} className="text-rose-500" />
                                        </a>
                                      ) : item.agency_risk_level === 'moderate' || (item.agency_rating && item.agency_rating < 3.8) ? (
                                        <a
                                          href={item.agency_url || `https://www.google.com/search?q=${encodeURIComponent(item.agency_name + ' Cape Town reviews')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={`Click to read reviews for ${item.agency_name}`}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all cursor-pointer"
                                        >
                                          <span>⚠️</span>
                                          <span>Moderate Reviews</span>
                                          <ArrowSquareOut size={10} className="text-amber-600" />
                                        </a>
                                      ) : item.agency_rating ? (
                                        <a
                                          href={item.agency_url || `https://www.google.com/search?q=${encodeURIComponent(item.agency_name + ' Cape Town reviews')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={`Click to read verified reviews for ${item.agency_name}`}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer"
                                        >
                                          <ShieldCheck size={12} weight="bold" className="text-emerald-600" />
                                          <span>Verified Agency</span>
                                          <ArrowSquareOut size={10} className="text-emerald-600" />
                                        </a>
                                      ) : null}
                                    </div>
                                  ) : null}"""

content = content.replace(old_card_agency, new_card_agency, 1)

# 4. Update Table View Agency / Landlord rendering
old_table_agency = """                                       {item.agency_name && (
                                         <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600 mt-0.5">
                                           <a
                                             href={item.agency_url || `https://www.google.com/search?q=${encodeURIComponent(item.agency_name + ' Cape Town reviews')}`}
                                             target="_blank"
                                             rel="noopener noreferrer"
                                             title={`Read reviews for ${item.agency_name}`}
                                             className="inline-flex items-center gap-1 font-medium hover:text-zinc-950 hover:underline transition-colors"
                                           >
                                             <span>{item.agency_name}</span>
                                             {item.agency_rating && (
                                               <span className="text-amber-700 font-bold ml-0.5">★ {item.agency_rating.toFixed(1)}</span>
                                             )}
                                             <ArrowSquareOut size={10} className="text-zinc-400" />
                                           </a>
                                           {(item.agency_risk_level === 'high' || (item.agency_rating && item.agency_rating < 3.0)) && (
                                             <a
                                               href={item.agency_url || `https://www.google.com/search?q=${encodeURIComponent(item.agency_name + ' Cape Town reviews')}`}
                                               target="_blank"
                                               rel="noopener noreferrer"
                                               className="text-[10px] text-rose-800 font-extrabold bg-rose-50 hover:bg-rose-100 px-1.5 py-0.2 rounded border border-rose-300 flex items-center gap-0.5"
                                             >
                                               <span>🚩</span> Red Flag
                                             </a>
                                           )}
                                         </div>
                                       )}"""

new_table_agency = """                                       {isLandlordListing(item) ? (
                                         <div className="flex items-center gap-1 text-[11px] text-teal-800 font-semibold mt-0.5">
                                           <span>🏡 Direct Landlord</span>
                                         </div>
                                       ) : item.agency_name ? (
                                         <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600 mt-0.5">
                                           <a
                                             href={item.agency_url || `https://www.google.com/search?q=${encodeURIComponent(item.agency_name + ' Cape Town reviews')}`}
                                             target="_blank"
                                             rel="noopener noreferrer"
                                             title={`Read reviews for ${item.agency_name}`}
                                             className="inline-flex items-center gap-1 font-medium hover:text-zinc-950 hover:underline transition-colors"
                                           >
                                             <span>{item.agency_name}</span>
                                             {item.agency_rating && (
                                               <span className="text-amber-700 font-bold ml-0.5">★ {item.agency_rating.toFixed(1)}</span>
                                             )}
                                             <ArrowSquareOut size={10} className="text-zinc-400" />
                                           </a>
                                           {(item.agency_risk_level === 'high' || (item.agency_rating && item.agency_rating < 3.0)) && (
                                             <a
                                               href={item.agency_url || `https://www.google.com/search?q=${encodeURIComponent(item.agency_name + ' Cape Town reviews')}`}
                                               target="_blank"
                                               rel="noopener noreferrer"
                                               className="text-[10px] text-rose-800 font-extrabold bg-rose-50 hover:bg-rose-100 px-1.5 py-0.2 rounded border border-rose-300 flex items-center gap-0.5"
                                             >
                                               <span>🚩</span> Red Flag
                                             </a>
                                           )}
                                         </div>
                                       ) : null}"""

content = content.replace(old_table_agency, new_table_agency, 1)

with open("c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Applied Landlord badge replacement successfully!")

