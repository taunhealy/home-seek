import re

file_path = r'c:\Ryoko\Projects\home-seek\web\src\app\reports\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add NavigationArrow to imports if not present
if 'NavigationArrow,' not in content:
    content = content.replace('Lightning,', 'Lightning,\n  NavigationArrow,')

# 2. Add LocationProximityItem interface
loc_interface = '''
interface LocationProximityItem {
  label: string;
  target_place: string;
  distance_km: number;
  distance_text: string;
  duration_mins: number;
  duration_text: string;
  commute_mode: 'driving' | 'walking' | 'bicycling' | 'transit' | string;
  is_within_threshold?: boolean;
  maps_route_url?: string;
}
'''

if 'interface LocationProximityItem' not in content:
    content = content.replace('interface RankedItem {', loc_interface + '\ninterface RankedItem {')

# 3. Add location_proximity to RankedItem
if 'location_proximity?:' not in content:
    content = content.replace(
        'last_verified_at?: number;',
        'last_verified_at?: number;\n  location_proximity?: LocationProximityItem[];'
    )

# 4. Add location_anchors to IntelligenceReport
if 'location_anchors?:' not in content:
    content = content.replace(
        'last_availability_check?: number;',
        'last_availability_check?: number;\n  location_anchors?: any[];\n  commute_anchors?: any[];'
    )

# 5. Add User Priority Locations to Overview Banner Card
overview_chips_target = '''                      {selectedReport.personal_tastes && (
                        <span className="bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200 max-w-md truncate">
                          Tastes: {selectedReport.personal_tastes}
                        </span>
                      )}
                    </div>
                  </div>'''

overview_chips_replacement = '''                      {selectedReport.personal_tastes && (
                        <span className="bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200 max-w-md truncate">
                          Tastes: {selectedReport.personal_tastes}
                        </span>
                      )}
                    </div>

                    {/* User Priority Locations Bar */}
                    {(selectedReport.location_anchors || selectedReport.commute_anchors) && (
                      <div className="pt-3 border-t border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                        <div className="flex items-center gap-1.5 text-zinc-900 font-bold">
                          <NavigationArrow size={14} weight="bold" className="text-indigo-600" />
                          <span>Priority Location Anchors ({((selectedReport.location_anchors || selectedReport.commute_anchors) as any[]).length}):</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {((selectedReport.location_anchors || selectedReport.commute_anchors) as any[]).map((loc: any, idx: number) => (
                            <span
                              key={idx}
                              title={loc.target_place}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-zinc-800 text-[11px] font-medium transition-colors"
                            >
                              <span>{loc.commute_mode === 'walking' ? '🚶' : loc.commute_mode === 'bicycling' ? '🚲' : '🚗'}</span>
                              <span className="font-semibold text-zinc-950">{loc.label}</span>
                              <span className="text-zinc-500 font-normal hidden md:inline">({loc.target_place})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>'''

if 'Priority Location Anchors' not in content:
    if overview_chips_target in content:
        content = content.replace(overview_chips_target, overview_chips_replacement)
    else:
        # try CRLF
        overview_chips_target_crlf = overview_chips_target.replace('\n', '\r\n')
        overview_chips_replacement_crlf = overview_chips_replacement.replace('\n', '\r\n')
        if overview_chips_target_crlf in content:
            content = content.replace(overview_chips_target_crlf, overview_chips_replacement_crlf)

# 6. Add Location Proximity Section inside each card
advisor_target = '''                            {/* Advisor Evaluation */}
                            <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 text-xs text-zinc-800 leading-relaxed font-normal">
                              <span className="font-bold text-zinc-950 block mb-1">Advisor Evaluation:</span>
                              {item.short_explanation}
                            </div>'''

