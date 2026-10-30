with open("c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Card View: Replace agency badge with clickable link to Google reviews
old_card_agency = """                                  {item.agency_name && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-zinc-100 text-zinc-800 font-medium border border-zinc-200/80 text-[11px]">
                                        <Buildings size={12} className="text-zinc-500" />
                                        <span className="font-semibold">{item.agency_name}</span>
                                        {item.agency_rating && (
                                          <span className="flex items-center gap-0.5 text-amber-700 font-bold ml-0.5">
                                            <Star size={12} weight="fill" className="text-amber-500" />
                                            {item.agency_rating.toFixed(1)}★
                                            {item.agency_review_count ? (
                                              <span className="text-zinc-400 font-normal text-[10px]">({item.agency_review_count})</span>
                                            ) : null}
                                          </span>
                                        )}
                                      </div>

                                      {/* Agency Risk / Red Flag Badge */}
                                      {item.agency_risk_level === 'high' || (item.agency_rating && item.agency_rating < 3.0) ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs">
                                          <span>🚩</span>
                                          <span>Red Flag: Negative Tenant Reviews</span>
                                          {item.agency_flags && item.agency_flags[0] && (
                                            <span className="text-rose-600 font-semibold text-[10px] hidden sm:inline">({item.agency_flags[0]})</span>
                                          )}
                                        </span>
                                      ) : item.agency_risk_level === 'moderate' || (item.agency_rating && item.agency_rating < 3.8) ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                          <span>⚠️</span>
                                          <span>Moderate Reviews</span>
                                        </span>
                                      ) : item.agency_rating ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                          <ShieldCheck size={12} weight="bold" className="text-emerald-600" />
                                          <span>Verified Agency</span>
                                        </span>
                                      ) : null}
                                    </div>
                                  )}"""

new_card_agency = """                                  {item.agency_name && (
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

content = content.replace(old_card_agency, new_card_agency, 1)

# 2. Table View: Add clickable Agency Link with reviews
old_table_target = """                                       {item.building_name && (
                                         <div className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1 mt-0.5">
                                           <Buildings size={12} className="text-indigo-500" />
                                           <span>{item.building_name}</span>
                                         </div>
                                       )}"""

new_table_target = """                                       {item.building_name && (
                                         <div className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1 mt-0.5">
                                           <Buildings size={12} className="text-indigo-500" />
                                           <span>{item.building_name}</span>
                                         </div>
                                       )}
                                       {item.agency_name && (
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

content = content.replace(old_table_target, new_table_target, 1)

with open("c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Linked agency stars badge directly to reviews!")

