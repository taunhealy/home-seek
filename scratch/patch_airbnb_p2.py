with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Target start from Master-Detail Layout comment down to Overview Banner Card
start_marker = '          /* Master-Detail Layout in Search Page Styling */'
end_marker = '                  {/* Overview Banner Card */}'

idx_start = text.find(start_marker)
idx_end = text.find(end_marker)

print('Found start:', idx_start, 'end:', idx_end)

if idx_start != -1 and idx_end != -1:
    old_section = text[idx_start:idx_end]
    new_section = '''          {/* Airbnb-style Top Control & Report Selector Bar */}
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-3xl bg-zinc-50 border border-zinc-200 shadow-2xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Report Dropdown Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowArchiveDropdown(!showArchiveDropdown)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Clock size={14} weight="bold" />
                    <span>Report: {selectedReport ? formatDate(selectedReport.created_at) : 'Select Report'}</span>
                    <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded-md font-semibold">
                      {filteredRankedListings.length} Contenders
                    </span>
                    <CaretDown size={12} weight="bold" className={`transition-transform duration-200 ${showArchiveDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {showArchiveDropdown && (
                    <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white border border-zinc-200 rounded-3xl shadow-2xl p-2.5 z-50 space-y-1.5 max-h-[480px] overflow-y-auto">
                      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        <span>Report Archive ({reports.length})</span>
                        <span className="text-[10px] text-zinc-400 font-normal">Daily 11:00 AM SAST</span>
                      </div>
                      {reports.map((rep) => {
                        const isSel = selectedReport?.id === rep.id;
                        return (
                          <button
                            key={rep.id}
                            onClick={() => { setSelectedReport(rep); setShowArchiveDropdown(false); }}
                            className={`w-full text-left p-3 rounded-2xl border text-xs transition-all cursor-pointer ${
                              isSel ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm' : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-900'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold mb-1">
                              <span>{formatDate(rep.created_at)}</span>
                              <span className={`text-[11px] ${isSel ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                {rep.ranked_listings?.length || 0} listings
                              </span>
                            </div>
                            <p className="text-[11px] line-clamp-1 opacity-80">{rep.user_prompt || 'Scouted Report'}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Scope & Filter Badges */}
                {selectedReport?.areas_scouted && selectedReport.areas_scouted.length > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-semibold text-zinc-700">
                    <span>📍</span>
                    <span>{selectedReport.areas_scouted.join(', ')}</span>
                  </span>
                )}
                {selectedReport?.max_price && (
                  <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-semibold text-zinc-700">
                    <span>Max R {selectedReport.max_price.toLocaleString()}</span>
                  </span>
                )}
              </div>

              {/* View Mode & Verification Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Live Availability Verification */}
                <button
                  onClick={handleVerifyAvailability}
                  disabled={isVerifyingAvailability}
                  title="Check if any listings have been rented or deleted on Property24"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                >
                  <Lightning size={13} weight="fill" className={isVerifyingAvailability ? 'animate-spin text-amber-500' : 'text-emerald-600'} />
                  <span>{isVerifyingAvailability ? 'Verifying...' : 'Verify Status'}</span>
                </button>

                {/* Hide Off-Market Toggle */}
                {(selectedReport?.ranked_listings?.filter(it => it.is_available === false).length ?? 0) > 0 && (
                  <button
                    onClick={() => setHideUnavailable(!hideUnavailable)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      hideUnavailable
                        ? 'bg-zinc-950 text-white border-zinc-950 shadow-2xs'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <span>{hideUnavailable ? '✓' : '🚫'}</span>
                    <span>Hide Off-Market ({selectedReport?.ranked_listings?.filter(it => it.is_available === false).length})</span>
                  </button>
                )}

                {/* View Switchers */}
                <div className="flex items-center p-1 bg-zinc-100 rounded-xl border border-zinc-200">
                  <button
                    onClick={() => setViewMode('split')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'split' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                    title="Airbnb-style split view with full-size interactive map on the right"
                  >
                    <Compass size={14} weight="bold" />
                    <span>Split Map</span>
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'cards' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    <SquaresFour size={14} weight="bold" />
                    <span>Photo Gallery</span>
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'table' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    <ListDashes size={14} weight="bold" />
                    <span>Table View</span>
                  </button>
                </div>
              </div>
            </div>

            {selectedReport && (
              <div className="space-y-6">
'''
    text = text[:idx_start] + new_section + text[idx_end:]

# Now update the closing tags at the bottom of the section
# Formerly:
#                     </div>
#                   )}
#                 </div>
#               )}
#             </div>
#           </div>
#         )}
old_bottom = '''                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}'''

new_bottom = '''                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}'''

text = text.replace(old_bottom, new_bottom, 1)

# Now update the viewMode === 'split' grid ratio from xl:col-span-7 / xl:col-span-5 to lg:col-span-6 / lg:col-span-6 (50/50)
old_grid = 'viewMode === \'split\' ? "grid grid-cols-1 xl:grid-cols-12 gap-8 items-start" : "space-y-6"'
new_grid = 'viewMode === \'split\' ? "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full" : "space-y-6"'
text = text.replace(old_grid, new_grid, 1)

old_cards_col = 'viewMode === \'split\' ? "xl:col-span-7 space-y-6" : "space-y-6"'
new_cards_col = 'viewMode === \'split\' ? "lg:col-span-6 xl:col-span-6 space-y-6" : "space-y-6"'
text = text.replace(old_cards_col, new_cards_col, 1)

old_mobile_map = 'xl:hidden h-80 w-full rounded-3xl overflow-hidden border border-zinc-200 shadow-md mb-6'
new_mobile_map = 'lg:hidden h-80 w-full rounded-3xl overflow-hidden border border-zinc-200 shadow-md mb-6'
text = text.replace(old_mobile_map, new_mobile_map, 1)

old_map_col = '<div className="hidden xl:block xl:col-span-5 sticky top-20 h-[calc(100vh-6.5rem)] rounded-3xl overflow-hidden border border-zinc-200 shadow-xl bg-white">'
new_map_col = '<div className="hidden lg:block lg:col-span-6 xl:col-span-6 sticky top-20 h-[calc(100vh-6.5rem)] rounded-3xl overflow-hidden border border-zinc-200 shadow-xl bg-white">'
text = text.replace(old_map_col, new_map_col, 1)

with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Phase 2 applied successfully!')

