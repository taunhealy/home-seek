with open('web/src/app/reports/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target1 = """                              {item.noise_risk === 'high' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                                  <WarningCircle size={14} weight="bold" />
                                  Traffic Noise Trap
                                </span>
                              ) : ("""

repl1 = """                              {item.noise_risk === 'high' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                                  <WarningCircle size={14} weight="bold" />
                                  {item.noise_reason && (item.noise_reason.toLowerCase().includes('bar') || item.noise_reason.toLowerCase().includes('gate') || item.noise_reason.toLowerCase().includes('derwent'))
                                    ? '🚨 Noise Trap (Bar & Gate)'
                                    : 'Traffic Noise Trap'}
                                </span>
                              ) : ("""

target2 = """                                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                            <WarningCircle size={12} weight="bold" />
                                            Traffic Trap
                                          </div>"""

repl2 = """                                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                            <WarningCircle size={12} weight="bold" />
                                            {item.noise_reason && (item.noise_reason.toLowerCase().includes('bar') || item.noise_reason.toLowerCase().includes('gate')) ? 'Bar/Gate Trap' : 'Noise Trap'}
                                          </div>"""

assert target1 in text, "target1 not found"
text = text.replace(target1, repl1)

assert target2 in text, "target2 not found"
text = text.replace(target2, repl2)

with open('web/src/app/reports/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: UI patched with dynamic noise trap badge")

