'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, X, Plus, MagnifyingGlass, Check } from '@phosphor-icons/react';

// Curated list of Western Cape & Cape Town suburbs with regional categorization
export const DEFAULT_CAPE_TOWN_SUBURBS = [
  // Atlantic Seaboard
  { name: 'Hout Bay', region: 'Atlantic Seaboard' },
  { name: 'Camps Bay', region: 'Atlantic Seaboard' },
  { name: 'Sea Point', region: 'Atlantic Seaboard' },
  { name: 'Green Point', region: 'Atlantic Seaboard' },
  { name: 'Mouille Point', region: 'Atlantic Seaboard' },
  { name: 'Three Anchor Bay', region: 'Atlantic Seaboard' },
  { name: 'Bantry Bay', region: 'Atlantic Seaboard' },
  { name: 'Fresnaye', region: 'Atlantic Seaboard' },
  { name: 'Clifton', region: 'Atlantic Seaboard' },
  { name: 'Bakoven', region: 'Atlantic Seaboard' },
  { name: 'Llandudno', region: 'Atlantic Seaboard' },
  { name: 'Waterfront', region: 'Atlantic Seaboard' },
  { name: 'Granger Bay', region: 'Atlantic Seaboard' },

  // City Bowl
  { name: 'Gardens', region: 'City Bowl' },
  { name: 'Oranjezicht', region: 'City Bowl' },
  { name: 'Tamboerskloof', region: 'City Bowl' },
  { name: 'Higgovale', region: 'City Bowl' },
  { name: 'Vredehoek', region: 'City Bowl' },
  { name: 'Devils Peak', region: 'City Bowl' },
  { name: 'City Bowl', region: 'City Bowl' },
  { name: 'Woodstock', region: 'City Bowl Fringe' },
  { name: 'Observatory', region: 'City Bowl Fringe' },
  { name: 'Salt River', region: 'City Bowl Fringe' },

  // Southern Suburbs
  { name: 'Constantia', region: 'Southern Suburbs' },
  { name: 'Bishopscourt', region: 'Southern Suburbs' },
  { name: 'Newlands', region: 'Southern Suburbs' },
  { name: 'Claremont', region: 'Southern Suburbs' },
  { name: 'Claremont Upper', region: 'Southern Suburbs' },
  { name: 'Kenilworth', region: 'Southern Suburbs' },
  { name: 'Kenilworth Upper', region: 'Southern Suburbs' },
  { name: 'Rondebosch', region: 'Southern Suburbs' },
  { name: 'Tokai', region: 'Southern Suburbs' },
  { name: 'Bergvliet', region: 'Southern Suburbs' },
  { name: 'Meadowridge', region: 'Southern Suburbs' },
  { name: 'Kirstenhof', region: 'Southern Suburbs' },
  { name: 'Steenberg', region: 'Southern Suburbs' },

  // South Peninsula (Deep South)
  { name: 'Kalk Bay', region: 'South Peninsula' },
  { name: 'St James', region: 'South Peninsula' },
  { name: 'Fish Hoek', region: 'South Peninsula' },
  { name: 'Glencairn', region: 'South Peninsula' },
  { name: 'Muizenberg', region: 'South Peninsula' },
  { name: 'Noordhoek', region: 'South Peninsula' },
  { name: 'Kommetjie', region: 'South Peninsula' },
  { name: 'Scarborough', region: 'South Peninsula' },
  { name: "Simon's Town", region: 'South Peninsula' },
  { name: 'Lakeside', region: 'South Peninsula' },
  { name: 'Marina Da Gama', region: 'South Peninsula' },
  { name: 'Capri', region: 'South Peninsula' },
  { name: 'Clovelly', region: 'South Peninsula' },

  // West Coast
  { name: 'Blouberg', region: 'West Coast' },
  { name: 'Bloubergstrand', region: 'West Coast' },
  { name: 'Big Bay', region: 'West Coast' },
  { name: 'Table View', region: 'West Coast' },
  { name: 'Sunset Beach', region: 'West Coast' },
  { name: 'West Beach', region: 'West Coast' },

  // Northern Suburbs & Winelands
  { name: 'Durbanville', region: 'Northern Suburbs' },
  { name: 'Welgemoed', region: 'Northern Suburbs' },
  { name: 'Plattekloof', region: 'Northern Suburbs' },
  { name: 'Stellenbosch', region: 'Winelands' },
  { name: 'Somerset West', region: 'Winelands' },
  { name: 'Paarl', region: 'Winelands' },
  { name: 'Franschhoek', region: 'Winelands' },
];

interface AreaPillsInputProps {
  selectedAreas: string[];
  onChange: (areas: string[]) => void;
  placeholder?: string;
}

