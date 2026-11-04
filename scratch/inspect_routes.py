with open('api/main.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if '/explore-listings' in l or '/ai-scout' in l:
        print(f"Line {i+1}: {l.strip()}")
        for j in range(i, min(i+40, len(lines))):
            print(f"  {lines[j].rstrip()}")
        print("="*60)

