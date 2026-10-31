import sys
sys.path.append('api')
from services.acoustic_registry import calculate_haversine_meters

# 4 Derwent Road is at (-33.9328, 18.4095) or where?
# In the satellite image: Roberta Flats is directly on the corner of Malan St and Derwent Rd!
# Malan St connects Derwent Rd to Kloof St (near Aruba).
# Let's check exact coordinates of Aruba and Roberta Flats!
print("Distance test:")
# Aruba Bar is at ~120 Kloof St: -33.9323, 18.4108
# Roberta Flats is at 4 Derwent Rd: -33.9326, 18.4099
d = calculate_haversine_meters(-33.9326, 18.4099, -33.9323, 18.4108)
print(f"Exact distance from 4 Derwent to Aruba: {d:.1f} meters!")

