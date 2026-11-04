with open('web/src/components/PropertyMap.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [l for l in text.splitlines() if 'anchor' in l.lower() and ('map' in l.lower() or 'icon' in l.lower() or 'svg' in l.lower() or 'badge' in l.lower())]
for m in matches[:15]:
    print(m.strip())

