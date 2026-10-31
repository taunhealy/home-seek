with open('api/services/ai_scout.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_tile_loop = False
for i, line in enumerate(lines):
    if line.strip().startswith('for i in range(1, len(tiles), 2):'):
        in_tile_loop = True
        new_lines.append(line)
        continue
    if in_tile_loop:
        if line.strip().startswith('return listings'):
            in_tile_loop = False
            new_lines.append('    return listings\n')
            continue
        # Indent lines inside tile loop by 4 spaces (to 12 spaces)
        if line.startswith('        '):
            new_lines.append('    ' + line)
        else:
            new_lines.append(line)
    else:
        new_lines.append(line)

with open('api/services/ai_scout.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("SUCCESS: Fixed indentation in ai_scout.py")

