import sys

path = 'web/src/components/PropertyMap.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace CartoDB tiles with Esri World_Street_Map & OpenStreetMap (Zero API Key, Zero Watermarks)
old_tile_block = """        // CartoDB High-Resolution Global Tiles (Full Zoom 0-20, Zero Watermarks)
        const sub = ['a', 'b', 'c', 'd'][Math.abs(wrappedX + y) % 4];
        if (mapStyle === 'osm') {
          // Detailed Street Map with park greenery and street labels
          baseTileUrl = `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${wrappedX}/${y}.png`;
        } else {
          // Positron Minimalist Monochrome Canvas (Airbnb-grade clean slate)
          baseTileUrl = `https://${sub}.basemaps.cartocdn.com/light_all/${zoom}/${wrappedX}/${y}.png`;
        }"""

new_tile_block = """        // Free Worldwide Basemap Layer (Zero API Key Required, Zero Watermarks)
        if (mapStyle === 'osm') {
          // OpenStreetMap Standard - 100% Free open-source map
          baseTileUrl = `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`;
        } else {
          // Esri World Street Map (Full zoom 0-19 worldwide, no API key required)
          baseTileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${y}/${wrappedX}`;
        }"""

if old_tile_block in content:
    content = content.replace(old_tile_block, new_tile_block)
    print("SUCCESS: Replaced tile provider logic.")
else:
    print("WARNING: Old tile block not found.")

# Add subtle minimalist styling to canvas mode so it looks like Airbnb clean gray canvas
old_container = '<div className="absolute inset-0 pointer-events-none">'
new_container = '<div className={`absolute inset-0 pointer-events-none transition-all duration-300 ${mapStyle === \'canvas\' ? \'grayscale-[85%] contrast-[92%] brightness-[102%]\' : \'\'}`}'

if old_container in content:
    content = content.replace(old_container, new_container)
    print("SUCCESS: Applied minimalist canvas styling.")

# Update attribution
old_attr = "{mapStyle === 'osm' ? '© OpenStreetMap · Voyager' : '© CartoDB Positron · OSM'}"
new_attr = "{mapStyle === 'osm' ? '© OpenStreetMap' : '© Esri · OpenStreetMap'}"

if old_attr in content:
    content = content.replace(old_attr, new_attr)
    print("SUCCESS: Updated attribution.")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch complete.")

