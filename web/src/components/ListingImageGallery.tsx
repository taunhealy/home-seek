'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  CaretLeft, 
  CaretRight, 
  Eye, 
  Sparkle, 
  CheckCircle,
  ShieldCheck,
  CircleNotch,
  Image as ImageIcon
} from '@phosphor-icons/react';

const ARCHITECTURAL_FALLBACK = "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80";

// Global in-memory cache and inflight tracker to eliminate duplicate requests across cards
const clientPhotosCache = new Map<string, string[]>();
const inflightFetchQueue = new Set<string>();

interface ListingImageGalleryProps {
  initialImage?: string | null;
  images?: string[];
  listingUrl: string;
  title: string;
  onOpenRealViewSlider?: (url: string) => void;
}

export function ListingImageGallery({
  initialImage,
  images = [],
  listingUrl,
  title,
  onOpenRealViewSlider
}: ListingImageGalleryProps) {
  // Compute initial photos array
  const seedPhotos = React.useMemo(() => {
    if (clientPhotosCache.has(listingUrl)) {
      return clientPhotosCache.get(listingUrl)!;
    }
    if (Array.isArray(images) && images.length > 0) {
      return images.filter(Boolean);
    }
    if (initialImage && initialImage.trim() !== '') {
      return [initialImage];
    }
    return [];
  }, [initialImage, images, listingUrl]);

  const [photos, setPhotos] = useState<string[]>(seedPhotos);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);
  const [rawImgError, setRawImgError] = useState<boolean>(false);
  const hasTriggeredFullFetch = useRef<boolean>(false);

  const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Helper to get rectified derivative image URL
  const getRectifiedUrl = (rawUrl: string) => {
    if (!rawUrl || rawUrl.includes('unsplash.com')) return rawUrl;
    return `${backendBase}/api/realview/rectify?url=${encodeURIComponent(rawUrl)}`;
  };

  // Sync seed photos if props change
  useEffect(() => {
    if (photos.length === 0 && seedPhotos.length > 0) {
      setPhotos(seedPhotos);
    }
  }, [seedPhotos]);

  // Polite, on-demand gallery loader (prevents concurrent DDoS on mount)
  const fetchFullGallerySafely = async () => {
    if (!listingUrl || hasTriggeredFullFetch.current) return;
    if (clientPhotosCache.has(listingUrl)) {
      setPhotos(clientPhotosCache.get(listingUrl)!);
      return;
    }
    if (inflightFetchQueue.has(listingUrl)) return;

    try {
      hasTriggeredFullFetch.current = true;
      inflightFetchQueue.add(listingUrl);
      setIsLoadingPhotos(true);

      const res = await fetch(`${backendBase}/api/listing-photos?url=${encodeURIComponent(listingUrl)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.photos) && data.photos.length > 0) {
          clientPhotosCache.set(listingUrl, data.photos);
          setPhotos(data.photos);
        }
      }
    } catch (err) {
      console.warn("Polite gallery fetch skipped:", err);
    } finally {
      inflightFetchQueue.delete(listingUrl);
      setIsLoadingPhotos(false);
    }
  };

  // Only auto-fetch on mount if the listing has NO initial image at all
  useEffect(() => {
    if (!seedPhotos || seedPhotos.length === 0) {
      const timer = setTimeout(() => {
        fetchFullGallerySafely();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [listingUrl, seedPhotos.length]);

  const effectivePhotos = photos.length > 0 ? photos : [ARCHITECTURAL_FALLBACK];
  const currentRawUrl = effectivePhotos[currentIndex] || ARCHITECTURAL_FALLBACK;
  const currentRectifiedUrl = currentRawUrl ? getRectifiedUrl(currentRawUrl) : ARCHITECTURAL_FALLBACK;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgError(false);
    setRawImgError(false);
    // User interacted: fetch full gallery if we only have 1 photo
    if (photos.length <= 1) fetchFullGallerySafely();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : effectivePhotos.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgError(false);
    setRawImgError(false);
    // User interacted: fetch full gallery if we only have 1 photo
    if (photos.length <= 1) fetchFullGallerySafely();
    setCurrentIndex((prev) => (prev < effectivePhotos.length - 1 ? prev + 1 : 0));
  };

  // If loading and we have no photos yet, show an elegant pulse skeleton
  if (isLoadingPhotos && photos.length === 0 && !initialImage) {
    return (
      <div className="w-full h-52 sm:h-64 rounded-2xl bg-zinc-100 border border-zinc-200 animate-pulse flex flex-col items-center justify-center gap-2 text-zinc-400">
        <CircleNotch size={24} className="animate-spin text-zinc-400" />
        <span className="text-xs font-semibold text-zinc-500">Retrieving interior photos...</span>
      </div>
    );
  }

  // Display photo URL resolution with multi-level graceful fallback
  let displaySrc = currentRectifiedUrl;
  if (imgError) {
    displaySrc = rawImgError ? ARCHITECTURAL_FALLBACK : currentRawUrl;
  }

  return (
    <div 
      className="space-y-2.5"
      onMouseEnter={() => {
        // Prefetch full photos on intentional user hover if only single preview photo exists
        if (photos.length <= 1) {
          fetchFullGallerySafely();
        }
      }}
    >
      {/* Main Large Transformed Preview */}
      <div className="relative w-full h-52 sm:h-64 rounded-2xl overflow-hidden bg-zinc-950 group select-none shadow-2xs border border-zinc-200">
        <img
          src={displaySrc}
          alt={`${title} - Photo ${currentIndex + 1}`}
          onError={() => {
            if (!imgError) {
              setImgError(true);
            } else {
              setRawImgError(true);
            }
          }}
          className="w-full h-full object-cover transition-opacity duration-300"
        />

        {/* Protection / Derivative Transformation Badge */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/80 backdrop-blur-md text-white text-[10px] font-bold tracking-wider uppercase shadow-sm">
          <ShieldCheck size={13} weight="bold" className="text-emerald-400" />
          <span>RealView™ Rectified (1.0x Eye View)</span>
        </div>

        {/* Photo Counter */}
        <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold">
          {currentIndex + 1} / {effectivePhotos.length}
        </div>

        {/* Navigation Arrows */}
        {effectivePhotos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              aria-label="Previous photo"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-zinc-900 flex items-center justify-center shadow-md transition-all opacity-80 hover:opacity-100 cursor-pointer"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <button
              onClick={handleNext}
              aria-label="Next photo"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-zinc-900 flex items-center justify-center shadow-md transition-all opacity-80 hover:opacity-100 cursor-pointer"
            >
              <CaretRight size={16} weight="bold" />
            </button>
          </>
        )}

        {/* Action Button: Open Interactive Before/After Lens Slider */}
        {onOpenRealViewSlider && (
          <button
            onClick={() => onOpenRealViewSlider(currentRawUrl)}
            className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white text-zinc-950 text-xs font-bold shadow-lg transition-transform hover:scale-102 cursor-pointer"
          >
            <Eye size={14} weight="bold" className="text-zinc-900" />
            <span>Before / After Slider</span>
          </button>
        )}
      </div>

      {/* Thumbnail Strip / Slider */}
      {effectivePhotos.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {effectivePhotos.map((photoUrl, idx) => {
            const isSelected = idx === currentIndex;
            const thumbRectifiedUrl = getRectifiedUrl(photoUrl);
            return (
              <button
                key={idx}
                onClick={() => {
                  setImgError(false);
                  setRawImgError(false);
                  setCurrentIndex(idx);
                }}
                className={`relative w-14 h-11 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  isSelected ? 'border-zinc-950 ring-2 ring-zinc-950/20 scale-102' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={thumbRectifiedUrl}
                  alt={`Thumbnail ${idx + 1}`}
                  onError={(e) => {
                    // Fall back to raw URL if rectified thumbnail fails
                    (e.target as HTMLImageElement).src = photoUrl;
                  }}
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
          {isLoadingPhotos && (
            <div className="w-14 h-11 shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center">
              <CircleNotch size={14} className="animate-spin text-zinc-400" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
