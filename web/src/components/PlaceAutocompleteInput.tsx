'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, MagnifyingGlass, Sparkle, NavigationArrow } from '@phosphor-icons/react';

export interface PlaceSuggestion {
  description: string;
  main_text: string;
  secondary_text: string;
  category: string;
  suggested_mode: 'driving' | 'walking' | 'bicycling' | 'transit' | string;
  default_label: string;
  default_mins: number;
}

interface PlaceAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (suggestion: PlaceSuggestion) => void;
  placeholder?: string;
  className?: string;
}

export function PlaceAutocompleteInput({
  value,
  onChange,
  onSelectSuggestion,
  placeholder = 'Destination / Address (Google Maps)',
  className = '',
}: PlaceAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Fetch suggestions with debouncing
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!value || value.trim().length === 0) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${backendBase}/api/places/autocomplete?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
            setSuggestions(data.suggestions);
            setIsOpen(true);
            setHighlightedIndex(0);
          } else {
            setSuggestions([]);
            setIsOpen(false);
          }
        }
      } catch (err) {
        console.warn('Place autocomplete error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [value, backendBase]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (s: PlaceSuggestion) => {
    onChange(s.description);
    setIsOpen(false);
    if (onSelectSuggestion) {
      onSelectSuggestion(s);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[highlightedIndex]) {
        handleSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'work':
        return '💼';
      case 'lifestyle':
        return '☕';
      case 'gym':
        return '🏋️';
      case 'outdoors':
        return '🚵';
      case 'study':
        return '🎓';
      default:
        return '📍';
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={
            className ||
            'w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950 transition-all'
          }
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin inline-block" />
          </div>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden py-1.5 max-h-64 overflow-y-auto">
          <div className="px-3 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between border-b border-zinc-100 mb-1">
            <span>Google Maps Place Suggestions</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <Sparkle size={11} weight="fill" />
              Verified GPS
            </span>
          </div>

          {suggestions.map((s, idx) => {
            const isHighlighted = idx === highlightedIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full text-left px-3.5 py-2 flex items-start gap-2.5 transition-colors cursor-pointer ${
                  isHighlighted ? 'bg-zinc-100/90 text-zinc-950' : 'text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                <span className="text-base leading-none mt-0.5 shrink-0">
                  {getCategoryIcon(s.category)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-950 truncate">
                      {s.main_text}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-medium shrink-0 bg-zinc-100 px-1.5 py-0.5 rounded">
                      {s.suggested_mode === 'walking' ? '🚶 Walk' : s.suggested_mode === 'bicycling' ? '🚲 Bike' : '🚗 Drive'}
                    </span>
                  </div>
                  {s.secondary_text && (
                    <span className="text-[11px] text-zinc-500 block truncate">
                      {s.secondary_text}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