export function AreaPillsInput({
  selectedAreas,
  onChange,
  placeholder = 'Type area name (e.g. Hout Bay)...',
}: AreaPillsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [availableSuburbs, setAvailableSuburbs] = useState(DEFAULT_CAPE_TOWN_SUBURBS);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Attempt to augment with live backend geofence suburbs
  useEffect(() => {
    async function loadBackendSuburbs() {
      try {
        const res = await fetch('http://127.0.0.1:8000/geofence/suburbs');
        if (res.ok) {
          const list: string[] = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const cleanList = list
              .filter(s => typeof s === 'string' && !s.startsWith('⭐') && !s.startsWith('🏖️'))
              .map(s => {
                const existing = DEFAULT_CAPE_TOWN_SUBURBS.find(
                  d => d.name.toLowerCase() === s.toLowerCase()
                );
                return {
                  name: s,
                  region: existing ? existing.region : 'Cape Town Area',
                };
              });

            // Merge avoiding duplicates
            const names = new Set(cleanList.map(c => c.name.toLowerCase()));
            const combined = [
              ...cleanList,
              ...DEFAULT_CAPE_TOWN_SUBURBS.filter(d => !names.has(d.name.toLowerCase())),
            ];
            setAvailableSuburbs(combined);
          }
        }
      } catch (e) {
        // Fallback already active
      }
    }
    loadBackendSuburbs();
  }, []);

  // Filter suggestions based on typed input
  const query = inputValue.trim().toLowerCase();
  const selectedSet = new Set(selectedAreas.map(a => a.toLowerCase().trim()));

  const filteredSuggestions = availableSuburbs
    .filter(item => !selectedSet.has(item.name.toLowerCase()))
    .filter(item => {
      if (!query) return false;
      return item.name.toLowerCase().includes(query) || item.region.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      // Prioritize items starting with query (e.g. "Ho" -> "Hout Bay" at top)
      const aStarts = a.name.toLowerCase().startsWith(query);
      const bStarts = b.name.toLowerCase().startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 8);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add an area to the selected list
  const addArea = (areaName: string) => {
    const trimmed = areaName.trim();
    if (!trimmed) return;
    if (!selectedSet.has(trimmed.toLowerCase())) {
      onChange([...selectedAreas, trimmed]);
    }
    setInputValue('');
    setIsOpen(false);
    setHighlightedIndex(0);
    inputRef.current?.focus();
  };

  // Remove an area from the selected list
  const removeArea = (areaToRemove: string) => {
    onChange(selectedAreas.filter(a => a.toLowerCase().trim() !== areaToRemove.toLowerCase().trim()));
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && filteredSuggestions.length > 0) {
        setIsOpen(true);
      } else if (filteredSuggestions.length > 0) {
        setHighlightedIndex(prev => (prev + 1) % filteredSuggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        setHighlightedIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
      }
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (isOpen && filteredSuggestions.length > 0 && highlightedIndex >= 0) {
        addArea(filteredSuggestions[highlightedIndex].name);
      } else if (inputValue.trim()) {
        addArea(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedAreas.length > 0) {
      // Remove last pill when pressing backspace on empty input
      removeArea(selectedAreas[selectedAreas.length - 1]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Pills Container & Input Box */}
      <div 
        onClick={() => inputRef.current?.focus()}
        className="relative min-h-[54px] w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-2 flex flex-wrap items-center gap-2 focus-within:border-zinc-900 focus-within:bg-white focus-within:ring-2 focus-within:ring-zinc-900/10 transition-all cursor-text"
      >
        <MagnifyingGlass size={18} className="text-zinc-400 ml-1.5 shrink-0" />

        {/* Selected Area Filter Pills */}
        {selectedAreas.map((area) => (
          <div
            key={area}
            className="group relative inline-flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 bg-white border border-zinc-200 hover:border-zinc-300 rounded-full text-xs font-medium text-zinc-900 shadow-2xs transition-all select-none"
          >
            <MapPin size={12} weight="fill" className="text-zinc-500 shrink-0" />
            <span className="font-semibold text-zinc-900">{area}</span>

            {/* Corner Cross Badge - Pops in smoothly on hover */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeArea(area);
              }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-zinc-900 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xs transform group-hover:scale-110 active:scale-95"
              aria-label={`Remove ${area}`}
              title={`Remove ${area}`}
            >
              <X size={9} weight="bold" />
            </button>
          </div>
        ))}

        {/* Inline Typeahead Input */}
        <div className="flex-1 min-w-[160px] relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => {
              if (inputValue.trim()) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={selectedAreas.length === 0 ? placeholder : 'Add suburb (e.g. Hout Bay)...'}
            className="w-full bg-transparent border-none text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none py-1 px-1"
          />
        </div>

        {/* Clear All action if multiple areas selected */}
        {selectedAreas.length > 2 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            className="ml-auto text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 px-2 py-1 rounded-md transition-colors"
          >
            Clear all
          </button>
        )}

        {/* Floating Autocomplete Dropdown */}
        {isOpen && filteredSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-zinc-100 py-1 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex justify-between">
              <span>Matching Cape Town Suburbs</span>
              <span>Press Enter or Click to add</span>
            </div>

            {filteredSuggestions.map((item, idx) => {
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={item.name}
                  type="button"
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={(e) => {
                    e.stopPropagation();
                    addArea(item.name);
                  }}
                  className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left transition-colors ${
                    isHighlighted ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-800 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                      isHighlighted ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      <MapPin size={13} weight="bold" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {item.region}
                      </div>
                    </div>
                  </div>

                  <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                    <Plus size={12} weight="bold" />
                    Add
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Select Popular Recommendations */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 pt-0.5">
        <span className="text-[11px] font-medium text-zinc-400">Quick add:</span>
        {['Hout Bay', 'Sea Point', 'Camps Bay', 'Gardens', 'Constantia', 'Kalk Bay'].map((suburb) => {
          const isAdded = selectedSet.has(suburb.toLowerCase());
          return (
            <button
              key={suburb}
              type="button"
              disabled={isAdded}
              onClick={() => addArea(suburb)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                isAdded
                  ? 'bg-zinc-100 text-zinc-400 cursor-default'
                  : 'bg-white border border-zinc-200 text-zinc-700 hover:border-zinc-900 hover:text-zinc-950 active:scale-95'
              }`}
            >
              {isAdded ? (
                <Check size={11} weight="bold" className="text-emerald-500" />
              ) : (
                <Plus size={10} weight="bold" className="text-zinc-400" />
              )}
              <span>{suburb}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
