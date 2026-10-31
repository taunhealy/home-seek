path = 'web/src/app/reports/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
if 'SpeakerHigh' not in content:
    content = content.replace(
        "import { PropertyMap, PropertyMapItem, ProximityAnchor } from '@/components/PropertyMap';",
        "import { PropertyMap, PropertyMapItem, ProximityAnchor, AcousticAudit } from '@/components/PropertyMap';"
    )
    content = content.replace(
        "  Quotes\n} from '@phosphor-icons/react';",
        "  Quotes,\n  SpeakerHigh\n} from '@phosphor-icons/react';"
    )

# 2. Add acoustic_audit to RankedItem interface
if 'acoustic_audit?: AcousticAudit | null;' not in content:
    content = content.replace(
        "  community_sentiment?: CommunitySentiment | null;\n  is_available?: boolean;",
        "  community_sentiment?: CommunitySentiment | null;\n  acoustic_audit?: AcousticAudit | null;\n  is_available?: boolean;"
    )

# 3. Update Roberta Flats coords in KNOWN_LISTING_COORDS to exact corner of Derwent & Malan St
old_coords = '"117763397": [-33.9338, 18.4055],'
new_coords = '"117763397": [-33.9328, 18.4103],'
if old_coords in content:
    content = content.replace(old_coords, new_coords)

# 4. Forward acoustic_audit in mapProperties
old_map_prop = """        rank: idx + 1,
        fit_score: item.fit_score,
        noise_risk: item.noise_risk,
        noise_reason: item.noise_reason,
        location_proximity: item.location_proximity
      };"""
new_map_prop = """        rank: idx + 1,
        fit_score: item.fit_score,
        noise_risk: item.noise_risk,
        noise_reason: item.noise_reason,
        location_proximity: item.location_proximity,
        acoustic_audit: item.acoustic_audit || undefined
      };"""
if old_map_prop in content:
    content = content.replace(old_map_prop, new_map_prop)

