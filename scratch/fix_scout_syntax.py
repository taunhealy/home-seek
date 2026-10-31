with open('c:/Ryoko/Projects/home-seek/api/services/ai_scout.py', 'r', encoding='utf-8') as f:
    text = f.read()

bad = "img_m = re.search(r\\'(?:lazy-src|data-original|data-image-url|data-lightbox-src|src)=\"(https://images\\.prop24\\.com/[^\"]+)\"\\', b)"
good = 'img_m = re.search(r"""(?:lazy-src|data-original|data-image-url|data-lightbox-src|src)="(https://images\\.prop24\\.com/[^"]+)""", b)'

text = text.replace(bad, good)
with open('c:/Ryoko/Projects/home-seek/api/services/ai_scout.py', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed ai_scout.py line 224')

