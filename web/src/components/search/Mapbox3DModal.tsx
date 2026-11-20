'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Compass,
  Cube,
  Eye,
  GlobeHemisphereWest,
  Pause,
  Play,
  Sun,
  X,
} from '@phosphor-icons/react';
import { apiUrl } from '@/lib/apiClient';

export interface Mapbox3DTarget {
  id?: string;
  title: string;
  address?: string;
  lat: number;
  lng: number;
  price?: number;
}

interface Mapbox3DModalProps {
  target: Mapbox3DTarget | null;
  onClose: () => void;
}

type SunMode = 'live' | 'winter' | 'summer';

function getCapeTownNow(): { hour: number; dayOfYear: number; timeLabel: string } {
  const now = new Date();
  // Format in Africa/Johannesburg (SAST, UTC+2) so it works regardless of viewer timezone
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const getNum = (type: string, fallback: number) => {
    const v = parts.find((p) => p.type === type)?.value;
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };

  const year = getNum('year', now.getFullYear());
  const month = getNum('month', now.getMonth() + 1);
  const day = getNum('day', now.getDate());
  const h = getNum('hour', now.getHours()) % 24;
  const m = getNum('minute', now.getMinutes());

  const startOfYear = Date.UTC(year, 0, 0);
  const currentUtc = Date.UTC(year, month - 1, day);
  const dayOfYear = Math.max(1, Math.min(366, Math.floor((currentUtc - startOfYear) / 86400000)));

  return {
    hour: h + m / 60,
    dayOfYear,
    timeLabel: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  };
}

function computeCapeTownSunLight(
  sastHour: number,
  mode: SunMode,
  lat = -33.92,
  lng = 18.42,
  liveDayOfYear?: number
): {
  azimuth: number;
  polar: number;
  altitudeDeg: number;
  isNight: boolean;
  color: string;
  intensity: number;
} {
  // Day of year: Jun 21 (Southern Winter Solstice = 172), Dec 21 (Southern Summer Solstice = 355), or today
  const dayOfYear =
    mode === 'winter' ? 172 : mode === 'summer' ? 355 : (liveDayOfYear ?? getCapeTownNow().dayOfYear);

  const deg2rad = Math.PI / 180;
  const rad2deg = 180 / Math.PI;

  // Solar declination
  const declRad = 23.44 * deg2rad * Math.sin(((2 * Math.PI) / 365) * (284 + dayOfYear));
  const latRad = lat * deg2rad;

  // SAST is UTC+2 (standard meridian 30°E); Cape Town (~18.4°E) solar noon is ~12:46 SAST
  const solarHour = sastHour + (lng - 30) / 15;
  const hourAngleRad = (solarHour - 12) * 15 * deg2rad;

  const sinAlt =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);
  const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const altitudeDeg = altRad * rad2deg;

  const cosAlt = Math.max(0.0001, Math.cos(altRad));
  const cosAz = Math.max(
    -1,
    Math.min(1, (Math.sin(declRad) - Math.sin(altRad) * Math.sin(latRad)) / (cosAlt * Math.cos(latRad)))
  );
  let azimuth = Math.acos(cosAz) * rad2deg;
  if (hourAngleRad > 0) {
    azimuth = (360 - azimuth) % 360;
  }

  const isNight = altitudeDeg <= 0;
  const polar = isNight ? 88 : Math.max(6, Math.min(86, 90 - altitudeDeg));
  const isGolden = !isNight && altitudeDeg < 18;

  return {
    azimuth,
    polar,
    altitudeDeg: Math.round(altitudeDeg),
    isNight,
    color: isNight ? '#3b4d71' : isGolden ? '#ffd2a1' : '#ffffff',
    intensity: isNight ? 0.22 : isGolden ? 0.65 : 0.45,
  };
}

