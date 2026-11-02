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
  ArrowsOutCardinal,
  CheckCircle,
  CaretUp,
  CaretDown,
  MapTrifold,
  SpeakerHigh,
  ShieldCheck,
  ShieldWarning,
  Waveform,
  Stack,
  CircleDashed,
  SlidersHorizontal
} from '@phosphor-icons/react';
import { resolveLocationCoords } from '@/lib/geo';

export interface AcousticAudit {
  estimated_db: number;
  exposure_level: 'sanctuary' | 'moderate' | 'high' | string;
  exposure_label: string;
  is_shielded: boolean;
  sound_shadow_status: string;
  facing_direction: string;
  nearest_hotspot: string;
  distance_to_hotspot_m: number;
  hotspot_lat?: number;
  hotspot_lng?: number;
  hotspot_type?: string;
  decibel_reduction_db?: number;
  is_ground_entrance?: boolean;
  acoustic_quirks?: string[];
  verdict?: string;
}

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
  rank?: number;
  fit_score?: number;
  noise_risk?: string;
  noise_reason?: string | null;
  location_proximity?: any[];
  acoustic_audit?: AcousticAudit;
}

export interface ProximityAnchor {
  id: string;
  label: string;
  target_place: string;
  lat: number;
  lng: number;
  max_commute_mins?: number;
  max_distance_km?: number;
  commute_mode?: 'driving' | 'transit' | 'walking' | 'bicycling' | string;
}

export interface ProximityFilterConfig {
  lat: number;
  lng: number;
  radiusKm: number;
  label: string;
}

export interface PropertyMapProps {
  properties: PropertyMapItem[];
  anchors: ProximityAnchor[];
  selectedPropertyId?: string | null;
  selectedAnchorId?: string | null;
  onSelectProperty?: (property: PropertyMapItem) => void;
  onSelectAnchor?: (anchor: ProximityAnchor) => void;
  proximityFilter?: ProximityFilterConfig | null;
  onRadiusChange?: (radiusKm: number) => void;
  className?: string;
  mode?: 'default' | 'search';
  selectedSuburbs?: string[];
  searchSummary?: {
    minPrice?: string | number;
    maxPrice?: string | number;
    bedrooms?: string;
    suburbsCount?: number;
  };
}

// Convert lat/lng to Web Mercator pixel coordinates
function project(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = n * ((lng + 180) / 360);
  const latRad = (lat * Math.PI) / 180;
  const y = (n * (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI)) / 2;
  return { x: x * 256, y: y * 256 };
}

// Haversine straight-line distance in km
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

// Topography-Aware Driving Distance & Duration Calculation
export function calculateDrivingDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const straight = calculateDistanceKm(lat1, lon1, lat2, lon2);

  // Cape Town topography check: Signal Hill / Lion's Head divides Atlantic Seaboard from City Bowl
  const isAtlantic1 = lon1 < 18.398 && lat1 > -33.955 && lat1 < -33.900;
  const isBowl1 = lon1 >= 18.400 && lat1 > -33.955 && lat1 < -33.915;
  const isAtlantic2 = lon2 < 18.398 && lat2 > -33.955 && lat2 < -33.900;
  const isBowl2 = lon2 >= 18.400 && lat2 > -33.955 && lat2 < -33.915;

  if ((isAtlantic1 && isBowl2) || (isBowl1 && isAtlantic2)) {
    // Must drive around Signal Hill via Helen Suzman / Buitengracht or Kloof Nek Pass (~2.7x)
    return Math.round(Math.max(5.4, straight * 2.7) * 10) / 10;
  }
  // Standard urban street road network factor (~1.38x)
  return Math.round(Math.max(0.6, straight * 1.38) * 10) / 10;
}

export function calculateDrivingDurationMins(drivingKm: number): number {
  return Math.max(2, Math.round((drivingKm / 32) * 60 + 2));
}

interface DrivingRouteData {
  distanceKm: number;
  durationMins: number;
  distanceText: string;
  durationText: string;
  points: [number, number][]; // [lat, lng] array
}

const drivingRouteCache = new Map<string, DrivingRouteData>();

// Cape Town Calibrated Noise Hotspots & Verified Sanctuary Enclaves
export const CAPE_TOWN_HOTSPOTS = [
  {
    id: 'kloof_aruba_nightlife',
    name: 'Kloof & Malan St (Aruba, Paradiso)',
    lat: -33.9323,
    lng: 18.4108,
    base_db: 84,
    radius_m: 220,
    type: 'nightlife',
    desc: 'Late-night DJ bass & patio crowds down Malan St waveguide'
  },
  {
    id: 'somerset_greenpoint_strip',
    name: 'Somerset Road Strip (Green Point)',
    lat: -33.9090,
    lng: 18.4110,
    base_db: 82,
    radius_m: 250,
    type: 'nightlife',
    desc: 'Sports bars, outdoor patios & evening crowd buzz'
  },
  {
    id: 'main_road_seapoint',
    name: 'Main Road Commercial (Sea Point)',
    lat: -33.9175,
    lng: 18.3880,
    base_db: 78,
    radius_m: 220,
    type: 'transit',
    desc: 'Buses, delivery scooters & late grocery traffic'
  },
  {
    id: 'bree_long_cbd',
    name: 'Bree & Long Street Spine',
    lat: -33.9220,
    lng: 18.4175,
    base_db: 86,
    radius_m: 300,
    type: 'nightlife',
    desc: 'High-decibel clubs & street revellers until 03:00'
  },
  {
    id: 'mill_buitenkant_transit',
    name: 'Mill St & Buitenkant Transit Canyon',
    lat: -33.9305,
    lng: 18.4140,
    base_db: 77,
    radius_m: 190,
    type: 'transit',
    desc: 'Dual carriageway transit & 24hr petrol idling'
  },
  {
    id: 'helen_suzman_blvd',
    name: 'Helen Suzman Blvd Highway',
    lat: -33.9050,
    lng: 18.4120,
    base_db: 76,
    radius_m: 160,
    type: 'highway',
    desc: 'Fast arterial road & stadium event traffic'
  }
];

export const CAPE_TOWN_SANCTUARIES = [
  {
    id: 'upper_tamboerskloof',
    name: 'Upper Tamboerskloof (Lion\'s Head)',
    lat: -33.9365,
    lng: 18.4015,
    radius_m: 450,
    ambient_db: 36,
    desc: 'Cul-de-sacs behind Lion\'s Head ridge with zero bar noise'
  },
  {
    id: 'higgovale_enclave',
    name: 'Higgovale Mountain Sanctuary',
    lat: -33.9410,
    lng: 18.4030,
    radius_m: 500,
    ambient_db: 34,
    desc: 'Ultra-quiet indigenous forest under Table Mountain'
  },
  {
    id: 'upper_oranjezicht',
    name: 'Upper Oranjezicht & Deer Park',
    lat: -33.9430,
    lng: 18.4250,
    radius_m: 480,
    ambient_db: 35,
    desc: 'Pine forest boundary & quiet tree-lined avenues'
  },
  {
    id: 'fresnaye_slopes',
    name: 'Upper Fresnaye Slopes',
    lat: -33.9240,
    lng: 18.3815,
    radius_m: 420,
    ambient_db: 36,
    desc: 'High-elevation wind-sheltered avenues above Sea Point'
  }
];

