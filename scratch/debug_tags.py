with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's inspect from line 620 to 650
lines = text.split('\n')
for i in range(620, 660):
    if i < len(lines):
        print(f"{i+1}: {lines[i]}")

print("---")
# And lines 1765 to 1790
for i in range(1765, 1795):
    if i < len(lines):
        print(f"{i+1}: {lines[i]}")

