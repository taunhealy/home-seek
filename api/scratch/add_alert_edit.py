file_path = r'c:\Ryoko\Projects\home-seek\web\src\app\alerts\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add PencilSimple, X to Phosphor Icons import
if 'PencilSimple,' not in content:
    content = content.replace('Eye\n} from', 'Eye,\n  PencilSimple,\n  X\n} from')

# 2. Add extra fields to AlertItem interface
if 'prompt?: string;' not in content:
    content = content.replace(
        'commute_anchors?: any[];',
        'commute_anchors?: any[];\n  prompt?: string;\n  personal_tastes?: string;\n  require_private_garden?: boolean;\n  exclude_shared_house?: boolean;'
    )

# 3. Add edit state and handlers
state_anchor = 'const [toastMessage, setToastMessage] = useState<string | null>(null);'
edit_logic = '''const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit Alert State
  const [editingAlert, setEditingAlert] = useState<AlertItem | null>(null);
  const [editArea, setEditArea] = useState('');
  const [editMaxPrice, setEditMaxPrice] = useState('');
  const [editMinBedrooms, setEditMinBedrooms] = useState('1');
  const [editPropertyType, setEditPropertyType] = useState('Apartment');
  const [editPrompt, setEditPrompt] = useState('');
  const [editPersonalTastes, setEditPersonalTastes] = useState('');
  const [editIndependentLiving, setEditIndependentLiving] = useState(false);
  const [editPrivateEntrance, setEditPrivateEntrance] = useState(false);
  const [editPrivateGarden, setEditPrivateGarden] = useState(false);
  const [editExcludeLandlord, setEditExcludeLandlord] = useState(false);
  const [editExcludeShared, setEditExcludeShared] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleOpenEdit = (alert: AlertItem) => {
    setEditingAlert(alert);
    setEditArea(alert.target_area || alert.search_query?.replace(/^AI Radar:\s*/, '').split('(')[0].trim() || 'Gardens');
    setEditMaxPrice(alert.max_price ? String(alert.max_price) : '18000');
    
    // Parse bedrooms
    let bedsVal = '1';
    if (alert.min_bedrooms) {
      if (Array.isArray(alert.min_bedrooms) && alert.min_bedrooms.length > 0) {
        bedsVal = String(alert.min_bedrooms[0]);
      } else {
        bedsVal = String(alert.min_bedrooms);
      }
    }
    setEditMinBedrooms(bedsVal.includes('+') ? bedsVal : `${bedsVal}+`);
    setEditPropertyType(alert.property_type || 'Apartment');
    setEditPrompt(alert.prompt || '');
    setEditPersonalTastes(alert.personal_tastes || '');
    setEditIndependentLiving(!!alert.require_independent_living);
    setEditPrivateEntrance(!!alert.require_private_entrance);
    setEditPrivateGarden(!!alert.require_private_garden);
    setEditExcludeLandlord(!!alert.exclude_landlord_on_site);
    setEditExcludeShared(!!alert.exclude_shared_house);
  };

  const handleSaveEdit = async () => {
    if (!editingAlert) return;
    const searchId = editingAlert.id || editingAlert.search_id;
    if (!searchId) return;

    const uid = profile?.id || user?.uid || 'taun_test_user';
    const bedsNum = parseInt(editMinBedrooms.replace('+', '')) || 1;
    const maxP = parseInt(editMaxPrice) || 18000;

    const updatedData = {
      target_area: editArea,
      search_query: `AI Radar: ${editArea} (${bedsNum}+ Beds, max R${maxP})`,
      max_price: maxP,
      min_bedrooms: [bedsNum],
      property_type: editPropertyType,
      prompt: editPrompt,
      personal_tastes: editPersonalTastes,
      require_independent_living: editIndependentLiving,
      require_private_entrance: editPrivateEntrance,
      require_private_garden: editPrivateGarden,
      exclude_landlord_on_site: editExcludeLandlord,
      exclude_shared_house: editExcludeShared,
    };

    try {
      setIsSavingEdit(true);
      const res = await fetchWithAuth(`/update-alert/${uid}/${searchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (res && res.ok) {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === searchId || a.search_id === searchId ? { ...a, ...updatedData } : a
          )
        );
        showToast(`✓ Radar alert for ${editArea} updated successfully!`);
        setEditingAlert(null);
      } else {
        showToast('Failed to update alert on server.');
      }
    } catch (err) {
      console.error('Error saving alert:', err);
      showToast('Error saving changes to alert.');
    } finally {
      setIsSavingEdit(false);
    }
  };'''

if 'handleOpenEdit' not in content:
    content = content.replace(state_anchor, edit_logic)

# 4. Add Edit button on each alert card
old_view_btn = '''                      {/* View Matches in Properties Feed */}
                      <Link
                        href={`/properties?search=${encodeURIComponent(alert.target_area || '')}`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-zinc-800 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                      >
                        <Eye size={15} weight="bold" />
                        <span>View Properties</span>
                      </Link>'''

