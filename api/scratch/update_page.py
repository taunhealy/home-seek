import re

file_path = r'c:\Ryoko\Projects\home-seek\web\src\app\reports\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Lightning to Phosphor Icons import if not present
if 'Lightning,' not in content:
    content = content.replace('Sparkle,', 'Sparkle,\n  Lightning,')

# 2. Add availability fields to RankedItem
if 'is_available?:' not in content:
    content = content.replace(
        'pro_report?: ProReport | null;',
        'pro_report?: ProReport | null;\n  is_available?: boolean;\n  availability_status?: string;\n  last_verified_at?: number;'
    )

# 3. Add last_availability_check to IntelligenceReport
if 'last_availability_check?:' not in content:
    content = content.replace(
        'ranked_listings: RankedItem[];',
        'ranked_listings: RankedItem[];\n  last_availability_check?: number;'
    )

# 4. Add availability state variables and handleVerifyAvailability
state_anchor = 'const [auditError, setAuditError] = useState<string | null>(null);'
avail_states = '''const [auditError, setAuditError] = useState<string | null>(null);
  const [isVerifyingAvailability, setIsVerifyingAvailability] = useState(false);
  const [availabilityToast, setAvailabilityToast] = useState<{ active: number; unavailable: number; message: string } | null>(null);
  const [hideUnavailable, setHideUnavailable] = useState(false);

  const handleVerifyAvailability = async () => {
    if (!selectedReport) return;
    const uid = profile?.id || user?.uid || 'taun_test_user';
    try {
      setIsVerifyingAvailability(true);
      const res = await fetch(`${backendBase}/api/reports/verify-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: selectedReport.id,
          user_id: uid
        })
      });
      if (res.ok) {
        const data = await res.json();
        const updatedReport: IntelligenceReport = {
          ...selectedReport,
          ranked_listings: data.listings,
          last_availability_check: data.checked_at
        };
        setSelectedReport(updatedReport);
        setReports(prev => prev.map(r => r.id === selectedReport.id ? updatedReport : r));
        setAvailabilityToast({
          active: data.active_count,
          unavailable: data.unavailable_count,
          message: data.unavailable_count > 0
            ? `Checked 10 listings: ${data.active_count} active • ${data.unavailable_count} off-market/rented detected`
            : `All ${data.active_count} listings confirmed active on Property24`
        });
        setTimeout(() => setAvailabilityToast(null), 7000);
      }
    } catch (e) {
      console.error("Availability verify error:", e);
    } finally {
      setIsVerifyingAvailability(false);
    }
  };'''

if 'handleVerifyAvailability' not in content:
    content = content.replace(state_anchor, avail_states)

# 5. Add "Verify Live Feed" button next to "Refresh" in top header
top_refresh_btn = '''              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-xs font-semibold text-zinc-800 transition-all cursor-pointer shadow-2xs"
              >
                <ArrowsClockwise size={14} className={isRefreshing ? 'animate-spin' : ''} weight="bold" />
                <span>Refresh</span>
              </button>'''

replacement_top_btns = '''              <button
                type="button"
                onClick={handleVerifyAvailability}
                disabled={isVerifyingAvailability || !selectedReport}
                title="Verify real-time availability on Property24: catches 404 deleted or rented listings"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold text-emerald-950 transition-all cursor-pointer shadow-2xs"
              >
                <Lightning size={15} weight="fill" className={isVerifyingAvailability ? 'animate-spin text-emerald-600' : 'text-emerald-600'} />
                <span>{isVerifyingAvailability ? 'Checking Availability...' : 'Live Feed Check'}</span>
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-xs font-semibold text-zinc-800 transition-all cursor-pointer shadow-2xs"
              >
                <ArrowsClockwise size={14} className={isRefreshing ? 'animate-spin' : ''} weight="bold" />
                <span>Refresh</span>
              </button>'''

if 'Live Feed Check' not in content and top_refresh_btn in content:
    content = content.replace(top_refresh_btn, replacement_top_btns)

# 6. In Curated Properties bar, add the Live Check button, Hide Off-Market toggle, and Toast notification
toolbar_anchor = '''                  {/* Listings Container Header & View Mode Switcher */}
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                      <span>Curated Properties</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-semibold">
                        {selectedReport.ranked_listings?.length || 0}
                      </span>
                    </h3>

                    <div className="flex items-center p-1 bg-zinc-100 rounded-xl border border-zinc-200">'''

