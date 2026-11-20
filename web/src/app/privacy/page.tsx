'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { ShieldCheck } from '@phosphor-icons/react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-28 pb-20 space-y-8">
        <div className="space-y-2 border-b border-zinc-200 pb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold">
            <ShieldCheck size={14} weight="fill" />
            <span>POPIA-Aligned Privacy Notice</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-950">Privacy Policy</h1>
          <p className="text-xs text-zinc-500">Last updated: November 2026</p>
        </div>

        <section className="space-y-3 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-950">1. Information We Collect</h2>
          <p>
            When you create an account or configure alerts on HomeSeek / Knightly, we store your email address,
            optional display name, nickname, avatar, saved search criteria, and optional WhatsApp alert number so we
            can deliver personalized rental shortlists and sync your shortlist across devices.
          </p>
        </section>

        <section className="space-y-3 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-950">2. Inspection Photos &amp; Local Browser Data</h2>
          <p>
            Search filters, comparison shortlists, and ingoing inspection drafts may be stored locally in your browser
            for speed. Photos uploaded for AI forensic audits or ingoing condition inspections are processed solely to
            generate your requested analysis and inspection report.
          </p>
        </section>

        <section className="space-y-3 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-950">3. Third-Party Services</h2>
          <p>
            We use Firebase Authentication for sign-in, Mapbox for on-demand 3D terrain previews, and AI model APIs for
            listing and condition analysis. We never sell your personal contact details to landlords, estate agents, or
            third-party marketers.
          </p>
        </section>

        <section className="space-y-3 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-950">4. Your Rights &amp; Data Deletion</h2>
          <p>
            Under South Africa&apos;s Protection of Personal Information Act (POPIA), you may request access to,
            correction of, or deletion of your account data at any time via our{' '}
            <Link href="/contact" className="text-indigo-600 font-semibold hover:underline">
              Contact page
            </Link>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
