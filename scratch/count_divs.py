with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

open_divs = 0
for i, line in enumerate(lines):
    # simple tag counter
    opens = line.count('<div')
    closes = line.count('</div')
    open_divs += (opens - closes)
    if i >= 1770:
        print(f"Line {i+1}: open_divs={open_divs} | {line.strip()}")

