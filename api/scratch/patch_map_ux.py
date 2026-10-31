with open('web/src/components/PropertyMap.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace PropertyMapItem interface to optionally include noise_risk
old_interface = '''export interface PropertyMapItem {
  id: string;
  title: string;
  address: string;
  price: number;
  currency?: string;
  bedrooms: number;
  bathrooms: number;
  sqm?: number;
  image: string;
  lat: number;
  lng: number;
  source_platform?: string;
  is_favorite?: boolean;
  rank?: number;
  fit_score?: number;
  location_proximity?: any[];
}'''

new_interface = '''export interface PropertyMapItem {
  id: string;
  title: string;
  address: string;
  price: number;
  currency?: string;
  bedrooms: number;
  bathrooms: number;
  sqm?: number;
  image: string;
  lat: number;
  lng: number;
  source_platform?: string;
  is_favorite?: boolean;
  rank?: number;
  fit_score?: number;
  noise_risk?: string;
  noise_reason?: string | null;
  location_proximity?: any[];
}'''

assert old_interface in text, "old_interface not found"
text = text.replace(old_interface, new_interface)

# Double click zoom handler addition
old_wheel = '''  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 1, 18));
    } else {
      setZoom((z) => Math.max(z - 1, 9));
    }
  };'''

new_wheel = '''  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 1, 18));
    } else {
      setZoom((z) => Math.max(z - 1, 9));
    }
  };

  // Double click to zoom into point
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const centerP = project(center.lat, center.lng, zoom);
    const targetPx = centerP.x + (clickX - dimensions.width / 2);
    const targetPy = centerP.y + (clickY - dimensions.height / 2);

    const n = Math.pow(2, zoom);
    const targetLng = (targetPx / 256 / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * targetPy) / 256 / n)));
    const targetLat = (latRad * 180) / Math.PI;

    setCenter({ lat: targetLat, lng: targetLng });
    setZoom((z) => Math.min(z + 1, 18));
  };'''

assert old_wheel in text, "old_wheel not found"
text = text.replace(old_wheel, new_wheel)

# Update container attributes to include onDoubleClick
old_container_div = '''    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-[#f1f2f4] border border-zinc-200 cursor-grab active:cursor-grabbing ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
    >'''

new_container_div = '''    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-[#f1f2f4] border border-zinc-200 cursor-grab active:cursor-grabbing ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >'''

assert old_container_div in text, "old_container_div not found"
text = text.replace(old_container_div, new_container_div)

# Replace the Entire Markers & HUD & Controls rendering section (from anchor markers to bottom controls)
marker_start = '{/* 4. Proximity Anchor Markers Layer */}'
marker_end = '{mapStyle === \'osm\' ? \'© OpenStreetMap\' : \'© Esri Canvas\'}\n        </div>\n      </div>'

old_section = text[text.find(marker_start):text.find(marker_end) + len(marker_end)]

new_section = '''{/* 4. Proximity Anchor Markers Layer */}
      {showAnchors &&
        anchors.map((anchor) => {
          const pos = getScreenPos(anchor.lat, anchor.lng);
          const isSelected = activeAnchor?.id === anchor.id;

          // Don't render if outside viewport
          if (pos.x < -100 || pos.x > dimensions.width + 100 || pos.y < -100 || pos.y > dimensions.height + 100) {
            return null;
          }

          return (
            <div
              key={anchor.id}
              className="absolute z-25 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
              onClick={(e) => {
                e.stopPropagation();
                if (hasDraggedRef.current) return;
                if (onSelectAnchor) onSelectAnchor(anchor);
              }}
            >
              <div className="relative group flex flex-col items-center">
                {/* Radar ping ring for selected anchor */}
                {isSelected && (
                  <span className="absolute -inset-2 rounded-full bg-emerald-400/30 animate-ping pointer-events-none" />
                )}

                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg transition-transform duration-150 group-hover:scale-105 ${
                    isSelected
                      ? 'bg-zinc-950 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-white shadow-emerald-950/20'
                      : 'bg-white text-zinc-900 border border-zinc-300 hover:border-zinc-950 shadow-md'
                  }`}
                >
                  <Target size={14} weight="bold" className={isSelected ? 'text-emerald-400 animate-pulse' : 'text-zinc-900'} />
                  <span className="truncate max-w-[140px] tracking-tight">{anchor.label}</span>
                </div>

                {/* Needle pointer */}
                <div className={`w-2 h-2 rotate-45 -mt-1 shadow-2xs ${
                  isSelected ? 'bg-zinc-950' : 'bg-white border-r border-b border-zinc-300'
                }`} />
              </div>
            </div>
          );
        })}

      {/* 5. Property Markers Layer (Airbnb-Grade Luxury Pins) */}
      {properties.map((property) => {
        const pos = getScreenPos(property.lat, property.lng);
        const isSelected = (selectedPropertyId ? selectedPropertyId === property.id : selectedProp?.id === property.id);
        const isHovered = hoveredProperty?.id === property.id;
        const isTopMatch = property.rank === 1;
        const isNoiseWarning = property.noise_risk === 'high' || (property.fit_score && property.fit_score < 50);

        // Don't render if far off-screen
        if (pos.x < -80 || pos.x > dimensions.width + 80 || pos.y < -80 || pos.y > dimensions.height + 80) {
          return null;
        }

        return (
          <div
            key={property.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer ${
              isSelected ? 'z-40' : isHovered ? 'z-35' : 'z-20'
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
            <div className={`relative group transition-transform duration-150 ${
              isSelected ? 'scale-110' : isHovered ? 'scale-105' : 'scale-100'
            }`}>
              
              {/* Selected radar glow */}
              {isSelected && (
                <span className="absolute -inset-1 rounded-full bg-emerald-400/25 animate-ping pointer-events-none" />
              )}

              {/* Marker Pill with Rank, Badge and Price */}
              <div
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-md whitespace-nowrap ${
                  isSelected
                    ? 'bg-zinc-950 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-white shadow-xl'
                    : 'bg-white text-zinc-900 border border-zinc-200/90 hover:border-zinc-950 hover:bg-zinc-50 hover:shadow-lg'
                }`}
              >
                {/* Rank Pill or Star */}
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

                {/* Noise Risk Icon Flag */}
                {isNoiseWarning && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Acoustic Noise Risk Flagged" />
                )}

                <span className={isSelected ? 'font-black' : 'font-extrabold'}>
                  {formatPricePill(property.price, property.currency)}
                </span>
              </div>

              {/* Needle Tip Pointing to Exact Geographic Coordinate */}
              <div
                className={`w-2 h-2 rotate-45 -mt-1 mx-auto shadow-2xs transition-colors ${
                  isSelected 
                    ? 'bg-zinc-950 ring-1 ring-emerald-400/50' 
                    : 'bg-white border-r border-b border-zinc-300 group-hover:bg-zinc-50'
                }`}
              />

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

      {/* 6. Active Property & Proximity HUD Header (Top Left - Sleek Glassmorphic Inspector) */}
      {selectedProp && (
        <div className="absolute top-4 left-4 z-40 bg-white/95 backdrop-blur-xl border border-zinc-200/90 rounded-2xl shadow-xl text-xs max-w-sm pointer-events-auto transition-all duration-200">
          {/* Collapsed Pill State */}
          {isHudCollapsed ? (
            <div 
              onClick={() => setIsHudCollapsed(false)}
              className="px-3.5 py-2 flex items-center gap-2 cursor-pointer hover:bg-zinc-50/80 rounded-2xl transition-colors"
            >
              <img 
                src={selectedProp.image} 
                alt="" 
                className="w-6 h-6 rounded-lg object-cover border border-zinc-200 shrink-0" 
              />
              <span className="font-extrabold text-zinc-950 truncate max-w-[150px]">
                #{selectedProp.rank} {selectedProp.title}
              </span>
              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px] shrink-0">
                {formatPricePill(selectedProp.price, selectedProp.currency)}
              </span>
              <CaretDown size={14} weight="bold" className="text-zinc-500 shrink-0" />
            </div>
          ) : (
            /* Expanded Full Inspector State */
            <div className="p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <img 
                    src={selectedProp.image} 
                    alt={selectedProp.title} 
                    className="w-12 h-12 rounded-xl object-cover border border-zinc-200 shrink-0 shadow-2xs" 
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="bg-zinc-950 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                        #{selectedProp.rank}
                      </span>
                      <span className="font-extrabold text-zinc-950 text-xs truncate max-w-[140px]">
                        {selectedProp.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate max-w-[160px] mt-0.5">{selectedProp.address}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-black text-indigo-700 text-xs">
                        {formatPricePill(selectedProp.price, selectedProp.currency)}
                        <span className="text-[10px] font-normal text-zinc-500"> /mo</span>
                      </span>
                      {selectedProp.fit_score && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                          selectedProp.fit_score >= 70 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {selectedProp.fit_score}% Fit
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsHudCollapsed(true)}
                  className="p-1 text-zinc-400 hover:text-zinc-800 transition-colors rounded-lg hover:bg-zinc-100 cursor-pointer shrink-0"
                  title="Collapse Inspector"
                  aria-label="Collapse Inspector"
                >
                  <CaretUp size={15} weight="bold" />
                </button>
              </div>

              {/* Desired Locations Proximity Section */}
              {anchors.length > 0 && (
                <div className="space-y-1.5 pt-2.5 border-t border-zinc-100">
                  <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    <span>Commute & Proximity</span>
                    <span className="text-zinc-400 font-normal">Click to focus</span>
                  </div>

                  {anchors.map((a) => {
                    const prox = selectedProp.location_proximity?.find(
                      (p: any) => 
                        (p.label && a.label && p.label.toLowerCase() === a.label.toLowerCase()) ||
                        (p.target_place && a.target_place && p.target_place.toLowerCase().includes(a.target_place.toLowerCase()))
                    );
                    const distKm = prox?.distance_km ?? calculateDistanceKm(selectedProp.lat, selectedProp.lng, a.lat, a.lng);
                    const dist = prox?.distance_text ?? `${distKm} km`;
                    const dur = prox?.duration_text ?? `~${Math.max(3, Math.round(distKm * 1.6 + 4))} mins`;
                    const isSelectedAnchor = activeAnchor?.id === a.id;

                    return (
                      <div 
                        key={a.id} 
                        onClick={() => onSelectAnchor && onSelectAnchor(a)}
                        className={`flex items-center justify-between text-[11px] font-medium px-2.5 py-1.5 rounded-xl cursor-pointer transition-all ${
                          isSelectedAnchor 
                            ? 'bg-zinc-950 text-white shadow-sm' 
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200/60'
                        }`}
                      >
                        <span className="truncate max-w-[130px] font-semibold flex items-center gap-1.5">
                          <Target size={12} className={isSelectedAnchor ? 'text-emerald-400' : 'text-zinc-500'} /> 
                          {a.label}
                        </span>
                        <span className={`font-black shrink-0 ${isSelectedAnchor ? 'text-emerald-400' : 'text-indigo-600'}`}>
                          {dur} • {dist}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Jump to listing card button */}
              <button
                onClick={() => {
                  const el = document.getElementById(`listing-card-${selectedProp.id}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="w-full py-1.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200/90 text-zinc-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Scroll to Full Dossier</span>
                <NavigationArrow size={12} weight="bold" className="text-zinc-600" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Map Zoom & Action Controls (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-40 flex flex-col gap-2 pointer-events-auto items-end">
        <div className="bg-white/95 backdrop-blur-md border border-zinc-200/90 rounded-2xl shadow-xl overflow-hidden flex flex-col p-0.5">
          <button
            onClick={() => setZoom((z) => Math.min(z + 1, 18))}
            className="p-2.5 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 rounded-xl transition-colors cursor-pointer"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <Plus size={15} weight="bold" />
          </button>
          <div className="h-px bg-zinc-100 mx-2" />
          <button
            onClick={() => setZoom((z) => Math.max(z - 1, 9))}
            className="p-2.5 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 rounded-xl transition-colors cursor-pointer"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <Minus size={15} weight="bold" />
          </button>
          <div className="h-px bg-zinc-100 mx-2" />
          <button
            onClick={resetView}
            className="p-2.5 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 rounded-xl transition-colors cursor-pointer"
            title="Fit All Properties"
            aria-label="Fit All Properties"
          >
            <ArrowsOutCardinal size={15} weight="bold" />
          </button>
        </div>

        {/* Free Map Attribution */}
        <div className="px-2.5 py-1 rounded-lg bg-white/85 backdrop-blur-md text-[10px] font-medium text-zinc-500 border border-zinc-200/70 shadow-2xs">
          {mapStyle === 'osm' ? '© OpenStreetMap' : '© Esri Canvas'}
        </div>
      </div>'''

assert old_section, "old_section could not be identified"
text = text.replace(old_section, new_section)

# Also polish the Bottom Left toolbar
old_bottom_left = '''      {/* Layer Toggles & Free Basemap Switcher (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-40 flex flex-wrap items-center gap-2 pointer-events-auto">
        {/* Basemap Switcher: Clean Canvas vs Street Map */}
        <button
          onClick={() => setMapStyle(mapStyle === 'canvas' ? 'osm' : 'canvas')}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm border bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-50 transition-all flex items-center gap-1.5 cursor-pointer"
          title={`Switch to ${mapStyle === 'canvas' ? 'OpenStreetMap (Street View)' : 'Clean Gray Canvas'}`}
        >
          <MapTrifold size={14} weight="bold" className="text-zinc-700" />
          <span>{mapStyle === 'canvas' ? 'Clean Canvas' : 'OpenStreetMap'}</span>
        </button>

        {/* Anchors Toggle */}
        <button
          onClick={() => setShowAnchors(!showAnchors)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm border transition-all flex items-center gap-1.5 cursor-pointer ${
            showAnchors
              ? 'bg-zinc-950 text-white border-zinc-950'
              : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
          }`}
        >
          <Target size={14} weight="bold" />
          <span>Anchors ({anchors.length})</span>
        </button>

        {/* Radius Toggle */}
        {showAnchors && (
          <button
            onClick={() => setShowRadius(!showRadius)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm border transition-all cursor-pointer ${
              showRadius
                ? 'bg-zinc-950 text-white border-zinc-950'
                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            5km Radius
          </button>
        )}
      </div>'''

new_bottom_left = '''      {/* Layer Toggles & Free Basemap Switcher (Bottom Left - Frosted Capsule Toolbar) */}
      <div className="absolute bottom-6 left-6 z-40 flex items-center p-1 rounded-2xl bg-white/95 backdrop-blur-xl border border-zinc-200/90 shadow-xl pointer-events-auto gap-1">
        {/* Basemap Switcher: Clean Canvas vs Street Map */}
        <button
          onClick={() => setMapStyle(mapStyle === 'canvas' ? 'osm' : 'canvas')}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-800 hover:bg-zinc-100 transition-all flex items-center gap-1.5 cursor-pointer"
          title={`Switch to ${mapStyle === 'canvas' ? 'OpenStreetMap (Detailed)' : 'Minimalist Canvas'}`}
        >
          <MapTrifold size={14} weight="bold" className="text-zinc-700" />
          <span>{mapStyle === 'canvas' ? 'Clean Canvas' : 'Street Map'}</span>
        </button>

        <div className="w-px h-5 bg-zinc-200" />

        {/* Anchors Toggle */}
        <button
          onClick={() => setShowAnchors(!showAnchors)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            showAnchors
              ? 'bg-zinc-950 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <Target size={14} weight="bold" className={showAnchors ? 'text-emerald-400' : 'text-zinc-500'} />
          <span>Anchors</span>
        </button>

        {/* Radius Toggle */}
        {showAnchors && (
          <button
            onClick={() => setShowRadius(!showRadius)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              showRadius
                ? 'bg-zinc-950 text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            5km Ring
          </button>
        )}
      </div>'''

assert old_bottom_left in text, "old_bottom_left not found in PropertyMap.tsx"
text = text.replace(old_bottom_left, new_bottom_left)

with open('web/src/components/PropertyMap.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: PropertyMap.tsx UI/UX design overhaul applied!")