replacement_toolbar = '''                  {/* Availability Result Toast Notification */}
                  {availabilityToast && (
                    <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between transition-all ${
                      availabilityToast.unavailable > 0 
                        ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs' 
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-2xs'
                    }`}>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} weight="bold" className={availabilityToast.unavailable > 0 ? 'text-amber-600' : 'text-emerald-600'} />
                        <span className="font-semibold">{availabilityToast.message}</span>
                      </div>
                      <button onClick={() => setAvailabilityToast(null)} className="text-zinc-500 hover:text-zinc-800 p-1">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Listings Container Header & View Mode Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                        <span>Curated Properties</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-semibold">
                          {selectedReport.ranked_listings?.length || 0}
                        </span>
                      </h3>

                      {/* Live Verification Badge / Button in Subheader */}
                      <button
                        onClick={handleVerifyAvailability}
                        disabled={isVerifyingAvailability}
                        title="Click to check if any of these listings have been rented or deleted on Property24"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200/90 text-zinc-800 border border-zinc-200 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <Lightning size={13} weight="fill" className={isVerifyingAvailability ? 'animate-spin text-amber-500' : 'text-emerald-600'} />
                        <span>{isVerifyingAvailability ? 'Verifying...' : 'Verify Status'}</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Hide Off-Market Toggle (only shows if any off-market listings detected) */}
                      {(selectedReport.ranked_listings?.filter(it => it.is_available === false).length ?? 0) > 0 && (
                        <button
                          onClick={() => setHideUnavailable(!hideUnavailable)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            hideUnavailable
                              ? 'bg-zinc-950 text-white border-zinc-950 shadow-2xs'
                              : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          <span>{hideUnavailable ? '✓' : '🚫'}</span>
                          <span>Hide Off-Market ({selectedReport.ranked_listings?.filter(it => it.is_available === false).length})</span>
                        </button>
                      )}

                      <div className="flex items-center p-1 bg-zinc-100 rounded-xl border border-zinc-200">'''

if 'Availability Result Toast Notification' not in content and toolbar_anchor in content:
    content = content.replace(toolbar_anchor, replacement_toolbar)

# 7. Use filtered listings in cards view and display off-market badges
card_mapping_anchor = '''                  {/* CARD VIEW MODE */}
                  {viewMode === 'cards' ? (
                    <div className="space-y-6">
                      {selectedReport.ranked_listings?.map((item) => ('''

replacement_card_mapping = '''                  {/* CARD VIEW MODE */}
                  {viewMode === 'cards' ? (
                    <div className="space-y-6">
                      {selectedReport.ranked_listings
                        ?.filter(item => !hideUnavailable || item.is_available !== false)
                        .map((item) => ('''

if card_mapping_anchor in content:
    content = content.replace(card_mapping_anchor, replacement_card_mapping)

# 8. Add off-market badge in card header
card_title_anchor = '''                                  <h4 className="font-bold text-zinc-950 text-base">
                                    {item.title}
                                  </h4>
                                </div>'''

replacement_card_title = '''                                  <h4 className="font-bold text-zinc-950 text-base">
                                    {item.title}
                                  </h4>
                                  {item.is_available === false && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs">
                                      <span>🚫</span>
                                      <span>Off-Market: {item.availability_status || 'Rented'}</span>
                                    </span>
                                  )}
                                </div>'''

if card_title_anchor in content:
    content = content.replace(card_title_anchor, replacement_card_title)

# 9. Add warning notice inside card if off-market
card_dim_anchor = '''                          {/* Card Content */}
                          <div className="space-y-4 pt-2">'''

replacement_card_dim = '''                          {/* Card Content */}
                          <div className="space-y-4 pt-2">
                            {item.is_available === false && (
                              <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs text-rose-900">
                                <WarningCircle size={16} weight="bold" className="text-rose-600 shrink-0" />
                                <span>
                                  <strong>Off-Market Alert:</strong> This listing was removed from Property24 or marked Let Agreed (status: {item.availability_status || 'HTTP 404'}). It is likely no longer available to rent.
                                </span>
                              </div>
                            )}'''

if card_dim_anchor in content:
    content = content.replace(card_dim_anchor, replacement_card_dim)

# 10. Update table view mapping to filter hideUnavailable and show off-market badge
table_mapping_anchor = '''                            {selectedReport.ranked_listings?.map((item) => ('''
replacement_table_mapping = '''                            {selectedReport.ranked_listings
                              ?.filter(item => !hideUnavailable || item.is_available !== false)
                              .map((item) => ('''

if table_mapping_anchor in content:
    content = content.replace(table_mapping_anchor, replacement_table_mapping)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated web/src/app/reports/page.tsx with live availability verification and off-market detection UI!")

