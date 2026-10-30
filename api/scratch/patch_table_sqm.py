with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                                  <div className="flex items-center gap-1">
                                    <Car size={14} className="text-zinc-400" />
                                    <span>{item.parking ? `${item.parking} Bay` : 'Street'}</span>
                                  </div>'''

replacement = '''                                  <div className="flex items-center gap-1">
                                    <Car size={14} className="text-zinc-400" />
                                    <span>{item.parking ? `${item.parking} Bay` : 'Street'}</span>
                                  </div>
                                  {item.sqm && (
                                    <div className="flex items-center gap-1 font-semibold text-zinc-800">
                                      <Ruler size={14} className="text-zinc-500" />
                                      <span>{item.sqm} m²</span>
                                    </div>
                                  )}'''

if target in content:
    content = content.replace(target, replacement, 1)
    with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS")
else:
    print("TARGET NOT FOUND")

