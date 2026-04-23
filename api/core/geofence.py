# 🛡️ THE OBSIDIAN GEOFENCE: Elite Cape Town Neighborhood Registry
# Only listings in these areas will be stored in the Global & User databases.

PREMIUM_SUBURBS = {
    # 🌊 Atlantic Seaboard (The Gold Coast)
    "sea point", "green point", "mouille point", "three anchor bay",
    "bantry bay", "fresnaye", "clifton", "camps bay", "bakoven", 
    "llandudno", "hout bay", "waterfront", "granger bay",

    # 🌳 Southern Suburbs
    "constantia", "bishopscourt", "newlands", "claremont upper", 
    "kenilworth upper", "rondebosch", "steenberg", "tokai", "kirstenhof", "bergvliet", "meadowridge",

    # ⛰️ City Bowl Heights
    "higgovale", "oranjezicht", "tamboerskloof", "gardens", "vredehoek",
    "city bowl", "devils peak",

    # 🏖️ South Peninsula Coastal
    "noordhoek", "kommetjie", "scarborough", "simon's town", "kalk bay", 
    "st james", "glencairn", "fish hoek", "muizenberg", "marina da gama", "lakeside",

    # 🏙️ Urban Revitalization Hubs
    "woodstock", "observatory", "salt river", "walmer estate", "university estate",

    # 🏄‍♂️ West Coast Kite-Belt
    "blouberg", "big bay", "table view", "west beach", "sunset beach",

    # 🍷 Winelands & Northern Elite
    "durbanville", "welgemoed", "plattekloof", "loevenstein", "stellenbosch", "somerset west"
}

# 🚫 BLACKLIST: Explicitly blocked nodes (to catch ambiguous AI extractions)
BLOCKED_SUBURBS = {
    "grassy park", "wynberg", 
    "plumstead", "athlone", "mitchells plain", "khayelitsha", "parow", 
    "bellville", "goodwood", "brooklyn", "maitland", "milnerton"
}

# 🌍 GEOFENCE ZONES: Grouping neighborhoods into 'Search Zones' for Source mapping (v85.0)
GEOFENCE_ZONES = {
    "atlantic": {"sea point", "green point", "mouille point", "three anchor bay", "bantry bay", "fresnaye", "clifton", "camps bay", "bakoven", "llandudno", "hout bay", "waterfront", "granger bay"},
    "west-coast": {"blouberg", "big bay", "table view", "west beach", "sunset beach"},
    "city-bowl": {"higgovale", "oranjezicht", "tamboerskloof", "gardens", "vredehoek", "city bowl", "devils peak", "woodstock", "observatory", "salt river", "walmer estate", "university estate"},
    "south": {"constantia", "bishopscourt", "newlands", "claremont upper", "kenilworth upper", "rondebosch", "steenberg", "tokai", "kirstenhof", "bergvliet", "meadowridge", "noordhoek", "kommetjie", "scarborough", "simon's town", "kalk bay", "st james", "glencairn", "fish hoek", "muizenberg", "marina da gama", "lakeside"},
    "north": {"durbanville", "welgemoed", "plattekloof", "loevenstein", "stellenbosch", "somerset west"}
}

def get_zone_for_area(area_name: str) -> str:
    """Classifies a neighborhood into a search zone for source-mapping."""
    if not area_name: return "global"
    clean = area_name.lower().strip()
    for zone, members in GEOFENCE_ZONES.items():
        if any(sub in clean for sub in members): return zone
    return "global"

def is_area_elite(area_name: str) -> bool:
    """Check if an extracted area meets the Obsidian Premium criteria."""
    if not area_name: return False
    
    clean_area = str(area_name).lower().strip()
    
    # 1. Check Blacklist First (The 'Dodgy' Filter)
    if any(blocked in clean_area for blocked in BLOCKED_SUBURBS):
        return False
        
    # 2. Check Whitelist (The 'Elite' Filter)
    # We use fuzzy matching in case AI says 'Upper Sea Point'
    if any(suburb in clean_area for suburb in PREMIUM_SUBURBS):
        return True
        
    return False
