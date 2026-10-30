with open("c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add shouldShowLiftBadge helper function
helper_func = """  const shouldShowLiftBadge = (floor?: string | null, hasLift?: string | null) => {
    if (!hasLift) return false;
    if (hasLift === 'N/A (Ground)') return false;
    if (!floor) return hasLift === 'yes' || hasLift === 'no';
    const f = floor.toLowerCase();
    if (f.includes('1st') || f.includes('first') || f.includes('ground')) {
      return false;
    }
    return true;
  };
"""

target_pos = "  const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';"
content = content.replace(target_pos, helper_func + "\n" + target_pos, 1)

# 2. Update Card View lift condition
old_card_lift = """                                {/* Lift / Elevator Badge */}
                                {item.has_lift && (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                                    item.has_lift === 'yes'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : item.has_lift === 'no'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : item.has_lift === 'N/A (Ground)'
                                      ? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                      : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                                  }`}>
                                    {item.has_lift === 'yes' ? '🛗 Lift Available' : item.has_lift === 'no' ? '⚠️ Stairs Only (No Lift)' : item.has_lift === 'N/A (Ground)' ? '🌿 Ground Level' : '🛗 Lift: Unknown'}
                                  </span>
                                )}"""

new_card_lift = """                                {/* Lift / Elevator Badge (Only for 2nd floor and above where stairs matter) */}
                                {shouldShowLiftBadge(item.floor_number, item.has_lift) && (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                                    item.has_lift === 'yes'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : item.has_lift === 'no'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                                  }`}>
                                    {item.has_lift === 'yes' ? '🛗 Lift Available' : item.has_lift === 'no' ? '⚠️ Stairs Only (No Lift)' : '🛗 Lift: Unknown'}
                                  </span>
                                )}"""

content = content.replace(old_card_lift, new_card_lift, 1)

# 3. Update Table View lift condition
old_table_lift = """                                  {item.has_lift && (
                                    <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-max ${
                                      item.has_lift === 'yes' ? 'bg-emerald-50 text-emerald-700' : item.has_lift === 'no' ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-600'
                                    }`}>
                                      {item.has_lift === 'yes' ? 'Lift' : item.has_lift === 'no' ? 'Stairs' : 'Lift ?'}
                                    </div>
                                  )}"""

new_table_lift = """                                  {shouldShowLiftBadge(item.floor_number, item.has_lift) && (
                                    <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-max ${
                                      item.has_lift === 'yes' ? 'bg-emerald-50 text-emerald-700' : item.has_lift === 'no' ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-600'
                                    }`}>
                                      {item.has_lift === 'yes' ? 'Lift' : item.has_lift === 'no' ? 'Stairs' : 'Lift ?'}
                                    </div>
                                  )}"""

content = content.replace(old_table_lift, new_table_lift, 1)

with open("c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated shouldShowLiftBadge in web/src/app/reports/page.tsx successfully!")

