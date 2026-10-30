from typing import List, Dict, Any, Optional

AREA_MEDIAN_BASELINES = {
    "gardens": {1.0: 16500, 2.0: 22000, 0.0: 13000},
    "tamboerskloof": {1.0: 16800, 2.0: 23000, 0.0: 13500},
    "sea point": {1.0: 17500, 2.0: 25000, 0.0: 14000},
    "green point": {1.0: 17500, 2.0: 25000, 0.0: 14000},
    "hout bay": {1.0: 12500, 2.0: 17000, 0.0: 9500},
    "fish hoek": {1.0: 9500, 2.0: 13500, 0.0: 7500},
    "capri": {1.0: 9500, 2.0: 13500, 0.0: 7500}
}

def calculate_price_value_pct(price: Optional[int], bedrooms: Optional[float], area: str, all_listings: List[Dict[str, Any]] = None) -> Optional[int]:
    if not price or price <= 0:
        return None
    
    beds = round(bedrooms or 1.0)
    clean_area = area.lower().strip()
    
    # 1. Dynamic median from live sample if >= 3 matching listings
    if all_listings:
        sample_prices = [
            l["price"] for l in all_listings 
            if l.get("price") and round(l.get("bedrooms") or 1.0) == beds
        ]
        if len(sample_prices) >= 3:
            sample_prices.sort()
            mid = len(sample_prices) // 2
            median_price = sample_prices[mid]
            diff_pct = round(((price - median_price) / median_price) * 100)
            return diff_pct

    # 2. Fallback to Cape Town market baselines
    for reg_area, bed_map in AREA_MEDIAN_BASELINES.items():
        if reg_area in clean_area:
            median_price = bed_map.get(beds, bed_map.get(1.0, 16500))
            diff_pct = round(((price - median_price) / median_price) * 100)
            return diff_pct

    # Default fallback City Bowl 1-bed
    median_price = 16500
    return round(((price - median_price) / median_price) * 100)

# Tests
test_cases = [
    {"price": 14500, "beds": 1.0, "area": "Gardens"},  # underpriced
    {"price": 16500, "beds": 1.0, "area": "Gardens"},  # fair
    {"price": 18500, "beds": 1.0, "area": "Gardens"},  # overpriced
    {"price": 16800, "beds": 1.0, "area": "Tamboerskloof"}, # fair
    {"price": 18000, "beds": 1.0, "area": "Gardens"}   # overpriced
]

for tc in test_cases:
    pct = calculate_price_value_pct(tc["price"], tc["beds"], tc["area"])
    tag = f"{abs(pct)}% underpriced" if pct < 0 else (f"{pct}% overpriced" if pct > 0 else "Fair value")
    print(f"R {tc['price']:,} in {tc['area']} ({tc['beds']} bed) -> {pct:+d}% ({tag})")

