'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Target, 
  MapPin, 
  ShieldCheck, 
  MagnifyingGlass, 
  Car, 
  Buildings, 
  ArrowRight, 
  Heart, 
  CheckCircle,
  DeviceMobile,
  Envelope,
  Lightning,
  Sparkle
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';

export default function Home() {
  const { user, profile, loading, login, logout } = useAuth();

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col pt-16">
      {/* Navigation */}
      <Navbar 
        user={user} 
        profile={profile} 
        loading={loading}
        handleLogin={login} 
        handleLogout={logout} 
      />

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center space-y-8">
        
        {/* Subtle pill tag */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-700 shadow-2xs"
        >
          <span className="w-2 h-2 rounded-full bg-zinc-950 animate-pulse" />
          <span>Real-Time Property Intelligence</span>
        </motion.div>

        {/* Main Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4"
        >
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-zinc-950 leading-[1.05]">
            Never miss your <br className="hidden sm:inline" />
            <span className="text-zinc-950">ideal home.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-zinc-600 font-normal leading-relaxed">
            Autonomous property tracking built for smart renters. Define your search criteria, 
            proximity anchors, and living privacy preferences — our radar does the rest.
          </p>
        </motion.div>

        {/* Hero CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2"
        >
          <Link
            href="/search"
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-zinc-950 text-white hover:bg-black font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group active:scale-98"
          >
            <span>Set Up Search Criteria</span>
            <ArrowRight size={16} weight="bold" className="group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/properties"
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-white text-zinc-900 border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 font-semibold text-sm transition-all shadow-2xs flex items-center justify-center gap-2 active:scale-98"
          >
            <Buildings size={16} weight="bold" />
            <span>Explore Properties & Map</span>
          </Link>
        </motion.div>

        {/* Hero Live Preview (Split Card & Map Teaser) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 rounded-3xl border border-zinc-200 bg-white p-3 sm:p-5 shadow-xl text-left"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            
            {/* Left Preview: Horizontal Card matching the user's reference */}
            <div className="lg:col-span-7 bg-zinc-50/80 rounded-2xl p-4 sm:p-5 border border-zinc-200/80 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
              <img
                src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80"
                alt="Property preview"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-zinc-200 shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-sm sm:text-base text-zinc-950 truncate">
                    14 Victoria Road, Camps Bay
                  </h4>
                  <span className="text-xs text-zinc-400 whitespace-nowrap">2 hours ago</span>
                </div>
                
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white border border-zinc-200 text-zinc-900">
                    R 28,000 / mo
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border border-zinc-200 text-zinc-700">
                    3 bedroom
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border border-zinc-200 text-zinc-700">
                    2 bathroom
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border border-zinc-200 text-zinc-700">
                    135 sqm
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-zinc-500">property24.com</span>
                  <div className="flex items-center gap-1.5 text-zinc-900 font-semibold">
                    <CheckCircle size={14} weight="fill" className="text-zinc-950" />
                    <span>Private Garden & Independent</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Preview: Proximity Commute Indicator */}
            <div className="lg:col-span-5 bg-zinc-950 text-white rounded-2xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Proximity Anchor Match
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                  98% FIT
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target size={16} weight="bold" className="text-zinc-300" />
                  <span className="text-xs font-bold text-white">Work: Amazon River Club HQ</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Car size={15} />
                  <span>18 mins driving commute · 12.4 km</span>
                </div>
              </div>

              <Link
                href="/properties"
                className="w-full py-2 bg-white text-zinc-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-zinc-100 transition-colors"
              >
                <span>View On Interactive Map</span>
                <ArrowRight size={13} weight="bold" />
              </Link>
            </div>

          </div>
        </motion.div>

      </section>

      {/* 4 Core Pillars Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full border-t border-zinc-200">
        <div className="text-center max-w-2xl mx-auto space-y-2 mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950">
            Engineered For Frictionless Renting
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600">
            Everything you need across 4 streamlined pages: Home, Search, Properties, and Contact.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1 */}
          <div className="p-6 rounded-3xl border border-zinc-200 bg-white space-y-3 shadow-2xs hover:border-zinc-400 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-950 font-bold">
              <MagnifyingGlass size={20} weight="bold" />
            </div>
            <h3 className="font-bold text-sm text-zinc-950">Granular Search</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Define suburbs, price windows, bedrooms, and must-haves like inverters and fibre connections.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-3xl border border-zinc-200 bg-white space-y-3 shadow-2xs hover:border-zinc-400 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-950 font-bold">
              <Target size={20} weight="bold" />
            </div>
            <h3 className="font-bold text-sm text-zinc-950">Proximity Anchors</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Set your target destinations (Work, Beach, School) and see real driving times mapped to each listing.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-3xl border border-zinc-200 bg-white space-y-3 shadow-2xs hover:border-zinc-400 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-950 font-bold">
              <ShieldCheck size={20} weight="bold" />
            </div>
            <h3 className="font-bold text-sm text-zinc-950">Privacy Shield</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Checkboxes for private entrance, exclusive garden, independent living, and no landlord on-site.
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-3xl border border-zinc-200 bg-white space-y-3 shadow-2xs hover:border-zinc-400 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-950 font-bold">
              <Buildings size={20} weight="bold" />
            </div>
            <h3 className="font-bold text-sm text-zinc-950">Interactive Map</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Split screen layout with crisp horizontal cards and live map markers for properties and anchors.
            </p>
          </div>

        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="bg-zinc-50 border-t border-zinc-200 py-16 px-4 sm:px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950">
            Ready to find your next home?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600">
            Start by setting up your search criteria or jump straight into the interactive properties map.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/search"
              className="px-6 py-3 bg-zinc-950 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors"
            >
              Configure Search Criteria
            </Link>
            <Link
              href="/properties"
              className="px-6 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-xl text-xs font-bold hover:bg-zinc-50 transition-colors"
            >
              Browse Properties Feed
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
