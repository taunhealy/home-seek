file_path = r'c:\Ryoko\Projects\home-seek\web\src\app\search\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Default bedrooms to '1+'
content = content.replace("const [bedrooms, setBedrooms] = useState('2');", "const [bedrooms, setBedrooms] = useState('1+');")
content = content.replace("const [bathrooms, setBathrooms] = useState('1');", "const [bathrooms, setBathrooms] = useState('1+');")

# 2. Bedrooms UI buttons
old_beds_ui = """                  <div className="flex gap-2">
                    {['1', '2', '3', '4+'].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBedrooms(b)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                          bedrooms === b
                            ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                            : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                        }`}
                      >
                        {b} {b === '1' ? 'Bed' : 'Beds'}
                      </button>
                    ))}
                  </div>"""

new_beds_ui = """                  <div className="flex gap-2">
                    {['1+', '2+', '3+', '4+'].map((b) => {
                      const isSelected = bedrooms === b || bedrooms === b.replace('+', '');
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setBedrooms(b)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs font-bold'
                              : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                          }`}
                        >
                          {b} Beds
                        </button>
                      );
                    })}
                  </div>"""

if old_beds_ui in content:
    content = content.replace(old_beds_ui, new_beds_ui)
else:
    # try CRLF
    old_beds_crlf = old_beds_ui.replace('\n', '\r\n')
    new_beds_crlf = new_beds_ui.replace('\n', '\r\n')
    assert old_beds_crlf in content, "old_beds_ui not found"
    content = content.replace(old_beds_crlf, new_beds_crlf)

# 3. Bathrooms UI buttons
old_baths_ui = """                  <div className="flex gap-2">
                    {['1', '2', '3+'].map((bath) => (
                      <button
                        key={bath}
                        type="button"
                        onClick={() => setBathrooms(bath)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                          bathrooms === bath
                            ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                            : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                        }`}
                      >
                        {bath} {bath === '1' ? 'Bath' : 'Baths'}
                      </button>
                    ))}
                  </div>"""

new_baths_ui = """                  <div className="flex gap-2">
                    {['1+', '2+', '3+'].map((bath) => {
                      const isSelected = bathrooms === bath || bathrooms === bath.replace('+', '');
                      return (
                        <button
                          key={bath}
                          type="button"
                          onClick={() => setBathrooms(bath)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs font-bold'
                              : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                          }`}
                        >
                          {bath} Baths
                        </button>
                      );
                    })}
                  </div>"""

if old_baths_ui in content:
    content = content.replace(old_baths_ui, new_baths_ui)
else:
    old_baths_crlf = old_baths_ui.replace('\n', '\r\n')
    new_baths_crlf = new_baths_ui.replace('\n', '\r\n')
    if old_baths_crlf in content:
        content = content.replace(old_baths_crlf, new_baths_crlf)

# 4. Search query and min_bedrooms payload
content = content.replace(
    'search_query: `AI Radar: ${locationQuery} (${bedrooms} Bed, max R${maxPrice})`,',
    'search_query: `AI Radar: ${locationQuery} (${bedrooms.includes("+") ? bedrooms : bedrooms + "+"} Beds, max R${maxPrice})`,'
)
content = content.replace(
    'min_bedrooms: [parseInt(bedrooms) || 1],',
    'min_bedrooms: [parseInt(bedrooms.replace("+", "")) || 1],'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated web/src/app/search/page.tsx with all-plus bedroom & bathroom selectors!")