# 5. Insert Acoustic & Sound Shadow Card into listing dossier
acoustic_card = """
                            {/* ACOUSTIC DECIBEL & SOUND SHADOW AUDIT */}
                            {item.acoustic_audit && (
                              <div className="mt-4 rounded-3xl bg-white border border-zinc-200/90 p-4 sm:p-5 shadow-sm space-y-4">
                                {/* Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-zinc-100">
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0 ${
                                      item.acoustic_audit.is_shielded
                                        ? 'bg-emerald-500 text-white shadow-emerald-500/20 shadow-sm'
                                        : 'bg-rose-600 text-white shadow-rose-600/20 shadow-sm'
                                    }`}>
                                      {item.acoustic_audit.is_shielded ? (
                                        <ShieldCheck size={18} weight="bold" />
                                      ) : (
                                        <SpeakerHigh size={18} weight="bold" />
                                      )}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-sm tracking-tight text-zinc-950 uppercase">
                                          Acoustic &amp; Sound Shadow Audit
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                          item.acoustic_audit.is_shielded
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                            : 'bg-rose-50 text-rose-800 border-rose-200'
                                        }`}>
                                          {item.acoustic_audit.sound_shadow_status}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-zinc-500">
                                        Calibrated line-of-sight sound canyon analysis &amp; building diffraction
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <div className={`px-3 py-1.5 rounded-2xl font-black text-xs flex items-center gap-1.5 border ${
                                      item.acoustic_audit.estimated_db <= 44
                                        ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                                        : item.acoustic_audit.estimated_db <= 60
                                        ? 'bg-amber-50 text-amber-950 border-amber-200'
                                        : 'bg-rose-50 text-rose-950 border-rose-200'
                                    }`}>
                                      <span className="text-zinc-400 font-medium text-[10px]">EST. ARRIVAL:</span>
                                      <span className="text-sm">{item.acoustic_audit.estimated_db}</span>
                                      <span className="text-[10px] text-zinc-500 font-bold">dBA</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Visual Decibel Gauge Meter Bar */}
                                <div className="space-y-1.5 bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                                  <div className="flex items-center justify-between text-[11px] font-bold">
                                    <span className="text-zinc-500">Acoustic Exposure Spectrum</span>
                                    <span className={item.acoustic_audit.is_shielded ? 'text-emerald-700' : 'text-rose-700'}>
                                      {item.acoustic_audit.exposure_label}
                                    </span>
                                  </div>
                                  <div className="relative h-2.5 w-full bg-zinc-200 rounded-full overflow-hidden flex">
                                    <div className="h-full bg-emerald-500 w-[30%]" title="Sanctuary (<45 dB)" />
                                    <div className="h-full bg-amber-400 w-[30%]" title="Moderate Ambient (45-65 dB)" />
                                    <div className="h-full bg-rose-600 w-[40%]" title="High Risk Corridor (>65 dB)" />
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                                    <span>30 dB (Forest Calm)</span>
                                    <span>55 dB (Normal Conversation)</span>
                                    <span>85 dB (Aruba / Bar DJ Bass)</span>
                                  </div>
                                </div>

                                {/* 3 Metric Panels */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                                  <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3 space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                                      Sound Shadow &amp; Diffraction
                                    </span>
                                    <p className="font-extrabold text-zinc-950">
                                      {item.acoustic_audit.is_shielded ? '🛡️ -14 dB Attenuation' : '⚡ 0 dB Direct Exposure'}
                                    </p>
                                    <p className="text-[11px] text-zinc-600 leading-snug">
                                      {item.acoustic_audit.is_shielded
                                        ? 'Solid building mass blocks direct sound canyon'
                                        : 'Unobstructed street line-of-sight acts as sound waveguide'}
                                    </p>
                                  </div>

                                  <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3 space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                                      Window / Facade Orientation
                                    </span>
                                    <p className="font-extrabold text-zinc-950 truncate">
                                      {item.acoustic_audit.facing_direction}
                                    </p>
                                    <p className="text-[11px] text-zinc-600 leading-snug">
                                      {item.acoustic_audit.facing_direction.toLowerCase().includes('mountain') || item.acoustic_audit.facing_direction.toLowerCase().includes('west')
                                        ? 'Faces mountain slopes; natural acoustic buffer'
                                        : 'Faces street traffic & commercial sound axis'}
                                    </p>
                                  </div>

                                  <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3 space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                                      Nearest Nightlife / Transit
                                    </span>
                                    <p className="font-extrabold text-zinc-950 truncate">
                                      {item.acoustic_audit.nearest_hotspot.split('(')[0].trim()}
                                    </p>
                                    <p className="text-[11px] text-zinc-600 leading-snug">
                                      ~{item.acoustic_audit.distance_to_hotspot_m}m away
                                    </p>
                                  </div>
                                </div>

                                {/* Acoustic Quirks List */}
                                {item.acoustic_audit.acoustic_quirks && item.acoustic_audit.acoustic_quirks.length > 0 && (
                                  <div className="space-y-1.5 pt-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                                      Key Acoustic Observations
                                    </span>
                                    <ul className="space-y-1 text-xs">
                                      {item.acoustic_audit.acoustic_quirks.map((q, qIdx) => (
                                        <li key={qIdx} className="flex items-start gap-1.5 leading-snug text-zinc-700">
                                          <span className={`font-bold mt-0.5 ${item.acoustic_audit?.is_shielded ? 'text-emerald-500' : 'text-rose-500'}`}>•</span>
                                          <span>{q}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* AI Acoustic Verdict Box */}
                                {item.acoustic_audit.verdict && (
                                  <div className={`rounded-2xl p-3 flex items-start gap-2.5 ${
                                    item.acoustic_audit.is_shielded
                                      ? 'bg-emerald-950 text-emerald-100 border border-emerald-900/50'
                                      : 'bg-zinc-950 text-zinc-100 border border-zinc-900'
                                  }`}>
                                    <Sparkle size={16} weight="fill" className={`shrink-0 mt-0.5 ${item.acoustic_audit.is_shielded ? 'text-emerald-400' : 'text-amber-400'}`} />
                                    <div className="space-y-0.5">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                                        Acoustic Advisory Verdict
                                      </span>
                                      <p className="text-xs font-medium leading-relaxed">
                                        {item.acoustic_audit.verdict}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
"""

target_div = """                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}"""

if 'Acoustic &amp; Sound Shadow Audit' not in content:
    content = content.replace(target_div, target_div + acoustic_card)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: reports page acoustics patch applied.")

