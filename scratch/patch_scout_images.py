import re

path = 'c:/Ryoko/Projects/home-seek/api/services/ai_scout.py'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# Add DEFAULT_APARTMENT_PHOTOS near top if not present
if 'DEFAULT_APARTMENT_PHOTOS' not in code:
    code = '''DEFAULT_APARTMENT_PHOTOS = [
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80"
]

''' + code

# Replace image assignment in LLM ranking block
old_llm_img = r'image=base\.get\("image"\),\s*images=base\.get\("images"\) or \(\[base\["image"\]\] if base\.get\("image"\) else \[\]\),'
new_llm_img = '''image=base.get("image") or (base.get("images")[0] if isinstance(base.get("images"), list) and base.get("images") else DEFAULT_APARTMENT_PHOTOS[len(final_ranked) % len(DEFAULT_APARTMENT_PHOTOS)]),
                        images=base.get("images") or ([base["image"]] if base.get("image") else [DEFAULT_APARTMENT_PHOTOS[len(final_ranked) % len(DEFAULT_APARTMENT_PHOTOS)]]),'''
code, c1 = re.subn(old_llm_img, new_llm_img, code)
print('c1 (llm image fallback):', c1)

# Replace image assignment in deterministic ranking block
old_det_img = r'image=c\.get\("image"\),\s*images=c\.get\("images"\) or \(\[c\["image"\]\] if c\.get\("image"\) else \[\]\),'
new_det_img = '''image=c.get("image") or (c.get("images")[0] if isinstance(c.get("images"), list) and c.get("images") else DEFAULT_APARTMENT_PHOTOS[idx % len(DEFAULT_APARTMENT_PHOTOS)]),
                images=c.get("images") or ([c["image"]] if c.get("image") else [DEFAULT_APARTMENT_PHOTOS[idx % len(DEFAULT_APARTMENT_PHOTOS)]]),'''
code, c2 = re.subn(old_det_img, new_det_img, code)
print('c2 (deterministic image fallback):', c2)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)
print('Saved ai_scout.py')

