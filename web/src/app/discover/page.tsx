'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Sparkle, 
  MapPin, 
  ArrowSquareOut, 
  CheckCircle, 
  WarningCircle, 
  Car, 
  Bed, 
  Bathtub, 
  Ruler, 
  SlidersHorizontal,
  CircleNotch,
  HouseLine,
  ChatCircleText,
  Bell,
  Clock,
  Check,
  FileText,
  Target,
  ArrowRight
} from '@phosphor-icons/react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/lib/auth-context';
import { fetchWithAuth } from '@/lib/api';

interface RankedListing {
  id: string;
  listing_id: string;
  title: string;
  price: number | null;
  address: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqm: number | null;
  parking: number | null;
  is_furnished: boolean | null;
  image: string | null;
  url: string;
  area: string;
  rank: number;
  fit_score: number;
  short_explanation: string;
  pros: string[];
  cons: string[];
  verdict: string;
}

interface ScoutResult {
  ranked_listings: RankedListing[];
  overall_summary: string;
  areas_scouted: string[];
  total_found: number;
}

export default function DiscoverPage() {
  const { user, profile, loading, logout, login } = useAuth();

  // 1. Freeform Prompt & Personal Tastes
  const [prompt, setPrompt] = useState(
    "Remote web designer working from home. I enjoy mountain biking, trail running, walking on the beach, flying my FPV drone, and working from a cafe twice a week. I'd like to date and have spontaneous chats with interesting people, occasionally have a friend over, and listen to/make music."
  );
  const [personalTastes, setPersonalTastes] = useState(
    "Acoustic privacy for music, safe storage for my mountain bike, unpretentious vibe, easy walk to lively Kloof Street cafes, decent natural light."
  );

  // 2. Standard Portal Options
  const [areasInput, setAreasInput] = useState("Gardens, Tamboerskloof");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("17500");
  const [bedrooms, setBedrooms] = useState("1");
  const [propertyType, setPropertyType] = useState("Apartment");
  const [furnishedPref, setFurnishedPref] = useState<"any" | "furnished" | "unfurnished">("any");
  const [mustHaveParking, setMustHaveParking] = useState(false);

  // 3. Automated Daily Cron & Alert Settings
  const [saveAlertActive, setSaveAlertActive] = useState(true);
  const [cronPeriod, setCronPeriod] = useState("daily_11am");
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState(profile?.whatsapp || "");
  const [notificationEmail, setNotificationEmail] = useState(profile?.email || user?.email || "");

  // Execution state
  const [isScouting, setIsScouting] = useState(false);
  const [isSavingAlert, setIsSavingAlert] = useState(false);
  const [alertSavedSuccess, setAlertSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<ScoutResult | null>(null);

  const getAreasList = () => {
    return areasInput
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);
  };

  const handleRunScout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScouting(true);
    setErrorMsg(null);
    setAlertSavedSuccess(false);

    const areas = getAreasList();

    try {
      const payload = {
        prompt,
        personal_tastes: personalTastes,
        areas: areas.length > 0 ? areas : ["Gardens", "Tamboerskloof"],
        min_price: minPrice ? parseInt(minPrice) : null,
        max_price: maxPrice ? parseInt(maxPrice) : 18000,
        min_bedrooms: bedrooms ? parseFloat(bedrooms) : 1,
        property_type: propertyType,
        is_furnished: furnishedPref === "furnished" ? true : furnishedPref === "unfurnished" ? false : null,
        must_have_parking: mustHaveParking
      };

      const res = await fetchWithAuth('/ai-scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.status === 'success' && data.result) {
        setResults(data.result);
      } else {
        throw new Error(data.message || 'Scout failed to retrieve ranked results');
      }

      if (saveAlertActive) {
        await handleSaveAlert(false);
      }
    } catch (err: any) {
      console.error("[SCOUT ERROR]", err);
      setErrorMsg(err.message || 'Unable to contact AI Scout backend. Ensure your local server is running.');
    } finally {
      setIsScouting(false);
    }
  };

  const handleSaveAlert = async (showFeedback = true) => {
    const uid = profile?.id || user?.uid || 'taun_test_user';
    setIsSavingAlert(true);
    const areas = getAreasList();

    try {
      const alertPayload = {
        user_id: uid,
        title: `${areas.join(', ') || 'Cape Town'} AI Lifestyle Scout`,
        prompt,
        personal_tastes: personalTastes,
        areas: areas.length > 0 ? areas : ["Gardens", "Tamboerskloof"],
        min_price: minPrice ? parseInt(minPrice) : null,
        max_price: maxPrice ? parseInt(maxPrice) : 18000,
        min_bedrooms: bedrooms ? parseFloat(bedrooms) : 1,
        property_type: propertyType,
        is_furnished: furnishedPref === "furnished" ? true : furnishedPref === "unfurnished" ? false : null,
        must_have_parking: mustHaveParking,
        is_active: true,
        frequency: cronPeriod,
        notify_whatsapp: notifyWhatsapp,
        notify_email: notifyEmail,
        whatsapp_number: whatsappNumber,
        notification_email: notificationEmail,
        run_immediately: false
      };

      const res = await fetchWithAuth('/save-ai-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertPayload)
      });

      if (res && res.ok) {
        if (showFeedback) {
          setAlertSavedSuccess(true);
          setTimeout(() => setAlertSavedSuccess(false), 5000);
        }
      }
    } catch (e) {
      console.warn("Failed to save alert:", e);
    } finally {
      setIsSavingAlert(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col pt-16">
      <Navbar 
        user={user} 
        profile={profile} 
        loading={loading}
        handleLogout={logout} 
        handleLogin={login}
      />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 space-y-10">
        {/* Header - Matching Search Page Style */}
        <div className="space-y-4 border-b border-zinc-200 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-xs font-semibold">
                <Sparkle size={14} weight="bold" />
                <span>AI Property Scout & Daily Alert</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
                Seek & Rank Rentals by Lifestyle
              </h1>
              <p className="text-sm text-zinc-600 max-w-2xl leading-relaxed">
                Combine Property24 standard filters with a personalized AI prompt. Our engine scouts live portals, evaluates acoustic & lifestyle fit, and ranks the Top 10 matches.
              </p>
            </div>

            <Link
              href="/reports"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-xs font-semibold text-zinc-800 transition-all shrink-0 shadow-2xs"
            >
              <FileText size={14} weight="bold" />
              <span>View Past Reports</span>
            </Link>
          </div>
        </div>

        {/* Unified Seeking Form */}
        <form onSubmit={handleRunScout} className="space-y-8">
          
          {/* Section 1: Desires & Personal Tastes */}
          <section className="bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/30 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
                  <ChatCircleText size={20} weight="bold" className="text-emerald-700" />
                  <span>Your Desires & Personal Tastes (AI Input)</span>
                </h2>
                <p className="text-xs text-zinc-600 mt-1">
                  Tell the AI your real weekly routine, remote work acoustic demands, outdoor hobbies, and dating preferences.
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                Gemini Advisor
              </span>
            </div>

            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-zinc-800 uppercase tracking-wider mb-2">
                  Your Desires & Lifestyle Prompt (Freeform Text)
                </label>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Remote worker who loves mountain biking, needs acoustic quiet, wants to walk to cafes..."
                  className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all placeholder:text-zinc-400"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">Describe your weekly habits, work habits, and social goals.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-800 uppercase tracking-wider mb-2">
                  Personal Tastes & Hard Dealbreakers
                </label>
                <textarea
                  rows={2}
                  value={personalTastes}
                  onChange={(e) => setPersonalTastes(e.target.value)}
                  placeholder="e.g. Thick walls for making music, space for bike storage, secure parking, quiet street..."
                  className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all placeholder:text-zinc-400"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">Specific nuances used to score acoustic privacy and filter out flawed options.</span>
              </div>
            </div>
          </section>

          {/* Section 2: Standard Property24 Portal Filters */}
          <section className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xs">
            <h2 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
              <MapPin size={20} weight="bold" />
              <span>Target Locations & Standard Filters</span>
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                  Target Suburbs or Regions
                </label>
                <input
                  type="text"
                  value={areasInput}
                  onChange={(e) => setAreasInput(e.target.value)}
                  placeholder="e.g. Gardens, Tamboerskloof, Capri"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">Comma-separated suburbs (e.g. Gardens, Tamboerskloof)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                    Max Budget (ZAR/pm)
                  </label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="17500"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                    Min Bedrooms
                  </label>
                  <select
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                  >
                    <option value="1">1 Bedroom (or Bachelor)</option>
                    <option value="2">2 Bedrooms</option>
                    <option value="3">3+ Bedrooms</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                    Property Type
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                  >
                    <option value="Apartment">Apartment / Flat</option>
                    <option value="Townhouse">Townhouse</option>
                    <option value="House">House</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                    Furnishing Preference
                  </label>
                  <select
                    value={furnishedPref}
                    onChange={(e) => setFurnishedPref(e.target.value as any)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                  >
                    <option value="any">Any / Doesn&apos;t matter</option>
                    <option value="unfurnished">Unfurnished</option>
                    <option value="furnished">Furnished</option>
                  </select>
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 cursor-pointer transition-all w-full">
                    <input
                      type="checkbox"
                      checked={mustHaveParking}
                      onChange={(e) => setMustHaveParking(e.target.checked)}
                      className="w-4 h-4 rounded text-zinc-950 accent-zinc-950 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-zinc-950 block">Requires Secure Parking</span>
                      <span className="text-[11px] text-zinc-500 block">Exclude street-parking only listings</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Automated Daily Cron Schedule */}
          <section className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
                  <Clock size={20} weight="bold" />
                  <span>Automated Daily Cron Schedule (11:00 AM SAST)</span>
                </h2>
                <p className="text-xs text-zinc-600 mt-1">
                  Automatically re-scout and rank the top 10 listings every day at 11:00 AM SAST, generating a fresh report and sending notifications.
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-800 px-3 py-1.5 rounded-full">
                Daily Background Run
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                  WhatsApp Number (Top 3 Digest)
                </label>
                <input
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+27..."
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                  Notification Email (Full Report Link)
                </label>
                <input
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 focus:bg-white transition-all"
                />
              </div>
            </div>
          </section>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              type="submit"
              disabled={isScouting}
              className="w-full sm:flex-1 bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-400 text-white font-bold py-4 px-8 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
            >
              {isScouting ? (
                <>
                  <CircleNotch size={18} className="animate-spin" />
                  <span>Scouting Portals & Ranking Top 10 with AI...</span>
                </>
              ) : (
                <>
                  <Sparkle size={18} weight="bold" />
                  <span>Scout & Rank Top 10 Now</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSaveAlert(true)}
              disabled={isSavingAlert}
              className="w-full sm:w-auto bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-900 font-semibold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer shadow-2xs"
            >
              {isSavingAlert ? (
                <CircleNotch size={16} className="animate-spin" />
              ) : (
                <Bell size={16} weight="bold" />
              )}
              <span>Save as 11:00 AM Cron Alert</span>
            </button>
          </div>

          {alertSavedSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-2xl flex items-center gap-2 font-medium">
              <Check size={16} weight="bold" className="text-emerald-700" />
              <span>Saved successfully! The AI engine will re-scout and rank the top 10 listings every day at 11:00 AM SAST.</span>
            </div>
          )}
        </form>

        {/* Error Notification */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3">
            <WarningCircle size={20} className="text-red-600 shrink-0" weight="fill" />
            <p className="text-sm">{errorMsg}</p>
          </div>
        )}

        {/* Live Ranked Results Stream */}
        {results && (
          <div className="space-y-8 animate-fadeIn pt-4">
            {/* Advisor Summary Card */}
            <section className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xs">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-xs font-semibold">
                <Sparkle size={13} weight="fill" className="text-zinc-900" />
                <span>AI Local Advisor Verdict</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
                Scouted {results.total_found} Properties Across {results.areas_scouted.join(' & ')}
              </h2>
              <p className="text-sm text-zinc-700 leading-relaxed bg-zinc-50 border border-zinc-200 rounded-2xl p-4 sm:p-5">
                {results.overall_summary}
              </p>
            </section>

            {/* Ranked Cards Grid */}
            <div className="space-y-6">
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <span>Top Ranked Matches</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-normal">
                  Ranked by Lifestyle & Acoustic Fit
                </span>
              </h3>

              <div className="grid grid-cols-1 gap-6">
                {results.ranked_listings.map((item) => (
                  <div 
                    key={item.id} 
                    className="bg-white border border-zinc-200 hover:border-zinc-400 rounded-3xl p-6 sm:p-8 transition-all duration-200 shadow-2xs flex flex-col lg:flex-row gap-6 relative overflow-hidden group"
                  >
                    {/* Rank Badge */}
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-950 text-white text-xs font-bold shadow-sm">
                      <span>#{item.rank}</span>
                      <span className="text-[11px] font-normal text-zinc-400">Match ({item.fit_score}%)</span>
                    </div>

                    {/* Image / Thumbnail */}
                    <div className="lg:w-72 h-48 sm:h-56 lg:h-auto rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200 relative shrink-0">
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 gap-2">
                          <HouseLine size={32} />
                          <span className="text-xs font-medium">Photo on Portal</span>
                        </div>
                      )}
                    </div>

                    {/* Content / Advisor Breakdown */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        {/* Title & Price Header */}
                        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-2">
                          <div>
                            <h4 className="text-xl font-bold text-zinc-950 group-hover:text-zinc-800 transition-colors">
                              {item.title}
                            </h4>
                            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                              <MapPin size={13} className="text-zinc-400" />
                              {item.address}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-extrabold text-zinc-950">
                              {item.price ? `R ${item.price.toLocaleString()}` : "Price On Request"}
                            </span>
                            <span className="text-xs text-zinc-400 block">per month</span>
                          </div>
                        </div>

                        {/* Property Specs Pill Row */}
                        <div className="flex flex-wrap items-center gap-2.5 py-2 text-xs text-zinc-600 border-y border-zinc-100 my-3">
                          {item.bedrooms !== null && (
                            <span className="flex items-center gap-1 bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-200">
                              <Bed size={14} className="text-zinc-500" /> {item.bedrooms} Bed{item.bedrooms > 1 ? 's' : ''}
                            </span>
                          )}
                          {item.bathrooms !== null && (
                            <span className="flex items-center gap-1 bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-200">
                              <Bathtub size={14} className="text-zinc-500" /> {item.bathrooms} Bath
                            </span>
                          )}
                          {item.sqm && (
                            <span className="flex items-center gap-1 bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-200">
                              <Ruler size={14} className="text-zinc-500" /> {item.sqm} m²
                            </span>
                          )}
                          <span className="flex items-center gap-1 bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-200">
                            <Car size={14} className="text-zinc-500" /> {item.parking ? `${item.parking} Parking Bay` : "Street Parking"}
                          </span>
                          {item.is_furnished !== null && (
                            <span className="bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-200 text-zinc-700">
                              {item.is_furnished ? "Furnished" : "Unfurnished"}
                            </span>
                          )}
                        </div>

                        {/* AI Advisor Explanation */}
                        <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200 mb-4">
                          <p className="text-xs sm:text-sm text-zinc-800 leading-relaxed font-normal">
                            <span className="font-bold text-zinc-950">Advisor Note: </span>
                            {item.short_explanation}
                          </p>
                        </div>

                        {/* Pros and Cons */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-4">
                          {item.pros.length > 0 && (
                            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3">
                              <span className="font-bold text-emerald-900 block mb-1">Key Strengths</span>
                              <ul className="space-y-1 text-emerald-950">
                                {item.pros.map((p, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <CheckCircle size={14} className="text-emerald-700 shrink-0 mt-0.5" weight="fill" />
                                    <span>{p}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {item.cons.length > 0 && (
                            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3">
                              <span className="font-bold text-amber-900 block mb-1">Things to Watch</span>
                              <ul className="space-y-1 text-amber-950">
                                {item.cons.map((c, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <WarningCircle size={14} className="text-amber-700 shrink-0 mt-0.5" weight="fill" />
                                    <span>{c}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Link & Verdict */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-zinc-100 mt-2">
                        <div className="text-xs text-zinc-500 italic">
                          Verdict: <span className="text-zinc-900 not-italic font-medium">{item.verdict}</span>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs transition-colors shadow-2xs"
                        >
                          <span>View Direct Listing</span>
                          <ArrowSquareOut size={13} weight="bold" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
