file_path = r'c:\Ryoko\Projects\home-seek\web\src\app\search\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Import PlaceAutocompleteInput
import_target = "import { AreaPillsInput } from '@/components/AreaPillsInput';"
import_replacement = "import { AreaPillsInput } from '@/components/AreaPillsInput';\nimport { PlaceAutocompleteInput } from '@/components/PlaceAutocompleteInput';"

if 'PlaceAutocompleteInput' not in content:
    content = content.replace(import_target, import_replacement)

# 2. Add newAnchorMode state
state_target = "const [newAnchorMins, setNewAnchorMins] = useState('25');"
state_replacement = "const [newAnchorMins, setNewAnchorMins] = useState('25');\n  const [newAnchorMode, setNewAnchorMode] = useState<'driving' | 'walking' | 'bicycling' | 'transit'>('driving');"

if 'newAnchorMode' not in content:
    content = content.replace(state_target, state_replacement)

# 3. Update addAnchor to use newAnchorMode
old_add_anchor = """  const addAnchor = () => {
    if (!newAnchorLabel.trim() || !newAnchorPlace.trim()) return;
    const newAnchor: CommuteAnchor = {
      id: `anchor-${Date.now()}`,
      label: newAnchorLabel,
      target_place: newAnchorPlace,
      max_commute_mins: parseInt(newAnchorMins) || 30,
      max_distance_km: 20,
      commute_mode: 'driving',
    };
    setAnchors([...anchors, newAnchor]);
    setNewAnchorLabel('');
  };"""

new_add_anchor = """  const addAnchor = () => {
    if (!newAnchorLabel.trim() || !newAnchorPlace.trim()) return;
    const newAnchor: CommuteAnchor = {
      id: `anchor-${Date.now()}`,
      label: newAnchorLabel,
      target_place: newAnchorPlace,
      max_commute_mins: parseInt(newAnchorMins) || 30,
      max_distance_km: 25,
      commute_mode: newAnchorMode || 'driving',
    };
    setAnchors([...anchors, newAnchor]);
    setNewAnchorLabel('');
    setNewAnchorPlace('');
    setNewAnchorMins('25');
    setNewAnchorMode('driving');
  };"""

if old_add_anchor in content:
    content = content.replace(old_add_anchor, new_add_anchor)
else:
    old_add_crlf = old_add_anchor.replace('\n', '\r\n')
    new_add_crlf = new_add_anchor.replace('\n', '\r\n')
    if old_add_crlf in content:
        content = content.replace(old_add_crlf, new_add_crlf)

# 4. Replace Add Anchor form with Google Maps Autocomplete and Preset Anchors
old_form = """            {/* Add New Anchor Form */}
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
              <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">Add Proximity Anchor</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Label (e.g. Work HQ)"
                  value={newAnchorLabel}
                  onChange={(e) => setNewAnchorLabel(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
                <input
                  type="text"
                  placeholder="Destination / Address"
                  value={newAnchorPlace}
                  onChange={(e) => setNewAnchorPlace(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Max mins (e.g. 25)"
                    value={newAnchorMins}
                    onChange={(e) => setNewAnchorMins(e.target.value)}
                    className="w-24 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                  <button
                    onClick={addAnchor}
                    className="flex-1 bg-zinc-950 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} weight="bold" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>"""

new_form = """            {/* Add New Anchor Form with Google Maps Autocomplete */}
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">Add Proximity Anchor</span>
                <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
                  <span>🗺️</span>
                  <span>Google Maps Suggestions</span>
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    placeholder="Label (e.g. Work HQ)"
                    value={newAnchorLabel}
                    onChange={(e) => setNewAnchorLabel(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950 transition-all"
                  />
                </div>

                <div className="sm:col-span-5">
                  <PlaceAutocompleteInput
                    value={newAnchorPlace}
                    onChange={(val) => setNewAnchorPlace(val)}
                    onSelectSuggestion={(s) => {
                      if (!newAnchorLabel || newAnchorLabel.trim() === '') {
                        setNewAnchorLabel(s.default_label);
                      }
                      if (s.default_mins) {
                        setNewAnchorMins(String(s.default_mins));
                      }
                      if (s.suggested_mode) {
                        setNewAnchorMode(s.suggested_mode as any);
                      }
                    }}
                    placeholder="Search address, cafe, gym, work hub..."
                  />
                </div>

                <div className="sm:col-span-3 flex gap-2">
                  <input
                    type="number"
                    placeholder="Mins (e.g. 20)"
                    value={newAnchorMins}
                    onChange={(e) => setNewAnchorMins(e.target.value)}
                    title="Maximum desired commute time in minutes"
                    className="w-20 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950"
                  />
                  <button
                    type="button"
                    onClick={addAnchor}
                    className="flex-1 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus size={14} weight="bold" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                <span className="text-zinc-500 font-semibold text-[11px] mr-1">Popular Anchors:</span>
                {[
                  { label: 'Work (Amazon River Club)', place: 'Amazon River Club, Observatory', mins: 25, mode: 'driving', icon: '💼' },
                  { label: 'Kloof Street Cafes', place: 'Kloof Street, Gardens', mins: 10, mode: 'walking', icon: '☕' },
                  { label: 'Table Mountain Trails', place: 'Deer Park Drive, Table Mountain', mins: 15, mode: 'bicycling', icon: '🚵' },
                  { label: 'Virgin Active Kloof', place: 'Virgin Active, Kloof Street, Gardens', mins: 10, mode: 'walking', icon: '🏋️' },
                  { label: 'Cape Town CBD', place: 'Cape Town CBD', mins: 15, mode: 'driving', icon: '🏙️' },
                  { label: 'Camps Bay Beach', place: 'Camps Bay Beach, Cape Town', mins: 15, mode: 'driving', icon: '🏖️' },
                ].map((preset, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => {
                      setNewAnchorLabel(preset.label);
                      setNewAnchorPlace(preset.place);
                      setNewAnchorMins(String(preset.mins));
                      setNewAnchorMode(preset.mode as any);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 hover:text-zinc-950 text-[11px] font-medium transition-all cursor-pointer shadow-2xs"
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>"""

if old_form in content:
    content = content.replace(old_form, new_form)
else:
    old_form_crlf = old_form.replace('\n', '\r\n')
    new_form_crlf = new_form.replace('\n', '\r\n')
    if old_form_crlf in content:
        content = content.replace(old_form_crlf, new_form_crlf)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully integrated PlaceAutocompleteInput into search/page.tsx!")

