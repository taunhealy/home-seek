'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Minus, 
  Compass, 
  MapPin, 
  NavigationArrow, 
  Car, 
  Bicycle, 
  PersonSimpleWalk, 
  House, 
  Target,
  Sparkle,
  ArrowsOutCardinal
} from '@phosphor-icons/react';

export interface PropertyMapItem {
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
}

export interface ProximityAnchor {
  id: string;
  label: string;
  target_place: string;
  lat: number;
  lng: number;
  max_commute_mins?: number;
  max_distance_km?: number;
  commute_mode?: 'driving' | 'transit' | 'walking' | 'bicycling';
}

interface PropertyMapProps {
  properties: PropertyMapItem[];
  anchors: ProximityAnchor[];
  selectedPropertyId?: string | null;
  selectedAnchorId?: string | null;
  onSelectProperty: (property: PropertyMapItem) => void;
  onSelectAnchor?: (anchor: ProximityAnchor) => void;
  className?: string;
}

// Convert lat/lng to Web Mercator pixel coordinates
function project(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = n * ((lng + 180) / 360);
  const latRad = (lat * Math.PI) / 180;
  const y = (n * (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI)) / 2;
  return { x: x * 256, y: y * 256 };
}

// Haversine formula for distance in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export const PropertyMap: React.FC<PropertyMapProps> = ({
  properties,
  anchors,
  selectedPropertyId,
  selectedAnchorId,
  onSelectProperty,
  onSelectAnchor,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const [zoom, setZoom] = useState(13);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: -33.935,
    lng: 18.42,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredProperty, setHoveredProperty] = useState<PropertyMapItem | null>(null);
  const [showAnchors, setShowAnchors] = useState(true);
  const [showRadius, setShowRadius] = useState(true);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 600,
          height: containerRef.current.clientHeight || 600,
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Center map on initial load or properties change
  useEffect(() => {
    if (properties.length > 0) {
      const avgLat = properties.reduce((acc, p) => acc + p.lat, 0) / properties.length;
      const avgLng = properties.reduce((acc, p) => acc + p.lng, 0) / properties.length;
      setCenter({ lat: avgLat, lng: avgLng });
    }
  }, [properties]);

  // Center map when a property is selected
  useEffect(() => {
    if (selectedPropertyId) {
      const p = properties.find((item) => item.id === selectedPropertyId);
      if (p) {
        setCenter({ lat: p.lat, lng: p.lng });
      }
    }
  }, [selectedPropertyId, properties]);

  // Pan / Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setDragStart({ x: e.clientX, y: e.clientY });

    // Convert pixel delta to lat/lng delta at current zoom
    const centerP = project(center.lat, center.lng, zoom);
    const newCenterP = { x: centerP.x - dx, y: centerP.y - dy };

    // Reverse projection
    const n = Math.pow(2, zoom);
    const newLng = (newCenterP.x / 256 / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * newCenterP.y) / 256 / n)));
    const newLat = (latRad * 180) / Math.PI;

    setCenter({ lat: newLat, lng: newLng });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 1, 18));
    } else {
      setZoom((z) => Math.max(z - 1, 9));
    }
  };

  // Convert lat/lng to screen pixel position
  const getScreenPos = useCallback(
    (lat: number, lng: number) => {
      const centerP = project(center.lat, center.lng, zoom);
      const markerP = project(lat, lng, zoom);
      return {
        x: dimensions.width / 2 + (markerP.x - centerP.x),
        y: dimensions.height / 2 + (markerP.y - centerP.y),
      };
    },
    [center, zoom, dimensions]
  );

  // Calculate visible tiles for CartoDB Positron (clean monochrome light tiles)
  const centerP = project(center.lat, center.lng, zoom);
  const startTileX = Math.floor((centerP.x - dimensions.width / 2) / 256);
  const endTileX = Math.floor((centerP.x + dimensions.width / 2) / 256);
  const startTileY = Math.floor((centerP.y - dimensions.height / 2) / 256);
  const endTileY = Math.floor((centerP.y + dimensions.height / 2) / 256);

  const tiles = [];
  const maxTile = Math.pow(2, zoom);
  for (let x = startTileX; x <= endTileX; x++) {
    for (let y = startTileY; y <= endTileY; y++) {
      if (y >= 0 && y < maxTile) {
        const wrappedX = ((x % maxTile) + maxTile) % maxTile;
        const left = x * 256 - (centerP.x - dimensions.width / 2);
        const top = y * 256 - (centerP.y - dimensions.height / 2);
        const sub = ['a', 'b', 'c', 'd'][Math.abs(x + y) % 4];
        tiles.push({
          key: `${zoom}-${x}-${y}`,
          url: `https://${sub}.basemaps.cartocdn.com/light_all/${zoom}/${wrappedX}/${y}.png`,
          left,
          top,
        });
      }
    }
  }

  // Selected property & active proximity anchor
  const selectedProp = properties.find((p) => p.id === selectedPropertyId);
  const activeAnchor =
    anchors.find((a) => a.id === selectedAnchorId) || anchors[0] || null;

  // Selected prop position & anchor position
  const propPos = selectedProp ? getScreenPos(selectedProp.lat, selectedProp.lng) : null;
  const anchorPos = activeAnchor ? getScreenPos(activeAnchor.lat, activeAnchor.lng) : null;

  // Commute distance & driving estimate
  const commuteDistKm =
    selectedProp && activeAnchor
      ? calculateDistanceKm(selectedProp.lat, selectedProp.lng, activeAnchor.lat, activeAnchor.lng)
      : null;
  const estimatedDrivingMins = commuteDistKm ? Math.max(3, Math.round(commuteDistKm * 1.6 + 4)) : null;

  const resetView = () => {
    if (properties.length > 0) {
      const avgLat = properties.reduce((acc, p) => acc + p.lat, 0) / properties.length;
      const avgLng = properties.reduce((acc, p) => acc + p.lng, 0) / properties.length;
      setCenter({ lat: avgLat, lng: avgLng });
      setZoom(13);
    }
  };

  const formatPricePill = (price: number, currency?: string) => {
    if (currency === 'AUD' || price > 100000) {
      if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
      if (price >= 1000) return `$${Math.round(price / 1000)}k`;
      return `$${price}`;
    }
    // Rental ZAR
    if (price >= 1000) return `R ${(price / 1000).toFixed(price % 1000 === 0 ? 0 : 1)}k`;
    return `R ${price}`;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-[#f8f9fa] border-l border-zinc-200 cursor-grab active:cursor-grabbing ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 1. Map Tiles Layer */}
      <div className="absolute inset-0 pointer-events-none">
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute select-none pointer-events-none"
            style={{
              left: `${tile.left}px`,
              top: `${tile.top}px`,
              width: '256px',
              height: '256px',
            }}
          />
        ))}
      </div>

      {/* 2. SVG Vector Layer (Commute lines, Anchor radius circles) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Proximity Anchor Radius Rings */}
        {showAnchors &&
          showRadius &&
          anchors.map((anchor) => {
            const pos = getScreenPos(anchor.lat, anchor.lng);
            // Rough pixel radius for 5km at current zoom:
            const metersPerPixel = (156543.03392 * Math.cos((anchor.lat * Math.PI) / 180)) / Math.pow(2, zoom);
            const radius5kmPixels = (5000 / metersPerPixel);
            const isTarget = activeAnchor?.id === anchor.id;

            return (
              <g key={`radius-${anchor.id}`}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={Math.max(15, radius5kmPixels)}
                  fill={isTarget ? 'rgba(0, 0, 0, 0.03)' : 'rgba(0, 0, 0, 0.015)'}
                  stroke={isTarget ? '#18181b' : '#a1a1aa'}
                  strokeWidth={isTarget ? '1.5' : '1'}
                  strokeDasharray={isTarget ? '4 3' : '3 3'}
                />
              </g>
            );
          })}

        {/* Selected Property Proximity Line to Active Anchor */}
        {propPos && anchorPos && showAnchors && (
          <g>
            {/* Soft highlight backing line */}
            <line
              x1={propPos.x}
              y1={propPos.y}
              x2={anchorPos.x}
              y2={anchorPos.y}
              stroke="#ffffff"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Primary connection line */}
            <line
              x1={propPos.x}
              y1={propPos.y}
              x2={anchorPos.x}
              y2={anchorPos.y}
              stroke="#09090b"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>

      {/* 3. Floating Commute Badge between Selected Property and Anchor */}
      {propPos && anchorPos && showAnchors && commuteDistKm !== null && (
        <div
          className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${(propPos.x + anchorPos.x) / 2}px`,
            top: `${(propPos.y + anchorPos.y) / 2}px`,
          }}
        >
          <div className="bg-zinc-950 text-white px-3 py-1.5 rounded-full shadow-lg border border-zinc-800 flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap animate-in fade-in duration-200">
            <Car size={14} weight="bold" className="text-zinc-300" />
            <span>~{estimatedDrivingMins} mins</span>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-300">{commuteDistKm} km</span>
          </div>
        </div>
      )}

      {/* 4. Proximity Anchor Markers Layer */}
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
              className="absolute z-25 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110"
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectAnchor) onSelectAnchor(anchor);
              }}
            >
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md transition-all ${
                    isSelected
                      ? 'bg-zinc-950 text-white ring-2 ring-zinc-400'
                      : 'bg-white text-zinc-900 border border-zinc-300 hover:border-zinc-900'
                  }`}
                >
                  <Target size={13} weight="bold" className={isSelected ? 'text-zinc-200' : 'text-zinc-900'} />
                  <span className="truncate max-w-[130px]">{anchor.label}</span>
                </div>
                <div className={`w-2 h-2 rounded-full mt-0.5 ${isSelected ? 'bg-zinc-950' : 'bg-zinc-600'}`} />
              </div>
            </div>
          );
        })}

      {/* 5. Property Markers Layer */}
      {properties.map((property) => {
        const pos = getScreenPos(property.lat, property.lng);
        const isSelected = selectedPropertyId === property.id;
        const isHovered = hoveredProperty?.id === property.id;

        // Don't render if far off-screen
        if (pos.x < -80 || pos.x > dimensions.width + 80 || pos.y < -80 || pos.y > dimensions.height + 80) {
          return null;
        }

        return (
          <div
            key={property.id}
            className={`absolute z-30 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all ${
              isSelected ? 'z-40 scale-110' : isHovered ? 'z-35 scale-105' : ''
            }`}
            style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectProperty(property);
            }}
            onMouseEnter={() => setHoveredProperty(property)}
            onMouseLeave={() => setHoveredProperty(null)}
          >
            <div className="relative group">
              {/* Marker Pill */}
              <div
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 shadow-md whitespace-nowrap ${
                  isSelected
                    ? 'bg-zinc-950 text-white ring-2 ring-black shadow-lg scale-105'
                    : 'bg-white text-zinc-900 border border-zinc-300 hover:border-zinc-950 hover:bg-zinc-50'
                }`}
              >
                <span>{formatPricePill(property.price, property.currency)}</span>
              </div>

              {/* Pin indicator tip */}
              <div
                className={`w-1.5 h-1.5 mx-auto rounded-full mt-0.5 transition-colors ${
                  isSelected ? 'bg-zinc-950' : 'bg-zinc-400 group-hover:bg-zinc-950'
                }`}
              />

              {/* Hover Mini-Card Tooltip */}
              {isHovered && !isSelected && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-52 bg-white rounded-xl shadow-xl border border-zinc-200 p-2 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  <img
                    src={property.image}
                    alt={property.title}
                    className="w-full h-24 object-cover rounded-lg mb-1.5"
                  />
                  <p className="text-xs font-bold text-zinc-950 truncate">{property.title}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{property.address}</p>
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-zinc-100 text-[11px] font-semibold text-zinc-700">
                    <span>{formatPricePill(property.price, property.currency)}</span>
                    <span>{property.bedrooms} bed · {property.bathrooms} bath</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 6. Map UI Controls (Top Left & Top Right) */}
      <div className="absolute top-4 left-4 z-40 flex flex-col gap-2 pointer-events-auto">
        {/* Proximity Anchor Quick Legend */}
        {activeAnchor && (
          <div className="bg-white/95 backdrop-blur-md border border-zinc-200/90 rounded-2xl p-2.5 shadow-sm text-xs max-w-xs">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Active Proximity Anchor</span>
              <span className="w-2 h-2 rounded-full bg-zinc-900 animate-pulse" />
            </div>
            <p className="font-bold text-zinc-950 truncate flex items-center gap-1.5">
              <Target size={14} weight="bold" className="text-zinc-900 shrink-0" />
              {activeAnchor.label}
            </p>
            {selectedProp && commuteDistKm !== null && (
              <p className="text-[11px] text-zinc-600 mt-1 flex items-center gap-1">
                <Car size={13} className="text-zinc-500" />
                <span>{commuteDistKm} km ({estimatedDrivingMins} mins commute)</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Map Zoom & Action Controls (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-40 flex flex-col gap-2">
        <div className="bg-white border border-zinc-200 rounded-xl shadow-md overflow-hidden flex flex-col">
          <button
            onClick={() => setZoom((z) => Math.min(z + 1, 18))}
            className="p-2.5 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 border-b border-zinc-200 transition-colors"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <Plus size={16} weight="bold" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 1, 9))}
            className="p-2.5 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 transition-colors"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <Minus size={16} weight="bold" />
          </button>
        </div>

        <button
          onClick={resetView}
          className="bg-white border border-zinc-200 p-2.5 rounded-xl shadow-md text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
          title="Fit Properties"
          aria-label="Fit Properties"
        >
          <ArrowsOutCardinal size={16} weight="bold" />
        </button>
      </div>

      {/* Layer Toggles (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-40 flex items-center gap-2">
        <button
          onClick={() => setShowAnchors(!showAnchors)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm border transition-all flex items-center gap-1.5 ${
            showAnchors
              ? 'bg-zinc-950 text-white border-zinc-950'
              : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
          }`}
        >
          <Target size={14} weight="bold" />
          <span>Anchors ({anchors.length})</span>
        </button>

        {showAnchors && (
          <button
            onClick={() => setShowRadius(!showRadius)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm border transition-all ${
              showRadius
                ? 'bg-zinc-950 text-white border-zinc-950'
                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            5km Radius
          </button>
        )}
      </div>

    </div>
  );
};
