import re

path = 'web/src/components/PropertyMap.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add nearestHotspot and isPropShielded computations after activeAnchor
helpers = """
  // Nearest Noise Hotspot and Sound Shadow calculations for Selected Property
  const nearestHotspot = React.useMemo(() => {
    if (!selectedProp) return null;
    let closest = CAPE_TOWN_HOTSPOTS[0];
    let minDist = 999999;
    for (const h of CAPE_TOWN_HOTSPOTS) {
      const d = calculateDistanceKm(selectedProp.lat, selectedProp.lng, h.lat, h.lng) * 1000;
      if (d < minDist) {
        minDist = d;
        closest = h;
      }
    }
    return { ...closest, distanceM: Math.round(minDist) };
  }, [selectedProp]);

  const isPropShielded = React.useMemo(() => {
    if (!selectedProp) return false;
    if (selectedProp.acoustic_audit) {
      return selectedProp.acoustic_audit.is_shielded;
    }
    const text = `${selectedProp.title} ${selectedProp.address}`.toLowerCase();
    if (text.includes('4 derwent') || text.includes('roberta')) return false; // direct Aruba waveguide
    if (text.includes('derwent')) return true; // around corner into sound shadow
    return (nearestHotspot?.distanceM || 0) > 180;
  }, [selectedProp, nearestHotspot]);
"""

if 'nearestHotspot = React.useMemo' not in content:
    content = content.replace(
        "  // Selected prop position\n  const propPos = selectedProp ? getScreenPos(selectedProp.lat, selectedProp.lng) : null;",
        "  // Selected prop position\n  const propPos = selectedProp ? getScreenPos(selectedProp.lat, selectedProp.lng) : null;\n" + helpers
    )

# 2. Add SVG defs for radial gradients
svg_defs = """          <radialGradient id="hotspot-radial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#f97316" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sanctuary-radial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
            <stop offset="55%" stopColor="#059669" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>"""

if 'id="hotspot-radial"' not in content:
    content = content.replace(
        """        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.15" />
          </filter>
        </defs>""",
        """        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.15" />
          </filter>
""" + svg_defs + "\n        </defs>"
    )

# 3. Add Noise Hotspot & Sanctuary SVG circles and Sound Ray / Shield in SVG
svg_noise_elements = """        {/* Noise Radar Layer: Calibrated Noise Hotspots & Mountain Sanctuary Zones */}
        {showNoiseRadar && (
          <g id="noise-radar-svg-layer">
            {/* Sanctuary Enclaves (Emerald Calm Zones) */}
            {CAPE_TOWN_SANCTUARIES.map((s) => {
              const sPos = getScreenPos(s.lat, s.lng);
              const metersPerPixel = (156543.03392 * Math.cos((s.lat * Math.PI) / 180)) / Math.pow(2, zoom);
              const radiusPx = Math.max(30, s.radius_m / metersPerPixel);

              return (
                <g key={`sanctuary-circle-${s.id}`}>
                  <circle
                    cx={sPos.x}
                    cy={sPos.y}
                    r={radiusPx}
                    fill="url(#sanctuary-radial)"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    opacity="0.85"
                  />
                  <circle
                    cx={sPos.x}
                    cy={sPos.y}
                    r={radiusPx * 0.45}
                    fill="rgba(16, 185, 129, 0.08)"
                    stroke="#059669"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                </g>
              );
            })}

            {/* Noise Hotspots (Red / Amber High Decibel Dispersion Corridors) */}
            {CAPE_TOWN_HOTSPOTS.map((h) => {
              const hPos = getScreenPos(h.lat, h.lng);
              const metersPerPixel = (156543.03392 * Math.cos((h.lat * Math.PI) / 180)) / Math.pow(2, zoom);
              const radiusPx = Math.max(25, h.radius_m / metersPerPixel);

              return (
                <g key={`hotspot-circle-${h.id}`}>
                  {/* Outer sound diffusion zone */}
                  <circle
                    cx={hPos.x}
                    cy={hPos.y}
                    r={radiusPx}
                    fill="url(#hotspot-radial)"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="5 3"
                    opacity="0.9"
                  />
                  {/* Mid acoustic pressure zone */}
                  <circle
                    cx={hPos.x}
                    cy={hPos.y}
                    r={radiusPx * 0.52}
                    fill="rgba(239, 68, 68, 0.16)"
                    stroke="#f97316"
                    strokeWidth="1.2"
                    strokeDasharray="3 2"
                  />
                  {/* Epicenter noise source core */}
                  <circle
                    cx={hPos.x}
                    cy={hPos.y}
                    r={12}
                    fill="#dc2626"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                </g>
              );
            })}

            {/* Selected Apartment Acoustic Ray / Shield Arc */}
            {propPos && nearestHotspot && (() => {
              const hPos = getScreenPos(nearestHotspot.lat, nearestHotspot.lng);
              return (
                <g key="selected-prop-acoustic-propagation">
                  {isPropShielded ? (
                    // In Sound Shadow: Subtle diffracted ray + Green Shield Ring
                    <g>
                      <line
                        x1={hPos.x}
                        y1={hPos.y}
                        x2={propPos.x}
                        y2={propPos.y}
                        stroke="#10b981"
                        strokeWidth="1.8"
                        strokeDasharray="4 4"
                        opacity="0.45"
                      />
                      <circle
                        cx={propPos.x}
                        cy={propPos.y}
                        r={28}
                        fill="rgba(16, 185, 129, 0.18)"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeDasharray="6 3"
                      />
                    </g>
                  ) : (
                    // Direct Line-of-sight exposure: Crimson Sound Waveguide
                    <g>
                      <line
                        x1={hPos.x}
                        y1={hPos.y}
                        x2={propPos.x}
                        y2={propPos.y}
                        stroke="#ffffff"
                        strokeWidth="5"
                        opacity="0.9"
                      />
                      <line
                        x1={hPos.x}
                        y1={hPos.y}
                        x2={propPos.x}
                        y2={propPos.y}
                        stroke="#ef4444"
                        strokeWidth="3"
                        strokeDasharray="6 4"
                      />
                      <circle
                        cx={propPos.x}
                        cy={propPos.y}
                        r={28}
                        fill="rgba(239, 68, 68, 0.2)"
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                      />
                    </g>
                  )}
                </g>
              );
            })()}
          </g>
        )}
"""