export const SUBURB_ABBREVIATIONS: Record<string, string> = {
  'tamboerskloof': 'TK',
  'oranjezicht': 'OZ',
  'gardens': 'GD',
  'green point': 'GP',
  'sea point': 'SP',
  'camps bay': 'CB',
  'vredehoek': 'VH',
  'higgovale': 'HV',
  'bo-kaap': 'BK',
  'de waterkant': 'DW',
  'mouille point': 'MP',
  'fresnaye': 'FR',
  'bantry bay': 'BB',
  'clifton': 'CF',
  'bakoven': 'BO',
  'hout bay': 'HB',
  'observatory': 'OB',
  'woodstock': 'WS',
  'salt river': 'SR',
  'rondebosch': 'RB',
  'newlands': 'NL',
  'claremont': 'CM',
  'constantia': 'CS',
  'century city': 'CC',
  'kalk bay': 'KB',
  'simons town': 'ST',
  "simon's town": 'ST',
  'fish hoek': 'FH',
  'muizenberg': 'MB',
  'pinelands': 'PL',
  'durbanville': 'DV',
  'bellville': 'BV',
  'blouberg': 'BB',
  'table view': 'TV',
};

export function getSuburbAbbr(name: string): string {
  const clean = name.toLowerCase().trim();
  if (SUBURB_ABBREVIATIONS[clean]) return SUBURB_ABBREVIATIONS[clean];
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export const PropertyMap: React.FC<PropertyMapProps> = ({
  properties,
  anchors,
  selectedPropertyId,
  selectedAnchorId,
  onSelectProperty,
  onSelectAnchor,
  proximityFilter = null,
  onRadiusChange,
  className = '',
  mode = 'default',
  selectedSuburbs = [],
  searchSummary
}) => {
  const isSearchMode = mode === 'search';
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const [zoom, setZoom] = useState(14.5);
  const targetZoomRef = useRef(14.5);
  const animFrameRef = useRef<number | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: -33.9300,
    lng: 18.4100,
  });

  // Local proximity radius ring state (in km)
  const [localRadiusKm, setLocalRadiusKm] = useState<number>(() => {
    return proximityFilter?.radiusKm || 5.0;
  });

  useEffect(() => {
    if (proximityFilter?.radiusKm !== undefined) {
      setLocalRadiusKm(proximityFilter.radiusKm);
    }
  }, [proximityFilter?.radiusKm]);

  const effectiveRadiusKm = proximityFilter?.radiusKm ?? localRadiusKm;

  const handleRadiusChange = (newRadius: number) => {
    setLocalRadiusKm(newRadius);
    if (onRadiusChange) {
      onRadiusChange(newRadius);
    }
  };

  // Map Basemap Style: 'canvas' (Esri Gray Canvas) or 'osm' (OpenStreetMap)
  const [mapStyle, setMapStyle] = useState<'canvas' | 'osm'>('canvas');

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  // Active Road Driving Route State
  const [activeDrivingRoute, setActiveDrivingRoute] = useState<DrivingRouteData | null>(null);


  const hasDraggedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const [hoveredProperty, setHoveredProperty] = useState<PropertyMapItem | null>(null);
  const [showAnchors, setShowAnchors] = useState(true);
  const [showRadius, setShowRadius] = useState(true);
  const [showNoiseRadar, setShowNoiseRadar] = useState(mode !== 'search');
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);
  const [isSearchRadarCollapsed, setIsSearchRadarCollapsed] = useState(false);
  const [isRadiusCollapsed, setIsRadiusCollapsed] = useState(false);

  // Click-to-activate map focus (prevents page scroll hijacking)
  const [isMapActive, setIsMapActive] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Outside click listener to deactivate map focus
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsMapActive(false);
        setShowScrollHint(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, []);

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

  // Center map & calculate smart initial zoom on load
  useEffect(() => {
    if (!isSearchMode && properties.length > 0) {
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
      const targetZ = span < 0.015 ? 15.2 : span < 0.035 ? 14.5 : span < 0.08 ? 13.8 : 13.0;
      setZoom(targetZ);
      targetZoomRef.current = targetZ;
    }
  }, [properties, isSearchMode]);

  // Auto-center & frame in Search Mode when criteria change
  useEffect(() => {
    if (isSearchMode) {
      const points: { lat: number; lng: number }[] = [];
      if (proximityFilter) {
        points.push({ lat: proximityFilter.lat, lng: proximityFilter.lng });
      }
      if (selectedSuburbs && selectedSuburbs.length > 0) {
        selectedSuburbs.forEach((suburb) => {
          const geo = resolveLocationCoords(suburb);
          points.push({ lat: geo.lat, lng: geo.lng });
        });
      }
      if (anchors && anchors.length > 0) {
        anchors.forEach((a) => points.push({ lat: a.lat, lng: a.lng }));
      }
      if (points.length > 0 && !isDraggingRef.current) {
        let minLat = points[0].lat;
        let maxLat = points[0].lat;
        let minLng = points[0].lng;
        let maxLng = points[0].lng;
        points.forEach((pt) => {
          if (pt.lat < minLat) minLat = pt.lat;
          if (pt.lat > maxLat) maxLat = pt.lat;
          if (pt.lng < minLng) minLng = pt.lng;
          if (pt.lng > maxLng) maxLng = pt.lng;
        });
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        setCenter({ lat: centerLat, lng: centerLng });
        const span = Math.max(maxLat - minLat, maxLng - minLng);
        const targetZ = span < 0.02 ? 14.6 : span < 0.06 ? 13.8 : span < 0.12 ? 12.8 : 12.0;
        setZoom(targetZ);
        targetZoomRef.current = targetZ;
      }
    }
  }, [isSearchMode, proximityFilter?.lat, proximityFilter?.lng, selectedSuburbs, anchors]);

  // Center map when a property is selected (only if not currently dragging)
  useEffect(() => {
    if (selectedPropertyId && !isDraggingRef.current) {
      const p = properties.find((item) => item.id === selectedPropertyId);
      if (p) {
        setCenter({ lat: p.lat, lng: p.lng });
      }
    }
  }, [selectedPropertyId, properties]);

  // Unified Drag Handlers attached to window (zero drift, zero coordinate lag, rAF throttled)
  const startDrag = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = { x: clientX, y: clientY };
    setIsDragging(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left mouse button only
    startDrag(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  useEffect(() => {
    let rafId: number | null = null;
    let accumulatedDx = 0;
    let accumulatedDy = 0;

    const applyMove = () => {
      rafId = null;
      if (accumulatedDx === 0 && accumulatedDy === 0) return;
      const dx = accumulatedDx;
      const dy = accumulatedDy;
      accumulatedDx = 0;
      accumulatedDy = 0;

      setCenter((prevCenter) => {
        const centerP = project(prevCenter.lat, prevCenter.lng, zoom);
        const newCenterP = { x: centerP.x - dx, y: centerP.y - dy };

        const n = Math.pow(2, zoom);
        const newLng = (newCenterP.x / 256 / n) * 360 - 180;
        const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * newCenterP.y) / 256 / n)));
        const newLat = (latRad * 180) / Math.PI;

        return { lat: newLat, lng: newLng };
      });
    };

    const handleMove = (clientX: number, clientY: number) => {
      if (!isDraggingRef.current) return;
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        hasDraggedRef.current = true;
      }
      dragStartRef.current = { x: clientX, y: clientY };
      accumulatedDx += dx;
      accumulatedDy += dy;

      if (rafId === null) {
        rafId = requestAnimationFrame(applyMove);
      }
    };

    const handleEnd = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        applyMove();
      }
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    };

    const onWindowMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onWindowMouseUp = () => handleEnd();
    const onWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onWindowTouchEnd = () => handleEnd();

    window.addEventListener('mousemove', onWindowMouseMove, { passive: true });
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('touchmove', onWindowTouchMove, { passive: true });
    window.addEventListener('touchend', onWindowTouchEnd);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
    };
  }, [zoom]);

  // Fluid Easy-Ease Fractional Zoom Controller with Exponential Damping
  const smoothZoomTo = useCallback((target: number) => {
    const clamped = Math.max(9.5, Math.min(18.5, Math.round(target * 100) / 100));
    targetZoomRef.current = clamped;

    if (animFrameRef.current !== null) return;

    const animate = () => {
      setZoom((current) => {
        const diff = targetZoomRef.current - current;
        if (Math.abs(diff) < 0.005) {
          animFrameRef.current = null;
          return targetZoomRef.current;
        }
        // Smooth exponential ease-out curve (~18% of distance closed per frame)
        const next = current + diff * 0.18;
        animFrameRef.current = requestAnimationFrame(animate);
        return next;
      });
    };
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Wheel zoom - fine fluid fractional increments with easy-ease animation
  const handleWheel = (e: React.WheelEvent) => {
    if (!isMapActive) {
      // Don't intercept scroll; allow smooth page scrolling
      setShowScrollHint(true);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = setTimeout(() => setShowScrollHint(false), 1600);
      return;
    }

    e.preventDefault();
    const absDelta = Math.abs(e.deltaY);
    // Dynamic fine sensitivity: 0.16 to 0.38 per wheel tick
    const step = Math.min(0.38, Math.max(0.16, absDelta * 0.0016));
    const nextTarget = targetZoomRef.current + (e.deltaY < 0 ? step : -step);
    smoothZoomTo(nextTarget);
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
    smoothZoomTo(targetZoomRef.current + 0.75);
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

  // Calculate visible tiles for Free tile providers (Fractional zoom continuous scaling)
  const tileZoom = Math.floor(zoom);
  const tileScale = Math.pow(2, zoom - tileZoom);
  const tileSize = 256 * tileScale;

  const centerP = project(center.lat, center.lng, zoom);
  const startTileX = Math.floor((centerP.x - dimensions.width / 2) / tileSize);
  const endTileX = Math.floor((centerP.x + dimensions.width / 2) / tileSize);
  const startTileY = Math.floor((centerP.y - dimensions.height / 2) / tileSize);
  const endTileY = Math.floor((centerP.y + dimensions.height / 2) / tileSize);

  const tiles: Array<{
    key: string;
    baseTileUrl: string;
    refTileUrl?: string;
    left: number;
    top: number;
    width: number;
    height: number;
  }> = [];

  const maxTile = Math.pow(2, tileZoom);
  for (let x = startTileX; x <= endTileX; x++) {
    for (let y = startTileY; y <= endTileY; y++) {
      if (y >= 0 && y < maxTile) {
        const wrappedX = ((x % maxTile) + maxTile) % maxTile;
        const left = x * tileSize - (centerP.x - dimensions.width / 2);
        const top = y * tileSize - (centerP.y - dimensions.height / 2);

        let baseTileUrl = '';
        let refTileUrl: string | undefined = undefined;

        // Free Worldwide Basemap Layer (Zero API Key Required, Zero Watermarks)
        if (mapStyle === 'osm') {
          // OpenStreetMap Standard - 100% Free open-source map
          baseTileUrl = `https://tile.openstreetmap.org/${tileZoom}/${wrappedX}/${y}.png`;
        } else {
          // Esri World Street Map (Full zoom 0-19 worldwide, no API key required)
          baseTileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${tileZoom}/${y}/${wrappedX}`;
        }

        tiles.push({
          key: `${mapStyle}-${tileZoom}-${x}-${y}`,
          baseTileUrl,
          refTileUrl,
          left,
          top,
          width: tileSize + 0.5,
          height: tileSize + 0.5,
        });
      }
    }
  }

  // Selected property & active proximity anchor
  const selectedProp = isSearchMode ? null : (properties.find((p) => p.id === selectedPropertyId) || properties[0] || null);
  const activeAnchor =
    anchors.find((a) => a.id === selectedAnchorId) || anchors[0] || null;

  const locationLabel = proximityFilter?.label
    || activeAnchor?.label
    || (anchors.length > 0 ? anchors[0].label : 'Location Radius');

  // Selected prop position
  const propPos = selectedProp ? getScreenPos(selectedProp.lat, selectedProp.lng) : null;

  const lastRenderedPositionsRef = useRef<Record<string, { isCompact: boolean }>>({});

  // Smart Anti-Collision Level-of-Detail (LOD) Engine:
  // Detects overlapping pins in screen pixel space and condenses crowded pins into sleek micro-dots
  const renderedPositions = React.useMemo(() => {
    // While dragging, freeze the LOD layout so pins never pop or nudge mid-drag
    if (isDraggingRef.current && Object.keys(lastRenderedPositionsRef.current).length > 0) {
      return lastRenderedPositionsRef.current;
    }

    const result: Record<string, { isCompact: boolean }> = {};
    const placed: { x: number; y: number }[] = [];

    // If anchor is rendered with full pill, mark its footprint
    if (activeAnchor && zoom >= 13.8) {
      const aPos = getScreenPos(activeAnchor.lat, activeAnchor.lng);
      placed.push({ x: aPos.x, y: aPos.y });
    }

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

      if (isHovered) {
        result[prop.id] = { isCompact: false };
        placed.push({ x: pos.x, y: pos.y });
        continue;
      }

      // If map is zoomed out (< 13.5), only selected property can be an expanded pill,
      // all other properties condense to micro-pins with rank number
      if (zoom < 13.5 && !isSelected) {
        result[prop.id] = { isCompact: true };
        placed.push({ x: pos.x, y: pos.y });
        continue;
      }

      // At very low zoom (< 12.0), condense ALL properties including selected to prevent huge pills blocking cities
      if (zoom < 12.0) {
        result[prop.id] = { isCompact: true };
        placed.push({ x: pos.x, y: pos.y });
        continue;
      }

      if (isSelected) {
        result[prop.id] = { isCompact: false };
        placed.push({ x: pos.x, y: pos.y });
        continue;
      }

      // Check collision with already-placed badges: wide pill needs ~70px X, ~30px Y
      const hasCollision = placed.some((other) => {
        const dx = Math.abs(pos.x - other.x);
        const dy = Math.abs(pos.y - other.y);
        return dx < 70 && dy < 30;
      });

      if (hasCollision) {
        result[prop.id] = { isCompact: true };
      } else {
        result[prop.id] = { isCompact: false };
      }
      placed.push({ x: pos.x, y: pos.y });
    }

    lastRenderedPositionsRef.current = result;
    return result;
  }, [properties, selectedPropertyId, hoveredProperty, center, zoom, dimensions, activeAnchor]);


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


  // Fetch real-time OSRM Driving Route along actual street network
  useEffect(() => {
    if (!selectedProp || !activeAnchor) {
      setActiveDrivingRoute(null);
      return;
    }

    const routeKey = `${selectedProp.lat.toFixed(4)},${selectedProp.lng.toFixed(4)}::${activeAnchor.lat.toFixed(4)},${activeAnchor.lng.toFixed(4)}`;

    if (drivingRouteCache.has(routeKey)) {
      setActiveDrivingRoute(drivingRouteCache.get(routeKey)!);
      return;
    }

    // Immediate topography-aware fallback while fetching road network
    const fallbackDist = calculateDrivingDistanceKm(selectedProp.lat, selectedProp.lng, activeAnchor.lat, activeAnchor.lng);
    const fallbackDur = calculateDrivingDurationMins(fallbackDist);
    const fallbackData: DrivingRouteData = {
      distanceKm: fallbackDist,
      durationMins: fallbackDur,
      distanceText: `${fallbackDist} km`,
      durationText: `~${fallbackDur} mins`,
      points: [[selectedProp.lat, selectedProp.lng], [activeAnchor.lat, activeAnchor.lng]]
    };
    setActiveDrivingRoute(fallbackData);

    let isMounted = true;
    const fetchOsrmRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${selectedProp.lng},${selectedProp.lat};${activeAnchor.lng},${activeAnchor.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.routes && json.routes.length > 0) {
            const r = json.routes[0];
            const distKm = Math.round((r.distance / 1000) * 10) / 10;
            const durMins = Math.max(1, Math.round(r.duration / 60));
            // GeoJSON coordinates are [lon, lat] -> convert to [lat, lng]
            const coords: [number, number][] = r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);

            const routeData: DrivingRouteData = {
              distanceKm: distKm,
              durationMins: durMins,
              distanceText: `${distKm} km`,
              durationText: `~${durMins} mins`,
              points: coords
            };
            drivingRouteCache.set(routeKey, routeData);
            if (isMounted) {
              setActiveDrivingRoute(routeData);
            }
          }
        }
      } catch (e) {
        // keep fallback
      }
    };

    fetchOsrmRoute();
    return () => {
      isMounted = false;
    };
  }, [selectedProp?.lat, selectedProp?.lng, activeAnchor?.lat, activeAnchor?.lng, activeAnchor?.id]);

  const resetView = () => {
    if (properties.length > 0) {
      const lats = properties.map(p => p.lat);
      const lngs = properties.map(p => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      setCenter({ lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 });
      const span = Math.max(maxLat - minLat, maxLng - minLng);
      const targetZ = span < 0.015 ? 15.2 : span < 0.035 ? 14.5 : span < 0.08 ? 13.8 : 13.0;
      smoothZoomTo(targetZ);
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
      className={`relative w-full h-full overflow-hidden select-none bg-[#f1f2f4] border border-zinc-200 transition-shadow duration-200 ${isMapActive
          ? 'cursor-grab active:cursor-grabbing ring-2 ring-indigo-500/25'
          : 'cursor-pointer'
        } ${className}`}
      onClick={() => {
        setIsMapActive(true);
        setShowScrollHint(false);
      }}
      onMouseDown={(e) => {
        setIsMapActive(true);
        setShowScrollHint(false);
        handleMouseDown(e);
      }}
      onMouseLeave={() => {
        setIsMapActive(false);
        setShowScrollHint(false);
      }}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      {/* Scroll Hint Overlay (informs user that clicking activates zoom) */}
      {showScrollHint && !isMapActive && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 py-1.5 rounded-full bg-zinc-950/90 backdrop-blur-md text-white text-[11px] font-bold shadow-xl border border-white/20 flex items-center gap-1.5">
            <NavigationArrow size={12} weight="bold" className="text-emerald-400" />
            <span>Click map to control zoom</span>
          </div>
        </div>
      )}
      {/* 1. Map Tiles Layer (Free Map APIs - No Watermarks) */}
      <div className={`absolute inset-0 pointer-events-none transition-[filter] duration-300 ${mapStyle === 'canvas' ? 'grayscale-[85%] contrast-[92%] brightness-[102%]' : ''}`}>
        {tiles.map((tile) => (
          <React.Fragment key={tile.key}>
            <img
              src={tile.baseTileUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute select-none pointer-events-none transition-opacity duration-300"
              style={{
                left: `${tile.left}px`,
                top: `${tile.top}px`,
                width: `${tile.width}px`,
                height: `${tile.height}px`,
              }}
            />
            {tile.refTileUrl && (
              <img
                src={tile.refTileUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute select-none pointer-events-none opacity-85 transition-opacity duration-300"
                style={{
                  left: `${tile.left}px`,
                  top: `${tile.top}px`,
                  width: `${tile.width}px`,
                  height: `${tile.height}px`,
                }}
              />
            )}
          </React.Fragment>
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
          <radialGradient id="hotspot-radial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#f97316" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sanctuary-radial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
            <stop offset="55%" stopColor="#059669" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Noise Radar Layer: Calibrated Noise Hotspots & Mountain Sanctuary Zones */}
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

        {/* Proximity Anchor Radius Rings & Dynamic Distance Filter Zone */}
        {showRadius && (
          <g id="proximity-radius-rings">
            {/* 1. Dynamic Illustrative Proximity Filter Zone */}
            {proximityFilter && (() => {
              const pPos = getScreenPos(proximityFilter.lat, proximityFilter.lng);
              const metersPerPixel = (156543.03392 * Math.cos((proximityFilter.lat * Math.PI) / 180)) / Math.pow(2, zoom);
              const radiusPixels = (effectiveRadiusKm * 1000) / metersPerPixel;

              return (
                <g key="dynamic-proximity-filter-svg">
                  {/* Outer illustrative radar halo */}
                  <circle
                    cx={pPos.x}
                    cy={pPos.y}
                    r={radiusPixels}
                    fill="rgba(79, 70, 229, 0.08)"
                    stroke="#4f46e5"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                  />
                  {/* Inner soft buffer zone */}
                  <circle
                    cx={pPos.x}
                    cy={pPos.y}
                    r={radiusPixels * 0.45}
                    fill="rgba(79, 70, 229, 0.04)"
                    stroke="#818cf8"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    opacity="0.8"
                  />
                </g>
              );
            })()}

            {/* 2. Anchor Radius Rings */}
            {showAnchors &&
              anchors.map((anchor) => {
                const pos = getScreenPos(anchor.lat, anchor.lng);
                const metersPerPixel = (156543.03392 * Math.cos((anchor.lat * Math.PI) / 180)) / Math.pow(2, zoom);
                const isTarget = activeAnchor?.id === anchor.id;
                const radiusMeters = (isTarget && !proximityFilter)
                  ? (effectiveRadiusKm * 1000)
                  : (anchor.max_distance_km ? anchor.max_distance_km * 1000 : 5000);
                const radiusPixels = radiusMeters / metersPerPixel;

                return (
                  <g key={`radius-${anchor.id}`}>
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={Math.max(15, radiusPixels)}
                      fill={isTarget ? 'rgba(79, 70, 229, 0.04)' : 'rgba(0, 0, 0, 0.01)'}
                      stroke={isTarget ? '#4f46e5' : '#a1a1aa'}
                      strokeWidth={isTarget ? '1.8' : '1'}
                      strokeDasharray={isTarget ? '4 3' : '3 3'}
                    />
                  </g>
                );
              })}
          </g>
        )}

        {/* Selected Property Proximity Lines & Driving Road Route */}
        {propPos && showAnchors && (
          <g>
            {anchors.map((anchor) => {
              const aPos = getScreenPos(anchor.lat, anchor.lng);
              const isTarget = activeAnchor?.id === anchor.id;

              // If this is the active target anchor and we have multi-point road geometry, render actual road path
              if (isTarget && activeDrivingRoute && activeDrivingRoute.points.length > 2) {
                const polylinePoints = activeDrivingRoute.points
                  .map(p => {
                    const sp = getScreenPos(p[0], p[1]);
                    return `${sp.x},${sp.y}`;
                  })
                  .join(' ');

                return (
                  <g key={`driving-route-${anchor.id}`}>
                    {/* Road highlight halo */}
                    <polyline
                      points={polylinePoints}
                      stroke="#ffffff"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      opacity="0.9"
                    />
                    {/* Road driving path */}
                    <polyline
                      points={polylinePoints}
                      stroke="#4f46e5"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    {/* Inner dash accent */}
                    <polyline
                      points={polylinePoints}
                      stroke="#a5b4fc"
                      strokeWidth="1.5"
                      strokeDasharray="4 6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </g>
                );
              }

              // Fallback / secondary connection line
              return (
                <g key={`line-${anchor.id}`}>
                  <line
                    x1={propPos.x}
                    y1={propPos.y}
                    x2={aPos.x}
                    y2={aPos.y}
                    stroke="#ffffff"
                    strokeWidth={isTarget ? "4" : "2"}
                    strokeLinecap="round"
                  />
                  <line
                    x1={propPos.x}
                    y1={propPos.y}
                    x2={aPos.x}
                    y2={aPos.y}
                    stroke={isTarget ? "#4f46e5" : "#a1a1aa"}
                    strokeWidth={isTarget ? "2" : "1"}
                    strokeDasharray={isTarget ? "6 4" : "4 4"}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* Floating Noise Hotspot & Sanctuary Labels on Map (Level of Detail LOD) */}
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
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black shadow-lg border flex items-center gap-1.5 backdrop-blur-md ${isPropShielded
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
      {selectedProp && propPos && showAnchors && activeAnchor && (() => {
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

        // Only render if anchor and property have sufficient breathing room AND zoom is sufficient
        if (zoom < 13.2 || totalPixels < 110) return null;

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
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-none ${isSelected ? 'z-35' : 'z-20'
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
                  zoom >= 13.8 ? (
                    <>
                      <span className="absolute -inset-2 rounded-full bg-emerald-400/30 animate-ping pointer-events-none" />
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg bg-zinc-950 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-white shadow-emerald-950/20 whitespace-nowrap">
                        <Target size={14} weight="bold" className="text-emerald-400 animate-pulse" />
                        <span className="truncate max-w-[140px] tracking-tight">{anchor.label}</span>
                      </div>
                      <div className="w-2 h-2 rotate-45 -mt-1 shadow-2xs bg-zinc-950" />
                    </>
                  ) : (
                    <div className="relative group/anchor">
                      <span className="absolute -inset-1.5 rounded-full bg-emerald-400/40 animate-ping pointer-events-none" />
                      <div className="w-8 h-8 rounded-full bg-zinc-950 text-white ring-2 ring-emerald-400 shadow-xl flex items-center justify-center hover:scale-110 transition-transform">
                        <Target size={16} weight="bold" className="text-emerald-400" />
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-xl bg-zinc-950 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/anchor:opacity-100 pointer-events-none shadow-xl transition-opacity z-50 border border-emerald-400/30">
                        {anchor.label}
                      </div>
                    </div>
                  )
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

      {/* 4b. Dynamic Chosen Proximity Location Beacon & Radius Distance Label */}
      {proximityFilter && (() => {
        const pPos = getScreenPos(proximityFilter.lat, proximityFilter.lng);
        const metersPerPixel = (156543.03392 * Math.cos((proximityFilter.lat * Math.PI) / 180)) / Math.pow(2, zoom);
        const radiusPixels = (effectiveRadiusKm * 1000) / metersPerPixel;

        return (
          <div key="dynamic-proximity-filter-elements" className="pointer-events-none">
            {/* Center Beacon */}
            <div
              className="absolute z-40 transform -translate-x-1/2 -translate-y-1/2 transition-none pointer-events-auto"
              style={{ left: `${pPos.x}px`, top: `${pPos.y}px` }}
            >
              <div className="relative flex flex-col items-center group/focal">
                {zoom < 13.8 ? (
                  /* Compact Target Icon for Zoomed-Out View */
                  <>
                    {!isDragging && (
                      <span className="absolute -inset-1.5 rounded-full bg-indigo-500/40 animate-ping pointer-events-none" />
                    )}
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white ring-2 ring-white shadow-xl flex items-center justify-center hover:scale-110 transition-transform cursor-pointer">
                      <Target size={15} weight="bold" />
                    </div>
                    {/* Tooltip on Hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-xl bg-zinc-950 text-white text-[11px] font-extrabold whitespace-nowrap opacity-0 group-hover/focal:opacity-100 pointer-events-none shadow-xl border border-white/10 z-50 transition-opacity">
                      Focal Hub: {proximityFilter.label}
                    </div>
                  </>
                ) : (
                  /* Expanded Luxury Pill for Zoomed-In View */
                  <>
                    {!isDragging && (
                      <span className="absolute -inset-2.5 rounded-full bg-indigo-500/40 animate-ping pointer-events-none" />
                    )}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-950 text-white font-extrabold text-xs shadow-2xl ring-2 ring-indigo-400 ring-offset-2 ring-offset-white whitespace-nowrap">
                      <Target size={14} weight="bold" className={`text-indigo-400 ${isDragging ? '' : 'animate-pulse'}`} />
                      <span>{proximityFilter.label}</span>
                    </div>
                    <div className="w-2 h-2 rotate-45 -mt-1 shadow-2xs bg-zinc-950" />
                  </>
                )}
              </div>
            </div>

            {/* Perimeter Distance Badge */}
              { radiusPixels > 30 && showRadius && (
                <div
                  className="absolute z-35 transform -translate-x-1/2 -translate-y-full mb-1 transition-none"
                  style={{ left: `${pPos.x}px`, top: `${pPos.y - radiusPixels}px` }}
                >
                  <div className="px-2.5 py-0.5 rounded-full bg-indigo-600/95 text-white text-[10px] font-black shadow-md border border-white/50 backdrop-blur-md whitespace-nowrap">
                    {effectiveRadiusKm.toFixed(1)} km radius
                  </div>
                </div>
              )}
          </div>
        );
      })()}

      {/* 4c. Active Anchor Perimeter Distance Badge (when no custom proximity filter is active) */}
      {!proximityFilter && showRadius && showAnchors && activeAnchor && (() => {
        const aPos = getScreenPos(activeAnchor.lat, activeAnchor.lng);
        const metersPerPixel = (156543.03392 * Math.cos((activeAnchor.lat * Math.PI) / 180)) / Math.pow(2, zoom);
        const radiusPixels = (effectiveRadiusKm * 1000) / metersPerPixel;

        if (radiusPixels <= 30) return null;
        return (
          <div
            key={`anchor-perimeter-badge-${activeAnchor.id}`}
            className="absolute z-35 transform -translate-x-1/2 -translate-y-full mb-1 pointer-events-none transition-none"
            style={{ left: `${aPos.x}px`, top: `${aPos.y - radiusPixels}px` }}
          >
            <div className="px-2.5 py-0.5 rounded-full bg-indigo-600/95 text-white text-[10px] font-black shadow-md border border-white/50 backdrop-blur-md whitespace-nowrap">
              {effectiveRadiusKm.toFixed(1)} km radius
            </div>
          </div>
        );
      })()}

      {/* 5A. Target Suburb Pins (Search Mode: Dynamic Level-of-Detail & Anti-Collision) */}
      {isSearchMode && selectedSuburbs && (() => {
        const placedMarkers: { x: number; y: number }[] = [];
        if (proximityFilter) {
          const fp = getScreenPos(proximityFilter.lat, proximityFilter.lng);
          placedMarkers.push({ x: fp.x, y: fp.y });
        }

        return selectedSuburbs.map((suburb) => {
          const coords = resolveLocationCoords(suburb);
          const rawPos = getScreenPos(coords.lat, coords.lng);
          if (rawPos.x < -100 || rawPos.x > dimensions.width + 100 || rawPos.y < -100 || rawPos.y > dimensions.height + 100) {
            return null;
          }

          const abbr = getSuburbAbbr(suburb);
          const isZoomedOut = zoom < 13.8;
          let renderCompact = isZoomedOut;

          if (!renderCompact) {
            // Check collision for full 110px pill against previously placed markers
            const collides = placedMarkers.some(
              (p) => Math.abs(p.x - rawPos.x) < 85 && Math.abs(p.y - rawPos.y) < 28
            );
            if (collides) {
              renderCompact = true;
            }
          }

          // Anti-overlap displacement: if even the compact circles collide (< 26px), micro-nudge slightly
          let posX = rawPos.x;
          let posY = rawPos.y;
          const pointCollision = placedMarkers.find(
            (p) => Math.hypot(p.x - posX, p.y - posY) < 26
          );
          if (pointCollision) {
            const angle = Math.atan2(posY - pointCollision.y, posX - pointCollision.x) || Math.PI / 4;
            posX = pointCollision.x + Math.cos(angle) * 28;
            posY = pointCollision.y + Math.sin(angle) * 28;
          }

          placedMarkers.push({ x: posX, y: posY });

          return (
            <div
              key={suburb}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-35 pointer-events-auto cursor-pointer select-none transition-none group/suburb"
              style={{ left: `${posX}px`, top: `${posY}px` }}
            >
              <div className="relative flex flex-col items-center">
                {renderCompact ? (
                  /* Compact Geo Icon & Abbreviation Dot for Zoomed-Out View */
                  <>
                    <div className="w-6 h-6 rounded-full bg-zinc-950 text-white border-2 border-indigo-400 shadow-lg flex items-center justify-center text-[10px] font-black tracking-tight hover:scale-125 transition-transform">
                      {abbr}
                    </div>
                    {/* Tooltip on Hover showing full suburb name */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-xl bg-zinc-950 text-white text-[11px] font-extrabold whitespace-nowrap opacity-0 group-hover/suburb:opacity-100 pointer-events-none shadow-xl border border-white/10 z-50 transition-opacity">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} weight="fill" className="text-indigo-400" />
                        <span>{suburb}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Expanded Full Luxury Pill for Zoomed-In View */
                  <>
                    <div className="px-3 py-1.5 rounded-2xl text-xs font-black bg-zinc-950 text-white shadow-xl border border-white/20 flex items-center gap-1.5 whitespace-nowrap hover:scale-105 transition-transform">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                      <span>{suburb}</span>
                    </div>
                    <div className="w-2.5 h-2.5 rotate-45 -mt-1 bg-zinc-950 border-r border-b border-white/20 shadow-xs" />
                  </>
                )}
              </div>
            </div>
          );
        });
      })()}

      {/* 5B. Property Markers Layer (Results / Default Mode) */}
      {!isSearchMode && properties.map((property) => {
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
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-none ${isSelected ? 'z-45' : isHovered ? 'z-40' : isCompact ? 'z-20' : 'z-25'
              }`}
            style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            onClick={(e) => {
              e.stopPropagation();
              if (hasDraggedRef.current) return;
              if (onSelectProperty) onSelectProperty(property);
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
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-md border-2 transition-transform group-hover:scale-125 ${isTopMatch
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
                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-md whitespace-nowrap ${isSelected
                        ? 'bg-zinc-950 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-white shadow-xl'
                        : 'bg-white text-zinc-900 border border-zinc-200/90 hover:border-zinc-950 hover:bg-zinc-50 hover:shadow-lg'
                      }`}
                  >
                    {property.rank && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${isSelected
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
                    className={`w-2 h-2 rotate-45 -mt-1 mx-auto shadow-2xs transition-colors ${isSelected
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
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full backdrop-blur-xs ${property.fit_score >= 75 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
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


      {/* 6. Active Property & Proximity HUD Header (Top Left) */}
      {isSearchMode ? (
        <div className="absolute top-4 left-4 z-40 max-w-sm pointer-events-auto">
          {isSearchRadarCollapsed ? (
            <div
              onClick={() => setIsSearchRadarCollapsed(false)}
              className="px-3.5 py-2 flex items-center gap-2.5 cursor-pointer hover:bg-zinc-50/90 rounded-2xl bg-white/95 backdrop-blur-xl border border-zinc-200/90 shadow-xl text-xs transition-all select-none group"
              title="Expand Search Filter Radar"
            >
              <div className="w-6 h-6 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-bold shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <SlidersHorizontal size={13} weight="bold" className="text-indigo-400" />
              </div>
              <span className="font-extrabold text-zinc-950 truncate max-w-[170px]">
                Search Radar ({selectedSuburbs && selectedSuburbs.length > 0 ? `${selectedSuburbs.length} Suburbs` : 'All City'})
              </span>
              <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[10px] shrink-0">
                {effectiveRadiusKm.toFixed(1)} km
              </span>
              <CaretDown size={14} weight="bold" className="text-zinc-500 shrink-0" />
            </div>
          ) : (
            <div className="bg-white/95 backdrop-blur-xl border border-zinc-200/90 rounded-3xl shadow-xl text-xs p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-2xl bg-zinc-950 text-white flex items-center justify-center font-bold shadow-xs">
                    <SlidersHorizontal size={16} weight="bold" className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-zinc-950 text-xs">Search Filter Radar</h3>
                    <p className="text-[10px] text-zinc-500 font-medium">Real-time criteria footprint</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-black uppercase tracking-wider">
                    Search Mode
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSearchRadarCollapsed(true)}
                    className="p-1 text-zinc-400 hover:text-zinc-800 transition-colors rounded-lg hover:bg-zinc-100 cursor-pointer"
                    title="Collapse Search Filter Radar"
                    aria-label="Collapse Search Filter Radar"
                  >
                    <CaretUp size={15} weight="bold" />
                  </button>
                </div>
              </div>

              {/* Active Criteria Summary */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                  <span className="font-semibold text-zinc-600 flex items-center gap-1.5">
                    <MapPin size={14} weight="bold" className="text-indigo-600" />
                    Target Suburbs
                  </span>
                  <span className="font-extrabold text-zinc-950">
                    {selectedSuburbs && selectedSuburbs.length > 0
                      ? `${selectedSuburbs.length} Selected`
                      : 'All Cape Town'}
                  </span>
                </div>

                {proximityFilter && (
                  <div className="flex items-center justify-between text-[11px] p-2.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/70">
                    <span className="font-semibold text-indigo-900 flex items-center gap-1.5 truncate max-w-[160px]">
                      <Target size={14} weight="bold" className="text-indigo-600 shrink-0" />
                      {locationLabel}
                    </span>
                    <span className="font-black text-indigo-700 shrink-0">
                      {effectiveRadiusKm.toFixed(1)} km buffer
                    </span>
                  </div>
                )}

                {searchSummary && (searchSummary.minPrice || searchSummary.maxPrice) && (
                  <div className="flex items-center justify-between text-[11px] p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                    <span className="font-semibold text-zinc-600">Budget Window</span>
                    <span className="font-extrabold text-zinc-950">
                      R {Number(searchSummary.minPrice || 0).toLocaleString()} – R {Number(searchSummary.maxPrice || 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-1.5 text-[10px] text-zinc-400 font-medium leading-relaxed border-t border-zinc-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                <span>Map reflects your live filters. Properties are ranked when you launch the report.</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        selectedProp && (
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
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${selectedProp.fit_score >= 70 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
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


                {/* Acoustic Decibel & Orientation Rating */}
                <div className="pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    <span>Acoustic Decibel &amp; Orientation</span>
                    <span className={isPropShielded ? 'text-emerald-600 font-extrabold' : 'text-rose-600 font-extrabold'}>
                      {selectedProp.acoustic_audit?.estimated_db || (isPropShielded ? 40 : 73)} dBA
                    </span>
                  </div>
                  <div className={`p-2 rounded-xl text-xs flex items-center gap-2 border ${isPropShielded
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

                {/* Desired Locations Proximity Section */}
                {anchors.length > 0 && (
                  <div className="space-y-1.5 pt-2.5 border-t border-zinc-100">
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      <span>Commute & Proximity</span>
                      <span className="text-zinc-400 font-normal">Click to focus</span>
                    </div>

                    {anchors.map((a) => {
                      const isSelectedAnchor = activeAnchor?.id === a.id;
                      const driveData = (isSelectedAnchor && activeDrivingRoute) ? activeDrivingRoute : null;
                      const distKm = driveData
                        ? driveData.distanceKm
                        : calculateDrivingDistanceKm(selectedProp.lat, selectedProp.lng, a.lat, a.lng);
                      const durMins = driveData
                        ? driveData.durationMins
                        : calculateDrivingDurationMins(distKm);
                      const dist = `${distKm} km`;
                      const dur = `~${durMins} mins`;

                      return (
                        <div
                          key={a.id}
                          onClick={() => onSelectAnchor && onSelectAnchor(a)}
                          className={`flex items-center justify-between text-[11px] font-medium px-2.5 py-1.5 rounded-xl cursor-pointer transition-all ${isSelectedAnchor
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
        )
      )}

      {/* Map Zoom & Action Controls (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-40 flex flex-col gap-2 pointer-events-auto items-end">
        <div className="bg-white/95 backdrop-blur-md border border-zinc-200/90 rounded-2xl shadow-xl overflow-hidden flex flex-col p-0.5">
          <button
            onClick={() => smoothZoomTo(targetZoomRef.current + 0.65)}
            className="p-2.5 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 rounded-xl transition-colors cursor-pointer"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <Plus size={15} weight="bold" />
          </button>
          <div className="h-px bg-zinc-100 mx-2" />
          <button
            onClick={() => smoothZoomTo(targetZoomRef.current - 0.65)}
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
          {mapStyle === 'osm' ? '© OpenStreetMap' : '© Esri · OpenStreetMap'}
        </div>
      </div>

        {/* Bottom Left Dock: Dynamic Location Radius Slider + Layer Visibility Toolbar */}
        <div
          className="absolute bottom-6 left-6 z-40 flex flex-col items-start gap-2 pointer-events-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Dynamic Radius Ring Slider (Directly above the toggle visibility switches) */}
          {showRadius && (proximityFilter || (showAnchors && (activeAnchor || anchors.length > 0))) && (
            isRadiusCollapsed ? (
              <div
                onClick={() => setIsRadiusCollapsed(false)}
                className="w-64 sm:w-72 px-3.5 py-2 rounded-2xl bg-white/95 backdrop-blur-xl border border-zinc-200/90 shadow-xl flex items-center justify-between gap-2 cursor-pointer hover:bg-zinc-50/90 transition-all select-none group"
                title="Expand Radius Slider"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Target size={14} weight="bold" className="text-indigo-600 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-zinc-800 truncate" title={locationLabel}>
                    {locationLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-extrabold text-[11px] whitespace-nowrap">
                    {effectiveRadiusKm.toFixed(1)} km
                  </span>
                  <CaretUp size={14} weight="bold" className="text-zinc-500 shrink-0" />
                </div>
              </div>
            ) : (
              <div className="w-64 sm:w-72 p-3 rounded-2xl bg-white/95 backdrop-blur-xl border border-zinc-200/90 shadow-xl transition-all duration-200 select-none animate-in fade-in duration-150">
                {/* Header: Location Label & Radius Pill */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Target size={14} weight="bold" className="text-indigo-600 shrink-0" />
                    <span className="text-xs font-bold text-zinc-800 truncate" title={locationLabel}>
                      {locationLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-extrabold text-[11px] whitespace-nowrap shrink-0">
                      {effectiveRadiusKm.toFixed(1)} km
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsRadiusCollapsed(true)}
                      className="p-1 text-zinc-400 hover:text-zinc-800 transition-colors rounded-lg hover:bg-zinc-100 cursor-pointer"
                      title="Collapse Radius Slider"
                      aria-label="Collapse Radius Slider"
                    >
                      <CaretDown size={14} weight="bold" />
                    </button>
                  </div>
                </div>

                {/* Slider Track */}
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={effectiveRadiusKm}
                  onChange={(e) => handleRadiusChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                  aria-label="Location Radius Ring Slider"
                />

                {/* Scale & Quick Presets */}
                <div className="flex items-center justify-between mt-1 text-[10px] font-semibold text-zinc-400">
                  <span>1 km</span>
                  <div className="flex items-center gap-1">
                    {[2, 5, 10, 15].map((km) => (
                      <button
                        key={km}
                        type="button"
                        onClick={() => handleRadiusChange(km)}
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${Math.abs(effectiveRadiusKm - km) < 0.25
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                          }`}
                      >
                        {km}k
                      </button>
                    ))}
                  </div>
                  <span>20 km</span>
                </div>
              </div>
            )
          )}

                  {/* Layer Visibility Toolbar (Gray Container with Title & Tooltips) */}
                  <div className="flex items-center p-1.5 rounded-2xl bg-zinc-200/90 backdrop-blur-xl border border-zinc-300/80 shadow-xl gap-1.5">
                    {/* Title */}
                    <div className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-zinc-600 border-r border-zinc-300/90 select-none">
                      <Stack size={14} weight="bold" className="text-zinc-700" />
                      <span>Layers</span>
                    </div>

                      {/* 1. Basemap Switcher */}
                      <div className="relative group/layer-btn">
                        <button
                          onClick={() => setMapStyle(mapStyle === 'canvas' ? 'osm' : 'canvas')}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150 ${mapStyle === 'osm'
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-400/30'
                              : 'bg-white/95 hover:bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-300/80 shadow-2xs hover:shadow-xs'
                            }`}
                          aria-label={`Switch Basemap (Current: ${mapStyle === 'canvas' ? 'Clean Canvas' : 'Detailed Streets'})`}
                        >
                          <MapTrifold size={16} weight={mapStyle === 'osm' ? 'fill' : 'bold'} />
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-xl bg-zinc-950/95 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/layer-btn:opacity-100 pointer-events-none shadow-xl transition-all duration-150 z-50 border border-white/10">
                          Basemap: {mapStyle === 'canvas' ? 'Clean Canvas' : 'Detailed Streets'}
                        </div>
                      </div>

                      {/* 2. Noise Radar Heatmap Toggle */}
                      <div className="relative group/layer-btn">
                        <button
                          onClick={() => setShowNoiseRadar(!showNoiseRadar)}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150 ${showNoiseRadar
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-400/30'
                              : 'bg-white/95 hover:bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-300/80 shadow-2xs hover:shadow-xs'
                            }`}
                          aria-label="Toggle Noise Radar Layer"
                        >
                          <SpeakerHigh size={16} weight={showNoiseRadar ? 'fill' : 'bold'} />
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-xl bg-zinc-950/95 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/layer-btn:opacity-100 pointer-events-none shadow-xl transition-all duration-150 z-50 border border-white/10">
                          Noise Radar: {showNoiseRadar ? 'Visible' : 'Hidden'}
                        </div>
                      </div>

                {/* 3. Proximity Anchors Toggle */}
                <div className="relative group/layer-btn">
                  <button
                    onClick={() => setShowAnchors(!showAnchors)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150 ${showAnchors
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-400/30'
                        : 'bg-white/95 hover:bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-300/80 shadow-2xs hover:shadow-xs'
                      }`}
                    aria-label="Toggle Proximity Anchors Layer"
                  >
                    <Target size={16} weight={showAnchors ? 'fill' : 'bold'} />
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-xl bg-zinc-950/95 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/layer-btn:opacity-100 pointer-events-none shadow-xl transition-all duration-150 z-50 border border-white/10">
                    Commute Anchors: {showAnchors ? 'Visible' : 'Hidden'}
                  </div>
                </div>

                {/* 4. Radius Buffer Ring Toggle */}
                {showAnchors && (
                  <div className="relative group/layer-btn">
                    <button
                      onClick={() => setShowRadius(!showRadius)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150 ${showRadius
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-400/30'
                          : 'bg-white/95 hover:bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-300/80 shadow-2xs hover:shadow-xs'
                        }`}
                      aria-label="Toggle Radius Buffer Ring"
                    >
                      <CircleDashed size={16} weight={showRadius ? 'fill' : 'bold'} />
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-xl bg-zinc-950/95 text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/layer-btn:opacity-100 pointer-events-none shadow-xl transition-all duration-150 z-50 border border-white/10">
                      Radius Ring: {showRadius ? 'Visible' : 'Hidden'}
                    </div>
                  </div>
                )}
              </div>
            </div>
    </div>
        );
};
