with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update filteredRankedListings logic
old_filter = '''  const filteredRankedListings = useMemo(() => {
    if (!selectedReport?.ranked_listings) return [];
    return selectedReport.ranked_listings.filter(
      (item) => (!hideUnavailable || item.is_available !== false) && (!selectedReport.max_price || !item.price || item.price <= selectedReport.max_price)
    );
  }, [selectedReport, hideUnavailable]);'''

new_filter = '''  const filteredRankedListings = useMemo(() => {
    if (!selectedReport?.ranked_listings) return [];
    const minBeds = selectedReport.min_bedrooms ? Number(selectedReport.min_bedrooms) : 1;
    return selectedReport.ranked_listings.filter((item) => {
      if (hideUnavailable && item.is_available === false) return false;
      if (selectedReport.max_price && item.price && item.price > selectedReport.max_price) return false;
      if (minBeds && item.bedrooms !== undefined && item.bedrooms !== null && item.bedrooms < minBeds) return false;
      return true;
    });
  }, [selectedReport, hideUnavailable]);'''

text = text.replace(old_filter, new_filter, 1)

# 2. Update rank in mapProperties
old_map_rank = 'rank: item.rank || idx + 1,'
new_map_rank = 'rank: idx + 1,'
text = text.replace(old_map_rank, new_map_rank, 1)

# 3. Update count badge in header
old_count = '<span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-semibold">\n                          {selectedReport.ranked_listings?.length || 0}\n                        </span>'
new_count = '<span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-semibold">\n                          {filteredRankedListings.length}\n                        </span>'
text = text.replace(old_count, new_count, 1)

# 4. Update card map iteration and badge
old_card_map = '{filteredRankedListings.map((item) => {'
new_card_map = '{filteredRankedListings.map((item, idx) => {'
text = text.replace(old_card_map, new_card_map, 1)

old_badge = '<span className="w-6 h-6 rounded-lg bg-zinc-950 text-white font-extrabold text-xs flex items-center justify-center shrink-0">\n                                    #{item.rank}\n                                  </span>'
new_badge = '<span className="w-6 h-6 rounded-lg bg-zinc-950 text-white font-extrabold text-xs flex items-center justify-center shrink-0">\n                                    #{idx + 1}\n                                  </span>'
text = text.replace(old_badge, new_badge, 1)

# 5. Update Table View to use filteredRankedListings with idx + 1
old_table_body = '''                          <tbody className="divide-y divide-zinc-100 text-sm">
                            {selectedReport.ranked_listings
                              ?.filter(item => (!hideUnavailable || item.is_available !== false) && (!selectedReport.max_price || !item.price || item.price <= selectedReport.max_price))
                              .map((item) => (
                              <tr key={item.id || item.listing_id} className="hover:bg-zinc-50/50 transition-colors group">
                                {/* Title, Address, Agency */}
                                <td className="py-4 px-4 align-top max-w-xs">
                                  <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-zinc-950 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                      #{item.rank}
                                    </div>'''

new_table_body = '''                          <tbody className="divide-y divide-zinc-100 text-sm">
                            {filteredRankedListings.map((item, idx) => (
                              <tr key={item.id || item.listing_id} className="hover:bg-zinc-50/50 transition-colors group">
                                {/* Title, Address, Agency */}
                                <td className="py-4 px-4 align-top max-w-xs">
                                  <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-zinc-950 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                      #{idx + 1}
                                    </div>'''

text = text.replace(old_table_body, new_table_body, 1)

with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Successfully patched reports page ranking & numbering!')

