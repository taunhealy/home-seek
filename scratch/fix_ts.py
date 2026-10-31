with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add min_bedrooms to IntelligenceReport interface
target1 = '''  max_price?: number;
  ranked_listings: RankedItem[];'''

replacement1 = '''  max_price?: number;
  min_bedrooms?: number;
  ranked_listings: RankedItem[];'''

text = text.replace(target1, replacement1, 1)

# Fix line 242 casting
target2 = 'const minBeds = selectedReport.min_bedrooms ? Number(selectedReport.min_bedrooms) : 1;'
replacement2 = 'const minBeds = (selectedReport as any)?.min_bedrooms ? Number((selectedReport as any).min_bedrooms) : 1;'
text = text.replace(target2, replacement2, 1)

with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed min_bedrooms TypeScript type in reports page')

