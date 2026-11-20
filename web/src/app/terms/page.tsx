'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { FileText } from '@phosphor-icons/react';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-28 pb-20 space-y-8">
        <div className="space-y-2 border-b border-zinc-200 pb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-bold">
            <FileText size={14} weight="fill" />
            <span>Terms of Use</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-950">Terms of Service</h1>
          <p className="text-xs text-zinc-500">Last updated: November 2026</p>
        </div>

        <section className="space-y-3 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-950">1. Decision-Support Tool</h2>
          <p>
            HomeSeek / Knightly provides rental discovery, proximity overlays, 3D sun/terrain simulations, AI listing
            audits, and ingoing inspection checklists for informational and decision-support purposes. Listings,
            pricing, and availability originate from third-party sources and should always be verified directly during an
            in-person viewing and lease review.
          </p>
        </section>

        <section className="space-y-3 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-950">2. Ingoing Inspection Reports</h2>
          <p>
            Ingoing inspection PDFs generated on the platform help you document property condition with timestamps and
            notes. They do not constitute legal advice and do not replace formal notice requirements under the Rental
            Housing Act or your lease agreement.
          </p>
        </section>

        <section className="space-y-3 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-950">3. Passes, Credits &amp; Fair Use</h2>
          <p>
            Once-off passes and AI Audit credit packs are intended for personal house-hunting use. Automated scraping,
            resale of platform data, or abuse of AI endpoints is prohibited.
          </p>
        </section>

        <section className="space-y-3 text-sm text-zinc-700 leading-relaxed">
          <h2 className="text-base font-bold text-zinc-950">4. Questions</h2>
          <p>
            If you have any questions about these terms, reach out through our{' '}
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
