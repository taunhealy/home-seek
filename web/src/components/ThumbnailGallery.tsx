'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CaretLeft, CaretRight, CircleNotch } from '@phosphor-icons/react';

const ARCHITECTURAL_FALLBACK = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80';

// Curated architectural interior perspectives to supplement single-image listings
const SUPPLEMENTAL_INTERIORS = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80', // Lounge / Living
  'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop&q=80', // Chef Kitchen
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80', // Bedroom
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80', // Bathroom
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80'  // Balcony / View
];

// Global client cache and inflight tracker across all thumbnail cards
const clientPhotosCache = new Map<string, string[]>();
const inflightFetchQueue = new Set<string>();

interface ThumbnailGalleryProps {
  initialImage?: string | null;
  images?: string[];
  listingUrl?: string;
  title: string;
  aspectClassName?: string;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  priceBadge?: React.ReactNode;
  bottomBanner?: React.ReactNode;
  className?: string;
}

export function ThumbnailGallery({
  initialImage,
  images = [],
  listingUrl,
  title,
  aspectClassName = 'h-48 sm:h-52',
  badges,
  actions,
  priceBadge,
  bottomBanner,
  className = ''
}: ThumbnailGalleryProps) {
  // Determine seed photos
  const seedPhotos = React.useMemo(() => {
    if (listingUrl && clientPhotosCache.has(listingUrl)) {
      return clientPhotosCache.get(listingUrl)!;
    }
    if (Array.isArray(images) && images.length > 1) {
      return images.filter(Boolean);
    }
    const primary = (Array.isArray(images) && images[0]) || initialImage || ARCHITECTURAL_FALLBACK;
    // Provide full multi-photo experience by combining primary image with supplemental interior perspectives
    return [primary, ...SUPPLEMENTAL_INTERIORS.slice(0, 4)];
  }, [initialImage, images, listingUrl]);

  const [photos, setPhotos] = useState<string[]>(seedPhotos);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState<boolean>(false);
  const hasTriggeredFetch = useRef<boolean>(false);
  const touchStartX = useRef<number | null>(null);

  const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Sync seed photos when props change
  useEffect(() => {
    if (listingUrl && clientPhotosCache.has(listingUrl)) {
      setPhotos(clientPhotosCache.get(listingUrl)!);
    } else {
      setPhotos(seedPhotos);
    }
  }, [seedPhotos, listingUrl]);

  // Polite on-demand photo fetcher from Property24/PrivateProperty
  const fetchFullPhotosSafely = async () => {
    if (!listingUrl || hasTriggeredFetch.current) return;
    if (clientPhotosCache.has(listingUrl)) {
      setPhotos(clientPhotosCache.get(listingUrl)!);
      return;
    }
    if (inflightFetchQueue.has(listingUrl)) return;

    try {
      hasTriggeredFetch.current = true;
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
      // Keep existing photos fallback gracefully
    } finally {
      inflightFetchQueue.delete(listingUrl);
      setIsLoadingPhotos(false);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    fetchFullPhotosSafely();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    fetchFullPhotosSafely();
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 40) {
      // Swiped left -> next photo
      setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
    } else if (diff < -40) {
      // Swiped right -> prev photo
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
    }
    touchStartX.current = null;
  };

  const currentPhoto = photos[currentIndex] || ARCHITECTURAL_FALLBACK;

  // Windowed pagination dots (up to 5 dots visible)
  const maxDots = 5;
  const numPhotos = photos.length;
  let dotIndices: number[] = [];
  if (numPhotos <= maxDots) {
    dotIndices = Array.from({ length: numPhotos }, (_, i) => i);
  } else {
    let start = Math.max(0, currentIndex - Math.floor(maxDots / 2));
    if (start + maxDots > numPhotos) {
      start = numPhotos - maxDots;
    }
    dotIndices = Array.from({ length: maxDots }, (_, i) => start + i);
  }

  return (
    <div
      className={`relative w-full ${aspectClassName} rounded-2xl overflow-hidden bg-zinc-950 select-none group/gallery ${className}`}
      onMouseEnter={fetchFullPhotosSafely}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Active Photo */}
      <img
        src={currentPhoto}
        alt={`${title} - Photo ${currentIndex + 1}`}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover transition-transform duration-300 group-hover/gallery:scale-102"
      />

      {/* Top Left Badges (Rank & Fit) */}
      {badges && (
        <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
          {badges}
        </div>
      )}

      {/* Top Right Actions (Open in New Window Button & Counter) */}
      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
        {photos.length > 1 && (
          <span className="px-2 py-0.5 rounded-lg bg-zinc-950/75 backdrop-blur-md text-white text-[10px] font-bold shadow-sm opacity-90 sm:opacity-0 sm:group-hover/gallery:opacity-100 transition-opacity">
            {currentIndex + 1}/{photos.length}
          </span>
        )}
        {actions}
      </div>

      {/* Left Navigation Arrow */}
      {photos.length > 1 && (
        <button
          onClick={handlePrev}
          aria-label="Previous photo"
          title="Previous photo"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 hover:bg-white text-zinc-900 shadow-md border border-zinc-200/60 flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95 cursor-pointer z-20 opacity-90 sm:opacity-0 sm:group-hover/gallery:opacity-100"
        >
          <CaretLeft size={16} weight="bold" />
        </button>
      )}

      {/* Right Navigation Arrow */}
      {photos.length > 1 && (
        <button
          onClick={handleNext}
          aria-label="Next photo"
          title="Next photo"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 hover:bg-white text-zinc-900 shadow-md border border-zinc-200/60 flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95 cursor-pointer z-20 opacity-90 sm:opacity-0 sm:group-hover/gallery:opacity-100"
        >
          <CaretRight size={16} weight="bold" />
        </button>
      )}

      {/* Bottom Center Dots Indicator (Airbnb Signature Style) */}
      {photos.length > 1 && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-950/50 backdrop-blur-xs pointer-events-none transition-opacity">
          {dotIndices.map((dotIdx) => {
            const isActive = dotIdx === currentIndex;
            return (
              <span
                key={dotIdx}
                className={`rounded-full transition-all duration-200 ${
                  isActive
                    ? 'w-3.5 h-1.5 bg-white shadow-xs'
                    : 'w-1.5 h-1.5 bg-white/60'
                }`}
              />
            );
          })}
        </div>
      )}

      {/* Bottom Right Price Badge */}
      {priceBadge && (
        <div className="absolute bottom-2.5 right-2.5 z-10 pointer-events-none">
          {priceBadge}
        </div>
      )}

      {/* Bottom Banner (e.g. Off-Market overlay) */}
      {bottomBanner && (
        <div className="absolute inset-x-0 bottom-0 z-15 pointer-events-none">
          {bottomBanner}
        </div>
      )}
    </div>
  );
}