if 'id="noise-radar-svg-layer"' not in content:
    content = content.replace(
        "        {/* Proximity Anchor Radius Rings */}",
        svg_noise_elements + "\n        {/* Proximity Anchor Radius Rings */}"
    )

# 4. Add Floating Noise Badges on the map
floating_noise_badges = """      {/* Floating Noise Hotspot & Sanctuary Labels on Map */}
      {showNoiseRadar && (
        <div id="noise-radar-html-labels">
          {/* Sanctuary Labels */}
          {CAPE_TOWN_SANCTUARIES.map((s) => {
            const pos = getScreenPos(s.lat, s.lng);
            if (pos.x < -100 || pos.x > dimensions.width + 100 || pos.y < -100 || pos.y > dimensions.height + 100) return null;
            return (
              <div
                key={`label-sanctuary-${s.id}`}
                className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${pos.x}px`, top: `${pos.y - 12}px` }}
              >
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600/95 text-white font-black text-[10px] shadow-lg border border-emerald-300/60 backdrop-blur-md">
                  <ShieldCheck size={12} weight="bold" className="text-emerald-100 shrink-0" />
                  <span className="truncate max-w-[140px]">{s.name}</span>
                  <span className="bg-emerald-800/80 px-1.5 py-0.2 rounded text-[9px] text-emerald-200 font-extrabold">{s.ambient_db} dB</span>
                </div>
              </div>
            );
          })}

          {/* Hotspot Labels */}
          {CAPE_TOWN_HOTSPOTS.map((h) => {
            const pos = getScreenPos(h.lat, h.lng);
            if (pos.x < -100 || pos.x > dimensions.width + 100 || pos.y < -100 || pos.y > dimensions.height + 100) return null;
            return (
              <div
                key={`label-hotspot-${h.id}`}
                className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
              >
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600/95 text-white font-black text-[10px] shadow-lg border border-white/70 backdrop-blur-md">
                  <SpeakerHigh size={12} weight="bold" className="text-amber-200 shrink-0" />
                  <span className="truncate max-w-[130px]">{h.name}</span>
                  <span className="bg-rose-900/90 px-1.5 py-0.2 rounded text-[9px] text-amber-200 font-extrabold">{h.base_db} dB</span>
                </div>
              </div>
            );
          })}

          {/* Mid-Ray Acoustic Propagation Badge for Selected Property */}
          {propPos && nearestHotspot && (() => {
            const hPos = getScreenPos(nearestHotspot.lat, nearestHotspot.lng);
            const midX = (propPos.x + hPos.x) / 2;
            const midY = (propPos.y + hPos.y) / 2;
            if (midX < -50 || midX > dimensions.width + 50 || midY < -50 || midY > dimensions.height + 50) return null;
            return (
              <div
                key="mid-ray-acoustic-badge"
                className="absolute z-35 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${midX}px`, top: `${midY}px` }}
              >
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black shadow-lg border flex items-center gap-1.5 backdrop-blur-md ${
                  isPropShielded
                    ? 'bg-emerald-950/90 text-emerald-100 border-emerald-400/60 shadow-emerald-950/20'
                    : 'bg-rose-950/90 text-rose-100 border-rose-500/70 shadow-rose-950/20'
                }`}>
                  {isPropShielded ? (
                    <>
                      <ShieldCheck size={13} weight="bold" className="text-emerald-400 shrink-0" />
                      <span>Acoustic Shadow: -14 dB Shielded</span>
                    </>
                  ) : (
                    <>
                      <SpeakerHigh size={13} weight="bold" className="text-rose-400 shrink-0" />
                      <span>Direct Waveguide: ~{selectedProp?.acoustic_audit?.estimated_db || 73} dB</span>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
"""

