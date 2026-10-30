path = "c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Target block
start_marker = "{/* Advisor Explanation */}"
end_marker = "{/* Card Footer: Takeaway & External View */}"

idx_start = content.find(start_marker)
idx_end = content.find(end_marker)

if idx_start == -1 or idx_end == -1:
    print("Markers not found! start:", idx_start, "end:", idx_end)
else:
    new_block = """{/* Advisor Evaluation */}
                              <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 text-xs text-zinc-800 leading-relaxed font-normal">
                                <span className="font-bold text-zinc-950 block mb-1">Advisor Evaluation:</span>
                                {item.short_explanation}
                              </div>

                              {/* Pros & Cons Container */}
                              {((item.pros && item.pros.length > 0) || (item.cons && item.cons.length > 0)) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                  {/* Pros Container */}
                                  {item.pros && item.pros.length > 0 && (
                                    <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-2xl p-3.5 space-y-2">
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 uppercase tracking-wider">
                                        <CheckCircle size={14} weight="fill" className="text-emerald-600" />
                                        <span>Pros & Highlights</span>
                                      </div>
                                      <ul className="space-y-1.5 text-xs text-emerald-950">
                                        {item.pros.map((pro, pIdx) => (
                                          <li key={pIdx} className="flex items-start gap-2 leading-relaxed">
                                            <span className="text-emerald-500 font-bold mt-0.5">•</span>
                                            <span>{pro}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Cons / Hazards Container */}
                                  {item.cons && item.cons.length > 0 && (
                                    <div className="bg-rose-50/50 border border-rose-200/70 rounded-2xl p-3.5 space-y-2">
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900 uppercase tracking-wider">
                                        <WarningCircle size={14} weight="fill" className="text-rose-600" />
                                        <span>Cons & Drawbacks</span>
                                      </div>
                                      <ul className="space-y-1.5 text-xs text-rose-950">
                                        {item.cons.map((con, cIdx) => (
                                          <li key={cIdx} className="flex items-start gap-2 leading-relaxed font-medium">
                                            <span className="text-rose-500 font-bold mt-0.5">•</span>
                                            <span>{con}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}

                              """
    
    updated_content = content[:idx_start] + new_block + content[idx_end:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(updated_content)
    print("Successfully replaced Advisor Explanation with Pros & Cons Container!")

