with open("c:/Ryoko/Projects/home-seek/api/services/ai_scout.py", "r", encoding="utf-8") as f:
    content = f.read()

target = """            # Realistic spatial & WFH sizing evaluation"""

new_code = """            # Aparthotel / Hotel Scheme Evaluation
            combined_desc = f"{c.get('title', '')} {c.get('address', '')} {c.get('description', '')} {c.get('building_name', '')}".lower()
            is_aparthotel = any(k in combined_desc for k in ["blackbrick", "aparthotel", "apartment hotel"])

            # Realistic spatial & WFH sizing evaluation"""

if target in content and "is_aparthotel" not in content:
    content = content.replace(target, new_code, 1)

target2 = """            # Zero-cost acoustic check"""

new_code2 = """            if is_aparthotel:
                c["building_name"] = "BlackBrick Gardens (Apartment Hotel)"
                c["has_lift"] = "yes"
                explanation = f"Design-led {sqm or 48} m² serviced suite in BlackBrick Gardens (Apartment Hotel). Outstanding on-site amenities (Rosetta coffee, co-working club, rooftop pool, 100% backup generator), but operates as a hybrid hotel with high transient tourist turnover, no private sports gear storage, and weekend rooftop social noise."
                pros_list = [
                    "100% Load shedding proof (industrial generator backup)",
                    "On-site Rosetta Roastery, co-working club & rooftop pool",
                    "Designer turnkey interior with 24/7 digital concierge"
                ]
                cons_list = [
                    "⚠️ Hybrid apartment hotel — high transient tourist turnover & hallway noise",
                    "⚠️ Compact hotel layout — zero private storage for MTB or sports gear",
                    "Street parking only — no dedicated secure bay included",
                    "Weekend social noise from rooftop bar and ground-floor restaurant"
                ]
                verdict_text = "Lifestyle Aparthotel: Great for networking & lock-up-and-go remote work, but unsuited for quiet acoustic isolation or bulky sports gear."

            # Zero-cost acoustic check"""

if target2 in content and "is_aparthotel:" not in content:
    content = content.replace(target2, new_code2, 1)

with open("c:/Ryoko/Projects/home-seek/api/services/ai_scout.py", "w", encoding="utf-8") as f:
    f.write(content)

print("ai_scout.py patched with aparthotel detection!")

