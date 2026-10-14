'use client';

import React from 'react';
import Link from 'next/link';

export const Footer = () => {
  return (
    <footer className="bg-white border-t border-zinc-200 py-12 px-6 sm:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        
        {/* Brand */}
        <div className="flex flex-col items-center md:items-start gap-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-zinc-950 text-white rounded-lg flex items-center justify-center font-bold text-sm">
              H
            </div>
            <span className="text-base font-bold tracking-tight text-zinc-950">HomeSeek</span>
          </div>
          <p className="text-xs text-zinc-600 mt-1">
            Real-time rental intelligence & proximity-driven property radar.
          </p>
        </div>

        {/* 4 Main Links */}
        <div className="flex flex-wrap justify-center items-center gap-6 text-xs font-semibold text-zinc-700">
          <Link href="/" className="hover:text-zinc-950 transition-colors">Home</Link>
          <Link href="/search" className="hover:text-zinc-950 transition-colors">Search</Link>
          <Link href="/properties" className="hover:text-zinc-950 transition-colors">Properties</Link>
          <Link href="/contact" className="hover:text-zinc-950 transition-colors">Contact</Link>
        </div>

        {/* Copyright & Info */}
        <div className="text-xs text-zinc-600 text-center md:text-right">
          &copy; {new Date().getFullYear()} HomeSeek. All rights reserved.
        </div>

      </div>
    </footer>
  );
};