export const Mapbox3DModal: React.FC<Mapbox3DModalProps> = ({ target, onClose }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const orbitFrameRef = useRef<number | null>(null);

  const [token, setToken] = useState<string | null>(process.env.NEXT_PUBLIC_MAPBOX_TOKEN || null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'streets'>('satellite');
  const [sunMode, setSunMode] = useState<SunMode>('live');
  const [isLiveClock, setIsLiveClock] = useState<boolean>(true);
  const [liveNow, setLiveNow] = useState(() => getCapeTownNow());
  const [manualHour, setManualHour] = useState<number>(() => Math.max(5.5, Math.min(20, getCapeTownNow().hour)));
  const [isOrbiting, setIsOrbiting] = useState<boolean>(false);
  const [is3DReady, setIs3DReady] = useState<boolean>(false);

  const activeHour = isLiveClock ? liveNow.hour : manualHour;

  // Keep real-time Cape Town clock updated every 30s while Live mode is active
  useEffect(() => {
    if (!target || !isLiveClock) return;
    setLiveNow(getCapeTownNow());
    const id = setInterval(() => {
      setLiveNow(getCapeTownNow());
    }, 30000);
    return () => clearInterval(id);
  }, [target, isLiveClock]);

  // Fetch public pk.* token from backend if not in NEXT_PUBLIC_MAPBOX_TOKEN
  useEffect(() => {
    if (!target) return;
    if (token && token.startsWith('pk.')) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/config/mapbox'));
        const data = await res.json();
        if (!cancelled) {
          if (data?.token && String(data.token).startsWith('pk.')) {
            setToken(data.token);
            setTokenError(null);
          } else {
            setTokenError('Mapbox public token (pk.*) not configured.');
          }
        }
      } catch {
        if (!cancelled) setTokenError('Could not load Mapbox configuration.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target, token]);

    const apply3DLayersAndLight = (
      map: mapboxgl.Map,
      currentHour: number,
      currentMode: SunMode,
      lat: number,
      lng: number,
      dayOfYear: number
    ) => {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.35 });

      const sun = computeCapeTownSunLight(currentHour, currentMode, lat, lng, dayOfYear);

      if (!map.getLayer('sky')) {
        map.addLayer({
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [sun.azimuth, sun.polar],
            'sky-atmosphere-sun-intensity': sun.isNight ? 2 : 12,
          },
        });
      } else {
        map.setPaintProperty('sky', 'sky-atmosphere-sun', [sun.azimuth, sun.polar]);
        map.setPaintProperty('sky', 'sky-atmosphere-sun-intensity', sun.isNight ? 2 : 12);
      }

      if (map.getSource('composite') && !map.getLayer('3d-buildings')) {
        const layers = map.getStyle()?.layers || [];
        const labelLayerId = layers.find((l) => l.type === 'symbol' && l.layout && (l.layout as any)['text-field'])?.id;
        map.addLayer(
          {
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': '#cbd5e1',
              'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.5, ['get', 'height']],
              'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.5, ['get', 'min_height']],
              'fill-extrusion-opacity': 0.72,
            },
          },
          labelLayerId
        );
      }

      map.setLight({
        anchor: 'map',
        position: [1.5, sun.azimuth, sun.polar],
        color: sun.color,
        intensity: sun.intensity,
      });
    };

    // Initialize Mapbox GL JS 3D Map on-demand
    useEffect(() => {
      if (!target || !token || !mapContainerRef.current) return;
    setIs3DReady(false);

      mapboxgl.accessToken = token;
      const styleUrl =
        mapStyle === 'satellite'
          ? 'mapbox://styles/mapbox/satellite-streets-v12'
          : 'mapbox://styles/mapbox/streets-v12';

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: styleUrl,
        center: [target.lng, target.lat],
        zoom: 16.4,
        pitch: 64,
        bearing: -25,
        antialias: true,
      });

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

      new mapboxgl.Marker({ color: '#4f46e5' })
        .setLngLat([target.lng, target.lat])
        .addTo(map);

      map.on('style.load', () => {
        apply3DLayersAndLight(map, activeHour, sunMode, target.lat, target.lng, liveNow.dayOfYear);
        setIs3DReady(true);
      });

      mapRef.current = map;

      return () => {
        if (orbitFrameRef.current) cancelAnimationFrame(orbitFrameRef.current);
        orbitFrameRef.current = null;
        map.remove();
        mapRef.current = null;
      };
      // Only re-init when target or token changes; style changes handled below
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target?.lat, target?.lng, token]);

    // Update basemap style without losing camera
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      const styleUrl =
        mapStyle === 'satellite'
          ? 'mapbox://styles/mapbox/satellite-streets-v12'
          : 'mapbox://styles/mapbox/streets-v12';
      map.setStyle(styleUrl);
    }, [mapStyle]);

    // Update Sun / Shadow angle dynamically
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !target || !map.isStyleLoaded()) return;
      const sun = computeCapeTownSunLight(activeHour, sunMode, target.lat, target.lng, liveNow.dayOfYear);
      if (map.getLayer('sky')) {
        map.setPaintProperty('sky', 'sky-atmosphere-sun', [sun.azimuth, sun.polar]);
        map.setPaintProperty('sky', 'sky-atmosphere-sun-intensity', sun.isNight ? 2 : 12);
      }
      map.setLight({
        anchor: 'map',
        position: [1.5, sun.azimuth, sun.polar],
        color: sun.color,
        intensity: sun.intensity,
      });
  }, [activeHour, sunMode, target?.lat, target?.lng, liveNow.dayOfYear]);

  // Smooth 3D Orbit animation
  useEffect(() => {
    const map = mapRef.current;
    if (!isOrbiting || !map) {
      if (orbitFrameRef.current) cancelAnimationFrame(orbitFrameRef.current);
      orbitFrameRef.current = null;
      return;
    }
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      map.rotateTo((map.getBearing() + dt * 10) % 360, { duration: 0 });
      orbitFrameRef.current = requestAnimationFrame(tick);
    };
    orbitFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (orbitFrameRef.current) cancelAnimationFrame(orbitFrameRef.current);
    };
  }, [isOrbiting]);

  if (!target) return null;

  const sunInfo = computeCapeTownSunLight(activeHour, sunMode, target.lat, target.lng, liveNow.dayOfYear);
  const wholeHours = Math.floor(activeHour) % 24;
  const wholeMins = Math.round((activeHour - Math.floor(activeHour)) * 60) % 60;
  const hourStr = isLiveClock
    ? liveNow.timeLabel
    : `${String(wholeHours).padStart(2, '0')}:${String(wholeMins).padStart(2, '0')}`;

  return (
    <div
      className="fixed inset-0 z-[140] bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[85vh] bg-zinc-950 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="px-4 py-3 bg-zinc-900/95 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Cube size={18} weight="fill" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-white truncate">{target.title}</div>
              <div className="text-[11px] text-zinc-400 truncate">
                {target.address || `${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}`}
                {target.price ? ` · R ${target.price.toLocaleString()}/mo` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            {/* Style Switch */}
            <button
              type="button"
              onClick={() => setMapStyle(mapStyle === 'satellite' ? 'streets' : 'satellite')}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
            >
              <GlobeHemisphereWest size={14} weight="bold" className="text-emerald-400" />
              <span>{mapStyle === 'satellite' ? 'Satellite 3D' : 'Streets 3D'}</span>
            </button>

            {/* Camera Presets */}
            <button
              type="button"
              onClick={() => {
                setIsOrbiting(false);
                mapRef.current?.flyTo({ center: [target.lng, target.lat], zoom: 17.5, pitch: 76, duration: 900 });
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
              title="Tilt down to check real horizon & neighbouring building sightlines"
            >
              <Eye size={14} weight="bold" className="text-sky-400" />
              <span>Sightline</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOrbiting(false);
                mapRef.current?.flyTo({ center: [target.lng, target.lat], zoom: 18.3, pitch: 22, duration: 900 });
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
              title="Inspect roof, main house & driveway layout from above"
            >
              <Compass size={14} weight="bold" className="text-amber-300" />
              <span>Driveway / Roof</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOrbiting(!isOrbiting)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${isOrbiting ? 'bg-indigo-600 text-white' : 'bg-white/10 hover:bg-white/15 text-white'
                }`}
            >
              {isOrbiting ? <Pause size={13} weight="fill" /> : <Play size={13} weight="fill" />}
              <span>{isOrbiting ? 'Stop Orbit' : 'Orbit'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-600 text-white cursor-pointer transition-colors"
              aria-label="Close 3D Preview"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>

        {/* 3D Canvas */}
        <div className="relative flex-1 w-full bg-zinc-900">
          {tokenError ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-rose-300 font-semibold">
              {tokenError}
            </div>
          ) : (
            <>
              <div ref={mapContainerRef} className="w-full h-full" />
              {!is3DReady && (
                <div className="absolute inset-0 bg-zinc-900/85 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-20 pointer-events-none">
                  <div className="w-9 h-9 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                  <p className="text-xs font-bold text-zinc-200 tracking-wide">
                    Loading 3D Terrain, Buildings &amp; Sun Angle...
                  </p>
                </div>
              )}
            </>
          )}

          {/* Bottom Sun & Shadow Simulator Bar */}
            <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-[460px] bg-zinc-950/90 backdrop-blur-md border border-white/15 rounded-2xl p-3 space-y-2 shadow-2xl">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-extrabold text-white flex items-center gap-1.5">
                  <Sun size={15} weight="fill" className="text-amber-400" />
                  <span>Sun &amp; Mountain Shadow</span>
                </span>
                <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      const fresh = getCapeTownNow();
                      setLiveNow(fresh);
                      setSunMode('live');
                      setIsLiveClock(true);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 cursor-pointer ${sunMode === 'live' && isLiveClock
                        ? 'bg-emerald-400 text-zinc-950'
                        : 'text-zinc-300 hover:text-white'
                      }`}
                    title="Use real-time Cape Town SAST clock & today's exact sun angle"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${sunMode === 'live' && isLiveClock ? 'bg-zinc-950 animate-pulse' : 'bg-emerald-400'
                        }`}
                    />
                    <span>Live</span>
                  </button>
                  {(['winter', 'summer'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSunMode(s)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold capitalize cursor-pointer ${sunMode === s ? 'bg-amber-400 text-zinc-950' : 'text-zinc-300 hover:text-white'
                        }`}
                    >
                      {s === 'winter' ? 'Winter (Jun)' : 'Summer (Dec)'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={5.5}
                  max={20}
                  step={0.25}
                  value={Math.max(5.5, Math.min(20, activeHour))}
                  onChange={(e) => {
                    setIsLiveClock(false);
                    setManualHour(parseFloat(e.target.value));
                  }}
                  className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <span className="text-[11px] font-black text-amber-300 tabular-nums whitespace-nowrap">
                  {hourStr} SAST · {sunInfo.isNight ? 'Night' : `${sunInfo.altitudeDeg}° alt`}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">
                {isLiveClock
                  ? 'Synced to real-time Cape Town SAST · Drag slider to scrub sun & mountain shadows'
                  : 'Manual sun preview · Click Live to snap back to real-time Cape Town sun'}
              </p>
            </div>
          </div>
        </div>
      </div>
      );
};