new_view_and_edit_btns = '''                      {/* View Matches in Properties Feed */}
                      <Link
                        href={`/properties?search=${encodeURIComponent(alert.target_area || '')}`}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-800 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                      >
                        <Eye size={15} weight="bold" />
                        <span>View</span>
                      </Link>

                      {/* Edit Alert Button */}
                      <button
                        onClick={() => handleOpenEdit(alert)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-800 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 transition-colors cursor-pointer"
                        title="Edit alert parameters, budget, and lifestyle filters"
                      >
                        <PencilSimple size={14} weight="bold" />
                        <span>Edit</span>
                      </button>'''

if old_view_btn in content:
    content = content.replace(old_view_btn, new_view_and_edit_btns)
else:
    old_view_crlf = old_view_btn.replace('\n', '\r\n')
    new_view_crlf = new_view_and_edit_btns.replace('\n', '\r\n')
    if old_view_crlf in content:
        content = content.replace(old_view_crlf, new_view_crlf)

# 5. Add Edit Modal before </main>
modal_code = '''
      {/* EDIT ALERT MODAL */}
      <AnimatePresence>
        {editingAlert && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-zinc-200 max-w-xl w-full p-6 sm:p-7 space-y-5 shadow-2xl my-8"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
                    <PencilSimple size={20} weight="bold" className="text-zinc-700" />
                    <span>Edit Radar Alert</span>
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Update location, budget ceiling, bedrooms, and lifestyle criteria.
                  </p>
                </div>
                <button
                  onClick={() => setEditingAlert(null)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Edit Form Body */}
              <div className="space-y-4 text-xs">
                {/* Target Area */}
                <div>
                  <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                    Target Area / Suburbs
                  </label>
                  <input
                    type="text"
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
                    placeholder="e.g. Gardens, Tamboerskloof"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all font-medium"
                  />
                </div>

                {/* Price Ceiling & Bedrooms */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                      Max Price (Budget Ceiling)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R</span>
                      <input
                        type="number"
                        value={editMaxPrice}
                        onChange={(e) => setEditMaxPrice(e.target.value)}
                        placeholder="18000"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                      Min Bedrooms
                    </label>
                    <div className="flex gap-1.5">
                      {['1+', '2+', '3+', '4+'].map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setEditMinBedrooms(b)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            editMinBedrooms === b
                              ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                              : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Property Type */}
                <div>
                  <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                    Property Type
                  </label>
                  <select
                    value={editPropertyType}
                    onChange={(e) => setEditPropertyType(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all font-medium"
                  >
                    <option value="Apartment">Apartment / Flat</option>
                    <option value="House">House</option>
                    <option value="Townhouse">Townhouse</option>
                    <option value="Any">Any Property Type</option>
                  </select>
                </div>

                {/* Routine & Tastes */}
                <div>
                  <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                    AI Routine & Desires Prompt
                  </label>
                  <textarea
                    rows={2}
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Weekly routine, mountain biking, cafe work, acoustic desires..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                    Acoustic & Lifestyle Dealbreakers
                  </label>
                  <input
                    type="text"
                    value={editPersonalTastes}
                    onChange={(e) => setEditPersonalTastes(e.target.value)}
                    placeholder="Acoustic quiet for music, secure bike storage, quiet street..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-950 focus:bg-white focus:outline-none focus:border-zinc-950 transition-all"
                  />
                </div>

                {/* Privacy Shield Toggles */}
                <div className="pt-2 border-t border-zinc-100 space-y-2">
                  <span className="block text-xs font-bold text-zinc-800 uppercase tracking-wider">
                    Privacy & Autonomy Shield
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100/70 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={editIndependentLiving}
                        onChange={(e) => setEditIndependentLiving(e.target.checked)}
                        className="rounded text-zinc-950 accent-zinc-950"
                      />
                      <span className="font-semibold text-zinc-800">Independent Living</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100/70 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={editPrivateEntrance}
                        onChange={(e) => setEditPrivateEntrance(e.target.checked)}
                        className="rounded text-zinc-950 accent-zinc-950"
                      />
                      <span className="font-semibold text-zinc-800">Private Entrance</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100/70 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={editExcludeLandlord}
                        onChange={(e) => setEditExcludeLandlord(e.target.checked)}
                        className="rounded text-zinc-950 accent-zinc-950"
                      />
                      <span className="font-semibold text-zinc-800">Exclude Landlord On-Site</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100/70 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={editExcludeShared}
                        onChange={(e) => setEditExcludeShared(e.target.checked)}
                        className="rounded text-zinc-950 accent-zinc-950"
                      />
                      <span className="font-semibold text-zinc-800">Exclude Shared House</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setEditingAlert(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
'''

if '</main>' in content and 'EDIT ALERT MODAL' not in content:
    content = content.replace('      </main>', modal_code + '\n      </main>')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully added Edit button and Edit Alert Modal to web/src/app/alerts/page.tsx!")

