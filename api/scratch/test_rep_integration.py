import urllib.request
import re

url_detail = "https://www.property24.com/to-rent/gardens/cape-town/western-cape/9145/114409019"
req = urllib.request.Request(url_detail, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html_detail = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

# Find agency on detail page
agent_agency = re.search(r'title="Estate Agency profile for ([^"]+)"', html_detail)
schema_agency = re.search(r'"@type"\s*:\s*"RealEstateAgent"\s*,\s*"name"\s*:\s*"([^"]+)"', html_detail)
branding_agency = re.search(r'class="p24_agencyBranding"[^>]*title="([^"]+)"', html_detail) or \
                  re.search(r'class="p24_agencyLogo"[^>]*alt="([^"]+)"', html_detail) or \
                  re.search(r'class="[^"]*p24_agentAgency[^"]*"[^>]*>(.*?)</div>', html_detail, re.S)

print("Detail page agency:")
print("  title agency:", agent_agency.group(1) if agent_agency else None)
print("  schema agency:", schema_agency.group(1) if schema_agency else None)
print("  branding agency:", branding_agency.group(1) if branding_agency else None)

from services.agency_reputation import lookup_agency_reputation
name = schema_agency.group(1) if schema_agency else (agent_agency.group(1) if agent_agency else "RE/MAX Living")
rep = lookup_agency_reputation(name, area="Gardens")
print("\nLookup Agency Reputation Result:")
print("  Canonical Name:", rep.get("canonical_name"))
print("  Google Rating:", rep.get("google_rating"), "★ (", rep.get("google_review_count"), "reviews )")
print("  HelloPeter Rating:", rep.get("hellopeter_rating"), "★ (", rep.get("hellopeter_review_count"), "reviews )")
print("  Risk Level:", rep.get("risk_level"))
print("  Recent complaint/feedback:", rep.get("recent_complaint_sample"))
print("  Flags:", rep.get("flags"))

