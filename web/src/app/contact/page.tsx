'use client';

import React, { useState } from 'react';
import { 
  Envelope, 
  DeviceMobile, 
  ChatCircleDots, 
  CheckCircle, 
  PaperPlaneRight, 
  MapPin, 
  Clock, 
  Question,
  CaretDown
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';

export default function ContactPage() {
  const { user, profile, loading, login, logout } = useAuth();

  const [form, setForm] = useState({
    name: user?.displayName || '',
    email: user?.email || '',
    phone: profile?.whatsapp || '',
    category: 'General Inquiry',
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 600);
  };

  const faqs = [
    {
      q: 'How quickly does HomeSeek discover new rental listings?',
      a: 'Our autonomous scrapers monitor major portals and social channels every 5 to 15 minutes. Once a match passes your Privacy Shield and proximity criteria, an alert is dispatched instantly to WhatsApp and Email.',
    },
    {
      q: 'How does the Living Autonomy & Privacy Shield work?',
      a: 'Our AI engine analyzes the listing description, photo metadata, and property attributes to detect shared garden arrangements, on-site landlords, communes, and lack of private entrances, warning you upfront.',
    },
    {
      q: 'Can I track multiple commute locations?',
      a: 'Yes! You can define multiple Proximity Anchors (e.g. Work HQ, gym, school, beach) on the Search page, and the interactive map will calculate driving and walking times for each property.',
    },
    {
      q: 'Is HomeSeek free to use?',
      a: 'Basic search, interactive map exploration, and email alerts are free. Advanced instant WhatsApp alerts and automated viewing scheduling are part of our premium sniper plans.',
    },
  ];

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col pt-16">
      <Navbar 
        user={user} 
        profile={profile} 
        loading={loading}
        handleLogin={login} 
        handleLogout={logout} 
      />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-12 space-y-12">
        
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-xs font-semibold">
            <ChatCircleDots size={14} weight="bold" />
            <span>Support & Assistance</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-950">
            Get in Touch
          </h1>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Have questions about your rental search criteria, custom geofences, or technical feedback? 
            Our Cape Town team is here to assist.
          </p>
        </div>

        {/* Contact Grid: Form on Left, Direct Channels on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Contact Form */}
          <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-2xs">
            {submitted ? (
              <div className="py-12 text-center space-y-4 animate-in fade-in duration-200">
                <div className="w-14 h-14 bg-zinc-100 text-zinc-950 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={32} weight="bold" />
                </div>
                <h3 className="text-xl font-bold text-zinc-950">Message Received</h3>
                <p className="text-xs text-zinc-600 max-w-sm mx-auto leading-relaxed">
                  Thank you for reaching out. A property specialist will review your inquiry and reply via email or WhatsApp within 2 hours.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setForm({ ...form, message: '' });
                  }}
                  className="mt-4 px-5 py-2.5 bg-zinc-950 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-lg font-bold text-zinc-950 mb-4">Send a Direct Message</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Alex Morgan"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="alex@example.com"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      WhatsApp / Phone
                    </label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+27 82 000 0000"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Inquiry Category
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                    >
                      <option>General Inquiry</option>
                      <option>Search Criteria Support</option>
                      <option>Privacy Shield Question</option>
                      <option>Listing Ingestion Request</option>
                      <option>Bug or Feedback</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Your Message
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Tell us about the property or requirements you are looking for..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-zinc-950 text-white hover:bg-black py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs active:scale-98 disabled:opacity-50"
                >
                  <PaperPlaneRight size={16} weight="bold" />
                  <span>{submitting ? 'Transmitting...' : 'Send Message'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Right: Direct Information Channels */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Quick Contact Card */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-6 space-y-5">
              <h3 className="text-base font-bold text-zinc-950">Direct Channels</h3>
              
              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-900 shrink-0">
                    <Envelope size={16} weight="bold" />
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-900 block">Support Desk</span>
                    <a href="mailto:support@homeseek.co.za" className="text-zinc-500 hover:text-zinc-950 transition-colors">
                      support@homeseek.co.za
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-900 shrink-0">
                    <DeviceMobile size={16} weight="bold" />
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-900 block">WhatsApp Priority Radar</span>
                    <span className="text-zinc-500">+27 (0) 21 823 4400</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-900 shrink-0">
                    <MapPin size={16} weight="bold" />
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-900 block">HQ Operations</span>
                    <span className="text-zinc-500">Cape Town & Regional Radar Hubs</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-900 shrink-0">
                    <Clock size={16} weight="bold" />
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-900 block">Monitoring Hours</span>
                    <span className="text-zinc-500">Autonomous 24/7 Scraping Engine</span>
                  </div>
                </div>
              </div>
            </div>

            {/* System Status Pill */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-zinc-900">All Radar Ingestors Operational</span>
              </div>
              <span className="text-[11px] text-zinc-400">100% Uptime</span>
            </div>

          </div>

        </div>

        {/* FAQ Section */}
        <div className="pt-8 border-t border-zinc-200 space-y-4">
          <h2 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
            <Question size={20} weight="bold" />
            <span>Frequently Asked Questions</span>
          </h2>

          <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-3xl overflow-hidden bg-white">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="transition-colors">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-zinc-50"
                  >
                    <span className="text-sm font-semibold text-zinc-950">{faq.q}</span>
                    <CaretDown
                      size={16}
                      weight="bold"
                      className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180 text-zinc-950' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs text-zinc-600 leading-relaxed bg-zinc-50/50">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
}
