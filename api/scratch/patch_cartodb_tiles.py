path = 'web/src/components/PropertyMap.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Esri tile provider logic with CartoDB Positron & Voyager
old_tiles = """        if (mapStyle === 'osm') {
          // OpenStreetMap Standard - 100% Free open-source map
          baseTileUrl = `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`;
        } else {
          // Esri World Light Gray Canvas - Airbnb-style minimalist monochrome map
          baseTileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${zoom}/${y}/${wrappedX}`;
          refTileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/${zoom}/${y}/${wrappedX}`;
        }"""

new_tiles = """        // CartoDB High-Resolution Global Tiles (Full Zoom 0-20, Zero Watermarks)
        const sub = ['a', 'b', 'c', 'd'][Math.abs(wrappedX + y) % 4];
        if (mapStyle === 'osm') {
          // Detailed Street Map with park greenery and street labels
          baseTileUrl = `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${wrappedX}/${y}.png`;
        } else {
          // Positron Minimalist Monochrome Canvas (Airbnb-grade clean slate)
          baseTileUrl = `https://${sub}.basemaps.cartocdn.com/light_all/${zoom}/${wrappedX}/${y}.png`;
        }"""

if old_tiles in content:
    content = content.replace(old_tiles, new_tiles)
    print("SUCCESS: Replaced tile provider with CartoDB Positron & Voyager.")
else:
    print("WARNING: Old tiles block not matched, searching...")

# Replace attribution
old_attr = "{mapStyle === 'osm' ? '© OpenStreetMap' : '© Esri Canvas'}"
new_attr = "{mapStyle === 'osm' ? '© OpenStreetMap · Voyager' : '© CartoDB Positron · OSM'}"

if old_attr in content:
    content = content.replace(old_attr, new_attr)
    print("SUCCESS: Updated map attribution.")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

