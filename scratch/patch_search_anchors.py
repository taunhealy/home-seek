with open('c:/Ryoko/Projects/home-seek/web/src/app/search/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
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
                </div>'''

replacement = '''              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* 1. Destination / Google Maps Autocomplete (Primary) */}
                <div className="sm:col-span-6">
                  <PlaceAutocompleteInput
                    value={newAnchorPlace}
                    onChange={(val) => {
                      setNewAnchorPlace(val);
                      if (!newAnchorLabel || newAnchorLabel.trim() === '') {
                        setNewAnchorLabel(val.split(',')[0]);
                      }
                    }}
                    onSelectSuggestion={(s) => {
                      setNewAnchorPlace(s.description);
                      setNewAnchorLabel(s.default_label || s.main_text);
                      if (s.default_mins) {
                        setNewAnchorMins(String(s.default_mins));
                      }
                      if (s.suggested_mode) {
                        setNewAnchorMode(s.suggested_mode as any);
                      }
                    }}
                    placeholder="Search address, venue or landmark (e.g. Kloof St, Gardens)"
                  />
                </div>

                {/* 2. Anchor Label */}
                <div className="sm:col-span-3">
                  <input
                    type="text"
                    placeholder="Label (e.g. Work HQ)"
                    value={newAnchorLabel}
                    onChange={(e) => setNewAnchorLabel(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950 transition-all font-medium"
                  />
                </div>'''

if target in text:
    text = text.replace(target, replacement, 1)
    with open('c:/Ryoko/Projects/home-seek/web/src/app/search/page.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Successfully updated search/page.tsx')
else:
    print('Target not found in search/page.tsx')

