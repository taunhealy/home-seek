'use client';

import React, { useState, useRef, useCallback } from 'react';
import { 
  Eye, 
  ArrowsLeftRight, 
  Sparkle, 
  Ruler, 
  WarningCircle, 
  CheckCircle,
  X,
  CircleNotch
} from '@phosphor-icons/react';

interface RealViewSliderProps {
  originalImageUrl: string;
  listingTitle?: string;
  onClose?: () => void;
}

interface SpatialAnalysis {
  is_distorted?: boolean;
  distortion_level?: 'low' | 'moderate' | 'severe';
  distortion_indicators?: string[];
  estimated_room_dimensions?: string;
  reality_summary?: string;
  furniture_fit?: string[];
}

export function RealViewSlider({ originalImageUrl, listingTitle, onClose }: RealViewSliderProps) {
  const [sliderPosition, setSliderPosition] = useState<number>(50); // percentage 0-100
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<SpatialAnalysis | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Backend rectified endpoint URL
  const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const rectifiedImageUrl = `${backendBase}/api/realview/rectify?url=${encodeURIComponent(originalImageUrl)}`;

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percent);
  }, []);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  const runSpatialCheck = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${backendBase}/api/realview/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: originalImageUrl, room_type: 'room' })
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
      }
    } catch (e) {
      console.warn("RealView analysis error:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border border-zinc-200 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-zinc-200 flex items-center justify-between shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-xs font-semibold mb-1">
              <Eye size={13} weight="fill" className="text-zinc-900" />
              <span>RealView™ Lens Rectifier</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-zinc-950">
              {listingTitle || 'De-Distort Ultra-Wide Angle Lens'}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Drag the slider to compare the agent&apos;s 0.5x ultra-wide photo against true human-eye proportions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runSpatialCheck}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <CircleNotch size={14} className="animate-spin text-zinc-600" />
                  <span>Auditing Scale...</span>
                </>
              ) : (
                <>
                  <Sparkle size={14} weight="fill" className="text-amber-500" />
                  <span>AI Scale Reality Check</span>
                </>
              )}
            </button>

            {onClose && (
              <button 
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors"
              >
                <X size={18} weight="bold" />
              </button>
            )}
          </div>
        </div>

        {/* Interactive Comparison Viewport */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div 
            ref={containerRef}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onMouseMove={handleMouseMove}
            onTouchMove={handleTouchMove}
            className="relative w-full h-[360px] sm:h-[420px] rounded-2xl overflow-hidden select-none cursor-ew-resize bg-zinc-900 shadow-inner"
          >
            {/* Background Image: Original Agent 0.5x Wide-Angle */}
            <img 
              src={originalImageUrl} 
              alt="Agent wide-angle view"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
            <div className="absolute top-4 left-4 z-10 px-2.5 py-1 rounded-lg bg-zinc-950/80 backdrop-blur-md text-white text-[11px] font-bold tracking-wide uppercase">
              Agent 0.5x Wide Angle (Stretched)
            </div>

            {/* Foreground Image: Rectified Human Eye 1.0x View */}
            <div 
              style={{ width: `${sliderPosition}%` }}
              className="absolute inset-0 h-full overflow-hidden border-r-2 border-white shadow-2xl pointer-events-none"
            >
              <img 
                src={rectifiedImageUrl} 
                alt="Human eye natural view"
                className="absolute inset-0 w-full h-full object-cover max-w-none pointer-events-none"
                style={{ width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%' }}
              />
              <div className="absolute top-4 left-4 z-10 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold tracking-wide uppercase shadow-sm">
                Human Eye 1.0x RealView™
              </div>
            </div>

            {/* Slider Divider Handle */}
            <div 
              style={{ left: `${sliderPosition}%` }}
              className="absolute top-0 bottom-0 -ml-3 w-6 flex items-center justify-center pointer-events-none z-20"
            >
              <div className="w-8 h-8 rounded-full bg-white text-zinc-900 shadow-lg flex items-center justify-center border border-zinc-200">
                <ArrowsLeftRight size={14} weight="bold" />
              </div>
            </div>
          </div>

          {/* AI Spatial Reality Results (If Triggered) */}
          {analysis && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3">
                <div className="flex items-center gap-2">
                  <Ruler size={16} className="text-zinc-700" />
                  <span className="font-bold text-sm text-zinc-950">Architectural Scale Audit</span>
                </div>
                {analysis.estimated_room_dimensions && (
                  <span className="px-3 py-1 rounded-xl bg-zinc-950 text-white text-xs font-bold">
                    Est. True Size: {analysis.estimated_room_dimensions}
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-800 leading-relaxed font-medium">
                {analysis.reality_summary}
              </p>

              {analysis.furniture_fit && analysis.furniture_fit.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    Furniture & Work-From-Home Clearance:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {analysis.furniture_fit.map((item, idx) => (
                      <div key={idx} className="bg-white border border-zinc-200/80 rounded-xl p-2.5 flex items-start gap-2 text-zinc-700">
                        <CheckCircle size={14} className="text-zinc-400 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Helper Explainer */}
          <div className="flex items-start gap-2 text-[11px] text-zinc-500 bg-zinc-50 p-3 rounded-xl border border-zinc-200/60">
            <WarningCircle size={14} className="text-zinc-400 mt-0.5 shrink-0" />
            <span>
              RealView™ mathematically counteracts radial barrel bowing and edge stretching used by 13-16mm ultra-wide smartphone lenses, restoring square door angles and true bed widths.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

