with open("c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update Card View Agency Badge
old_card_agency = """                                  {item.agency_name && (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-zinc-100 text-zinc-800 font-medium border border-zinc-200/80 text-[11px]">
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
                                  )}"""

new_card_agency = """                                  {item.agency_name && (
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

content = content.replace(old_card_agency, new_card_agency, 1)

# 2. Add Red Flag to Cons Container
old_cons = """                                      <ul className="space-y-1.5 text-xs text-rose-950">
                                        {item.cons.map((con, cIdx) => ("""

new_cons = """                                      <ul className="space-y-1.5 text-xs text-rose-950">
                                        {(item.agency_risk_level === 'high' || (item.agency_rating && item.agency_rating < 3.0)) && (
                                          <li className="flex items-start gap-2 leading-relaxed text-rose-900 font-semibold bg-rose-100/70 p-2 rounded-xl border border-rose-300">
                                            <span className="text-sm">🚩</span>
                                            <span>Agency Caution: {item.agency_name} has low tenant ratings ({item.agency_rating}★). Common complaints cite withheld deposits and maintenance delays.</span>
                                          </li>
                                        )}
                                        {item.cons.map((con, cIdx) => ("""

content = content.replace(old_cons, new_cons, 1)

# 3. Add Agency and Red Flag to Table View
old_table_bldg = """                                       {item.building_name && (
                                         <div className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1 mt-0.5">
                                           <Buildings size={12} className="text-indigo-500" />
                                           <span>{item.building_name}</span>
                                         </div>
                                       )}"""

new_table_bldg = """                                       {item.building_name && (
                                         <div className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1 mt-0.5">
                                           <Buildings size={12} className="text-indigo-500" />
                                           <span>{item.building_name}</span>
                                         </div>
                                       )}
                                       {item.agency_name && (
                                         <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600 mt-0.5">
                                           <span className="font-medium">{item.agency_name}</span>
                                           {item.agency_rating && (
                                             <span className="text-amber-700 font-bold">★ {item.agency_rating.toFixed(1)}</span>
                                           )}
                                           {(item.agency_risk_level === 'high' || (item.agency_rating && item.agency_rating < 3.0)) && (
                                             <span className="text-[10px] text-rose-800 font-extrabold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-300 flex items-center gap-0.5">
                                               <span>🚩</span> Red Flag
                                             </span>
                                           )}
                                         </div>
                                       )}"""

content = content.replace(old_table_bldg, new_table_bldg, 1)

with open("c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Applied agency red flags patch successfully!")