proximity_section = '''                            {/* Advisor Evaluation */}
                            <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 text-xs text-zinc-800 leading-relaxed font-normal">
                              <span className="font-bold text-zinc-950 block mb-1">Advisor Evaluation:</span>
                              {item.short_explanation}
                            </div>

                            {/* Location Proximity Section */}
                            {item.location_proximity && item.location_proximity.length > 0 && (
                              <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-950 uppercase tracking-wider">
                                    <NavigationArrow size={14} weight="bold" className="text-indigo-600" />
                                    <span>Location Proximity & Commutes</span>
                                  </div>
                                  <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline">
                                    Click any route for live Google Maps directions
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-0.5">
                                  {item.location_proximity.map((prox, pIdx) => {
                                    const isWalk = prox.commute_mode === 'walking';
                                    const isBike = prox.commute_mode === 'bicycling' || prox.commute_mode === 'cycling' || prox.commute_mode === 'bike';
                                    const modeIcon = isWalk ? '🚶' : isBike ? '🚲' : '🚗';

                                    return (
                                      <a
                                        key={pIdx}
                                        href={prox.maps_route_url || `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(item.address)}&destination=${encodeURIComponent(prox.target_place)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`Directions from ${item.address} to ${prox.target_place}`}
                                        className="group/prox flex flex-col justify-between p-3 rounded-xl bg-white hover:bg-zinc-100/90 border border-zinc-200/80 hover:border-zinc-300 transition-all cursor-pointer shadow-2xs"
                                      >
                                        <div className="space-y-0.5">
                                          <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-bold text-zinc-900 truncate max-w-[130px] group-hover/prox:text-indigo-600 transition-colors">
                                              {prox.label}
                                            </span>
                                            <ArrowSquareOut size={12} className="text-zinc-400 group-hover/prox:text-indigo-500 shrink-0" />
                                          </div>
                                          <div className="text-[10px] text-zinc-500 truncate">
                                            {prox.target_place}
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 mt-2 text-xs">
                                          <div className="flex items-center gap-1.5 font-extrabold text-zinc-950">
                                            <span>{modeIcon}</span>
                                            <span>{prox.duration_text}</span>
                                          </div>
                                          <span className="text-[10px] text-zinc-500 font-medium">
                                            {prox.distance_text}
                                          </span>
                                        </div>
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            )}'''

if 'Location Proximity & Commutes' not in content:
    if advisor_target in content:
        content = content.replace(advisor_target, proximity_section)
    else:
        advisor_target_crlf = advisor_target.replace('\n', '\r\n')
        proximity_section_crlf = proximity_section.replace('\n', '\r\n')
        if advisor_target_crlf in content:
            content = content.replace(advisor_target_crlf, proximity_section_crlf)

# 7. Add Proximity snippets in Table View
table_cell_anchor = '''                                      {item.building_name && (
                                        <div className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1 mt-0.5">
                                          <Buildings size={12} className="text-indigo-500" />
                                          <span>{item.building_name}</span>
                                        </div>
                                      )}'''

table_cell_replacement = '''                                      {item.building_name && (
                                        <div className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1 mt-0.5">
                                          <Buildings size={12} className="text-indigo-500" />
                                          <span>{item.building_name}</span>
                                        </div>
                                      )}
                                      {item.location_proximity && item.location_proximity.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                          {item.location_proximity.slice(0, 3).map((prox, pIdx) => (
                                            <a
                                              key={pIdx}
                                              href={prox.maps_route_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[10px] font-semibold transition-colors"
                                              title={`${prox.label} (${prox.target_place}) - Click for Google Maps route`}
                                            >
                                              <span>{prox.commute_mode === 'walking' ? '🚶' : prox.commute_mode === 'bicycling' ? '🚲' : '🚗'}</span>
                                              <span>{prox.label.split('(')[0].trim()}:</span>
                                              <span className="font-extrabold text-zinc-950">{prox.duration_text}</span>
                                            </a>
                                          ))}
                                        </div>
                                      )}'''

if 'slice(0, 3).map((prox' not in content:
    if table_cell_anchor in content:
        content = content.replace(table_cell_anchor, table_cell_replacement)
    else:
        table_cell_anchor_crlf = table_cell_anchor.replace('\n', '\r\n')
        table_cell_replacement_crlf = table_cell_replacement.replace('\n', '\r\n')
        if table_cell_anchor_crlf in content:
            content = content.replace(table_cell_anchor_crlf, table_cell_replacement_crlf)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated web/src/app/reports/page.tsx with Location Proximity UI!")

