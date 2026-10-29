'use client';

import React, { useState, useEffect } from 'react';
import { 
  CaretLeft, 
  CaretRight, 
  Eye, 
  Sparkle, 
  CheckCircle,
  ShieldCheck,
  CircleNotch
} from '@phosphor-icons/react';

interface ListingImageGalleryProps {
  initialImage: string | null;
  listingUrl: string;
  title: string;
  onOpenRealViewSlider?: (url: string) => void;
}

export function ListingImageGallery({
  initialImage,
  listingUrl,
  title,
  onOpenRealViewSlider
}: ListingImageGalleryProps) {
  const [photos, setPhotos] = useState<string[]>(initialImage ? [initialImage] : []);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);

  const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Helper to get rectified derivative image URL
  const getRectifiedUrl = (rawUrl: string) => {
    return `${backendBase}/api/realview/rectify?url=${encodeURIComponent(rawUrl)}`;
  };

  // Fetch full listing photos on mount
  useEffect(() => {
    let isMounted = true;
    const fetchPhotos = async () => {
      if (!listingUrl) return;
      try {
        setIsLoadingPhotos(true);
        const res = await fetch(`${backendBase}/api/listing-photos?url=${encodeURIComponent(listingUrl)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && Array.isArray(data.photos) && data.photos.length > 0) {
            if (isMounted) {
              setPhotos(data.photos);
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch listing gallery photos:", err);
      } finally {
        if (isMounted) setIsLoadingPhotos(false);
      }
    };

    fetchPhotos();
    return () => {
      isMounted = false;
    };
  }, [listingUrl, backendBase]);

  const currentRawUrl = photos[currentIndex] || initialImage || '';
  const currentRectifiedUrl = currentRawUrl ? getRectifiedUrl(currentRawUrl) : '';

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgError(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgError(false);
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  if (!currentRawUrl) {
    return (
      <div className="w-full h-48 rounded-2xl bg-zinc-100 flex items-center justify-center text-xs text-zinc-400">
        No preview photo available
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Main Large Transformed Preview */}
      <div className="relative w-full h-52 sm:h-64 rounded-2xl overflow-hidden bg-zinc-950 group select-none shadow-2xs border border-zinc-200">
        <img
          src={imgError ? currentRawUrl : currentRectifiedUrl}
          alt={`${title} - Photo ${currentIndex + 1}`}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-opacity duration-300"
        />

        {/* Protection / Derivative Transformation Badge */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/80 backdrop-blur-md text-white text-[10px] font-bold tracking-wider uppercase shadow-sm">
          <ShieldCheck size={13} weight="bold" className="text-emerald-400" />
          <span>RealView™ Rectified (1.0x Eye View)</span>
        </div>

        {/* Photo Counter */}
        <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold">
          {currentIndex + 1} / {photos.length}
        </div>

        {/* Navigation Arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              aria-label="Previous photo"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-zinc-900 flex items-center justify-center shadow-md transition-all opacity-80 hover:opacity-100"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <button
              onClick={handleNext}
              aria-label="Next photo"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-zinc-900 flex items-center justify-center shadow-md transition-all opacity-80 hover:opacity-100"
            >
              <CaretRight size={16} weight="bold" />
            </button>
          </>
        )}

        {/* Action Button: Open Interactive Before/After Lens Slider */}
        {onOpenRealViewSlider && (
          <button
            onClick={() => onOpenRealViewSlider(currentRawUrl)}
            className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white text-zinc-950 text-xs font-bold shadow-lg transition-transform hover:scale-102"
          >
            <Eye size={14} weight="bold" className="text-zinc-900" />
            <span>Before / After Slider</span>
          </button>
        )}
      </div>

      {/* Thumbnail Strip / Slider */}
      {photos.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-zinc-300">
          {photos.map((photoUrl, idx) => {
            const isSelected = idx === currentIndex;
            const thumbRectifiedUrl = getRectifiedUrl(photoUrl);
            return (
              <button
                key={idx}
                onClick={() => {
                  setImgError(false);
                  setCurrentIndex(idx);
                }}
                className={`relative w-14 h-11 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                  isSelected ? 'border-zinc-950 ring-2 ring-zinc-950/20 scale-102' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={thumbRectifiedUrl}
                  alt={`Thumbnail ${idx + 1}`}
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

