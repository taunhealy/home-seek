path = "c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

target = """                                                                          <p className="text-xs text-zinc-700 leading-relaxed mb-2 font-normal">
                                                                            {item.short_explanation}
                                                                          </p>"""

replacement = """                                                                          <p className="text-xs text-zinc-700 leading-relaxed mb-2 font-normal">
                                                                            {item.short_explanation}
                                                                          </p>
                                                                          {item.pros && item.pros.length > 0 && (
                                                                            <div className="space-y-1 mb-2">
                                                                              {item.pros.map((pro, pIdx) => (
                                                                                <div key={pIdx} className="text-[11px] font-medium leading-tight text-emerald-800 flex items-start gap-1 bg-emerald-50/70 p-1 rounded-lg border border-emerald-200/50">
                                                                                  <span className="text-emerald-500 font-bold">•</span>
                                                                                  <span>{pro}</span>
                                                                                </div>
                                                                              ))}
                                                                            </div>
                                                                          )}"""

if target in content:
    content = content.replace(target, replacement, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Table view pros added successfully!")
else:
    print("Target not found in Table view!")