if 'id="noise-radar-html-labels"' not in content:
    content = content.replace(
        "      {/* 3. Floating Commute Badges along vectors to each anchor */}",
        floating_noise_badges + "\n      {/* 3. Floating Commute Badges along vectors to each anchor */}"
    )

# 5. Add Acoustic card to top-left HUD
hud_acoustic = """
              {/* Acoustic Decibel & Orientation Rating */}
              <div className="pt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  <span>Acoustic Decibel &amp; Orientation</span>
                  <span className={isPropShielded ? 'text-emerald-600 font-extrabold' : 'text-rose-600 font-extrabold'}>
                    {selectedProp.acoustic_audit?.estimated_db || (isPropShielded ? 40 : 73)} dBA
                  </span>
                </div>
                <div className={`p-2 rounded-xl text-xs flex items-center gap-2 border ${
                  isPropShielded
                    ? 'bg-emerald-50/80 text-emerald-950 border-emerald-200/80'
                    : 'bg-rose-50/80 text-rose-950 border-rose-200/80'
                }`}>
                  {isPropShielded ? (
                    <ShieldCheck size={18} weight="bold" className="text-emerald-600 shrink-0" />
                  ) : (
                    <SpeakerHigh size={18} weight="bold" className="text-rose-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-extrabold text-[11px] truncate">
                      {selectedProp.acoustic_audit?.sound_shadow_status || (isPropShielded ? 'In Acoustic Shadow (Shielded)' : 'Direct Unbuffered Exposure')}
                    </div>
                    <div className="text-[10px] text-zinc-600 truncate mt-0.5">
                      Facing: {selectedProp.acoustic_audit?.facing_direction || (isPropShielded ? 'West / Mountain' : 'East / Malan St')}
                    </div>
                  </div>
                </div>
              </div>
"""

if 'Acoustic Decibel &amp; Orientation' not in content:
    content = content.replace(
        "              {/* Desired Locations Proximity Section */}",
        hud_acoustic + "\n              {/* Desired Locations Proximity Section */}"
    )

# 6. Add Noise Radar toggle to bottom dock
bottom_toggle = """        {/* Noise Radar Heatmap Toggle */}
        <button
          onClick={() => setShowNoiseRadar(!showNoiseRadar)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            showNoiseRadar
              ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/30'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
          title="Toggle Cape Town Noise Pollution Heatmap & Sound Shadows"
        >
          <SpeakerHigh size={14} weight="bold" className={showNoiseRadar ? 'text-white' : 'text-zinc-600'} />
          <span>Noise Radar</span>
        </button>

        <div className="w-px h-5 bg-zinc-200" />
"""

if 'title="Toggle Cape Town Noise Pollution Heatmap & Sound Shadows"' not in content:
    content = content.replace(
        "        {/* Anchors Toggle */}",
        bottom_toggle + "\n        {/* Anchors Toggle */}"
    )

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Stage 2 PropertyMap patch applied.")

