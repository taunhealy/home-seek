with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''<ListingImageGallery
                            initialImage={item.image}
                            listingUrl={item.url}
                            title={item.title}
                            onOpenRealViewSlider={(url) => setRealviewTarget({ url, title: item.title })}
                          />'''

replacement = '''<ListingImageGallery
                            initialImage={item.image}
                            images={item.images}
                            listingUrl={item.url}
                            title={item.title}
                            onOpenRealViewSlider={(url) => setRealviewTarget({ url, title: item.title })}
                          />'''

if target in text:
    text = text.replace(target, replacement, 1)
    with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Successfully patched reports/page.tsx')
else:
    print('Target not found')

