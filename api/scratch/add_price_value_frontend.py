path = "c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update RankedItem interface
target1 = "agency_hellopeter_rating?: number;"
replacement1 = "agency_hellopeter_rating?: number;\n  price_value_pct?: number | null;"

if target1 in content:
    content = content.replace(target1, replacement1, 1)
    print("RankedItem updated!")
else:
    print("target1 not found")

# 2. Update Card View price container
target2 = """                                                      <div className="text-left sm:text-right pl-8 sm:pl-0 shrink-0">
                                                        <div className="font-extrabold text-zinc-950 text-lg">
                                                          {item.price ? `R ${item.price.toLocaleString()}` : 'Contact'}
                                                        </div>
                                                        <div className="text-[11px] text-zinc-400">per month</div>
                                                      </div>"""

replacement2 = """                                                      <div className="flex items-center gap-2.5 sm:justify-end pl-8 sm:pl-0 shrink-0">
                                                        {item.price_value_pct !== null && item.price_value_pct !== undefined && (
                                                          <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors ${
                                                            item.price_value_pct <= -4
                                                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                              : item.price_value_pct >= 4
                                                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                                                              : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                                          }`}>
                                                            {item.price_value_pct < 0
                                                              ? `${Math.abs(item.price_value_pct)}% underpriced`
                                                              : item.price_value_pct > 0
                                                              ? `${item.price_value_pct}% overpriced`
                                                              : 'Fair Value'}
                                                          </div>
                                                        )}

                                                        <div className="text-left sm:text-right">
                                                          <div className="font-extrabold text-zinc-950 text-lg whitespace-nowrap">
                                                            {item.price ? `R ${item.price.toLocaleString()}` : 'Contact'}
                                                          </div>
                                                          <div className="text-[11px] text-zinc-400">per month</div>
                                                        </div>
                                                      </div>"""

if target2 in content:
    content = content.replace(target2, replacement2, 1)
    print("Card View price updated!")
else:
    # Try normalizing newlines
    target2_alt = target2.replace("\r\n", "\n")
    content_norm = content.replace("\r\n", "\n")
    if target2_alt in content_norm:
        content_norm = content_norm.replace(target2_alt, replacement2.replace("\r\n", "\n"), 1)
        content = content_norm
        print("Card View price updated (normalized)!")
    else:
        print("target2 not found!")

# 3. Update Table View price column
target3 = """                                {/* Price */}
                                                                      <td className="py-4 px-4 align-top whitespace-nowrap">
                                                                        <div className="font-extrabold text-zinc-950 text-base">
                                                                          {item.price ? `R ${item.price.toLocaleString()}` : 'Contact'}
                                                                        </div>
                                                                      <div className="text-[11px] text-zinc-400">per month</div>
                                                                    </td>"""

replacement3 = """                                {/* Price */}
                                                                      <td className="py-4 px-4 align-top whitespace-nowrap">
                                                                        <div className="flex items-center gap-2">
                                                                          {item.price_value_pct !== null && item.price_value_pct !== undefined && (
                                                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                                                              item.price_value_pct <= -4
                                                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                                                : item.price_value_pct >= 4
                                                                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                                                                : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                                                            }`}>
                                                                              {item.price_value_pct < 0
                                                                                ? `-${Math.abs(item.price_value_pct)}%`
                                                                                : item.price_value_pct > 0
                                                                                ? `+${item.price_value_pct}%`
                                                                                : 'Fair'}
                                                                            </span>
                                                                          )}
                                                                          <div>
                                                                            <div className="font-extrabold text-zinc-950 text-base">
                                                                              {item.price ? `R ${item.price.toLocaleString()}` : 'Contact'}
                                                                            </div>
                                                                            <div className="text-[11px] text-zinc-400">per month</div>
                                                                          </div>
                                                                        </div>
                                                                      </td>"""

content_norm = content.replace("\r\n", "\n")
target3_norm = target3.replace("\r\n", "\n")
if target3_norm in content_norm:
    content_norm = content_norm.replace(target3_norm, replacement3.replace("\r\n", "\n"), 1)
    content = content_norm
    print("Table View price updated!")
else:
    print("target3 not found!")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Saved web/src/app/reports/page.tsx successfully!")

