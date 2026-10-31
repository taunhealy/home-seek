import sys

path = 'web/src/components/PropertyMap.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update initial center & zoom calculation
old_center_effect = """  // Center map on initial load or properties change
  useEffect(() => {
    if (properties.length > 0) {
      const avgLat = properties.reduce((acc, p) => acc + p.lat, 0) / properties.length;
      const avgLng = properties.reduce((acc, p) => acc + p.lng, 0) / properties.length;
      setCenter({ lat: avgLat, lng: avgLng });
    }
  }, [properties]);"""

new_center_effect = """  // Center map & calculate smart initial zoom on load
  useEffect(() => {
    if (properties.length > 0) {
      const lats = properties.map(p => p.lat);
      const lngs = properties.map(p => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const avgLat = (minLat + maxLat) / 2;
      const avgLng = (minLng + maxLng) / 2;
      setCenter({ lat: avgLat, lng: avgLng });
      const span = Math.max(maxLat - minLat, maxLng - minLng);
      setZoom(span < 0.015 ? 15 : span < 0.035 ? 14 : 13);
    }
  }, [properties]);"""

if old_center_effect in content:
    content = content.replace(old_center_effect, new_center_effect)
    print("SUCCESS: Updated center effect.")

# 2. Add renderedPositions collision detection
collision_logic = """
  // Smart Anti-Collision Level-of-Detail (LOD) Engine:
  // Detects overlapping pins in screen pixel space and condenses crowded pins into sleek micro-dots
  const renderedPositions = React.useMemo(() => {
    const result: Record<string, { isCompact: boolean }> = {};
    const placed: { x: number; y: number }[] = [];

    // Sort: selected property first, then hovered, then rank #1, then rest
    const sorted = [...properties].sort((a, b) => {
      if (a.id === selectedPropertyId) return -1;
      if (b.id === selectedPropertyId) return 1;
      if (a.id === hoveredProperty?.id) return -1;
      if (b.id === hoveredProperty?.id) return 1;
      return (a.rank || 99) - (b.rank || 99);
    });

    for (const prop of sorted) {
      const pos = getScreenPos(prop.lat, prop.lng);
      const isSelected = prop.id === selectedPropertyId;
      const isHovered = prop.id === hoveredProperty?.id;

      if (isSelected || isHovered) {
        result[prop.id] = { isCompact: false };
        placed.push({ x: pos.x, y: pos.y });
        continue;
      }

      // Check collision with already-placed badges: wide pill needs ~58px X, ~26px Y
      const hasCollision = placed.some((other) => {
        const dx = Math.abs(pos.x - other.x);
        const dy = Math.abs(pos.y - other.y);
        return dx < 58 && dy < 26;
      });

      if (hasCollision) {
        result[prop.id] = { isCompact: true };
        placed.push({ x: pos.x, y: pos.y });
      } else {
        result[prop.id] = { isCompact: false };
        placed.push({ x: pos.x, y: pos.y });
      }
    }

    return result;
  }, [properties, selectedPropertyId, hoveredProperty, center, zoom, dimensions]);
"""

if "const renderedPositions = React.useMemo" not in content:
    content = content.replace(
        "  // Selected prop position\n  const propPos = selectedProp ? getScreenPos(selectedProp.lat, selectedProp.lng) : null;",
        "  // Selected prop position\n  const propPos = selectedProp ? getScreenPos(selectedProp.lat, selectedProp.lng) : null;\n" + collision_logic
    )
    print("SUCCESS: Added collision detection logic.")

# 3. Update resetView
old_reset = """  const resetView = () => {
    if (properties.length > 0) {
      const avgLat = properties.reduce((acc, p) => acc + p.lat, 0) / properties.length;
      const avgLng = properties.reduce((acc, p) => acc + p.lng, 0) / properties.length;
      setCenter({ lat: avgLat, lng: avgLng });
      setZoom(13);
    }
  };"""

new_reset = """  const resetView = () => {
    if (properties.length > 0) {
      const lats = properties.map(p => p.lat);
      const lngs = properties.map(p => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      setCenter({ lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 });
      const span = Math.max(maxLat - minLat, maxLng - minLng);
      setZoom(span < 0.015 ? 15 : span < 0.035 ? 14 : 13);
    }
  };"""

