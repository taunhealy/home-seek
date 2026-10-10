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

    # 🏖️ South Peninsula Coastal (Deep South)
    "noordhoek", "kommetjie", "scarborough", "simon's town", "simons town", "kalk bay", 
    "st james", "glencairn", "fish hoek", "muizenberg", "marina da gama", "lakeside",
    "capri", "clovelly", "sunnydale", "ocean view",

    # 🏙️ Urban Revitalization Hubs
    "woodstock", "observatory", "salt river", "walmer estate", "university estate",

    # 🏄‍♂️ West Coast Kite-Belt
    "blouberg", "big bay", "table view", "west beach", "sunset beach",

    # 🍷 Winelands & Northern Elite
    "durbanville", "welgemoed", "plattekloof", "loevenstein", "stellenbosch", "somerset west",

    # 🌲 Garden Route & Eden
    "george", "knysna", "mossel bay", "plettenberg bay", "wilderness", "sedgefield", "heatherlands",
    "herolds bay", "victoria bay", "blanco", "george central", "denneoord", "loerie park", "earlesveld"
}

# 🏖️ The Deep South Cluster
DEEP_SOUTH_SUBURBS = {
    "noordhoek", "kommetjie", "scarborough", "simon's town", "simons town", 
    "kalk bay", "st james", "glencairn", "fish hoek", "muizenberg", 
    "marina da gama", "lakeside", "capri", "clovelly", "sunnydale", "ocean view"
}

# ⭐ User Curated Cluster: Deep South only and Meadowridge, Bergvliet, Constantia, Hout Bay, Llandudno
MY_FAVOURITES_SUBURBS = DEEP_SOUTH_SUBURBS | {
    "meadowridge", "bergvliet", "constantia", "hout bay", "llandudno"
}

# 🚫 BLACKLIST: Explicitly blocked nodes (to catch ambiguous AI extractions or out-of-province redirects)
BLOCKED_SUBURBS = {
    "grassy park", "wynberg", 
    "plumstead", "athlone", "mitchells plain", "khayelitsha", "parow", 
    "bellville", "goodwood", "brooklyn", "maitland", "milnerton",
    "pretoria", "gauteng", "buffelsdrift", "centurion", "johannesburg", "sandton", "midrand", "durban"
}

# 🌍 GEOFENCE ZONES: Grouping neighborhoods into 'Search Zones' for Source mapping (v85.0)
GEOFENCE_ZONES = {
    "my-favourites": MY_FAVOURITES_SUBURBS,
    "deep-south": DEEP_SOUTH_SUBURBS,
    "atlantic": {"sea point", "green point", "mouille point", "three anchor bay", "bantry bay", "fresnaye", "clifton", "camps bay", "bakoven", "llandudno", "hout bay", "waterfront", "granger bay"},
    "west-coast": {"blouberg", "big bay", "table view", "west beach", "sunset beach"},
    "city-bowl": {"higgovale", "oranjezicht", "tamboerskloof", "gardens", "vredehoek", "city bowl", "devils peak", "woodstock", "observatory", "salt river", "walmer estate", "university estate"},
    "south": {"constantia", "bishopscourt", "newlands", "claremont upper", "kenilworth upper", "rondebosch", "steenberg", "tokai", "kirstenhof", "bergvliet", "meadowridge"} | DEEP_SOUTH_SUBURBS,
    "north": {"durbanville", "welgemoed", "plattekloof", "loevenstein", "stellenbosch", "somerset west"},
    "garden-route": {
        "george", "knysna", "mossel bay", "plettenberg bay", "wilderness", "sedgefield", 
        "heatherlands", "herolds bay", "victoria bay", "blanco", "george central", "denneoord", "loerie park", "earlesveld"
    }
}

def get_zone_for_area(area_name: str) -> str:
    """Classifies a neighborhood into a search zone for source-mapping."""
    if not area_name: return "global"
    clean = area_name.lower().strip()
    if any(k in clean for k in ["favourite", "favorite"]):
        return "my-favourites"
    if any(k in clean for k in ["deep south", "south peninsula"]):
        return "deep-south"
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
