file_path = r'c:\Ryoko\Projects\home-seek\web\src\app\properties\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_pills = """              <button
                onClick={() => setMinBedrooms(minBedrooms === 2 ? 'all' : 2)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap ${
                  minBedrooms === 2
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                2+ Beds
              </button>

              <button
                onClick={() => setMinBedrooms(minBedrooms === 4 ? 'all' : 4)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap ${
                  minBedrooms === 4
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                4+ Beds
              </button>"""

new_pills = """              {[1, 2, 3, 4].map((beds) => (
                <button
                  key={beds}
                  onClick={() => setMinBedrooms(minBedrooms === beds ? 'all' : beds)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    minBedrooms === beds
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs font-bold'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  {beds}+ Beds
                </button>
              ))}"""

if old_pills in content:
    content = content.replace(old_pills, new_pills)
else:
    old_pills_crlf = old_pills.replace('\n', '\r\n')
    new_pills_crlf = new_pills.replace('\n', '\r\n')
    assert old_pills_crlf in content, "old_pills not found"
    content = content.replace(old_pills_crlf, new_pills_crlf)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated web/src/app/properties/page.tsx bedroom filter pills!")