if old_reset in content:
    content = content.replace(old_reset, new_reset)
    print("SUCCESS: Updated resetView.")

# 4. Replace Noise Labels, Commute Badges, Anchor Pins, and Property Markers
# Find from "{/* Floating Noise Hotspot & Sanctuary Labels on Map */}" to ")}       </div>     )}      {/* 6. Active Property & Proximity HUD"
start_marker = "      {/* Floating Noise Hotspot & Sanctuary Labels on Map */}"
end_marker = "      {/* 6. Active Property & Proximity HUD Header (Top Left - Sleek Glassmorphic Inspector) */}"

start_pos = content.find(start_marker)
end_pos = content.find(end_marker)

if start_pos != -1 and end_pos != -1:
    clean_replacement = """      {/* Floating Noise Hotspot & Sanctuary Labels on Map (Level of Detail LOD) */}
      {showNoiseRadar && (
        <div id="noise-radar-html-labels">
          {/* Sanctuary Labels */}
          {CAPE_TOWN_SANCTUARIES.map((s) => {
            const pos = getScreenPos(s.lat, s.lng);
            if (pos.x < -100 || pos.x > dimensions.width + 100 || pos.y < -100 || pos.y > dimensions.height + 100) return null;
            return (
              <div
                key={`label-sanctuary-${s.id}`}
                className="absolute z-15 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${pos.x}px`, top: `${pos.y - 12}px` }}
              >
                {zoom >= 14 ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600/95 text-white font-black text-[10px] shadow-lg border border-emerald-300/60 backdrop-blur-md">
                    <ShieldCheck size={12} weight="bold" className="text-emerald-100 shrink-0" />
                    <span className="truncate max-w-[140px]">{s.name}</span>
                    <span className="bg-emerald-800/80 px-1.5 py-0.2 rounded text-[9px] text-emerald-200 font-extrabold">{s.ambient_db} dB</span>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-emerald-600/90 text-white shadow-md border border-white flex items-center justify-center">
                    <ShieldCheck size={11} weight="bold" />
                  </div>
                )}
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
                className="absolute z-15 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
              >
                {zoom >= 14 ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600/95 text-white font-black text-[10px] shadow-lg border border-white/70 backdrop-blur-md">
                    <SpeakerHigh size={12} weight="bold" className="text-amber-200 shrink-0" />
                    <span className="truncate max-w-[130px]">{h.name}</span>
                    <span className="bg-rose-900/90 px-1.5 py-0.2 rounded text-[9px] text-amber-200 font-extrabold">{h.base_db} dB</span>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-rose-600/90 text-white shadow-md border border-white flex items-center justify-center">
                    <SpeakerHigh size={11} weight="bold" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Mid-Ray Acoustic Propagation Badge for Selected Property (Only when space permits) */}
          {propPos && nearestHotspot && (() => {
            const hPos = getScreenPos(nearestHotspot.lat, nearestHotspot.lng);
            const screenDist = Math.hypot(propPos.x - hPos.x, propPos.y - hPos.y);
            // Hide badge if property and hotspot are less than 95px apart on screen
            if (screenDist < 95) return null;

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

      {/* 3. Single Floating Commute Badge for the Active Target Anchor */}
      {propPos && showAnchors && activeAnchor && (() => {
        const aPos = getScreenPos(activeAnchor.lat, activeAnchor.lng);
        const driveData = activeDrivingRoute;

        const distKm = driveData 
          ? driveData.distanceKm 
          : calculateDrivingDistanceKm(selectedProp.lat, selectedProp.lng, activeAnchor.lat, activeAnchor.lng);
        const durMins = driveData 
          ? driveData.durationMins 
          : calculateDrivingDurationMins(distKm);

        const distText = `${distKm} km`;
        const durText = `~${durMins} mins`;

        const dx = aPos.x - propPos.x;
        const dy = aPos.y - propPos.y;
        const totalPixels = Math.hypot(dx, dy);

        // Only render if anchor and property have sufficient breathing room
        if (totalPixels < 70) return null;

        let t = 0.24;
        const minRatio = Math.min(0.5, 48 / totalPixels);
        t = Math.max(minRatio, Math.min(0.32, 64 / totalPixels));

        let badgeX = propPos.x + dx * t;
        let badgeY = propPos.y + dy * t;

        if (activeDrivingRoute && activeDrivingRoute.points.length > 5) {
          const targetIndex = Math.min(activeDrivingRoute.points.length - 1, Math.max(1, Math.floor(activeDrivingRoute.points.length * 0.2)));
          const roadPoint = activeDrivingRoute.points[targetIndex];
          const roadScreen = getScreenPos(roadPoint[0], roadPoint[1]);
          badgeX = roadScreen.x;
          badgeY = roadScreen.y;
        }

        const isWalking = distKm <= 1.2 || activeAnchor.commute_mode === 'walking';
        const isBiking = activeAnchor.commute_mode === 'bicycling';

        return (
          <div
            key={`badge-active-${activeAnchor.id}`}
            className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${badgeX}px`, top: `${badgeY}px` }}
          >
            <div className="px-3 py-1 rounded-full shadow-lg border-2 flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap backdrop-blur-md bg-indigo-600 text-white border-white ring-4 ring-indigo-500/25 shadow-indigo-950/20">
              {isWalking ? (
                <PersonSimpleWalk size={13} weight="bold" className="text-amber-300" />
              ) : isBiking ? (
                <Bicycle size={13} weight="bold" className="text-amber-300" />
              ) : (
                <Car size={13} weight="fill" className="text-amber-300" />
              )}
              <span className="font-extrabold">{durText}</span>
              <span className="text-indigo-200 font-bold">·</span>
              <span className="text-indigo-100 font-semibold">{distText} drive</span>
            </div>
          </div>
        );
      })()}

      {/* 4. Proximity Anchor Markers Layer (Clean LOD: active expanded, inactive compact) */}
      {showAnchors &&
        anchors.map((anchor) => {
          const pos = getScreenPos(anchor.lat, anchor.lng);
          const isSelected = activeAnchor?.id === anchor.id;

          if (pos.x < -100 || pos.x > dimensions.width + 100 || pos.y < -100 || pos.y > dimensions.height + 100) {
            return null;
          }

          return (
            <div
              key={anchor.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all ${
                isSelected ? 'z-35' : 'z-20'
              }`}
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
              onClick={(e) => {
                e.stopPropagation();
                if (hasDraggedRef.current) return;
                if (onSelectAnchor) onSelectAnchor(anchor);
              }}
              title={anchor.label}
            >
              <div className="relative group flex flex-col items-center">
                {isSelected ? (
                  <>
                    <span className="absolute -inset-2 rounded-full bg-emerald-400/30 animate-ping pointer-events-none" />
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg bg-zinc-950 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-white shadow-emerald-950/20">
                      <Target size={14} weight="bold" className="text-emerald-400 animate-pulse" />
                      <span className="truncate max-w-[140px] tracking-tight">{anchor.label}</span>
                    </div>
                    <div className="w-2 h-2 rotate-45 -mt-1 shadow-2xs bg-zinc-950" />
                  </>
                ) : (
                  <div className="relative group/anchor">
                    <div className="w-7 h-7 rounded-full bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-300 hover:border-zinc-900 shadow-md flex items-center justify-center hover:scale-110 transition-all">
                      <Target size={14} weight="bold" className="text-zinc-700" />
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/anchor:opacity-100 pointer-events-none shadow-lg transition-opacity z-50">
                      {anchor.label}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

      {/* 5. Property Markers Layer (Airbnb-Grade Dynamic Anti-Collision Pins) */}
      {properties.map((property) => {
        const pos = getScreenPos(property.lat, property.lng);
        const isSelected = (selectedPropertyId ? selectedPropertyId === property.id : selectedProp?.id === property.id);
        const isHovered = hoveredProperty?.id === property.id;
        const isTopMatch = property.rank === 1;
        const isNoiseWarning = property.noise_risk === 'high' || (property.fit_score && property.fit_score < 50);
        const isCompact = !isSelected && !isHovered && renderedPositions[property.id]?.isCompact;

        if (pos.x < -80 || pos.x > dimensions.width + 80 || pos.y < -80 || pos.y > dimensions.height + 80) {
          return null;
        }

        return (
          <div
            key={property.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-150 ${
              isSelected ? 'z-45 scale-110' : isHovered ? 'z-40 scale-105' : isCompact ? 'z-20' : 'z-25'
            }`}
            style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            onClick={(e) => {
              e.stopPropagation();
              if (hasDraggedRef.current) return;
              onSelectProperty(property);
            }}
            onMouseEnter={() => setHoveredProperty(property)}
            onMouseLeave={() => setHoveredProperty(null)}
          >
            <div className="relative group">
              {/* Selected radar glow */}
              {isSelected && (
                <span className="absolute -inset-1.5 rounded-full bg-emerald-400/30 animate-ping pointer-events-none" />
              )}

              {/* Compact Round Pin vs Full Luxury Price Badge */}
              {isCompact ? (
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-md border-2 transition-transform group-hover:scale-125 ${
                    isTopMatch
                      ? 'bg-amber-400 text-zinc-950 border-white ring-1 ring-amber-400/50'
                      : 'bg-zinc-900 text-white border-white hover:bg-zinc-800'
                  }`}
                  title={`#${property.rank} - ${formatPricePill(property.price, property.currency)}`}
                >
                  {property.rank || ''}
                </div>
              ) : (
                <div>
                  <div
                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-md whitespace-nowrap ${
                      isSelected
                        ? 'bg-zinc-950 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-white shadow-xl'
                        : 'bg-white text-zinc-900 border border-zinc-200/90 hover:border-zinc-950 hover:bg-zinc-50 hover:shadow-lg'
                    }`}
                  >
                    {property.rank && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${
                        isSelected 
                          ? 'bg-emerald-400 text-zinc-950' 
                          : isTopMatch 
                            ? 'bg-amber-400 text-zinc-950' 
                            : 'bg-zinc-100 text-zinc-800'
                      }`}>
                        {isTopMatch && <Sparkle size={9} weight="fill" />}
                        #{property.rank}
                      </span>
                    )}

                    {isNoiseWarning && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Acoustic Noise Risk Flagged" />
                    )}

                    <span className={isSelected ? 'font-black' : 'font-extrabold'}>
                      {formatPricePill(property.price, property.currency)}
                    </span>
                  </div>

                  <div
                    className={`w-2 h-2 rotate-45 -mt-1 mx-auto shadow-2xs transition-colors ${
                      isSelected 
                        ? 'bg-zinc-950 ring-1 ring-emerald-400/50' 
                        : 'bg-white border-r border-b border-zinc-300 group-hover:bg-zinc-50'
                    }`}
                  />
                </div>
              )}

              {/* Hover Mini-Card Tooltip (Floating Micro-Dossier) */}
              {isHovered && !isSelected && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-zinc-200 p-2.5 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  <div className="relative w-full h-28 rounded-xl overflow-hidden mb-2 bg-zinc-100">
                    <img
                      src={property.image}
                      alt={property.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      {property.rank && (
                        <span className="bg-zinc-950/90 text-white text-[10px] font-black px-2 py-0.5 rounded-full backdrop-blur-xs">
                          #{property.rank}
                        </span>
                      )}
                      {property.fit_score && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full backdrop-blur-xs ${
                          property.fit_score >= 75 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {property.fit_score}% Fit
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-2 right-2 bg-zinc-950/80 backdrop-blur-md text-white font-extrabold text-xs px-2.5 py-0.5 rounded-lg shadow-sm">
                      {formatPricePill(property.price, property.currency)}
                    </div>
                  </div>

                  <p className="text-xs font-bold text-zinc-950 truncate">{property.title}</p>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5">{property.address}</p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 text-[11px] font-semibold text-zinc-700">
                    <span>{property.bedrooms} bed • {property.bathrooms} bath</span>
                    {property.sqm ? <span>{property.sqm} m²</span> : <span>Verified Unit</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
"""
    content = content[:start_pos] + clean_replacement + "\n\n" + content[end_pos:]
    print("SUCCESS: Replaced markers and labels with clean anti-collision implementation.")
else:
    print(f"FAILED to find markers: start_pos={start_pos}, end_pos={end_pos}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

