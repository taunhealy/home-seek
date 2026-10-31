for path in [r'c:\Ryoko\Projects\home-seek\api\main.py', r'c:\Ryoko\Projects\home-seek\api\main_local.py']:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    old_beds = """        # [BEDROOMS]
        if bedrooms and bedrooms != 'any':
            l_beds = h.get("bedrooms")
            if l_beds is None:
                continue
            if bedrooms.endswith("+"):
                try:
                    if l_beds < float(bedrooms[:-1]): continue
                except ValueError: pass
            else:
                try:
                    if l_beds < float(bedrooms): continue
                except ValueError: pass"""

    new_beds = """        # [BEDROOMS] Always minimum-based (1+, 2+, 3+, etc.)
        if bedrooms and str(bedrooms).lower() not in ['any', 'all', '']:
            l_beds = h.get("bedrooms")
            if l_beds is None:
                continue
            try:
                min_b = float(str(bedrooms).replace("+", "").strip())
                if l_beds < min_b:
                    continue
            except (ValueError, TypeError):
                pass"""

    if old_beds in content:
        content = content.replace(old_beds, new_beds)
    else:
        old_beds_crlf = old_beds.replace('\n', '\r\n')
        new_beds_crlf = new_beds.replace('\n', '\r\n')
        if old_beds_crlf in content:
            content = content.replace(old_beds_crlf, new_beds_crlf)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Successfully updated main.py and main_local.py bedroom filtering!")

