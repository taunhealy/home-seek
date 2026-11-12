// Real Cape Town Geocoding & Coordinate Resolver

export interface GeoLocation {
  lat: number;
  lng: number;
  label: string;
  suburb?: string;
}

// Known landmark coordinates across Cape Town
export const KNOWN_CAPE_TOWN_PLACES: Record<string, [number, number]> = {
  // Hubs & Landmarks
  "14 sunrise boulevard": [-34.1025, 18.4850],
  "sunrise boulevard": [-34.1025, 18.4850],
  "sunrise blvd": [-34.1025, 18.4850],
  "12 derwent rd": [-33.933734, 18.405534],
  "12 derwent road": [-33.933734, 18.405534],
  "derwent rd": [-33.933734, 18.405534],
  "derwent road": [-33.933734, 18.405534],
  "derwent court": [-33.933734, 18.405534],
  "costa da gama": [-34.1010, 18.4820],
  "ocean terraces": [-34.098635, 18.488359],
  "spurwing circle": [-34.0978, 18.4904],
  "sanderling road": [-34.0986, 18.4884],
  "capricorn": [-34.0986, 18.4884],
  "capricorn beach": [-34.0986, 18.4884],
  "marina da gama": [-34.0958, 18.4738],
  "the row": [-34.0958, 18.4738],
  "79 main road": [-34.1078, 18.4679],
  "main road muizenberg": [-34.1078, 18.4679],
  "muizenberg surfers corner": [-34.1080, 18.4710],
  "muizenberg village": [-34.1070, 18.4690],
  "amazon river club": [-33.9360, 18.4720],
  "amazon river club hq": [-33.9360, 18.4720],
  "observatory": [-33.9365, 18.4710],
  "cape town cbd": [-33.9220, 18.4230],
  "city bowl": [-33.9280, 18.4170],
  "kloof street": [-33.9315, 18.4105],
  "kloof st": [-33.9315, 18.4105],
  "gardens": [-33.9325, 18.4120],
  "tamboerskloof": [-33.9338, 18.4055],
  "oranjezicht": [-33.9400, 18.4190],
  "higgovale": [-33.9410, 18.4030],
  "vredehoek": [-33.9380, 18.4280],
  "bo-kaap": [-33.9215, 18.4145],
  "de waterkant": [-33.9160, 18.4180],
  "green point": [-33.9085, 18.4090],
  "green point urban park": [-33.9045, 18.4095],
  "sea point": [-33.9180, 18.3880],
  "sea point promenade": [-33.9160, 18.3840],
  "mouille point": [-33.8990, 18.4070],
  "mouillie point": [-33.8990, 18.4070],
  "three anchor bay": [-33.9080, 18.3975],
  "fresnaye": [-33.9240, 18.3815],
  "bantry bay": [-33.9285, 18.3790],
  "clifton": [-33.9380, 18.3765],
  "camps bay": [-33.9515, 18.3780],
  "camps bay beach": [-33.9515, 18.3780],
  "bakoven": [-33.9620, 18.3760],
  "hout bay": [-34.0450, 18.3550],
  "llandudno": [-34.0080, 18.3410],
  "v&a waterfront": [-33.9050, 18.4210],
  "waterfront": [-33.9050, 18.4210],
  "virgin active kloof": [-33.929839, 18.410876],
  "virgin active wembley": [-33.932292, 18.424188],
  "virgin active point": [-33.920726, 18.383306],
  "virgin active green point": [-33.906296, 18.402848],
  "virgin active silo": [-33.9090, 18.4230],
  "buc fitness club": [-33.920726, 18.383306],
  "the point mall": [-33.920726, 18.383306],
  "point mall": [-33.920726, 18.383306],
  "anytime fitness sea point": [-33.913819, 18.391226],
  "ignite fitness green point": [-33.9090, 18.4120],
  "roark gyms": [-33.924669, 18.414300],
  "zone fitness kloof": [-33.9295, 18.4105],
  "lifestyle on kloof": [-33.9298, 18.4108],
  "gardens shopping centre": [-33.9328, 18.4178],
  "gardens centre": [-33.9328, 18.4178],
  "cape quarter": [-33.9165, 18.4178],
  "jarryds": [-33.9213, 18.3828],
  "jarryds eatery": [-33.9213, 18.3828],
  "naked coffee": [-33.9200, 18.3848],
  "jason bakery": [-33.9085, 18.4132],
  "the strangers club": [-33.9098, 18.4075],
  "mojo market": [-33.919297, 18.385825],
  "truth coffee": [-33.9282, 18.4225],
  "our local": [-33.9348, 18.4082],
  "molten toffee": [-33.9378, 18.4060],
  "manna epicure": [-33.9362, 18.4070],
  "spar derry": [-33.9392, 18.4290],
  "table mountain": [-33.9570, 18.4030],
  "table mountain deer park": [-33.9430, 18.4250],
  "deer park": [-33.9430, 18.4250],
  "lions head": [-33.9350, 18.3890],
  "lion's head": [-33.9350, 18.3890],
  "signal hill": [-33.9180, 18.4020],
  "woodstock": [-33.9310, 18.4480],
  "salt river": [-33.9300, 18.4620],
  "rondebosch": [-33.9620, 18.4770],
  "newlands": [-33.9720, 18.4550],
  "claremont": [-33.9810, 18.4650],
  "cavendish": [-33.9810, 18.4650],
  "constantia": [-34.0250, 18.4350],
  "century city": [-33.8920, 18.5080],
  "uct": [-33.9575, 18.4605],
  "uct campus": [-33.9575, 18.4605],
  "scarborough beach": [-34.1995, 18.3740],
  "scarborough": [-34.1980, 18.3750],
  "camel rock": [-34.1982, 18.3765],
  "seabreeze estate": [-34.1435, 18.3480],
  "sea breeze estate": [-34.1435, 18.3480],
  "sea breeze village": [-34.1435, 18.3480],
  "klein slangkop": [-34.1350, 18.3220],
  "klein slangkop eco estate": [-34.1350, 18.3220],
  "imhoff manor": [-34.1365, 18.3540],
  "imhoff farm": [-34.1365, 18.3540],
  "imhoff's gift": [-34.1380, 18.3562],
  "imhoffs gift": [-34.1380, 18.3562],
  "harrier circle": [-34.1380, 18.3562],
  "harrier cir": [-34.1380, 18.3562],
  "bluewater estate": [-34.1320, 18.3650],
  "lake michelle": [-34.1180, 18.3780],
  "lake michelle eco estate": [-34.1180, 18.3780],
  "de goede hoop": [-34.1080, 18.3750],
  "chapmans peak estate": [-34.0950, 18.3720],
  "stonehaven": [-34.1220, 18.4050],
  "silvertree estate": [-34.0620, 18.4410],
  "stonehurst mountain estate": [-34.0680, 18.4450],
  "steenberg golf estate": [-34.0720, 18.4320],
  "long beach": [-34.1370, 18.3270],
  "kommetjie beach": [-34.1370, 18.3270],
  "noordhoek beach": [-34.1030, 18.3580],
  "noordhoek farm village": [-34.1020, 18.3680],
  "muizenberg beach": [-34.1080, 18.4710],
  "boulders beach": [-34.1970, 18.4510],
  "seaforth beach": [-34.1965, 18.4520],
  "fish hoek beach": [-34.1380, 18.4350],
  "kalk bay harbour": [-34.1280, 18.4480],
  "silvermine": [-34.0820, 18.4050],
  "simons town": [-34.1930, 18.4330],
  "simon's town": [-34.1930, 18.4330],
  "clifton 4th": [-33.9390, 18.3760],
  "clifton beach": [-33.9390, 18.3760],
  "newlands forest": [-33.9740, 18.4520],
  "tokai forest": [-34.0580, 18.4200],
  "constantia nek": [-34.0120, 18.4050],
  "kirstenbosch": [-33.9875, 18.4325],
  "kirstenbosch botanical gardens": [-33.9875, 18.4325]
};

// Haversine distance in km between two lat/lng points
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Resolve any text or address to Cape Town / Western Cape coordinates
export function resolveLocationCoords(query: string): GeoLocation {
  const cleaned = (query || '').toLowerCase().trim();
  
  if (!cleaned) {
    return { lat: -33.9249, lng: 18.4241, label: 'Cape Town' };
  }

  const knownKeys = Object.keys(KNOWN_CAPE_TOWN_PLACES).sort((a, b) => b.length - a.length);

  // 1. Exact suburb or alias match on the full query in SUBURBS_DIRECTORY
  const exactSuburb = SUBURBS_DIRECTORY.find(
    (s) => s.name.toLowerCase() === cleaned || s.aliases?.some((a) => a.toLowerCase() === cleaned)
  );
  if (exactSuburb) {
    return { lat: exactSuburb.lat, lng: exactSuburb.lng, label: exactSuburb.name, suburb: exactSuburb.name };
  }

  // 2. Segment-by-segment matching (most specific segment first, e.g. "Northshore, Hout Bay" -> "Northshore" before "Hout Bay")
  const tokens = cleaned.split(',').map((t) => t.trim()).filter(Boolean);
  for (const token of tokens) {
    const tokenSuburb = SUBURBS_DIRECTORY.find(
      (s) => s.name.toLowerCase() === token || s.aliases?.some((a) => a.toLowerCase() === token)
    );
    if (tokenSuburb) {
      return { lat: tokenSuburb.lat, lng: tokenSuburb.lng, label: tokenSuburb.name, suburb: tokenSuburb.name };
    }
    for (const place of knownKeys) {
      if (token.includes(place)) {
        const [lat, lng] = KNOWN_CAPE_TOWN_PLACES[place];
        return { lat, lng, label: query.split(',')[0].trim() || place, suburb: place };
      }
    }
  }

  // 3. High-precision Estate, Complex, Landmark & Street matching across full string (longest match first)
  for (const place of knownKeys) {
    if (cleaned.includes(place)) {
      const [lat, lng] = KNOWN_CAPE_TOWN_PLACES[place];
      return { lat, lng, label: query.split(',')[0].trim() || place, suburb: place };
    }
  }

  // 4. Partial suburb match across all suburbs (longest suburb name first to avoid false generic parent hits)
  const sortedSuburbs = [...SUBURBS_DIRECTORY].sort((a, b) => b.name.length - a.name.length);
  const partialSuburb = sortedSuburbs.find(
    (s) => cleaned.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(cleaned)
  );
  if (partialSuburb) {
    return { lat: partialSuburb.lat, lng: partialSuburb.lng, label: partialSuburb.name, suburb: partialSuburb.name };
  }

  // 5. Substring fallback across known places
  for (const place of knownKeys) {
    if (place.includes(cleaned)) {
      const [lat, lng] = KNOWN_CAPE_TOWN_PLACES[place];
      return { lat, lng, label: query.split(',')[0].trim() || place };
    }
  }

  // Default City Bowl
  return { lat: -33.9315, lng: 18.4105, label: query.split(',')[0].trim() || 'Cape Town' };
}

export interface SuburbEntry {
  name: string;
  region: string;
  lat: number;
  lng: number;
  aliases?: string[];
}

export const SUBURBS_DIRECTORY: SuburbEntry[] = [
  // Cape Town - Deep South & False Bay
  { name: 'Noordhoek', region: 'Cape Town · Deep South', lat: -34.1030, lng: 18.3680, aliases: ['noordhoek', 'chapmans peak', 'silvermine'] },
  { name: 'Sunnydale', region: 'Cape Town · Deep South', lat: -34.1195, lng: 18.3875, aliases: ['sunnydale', 'longbeach mall'] },
  { name: 'Capri', region: 'Cape Town · Deep South', lat: -34.1290, lng: 18.3910, aliases: ['capri', 'capri village'] },
  { name: 'Sun Valley', region: 'Cape Town · Deep South', lat: -34.1325, lng: 18.3960, aliases: ['sun valley'] },
  { name: 'Kommetjie', region: 'Cape Town · Deep South / Surf', lat: -34.1410, lng: 18.3300, aliases: ['kommetjie', 'long beach'] },
  { name: 'Witsand (Misty Cliffs)', region: 'Cape Town · Deep South / Surf', lat: -34.1780, lng: 18.3560, aliases: ['witsands', 'witsand', 'soetwater'] },
  { name: 'Misty Cliffs', region: 'Cape Town · Deep South', lat: -34.1850, lng: 18.3620, aliases: ['misty cliffs', 'mistycliffs'] },
  { name: 'Scarborough', region: 'Cape Town · Deep South', lat: -34.1980, lng: 18.3750, aliases: ['scarborough', 'cape point'] },
  { name: 'Fish Hoek', region: 'Cape Town · False Bay', lat: -34.1360, lng: 18.4320, aliases: ['fish hoek', 'valyland'] },
  { name: 'Kalk Bay', region: 'Cape Town · False Bay', lat: -34.1280, lng: 18.4480, aliases: ['kalk bay', 'st james'] },
  { name: 'Muizenberg', region: 'Cape Town · False Bay / Surf', lat: -34.1070, lng: 18.4710, aliases: ['muizenberg', 'surfers corner'] },
  { name: 'Capricorn', region: 'Cape Town · False Bay / Capricorn Beach', lat: -34.0986, lng: 18.4884, aliases: ['capricorn', 'capricorn beach', 'ocean terraces', 'spurwing'] },
  { name: 'Marina Da Gama', region: 'Cape Town · False Bay / Waterways', lat: -34.0958, lng: 18.4738, aliases: ['marina da gama', 'the row', 'zandvlei'] },
  { name: 'Costa Da Gama', region: 'Cape Town · False Bay', lat: -34.1010, lng: 18.4820, aliases: ['costa da gama', 'sunrise beach'] },
  { name: 'Simon\'s Town', region: 'Cape Town · False Bay', lat: -34.1930, lng: 18.4320, aliases: ['simons town', 'boulders'] },
  { name: 'Glencairn', region: 'Cape Town · False Bay', lat: -34.1610, lng: 18.4330, aliases: ['glencairn', 'glencairn heights'] },
  { name: 'Northshore', region: 'Hout Bay · Cape Town', lat: -34.0467, lng: 18.3485, aliases: ['northshore', 'northshore hout bay'] },
  { name: 'Hout Bay Harbour', region: 'Hout Bay · Cape Town', lat: -34.0551, lng: 18.3438, aliases: ['hout bay harbour', 'harbour'] },
  { name: 'Hout Bay Central', region: 'Hout Bay · Cape Town', lat: -34.0418, lng: 18.3578, aliases: ['hout bay central'] },
  { name: 'Hout Bay Beachfront', region: 'Hout Bay · Cape Town', lat: -34.0457, lng: 18.3512, aliases: ['hout bay beachfront', 'beachfront'] },
  { name: 'Scott Estate', region: 'Hout Bay · Cape Town', lat: -34.0417, lng: 18.3638, aliases: ['scott estate'] },
  { name: 'Penzance Estate', region: 'Hout Bay · Cape Town', lat: -34.0336, lng: 18.3601, aliases: ['penzance estate', 'penzance'] },
  { name: 'Beach Estate', region: 'Hout Bay · Cape Town', lat: -34.0445, lng: 18.3578, aliases: ['beach estate'] },
  { name: 'Longkloof', region: 'Hout Bay · Cape Town', lat: -34.0111, lng: 18.3872, aliases: ['longkloof'] },
  { name: 'Helgarda Estate', region: 'Hout Bay · Cape Town', lat: -34.0275, lng: 18.3468, aliases: ['helgarda estate'] },
  { name: 'Kronenzicht', region: 'Hout Bay · Cape Town', lat: -34.0296, lng: 18.3442, aliases: ['kronenzicht'] },
  { name: 'Bokkemanskloof', region: 'Hout Bay · Cape Town', lat: -34.0189, lng: 18.3829, aliases: ['bokkemanskloof'] },
  { name: 'Berg en Dal', region: 'Hout Bay · Cape Town', lat: -34.0363, lng: 18.3601, aliases: ['berg en dal'] },
  { name: 'Ruyteplaats', region: 'Hout Bay · Cape Town', lat: -34.0123, lng: 18.3586, aliases: ['ruyteplaats'] },
  { name: 'Tierboskloof', region: 'Hout Bay · Cape Town', lat: -34.0231, lng: 18.3697, aliases: ['tierboskloof'] },
  { name: 'Victorskloof', region: 'Hout Bay · Cape Town', lat: -34.0169, lng: 18.3579, aliases: ['victorskloof'] },
  { name: 'Oakhurst', region: 'Hout Bay · Cape Town', lat: -34.0202, lng: 18.3748, aliases: ['oakhurst'] },
  { name: 'Clovelly', region: 'Cape Town · False Bay', lat: -34.1330, lng: 18.4400, aliases: ['clovelly'] },

  // Cape Town - Southern Suburbs
  { name: 'Rosebank', region: 'Cape Town · Southern Suburbs', lat: -33.9555, lng: 18.4715, aliases: ['rosebank', 'liesbeek', 'baxter'] },
  { name: 'Mowbray', region: 'Cape Town · Southern Suburbs', lat: -33.9475, lng: 18.4720, aliases: ['mowbray', 'rhodes memorial', 'little mowbray'] },
  { name: 'Rondebosch', region: 'Cape Town · Southern Suburbs', lat: -33.9620, lng: 18.4770, aliases: ['rondebosch', 'upper rondebosch', 'uct'] },
  { name: 'Newlands', region: 'Cape Town · Southern Suburbs', lat: -33.9720, lng: 18.4550, aliases: ['newlands', 'kirstenbosch', 'fernwood'] },
  { name: 'Claremont', region: 'Cape Town · Southern Suburbs', lat: -33.9810, lng: 18.4650, aliases: ['claremont', 'claremont upper', 'cavendish'] },
  { name: 'Kenilworth', region: 'Cape Town · Southern Suburbs', lat: -33.9910, lng: 18.4710, aliases: ['kenilworth', 'kenilworth upper'] },
  { name: 'Harfield Village', region: 'Cape Town · Southern Suburbs', lat: -33.9900, lng: 18.4800, aliases: ['harfield village', 'harfield'] },
  { name: 'Wynberg', region: 'Cape Town · Southern Suburbs', lat: -34.0040, lng: 18.4670, aliases: ['wynberg', 'wynberg upper', 'chelsea'] },
  { name: 'Constantia', region: 'Cape Town · Southern Suburbs', lat: -34.0250, lng: 18.4350, aliases: ['constantia', 'constantia upper', 'silverhurst'] },
  { name: 'Bishopscourt', region: 'Cape Town · Southern Suburbs', lat: -33.9920, lng: 18.4480, aliases: ['bishopscourt'] },
  { name: 'Tokai', region: 'Cape Town · Southern Suburbs', lat: -34.0580, lng: 18.4310, aliases: ['tokai', 'steenberg', 'forest crest'] },
  { name: 'Bergvliet', region: 'Cape Town · Southern Suburbs', lat: -34.0480, lng: 18.4520, aliases: ['bergvliet', 'sweet valley'] },
  { name: 'Plumstead', region: 'Cape Town · Southern Suburbs', lat: -34.0210, lng: 18.4710, aliases: ['plumstead'] },
  { name: 'Diep River', region: 'Cape Town · Southern Suburbs', lat: -34.0320, lng: 18.4640, aliases: ['diep river'] },
  { name: 'Observatory', region: 'Cape Town · Southern Suburbs Fringe', lat: -33.9365, lng: 18.4710, aliases: ['observatory', 'obz', 'lower main'] },
  { name: 'Pinelands', region: 'Cape Town · Central', lat: -33.9330, lng: 18.5080, aliases: ['pinelands', 'howard centre'] },

  // Cape Town - City Bowl & Surrounds
  { name: 'Oranjezicht', region: 'Cape Town · City Bowl', lat: -33.9400, lng: 18.4190, aliases: ['oranjezicht', 'molteno', 'table mountain'] },
  { name: 'Tamboerskloof', region: 'Cape Town · City Bowl', lat: -33.9338, lng: 18.4055, aliases: ['tamboerskloof', 'derwent', 'military rd'] },
  { name: 'Gardens', region: 'Cape Town · City Bowl', lat: -33.9325, lng: 18.4120, aliases: ['gardens', 'kloof street', 'kloof'] },
  { name: 'Vredehoek', region: 'Cape Town · City Bowl', lat: -33.9380, lng: 18.4280, aliases: ['vredehoek', 'chelmsford', 'derry'] },
  { name: 'Higgovale', region: 'Cape Town · City Bowl', lat: -33.9410, lng: 18.4030, aliases: ['higgovale', 'kloof nek'] },
  { name: 'Bo-Kaap', region: 'Cape Town · City Bowl', lat: -33.9215, lng: 18.4145, aliases: ['bo-kaap', 'bokaap', 'wale st'] },
  { name: 'De Waterkant', region: 'Cape Town · City Bowl', lat: -33.9160, lng: 18.4180, aliases: ['de waterkant', 'waterkant', 'somerset rd'] },
  { name: 'Cape Town CBD', region: 'Cape Town · Central', lat: -33.9220, lng: 18.4230, aliases: ['cape town cbd', 'city centre', 'bree street', 'long street'] },
  { name: 'Woodstock', region: 'Cape Town · City Bowl Fringe', lat: -33.9310, lng: 18.4480, aliases: ['woodstock', 'upper woodstock', 'roodebloem'] },
  { name: 'Salt River', region: 'Cape Town · City Bowl Fringe', lat: -33.9300, lng: 18.4620, aliases: ['salt river'] },

  // Cape Town - Atlantic Seaboard
  { name: 'Green Point', region: 'Cape Town · Atlantic Seaboard', lat: -33.9085, lng: 18.4090, aliases: ['green point', 'greenpoint', 'somerset'] },
  { name: 'Mouille Point', region: 'Cape Town · Atlantic Seaboard', lat: -33.8990, lng: 18.4070, aliases: ['mouille point', 'mouillie point', 'lighthouse', 'beach rd'] },
  { name: 'Three Anchor Bay', region: 'Cape Town · Atlantic Seaboard', lat: -33.9080, lng: 18.3975, aliases: ['three anchor bay'] },
  { name: 'Sea Point', region: 'Cape Town · Atlantic Seaboard', lat: -33.9180, lng: 18.3880, aliases: ['sea point', 'seapoint', 'regent rd', 'promenade'] },
  { name: 'Fresnaye', region: 'Cape Town · Atlantic Seaboard', lat: -33.9240, lng: 18.3815, aliases: ['fresnaye', 'ave st leon'] },
  { name: 'Bantry Bay', region: 'Cape Town · Atlantic Seaboard', lat: -33.9285, lng: 18.3790, aliases: ['bantry bay', 'victoria rd'] },
  { name: 'Clifton', region: 'Cape Town · Atlantic Seaboard', lat: -33.9380, lng: 18.3765, aliases: ['clifton', '1st beach', '2nd beach', '4th beach'] },
  { name: 'Camps Bay', region: 'Cape Town · Atlantic Seaboard', lat: -33.9515, lng: 18.3780, aliases: ['camps bay', 'campsbay', 'camps bay drive'] },
  { name: 'Bakoven', region: 'Cape Town · Atlantic Seaboard', lat: -33.9620, lng: 18.3760, aliases: ['bakoven', 'beta beach'] },
  { name: 'Llandudno', region: 'Cape Town · Atlantic Seaboard', lat: -34.0080, lng: 18.3410, aliases: ['llandudno', 'sunset rocks'] },
  { name: 'Sandy Bay', region: 'Cape Town · Atlantic Seaboard', lat: -34.0225, lng: 18.3315, aliases: ['sandy bay', 'sandybay', 'oudeschip'] },
  { name: 'Hout Bay', region: 'Cape Town · Atlantic Seaboard', lat: -34.0450, lng: 18.3550, aliases: ['hout bay', 'houtbay', 'harbour'] },

  // Cape Town - West Coast & Northern Suburbs
  { name: 'Bloubergstrand', region: 'Cape Town · West Coast', lat: -33.8050, lng: 18.4600, aliases: ['bloubergstrand', 'blouberg', 'kite beach'] },
  { name: 'Parklands', region: 'Cape Town · West Coast', lat: -33.8120, lng: 18.5080, aliases: ['parklands', 'parklands north', 'sunningdale'] },
  { name: 'Table View', region: 'Cape Town · West Coast', lat: -33.8220, lng: 18.4880, aliases: ['table view', 'tableview'] },
  { name: 'Big Bay', region: 'Cape Town · West Coast', lat: -33.7880, lng: 18.4550, aliases: ['big bay', 'eden on the bay'] },
  { name: 'Century City', region: 'Cape Town · Northern Suburbs', lat: -33.8920, lng: 18.5080, aliases: ['century city', 'canal walk'] },
  { name: 'Durbanville', region: 'Cape Town · Northern Suburbs', lat: -33.8340, lng: 18.6480, aliases: ['durbanville', 'durbanville hills'] },
  { name: 'Bellville', region: 'Cape Town · Northern Suburbs', lat: -33.9010, lng: 18.6290, aliases: ['bellville'] },
  { name: 'Milnerton', region: 'Cape Town · West Coast', lat: -33.8710, lng: 18.4980, aliases: ['milnerton'] },

  // Garden Route & Eden
  { name: 'George', region: 'Garden Route · Eden', lat: -33.9630, lng: 22.4617, aliases: ['george'] },
  { name: 'George Central', region: 'George · Garden Route', lat: -33.9632, lng: 22.4597, aliases: ['george central'] },
  { name: 'Bodorp', region: 'George · Garden Route', lat: -33.9560, lng: 22.4570, aliases: ['bodorp'] },
  { name: 'Bergsig', region: 'George · Garden Route', lat: -33.9520, lng: 22.4680, aliases: ['bergsig', 'bersig'] },
  { name: 'Heather Park', region: 'George · Garden Route', lat: -33.9540, lng: 22.4350, aliases: ['heather park'] },
  { name: 'Heatherlands', region: 'George · Garden Route', lat: -33.9490, lng: 22.4440, aliases: ['heatherlands', 'george foothills'] },
  { name: 'Fernridge', region: 'George · Garden Route', lat: -33.9440, lng: 22.4600, aliases: ['fernridge', 'george mountain'] },
  { name: 'Camphersdrift', region: 'George · Garden Route', lat: -33.9555, lng: 22.4510, aliases: ['camphersdrift'] },
  { name: 'Denneoord', region: 'George · Garden Route', lat: -33.9505, lng: 22.4780, aliases: ['denneoord'] },
  { name: 'Dormehls Drift', region: 'George · Garden Route', lat: -33.9660, lng: 22.4680, aliases: ['dormehls drift'] },
  { name: 'Loerie Park', region: 'George · Garden Route', lat: -33.9720, lng: 22.4820, aliases: ['loerie park'] },
  { name: 'George East', region: 'George · Garden Route', lat: -33.9650, lng: 22.4780, aliases: ['george east'] },
  { name: 'George South', region: 'George · Garden Route', lat: -33.9740, lng: 22.4580, aliases: ['george south'] },
  { name: 'Blanco', region: 'George · Garden Route', lat: -33.9560, lng: 22.4160, aliases: ['blanco'] },
  { name: 'Denver Park', region: 'George · Garden Route', lat: -33.9710, lng: 22.4720, aliases: ['denver park'] },
  { name: 'George Industrial', region: 'George · Garden Route', lat: -33.9860, lng: 22.4780, aliases: ['george industrial'] },
  { name: 'Pacaltsdorp', region: 'George · Garden Route', lat: -34.0120, lng: 22.4620, aliases: ['pacaltsdorp'] },
  { name: 'Kraaibosch', region: 'George · Garden Route', lat: -33.9820, lng: 22.5250, aliases: ['kraaibosch'] },
  { name: 'Blue Mountain Village', region: 'George · Garden Route', lat: -33.9790, lng: 22.5110, aliases: ['blue mountain village'] },
  { name: 'Le Grand Estate', region: 'George · Garden Route', lat: -34.0320, lng: 22.4950, aliases: ['le grand estate'] },
  { name: 'Kingswood Golf Estate', region: 'George · Garden Route', lat: -33.9736, lng: 22.4321, aliases: ['kingswood golf estate'] },
  { name: 'King George Park', region: 'George · Garden Route', lat: -33.9610, lng: 22.4430, aliases: ['king george park'] },
  { name: 'Wilderness', region: 'Garden Route · Coastal Sanctuary', lat: -33.9920, lng: 22.5830, aliases: ['wilderness', 'wilderness beach', 'touw river'] },
  { name: 'Victoria Bay', region: 'Garden Route · Surf Bay', lat: -34.0040, lng: 22.5480, aliases: ['victoria bay', 'vic bay'] },
  { name: 'Sedgefield', region: 'Garden Route · Slow Town', lat: -34.0180, lng: 22.8020, aliases: ['sedgefield', 'myoli beach', 'cola beach'] },
  { name: 'Knysna', region: 'Garden Route · Lagoon & Forest', lat: -34.0350, lng: 23.0470, aliases: ['knysna', 'knysna heads', 'thesen island'] },
  { name: 'Plettenberg Bay', region: 'Garden Route · Coastal Haven', lat: -34.0530, lng: 23.3720, aliases: ['plettenberg bay', 'plett', 'robberg'] },
  { name: 'Mossel Bay', region: 'Garden Route · Coastal Port', lat: -34.1830, lng: 22.1460, aliases: ['mossel bay', 'mosselbay', 'pinnacle point'] },

  // Cape Winelands & Helderberg
  { name: 'Stellenbosch', region: 'Cape Winelands', lat: -33.9320, lng: 18.8600, aliases: ['stellenbosch', 'dorpsstraat'] },
  { name: 'Franschhoek', region: 'Cape Winelands', lat: -33.9130, lng: 19.1230, aliases: ['franschhoek'] },
  { name: 'Paarl', region: 'Cape Winelands', lat: -33.7280, lng: 18.9640, aliases: ['paarl'] },
  { name: 'Somerset West', region: 'Helderberg', lat: -34.0830, lng: 18.8470, aliases: ['somerset west', 'helderberg'] },
  { name: 'Strand', region: 'Helderberg', lat: -34.1180, lng: 18.8280, aliases: ['strand', 'strand beach'] }
];

export function searchSuburbs(query: string, currentSelected: string[] = []): SuburbEntry[] {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];

  const excluded = new Set(currentSelected.map(s => s.toLowerCase().trim()));

  const matches = SUBURBS_DIRECTORY.filter(item => {
    if (excluded.has(item.name.toLowerCase())) return false;
    const nameMatch = item.name.toLowerCase().includes(q);
    const aliasMatch = item.aliases?.some(a => a.toLowerCase().includes(q));
    const regionMatch = item.region.toLowerCase().includes(q);
    return nameMatch || aliasMatch || regionMatch;
  });

  // Sort: Prefix matches first, then alias prefix, then substring
  return matches.sort((a, b) => {
    const aNameStarts = a.name.toLowerCase().startsWith(q);
    const bNameStarts = b.name.toLowerCase().startsWith(q);
    if (aNameStarts && !bNameStarts) return -1;
    if (!aNameStarts && bNameStarts) return 1;

    const aAliasStarts = a.aliases?.some(al => al.toLowerCase().startsWith(q));
    const bAliasStarts = b.aliases?.some(al => al.toLowerCase().startsWith(q));
    if (aAliasStarts && !bAliasStarts) return -1;
    if (!aAliasStarts && bAliasStarts) return 1;

    return a.name.localeCompare(b.name);
  }).slice(0, 8);
}

export interface PlaceSuggestion {
  name: string;
  category: string;
  lat: number;
  lng: number;
  iconType: 'beach' | 'surf' | 'trail' | 'gym' | 'attraction' | 'hub' | 'cafe' | 'shop' | 'general';
}

export const SUGGESTED_PLACES_DIRECTORY: PlaceSuggestion[] = [
  // Deep South & False Bay Beaches, Surfs & Hubs
  { name: 'Scarborough Beach', category: 'Cape Town · Deep South · Beach & Surf', lat: -34.1995, lng: 18.3740, iconType: 'beach' },
  { name: 'Camel Rock (Scarborough)', category: 'Scarborough · Landmark Hub & Bakery', lat: -34.1982, lng: 18.3765, iconType: 'cafe' },
  { name: 'Misty Cliffs Coastal Reserve', category: 'Cape Town · Deep South · Scenic Marine Reserve', lat: -34.1850, lng: 18.3620, iconType: 'beach' },
  { name: 'Witsand Surf Spot', category: 'Cape Town · Deep South · Hollow A-Frame Peaks', lat: -34.1780, lng: 18.3560, iconType: 'surf' },
  { name: 'Long Beach (Kommetjie)', category: 'Kommetjie · Premier Cape Surf Beach', lat: -34.1370, lng: 18.3270, iconType: 'beach' },
  { name: 'Noordhoek Farm Village', category: 'Noordhoek · Artisan Bakeries & Village Green', lat: -34.1020, lng: 18.3680, iconType: 'cafe' },
  { name: 'Noordhoek Beach', category: 'Noordhoek · Expansive 8km White Sand Beach & Dunes', lat: -34.1030, lng: 18.3580, iconType: 'beach' },
  { name: 'Muizenberg Surfers Corner', category: 'Muizenberg · World Famous Gentle Surf Break', lat: -34.1080, lng: 18.4710, iconType: 'surf' },
  { name: 'Seaforth Beach', category: 'Simon\'s Town · Sheltered Boulder Cove & Safe Swim', lat: -34.1965, lng: 18.4520, iconType: 'beach' },
  { name: 'Boulders Beach', category: 'Simon\'s Town · World-Renowned Penguin Sanctuary', lat: -34.1970, lng: 18.4510, iconType: 'beach' },
  { name: 'Kalk Bay Harbour', category: 'Kalk Bay · Working Fishing Harbour & Seafood Cafes', lat: -34.1280, lng: 18.4480, iconType: 'cafe' },
  { name: 'Fish Hoek Beach', category: 'Fish Hoek · Warm Water Bay & Catwalk Stroll', lat: -34.1380, lng: 18.4350, iconType: 'beach' },
  { name: 'Silvermine Nature Reserve', category: 'Deep South · Mountain Reservoir & Fynbos Trails', lat: -34.0820, lng: 18.4050, iconType: 'trail' },

  // Deep South Gyms
  { name: 'Virgin Active Sun Valley', category: 'Sun Valley / Noordhoek · Health Club & Heated Pool', lat: -34.1380, lng: 18.3970, iconType: 'gym' },
  { name: 'Zone Fitness Fish Hoek', category: 'Fish Hoek Main Rd · Full Cardio & Strength Club', lat: -34.1360, lng: 18.4310, iconType: 'gym' },
  { name: 'Planet Fitness JustGym (Longbeach)', category: 'Noordhoek Longbeach Mall · Fitness & Weights', lat: -34.1375, lng: 18.3960, iconType: 'gym' },

  // Southern Suburbs Trails & Gyms
  { name: 'Newlands Forest Trailhead', category: 'Southern Suburbs · Lush Pine & Indigenous Forest', lat: -33.9740, lng: 18.4520, iconType: 'trail' },
  { name: 'Tokai Forest MTB Trails', category: 'Tokai · World-Class Singletrack & Pine Canopy', lat: -34.0580, lng: 18.4200, iconType: 'trail' },
  { name: 'Kirstenbosch Botanical Gardens', category: 'Newlands · UNESCO World Heritage Floral Sanctuary', lat: -33.9875, lng: 18.4325, iconType: 'attraction' },
  { name: 'Constantia Nek Trailhead', category: 'Constantia · Gateway to Table Mountain & Hout Bay', lat: -34.0120, lng: 18.4050, iconType: 'trail' },
  { name: 'Virgin Active Claremont', category: 'Claremont · Premium Health Club & Lap Pool', lat: -33.9820, lng: 18.4660, iconType: 'gym' },
  { name: 'Virgin Active Constantia', category: 'Constantia Village · High-End Fitness Club', lat: -34.0260, lng: 18.4410, iconType: 'gym' },
  { name: 'Zone Fitness Rondebosch', category: 'Riverside Mall Rondebosch · Student & Exec Gym', lat: -33.9620, lng: 18.4720, iconType: 'gym' },

  // ==========================================
  // Atlantic Seaboard / Promenade & Seaboard
  // ==========================================
  // Outdoors & Attractions
  { name: 'Sea Point Promenade', category: 'Sea Point · 11km Paved Oceanfront Sunset Strip', lat: -33.9160, lng: 18.3840, iconType: 'beach' },
  { name: 'Green Point Urban Park', category: 'Green Point · Biodiverse Botanical Park & Outdoor Trails', lat: -33.9045, lng: 18.4095, iconType: 'trail' },
  { name: 'Camps Bay Beach', category: 'Camps Bay · Palm-Lined White Sand Beach & Strip', lat: -33.9515, lng: 18.3780, iconType: 'beach' },
  { name: 'Clifton 4th Beach', category: 'Clifton · Wind-Sheltered Granite Boulder Cove', lat: -33.9390, lng: 18.3760, iconType: 'beach' },
  { name: 'Llandudno Beach', category: 'Llandudno · Picturesque Surf Beach & Sunset Rocks', lat: -34.0080, lng: 18.3410, iconType: 'beach' },

  // Gyms & Fitness
  { name: 'Virgin Active Green Point (Collection Club)', category: 'Green Point · Bill Peters Dr Collection Club & Olympic Lap Pool', lat: -33.906296, lng: 18.402848, iconType: 'gym' },
  { name: 'Virgin Active The Point (Sea Point)', category: 'Sea Point · The Point Mall 76 Regent Rd Club', lat: -33.920726, lng: 18.383306, iconType: 'gym' },
  { name: 'Anytime Fitness Sea Point', category: 'Sea Point · 142 Main Rd 24/7 Gym', lat: -33.913819, lng: 18.391226, iconType: 'gym' },
  { name: 'Ignite Fitness Green Point', category: 'Green Point · 122 Somerset Rd Strength Arena', lat: -33.9090, lng: 18.4120, iconType: 'gym' },
  { name: 'F45 Training Sea Point', category: 'Sea Point · 55 Regent Rd Functional Studio', lat: -33.9203, lng: 18.3842, iconType: 'gym' },
  { name: 'BUA Fitness Camps Bay', category: 'Camps Bay · The Promenade Victoria Rd Beachfront Gym', lat: -33.9515, lng: 18.3780, iconType: 'gym' },
  { name: 'SWEAT 1000 The Point', category: 'Sea Point · The Point Mall High-Intensity Studio', lat: -33.9206, lng: 18.3835, iconType: 'gym' },

  // Cafes & Bakeries
  { name: 'Jarryds Eatery & Bakery', category: 'Sea Point · 90 Regent Rd All-Day Brunch & Sourdough', lat: -33.9213, lng: 18.3828, iconType: 'cafe' },
  { name: 'Naked Coffee Sea Point', category: 'Sea Point · Wisbeach & Regent Rd Artisanal Espresso', lat: -33.9200, lng: 18.3848, iconType: 'cafe' },
  { name: 'Jason Bakery Green Point', category: 'Green Point · 83 Main Rd Celebrated Doughssants & Pastries', lat: -33.9085, lng: 18.4132, iconType: 'cafe' },
  { name: 'The Strangers Club', category: 'Green Point · 1 Braemar Rd Shaded Garden Courtyard Cafe', lat: -33.9098, lng: 18.4075, iconType: 'cafe' },
  { name: 'Pauline\'s Coffee & Wine', category: 'Sea Point · 297 Main Rd Minimalist Coffee Boutique', lat: -33.9182, lng: 18.3882, iconType: 'cafe' },
  { name: 'Mojo Market Food Hall', category: 'Sea Point · 30 Regent Rd 30+ Artisan Coffee & Food Stalls', lat: -33.919297, lng: 18.385825, iconType: 'cafe' },
  { name: 'De Waterkant Village Cafes', category: 'De Waterkant · Cape Quarter European Cobblestone Cafes', lat: -33.9160, lng: 18.4180, iconType: 'cafe' },

  // Shops & Retail Centres
  { name: 'The Point Mall (Sea Point)', category: 'Sea Point · 76 Regent Rd Checkers, Wellness & Dining', lat: -33.9207, lng: 18.3833, iconType: 'shop' },
  { name: 'Cape Quarter Lifestyle Village', category: 'Green Point · 27 Somerset Rd SPAR Gourmet & Boutiques', lat: -33.9165, lng: 18.4178, iconType: 'shop' },
  { name: 'V&A Waterfront Shopping Centre', category: 'Table Bay · Premier Flagship Mall, Dining & Marina', lat: -33.9040, lng: 18.4190, iconType: 'shop' },
  { name: 'Regent Road Retail Strip & SPAR', category: 'Sea Point · Walkable Artisan Grocers & Pharmacies', lat: -33.9195, lng: 18.3860, iconType: 'shop' },
  { name: 'Piazza Da Luz & Woolworths', category: 'Sea Point · 94 Regent Rd Woolworths Food & Boutiques', lat: -33.9218, lng: 18.3822, iconType: 'shop' },

  // ==========================================
  // City Bowl Enclaves
  // ==========================================
  // Outdoors & Attractions
  { name: 'Lion\'s Head Trailhead', category: 'City Bowl · Iconic Sunset Peak & Full Moon Hike', lat: -33.9350, lng: 18.3890, iconType: 'trail' },
  { name: 'Table Mountain Cableway', category: 'City Bowl · 7 New Wonders of Nature Aerial Station', lat: -33.9570, lng: 18.4030, iconType: 'attraction' },
  { name: 'Deer Park Trailhead', category: 'Vredehoek / Highlands · Scenic Foothill Trails', lat: -33.9430, lng: 18.4250, iconType: 'trail' },
  { name: 'Company\'s Garden', category: 'City Bowl · Historic Shaded Park & Tree Canopy', lat: -33.9275, lng: 18.4180, iconType: 'attraction' },

  // Gyms & Fitness
  { name: 'Virgin Active Wembley Square', category: 'Gardens · Wembley Square Flagship & 25m Lap Pool', lat: -33.932292, lng: 18.424188, iconType: 'gym' },
  { name: 'Virgin Active Kloof Street', category: 'Gardens · 50 Kloof Street Multi-Floor Health Club', lat: -33.929839, lng: 18.410876, iconType: 'gym' },
  { name: 'Roark Gyms Cape Town', category: 'Cape Town CBD · 130 Bree St Strength & Conditioning', lat: -33.924669, lng: 18.414300, iconType: 'gym' },
  { name: 'Zone Fitness Kloof Street', category: 'Gardens · Lifestyle on Kloof Cardio & Weights', lat: -33.9295, lng: 18.4105, iconType: 'gym' },
  { name: 'The Yard / SWEAT 1000 Kloof', category: 'Gardens · 70 Kloof St Functional Studio', lat: -33.9310, lng: 18.4100, iconType: 'gym' },
  { name: 'Virgin Active Silo District', category: 'V&A Silo · Waterfront Boutique Collection Club', lat: -33.9090, lng: 18.4230, iconType: 'gym' },

  // Cafes & Bakeries
  { name: 'Truth Coffee Roasting', category: 'Gardens Edge · 36 Buitenkant St Steampunk Roastery', lat: -33.9282, lng: 18.4225, iconType: 'cafe' },
  { name: 'Our Local (Kloof Street)', category: 'Gardens · 117 Kloof St Nursery Greenhouse Brunch', lat: -33.9348, lng: 18.4082, iconType: 'cafe' },
  { name: 'Molten Toffee (Kloof Street)', category: 'Gardens · 161 Kloof St Neighborhood Espresso', lat: -33.9378, lng: 18.4060, iconType: 'cafe' },
  { name: 'Manna Epicure (Kloof Street)', category: 'Gardens · 151 Kloof St French Bakery & Deli', lat: -33.9362, lng: 18.4070, iconType: 'cafe' },
  { name: 'Honest Chocolate & Gin Bar', category: 'City Centre · 64A Wale St Courtyard Cafe & Bakes', lat: -33.9228, lng: 18.4172, iconType: 'cafe' },
  { name: 'Red Sofa Cafe (Vredehoek)', category: 'Vredehoek · 21 Derry St Mountain View Cafe', lat: -33.9388, lng: 18.4282, iconType: 'cafe' },
  { name: 'Clark\'s Dining Room & Cafe', category: 'CBD · 109 Bree St Breakfast & Coffee Institution', lat: -33.9238, lng: 18.4168, iconType: 'cafe' },

  // Shops & Retail Centres
  { name: 'Gardens Shopping Centre', category: 'Gardens · Mill & Buitenkant St Woolies, Delis & Books', lat: -33.9328, lng: 18.4178, iconType: 'shop' },
  { name: 'Lifestyle on Kloof', category: 'Gardens · 50 Kloof St Woolworths Food & Wellness', lat: -33.9298, lng: 18.4108, iconType: 'shop' },
  { name: 'Spar Derry Street (Vredehoek)', category: 'Vredehoek · Derry St Gourmet Community Grocer', lat: -33.9392, lng: 18.4290, iconType: 'shop' },
  { name: 'Oranjezicht City Farm Market', category: 'Granger Bay · Cape Town Premier Organic Food Market', lat: -33.9015, lng: 18.4185, iconType: 'shop' },
  { name: 'Bree Street Boutique Strip', category: 'City Centre · Bree St Fashion & Concept Boutiques', lat: -33.9235, lng: 18.4165, iconType: 'shop' },

  // Garden Route (George & Wilderness)
  { name: 'Victoria Bay (Vic Bay)', category: 'Garden Route · World-Renowned Right-Hand Pointbreak', lat: -33.9830, lng: 22.5480, iconType: 'surf' },
  { name: 'Wilderness Beach', category: 'Wilderness · Endless Golden Coastline & Dolphin Viewing', lat: -33.9920, lng: 22.5850, iconType: 'beach' },
  { name: 'Witfontein Forestry Trails', category: 'George · Outeniqua Mountain Foothill MTB & Hikes', lat: -33.9350, lng: 22.4480, iconType: 'trail' },
  { name: 'Saasveld Nature Trails', category: 'George · Indigenous Riverine Forest Walkways', lat: -33.9620, lng: 22.5350, iconType: 'trail' },
  { name: 'Virgin Active George', category: 'George CBD · Full Racquet & Health Club', lat: -33.9610, lng: 22.4620, iconType: 'gym' },
  { name: 'Planet Fitness JustGym George', category: 'Knysna Road George · Cardio & Free Weights', lat: -33.9680, lng: 22.4550, iconType: 'gym' },
];

export function searchPlacesAndAttractions(query: string): PlaceSuggestion[] {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);

  // 1. Search curated places directory
  const placeMatches = SUGGESTED_PLACES_DIRECTORY.filter((place) => {
    const nameLow = place.name.toLowerCase();
    const catLow = place.category.toLowerCase();
    return tokens.every((tok) => nameLow.includes(tok) || catLow.includes(tok));
  });

  // 2. Also search SUBURBS_DIRECTORY to ensure all suburbs can be added as custom locations
  const suburbMatches: PlaceSuggestion[] = SUBURBS_DIRECTORY.filter((sub) => {
    const nameLow = sub.name.toLowerCase();
    const regLow = sub.region.toLowerCase();
    const aliasLow = (sub.aliases || []).join(' ').toLowerCase();
    return tokens.every((tok) => nameLow.includes(tok) || regLow.includes(tok) || aliasLow.includes(tok));
  }).map((sub) => ({
    name: sub.name,
    category: sub.region,
    lat: sub.lat,
    lng: sub.lng,
    iconType: 'general' as const,
  }));

  // Combine and deduplicate by name
  const seen = new Set<string>();
  const combined: PlaceSuggestion[] = [];

  for (const item of [...placeMatches, ...suburbMatches]) {
    const key = item.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(item);
    }
  }

  // Sort prefix matches first
  return combined.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q);
    const bStarts = b.name.toLowerCase().startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.name.localeCompare(b.name);
  }).slice(0, 8);
}

/**
 * Detailed privacy and dwelling classification.
 * Differentiates between explicit on-site landlord vs garden cottage / flatlet on shared property.
 */
export interface DwellingPrivacyInfo {
  isLandlordOnSite: boolean;
  isExplicitLandlord: boolean;
  isSecondaryDwelling: boolean;
  dwellingType: 'explicit_landlord' | 'garden_cottage' | 'flatlet' | 'shared_property' | 'independent';
  badgeLabel: string | null;
  shortFlag: string | null;
  aiInsightNote: string;
}

export function getDwellingPrivacyInfo(prop: {
  title?: string;
  address?: string;
  suburb?: string;
  dwelling_privacy?: string;
  is_landlord_on_site?: boolean;
  deep_ai_audit?: any;
  ai_insight?: string;
  description?: string;
  [key: string]: any;
}): DwellingPrivacyInfo {
  if (!prop) {
    return {
      isLandlordOnSite: false,
      isExplicitLandlord: false,
      isSecondaryDwelling: false,
      dwellingType: 'independent',
      badgeLabel: null,
      shortFlag: null,
      aiInsightNote: '🛡️ 100% Private Standalone',
    };
  }

  const fullText = [
    prop.title || '',
    prop.address || '',
    prop.suburb || '',
    prop.deep_ai_audit?.textVerdict || '',
    prop.deep_ai_audit?.personalMatchVerdict || '',
    prop.deep_ai_audit?.photoAudit || '',
    prop.ai_insight || '',
    prop.description || '',
  ].join(' ').toLowerCase();

  // 1. Explicit landlord / owner residing on-site
  const isExplicitLandlord =
    prop.is_landlord_on_site === true ||
    prop.dwelling_privacy === 'landlord_on_site' ||
    /\b(landlord lives|owner lives|landlord resides|owner resides|landlord on site|landlord on-site|owner on site|owner on-site|on owners? property|on landlords? property|suit quiet tenant as owner|main house occupied by owner|share with owner)\b/i.test(fullText);

  // 2. Garden cottage
  const isGardenCottage =
    prop.dwelling_privacy === 'garden_cottage' ||
    /\b(cottage|garden cottage|nutec cottage)\b/i.test(fullText);

  // 3. Flatlet / Granny flat / Separate entrance
  const isFlatlet =
    prop.dwelling_privacy === 'attached_flatlet' ||
    /\b(flatlet|granny flat|separate entrance|attached flatlet|bachelor flatlet|studio flatlet|wing of the house)\b/i.test(fullText);

  // 4. Other shared grounds
  const isSharedGrounds =
    prop.dwelling_privacy === 'room_shared' ||
    /\b(shared property|behind the main house|behind main house|attached to main house|shared yard|shared garden|shared gate|shared driveway|dual living)\b/i.test(fullText);

  const isSecondaryDwelling = isGardenCottage || isFlatlet || isSharedGrounds;
  const isLandlordOnSite = isExplicitLandlord || isSecondaryDwelling;

  if (isExplicitLandlord) {
    return {
      isLandlordOnSite: true,
      isExplicitLandlord: true,
      isSecondaryDwelling,
      dwellingType: 'explicit_landlord',
      badgeLabel: '⚠️ Landlord On-Site',
      shortFlag: 'Landlord On-Site',
      aiInsightNote: '⚠️ Verified landlord / owner residing on property',
    };
  }

  if (isGardenCottage) {
    return {
      isLandlordOnSite: true,
      isExplicitLandlord: false,
      isSecondaryDwelling: true,
      dwellingType: 'garden_cottage',
      badgeLabel: '🏡 Garden Cottage (Shared Grounds)',
      shortFlag: 'Garden Cottage',
      aiInsightNote: '🏡 Garden cottage on shared property (likely owner on-site)',
    };
  }

  if (isFlatlet) {
    return {
      isLandlordOnSite: true,
      isExplicitLandlord: false,
      isSecondaryDwelling: true,
      dwellingType: 'flatlet',
      badgeLabel: '🏡 Flatlet (Shared Property)',
      shortFlag: 'Flatlet',
      aiInsightNote: '🏡 Flatlet / separate entrance on shared property',
    };
  }

  if (isSharedGrounds) {
    return {
      isLandlordOnSite: true,
      isExplicitLandlord: false,
      isSecondaryDwelling: true,
      dwellingType: 'shared_property',
      badgeLabel: '⚠️ Shared Property',
      shortFlag: 'Shared Property',
      aiInsightNote: '⚠️ Shared grounds / secondary dwelling',
    };
  }

  return {
    isLandlordOnSite: false,
    isExplicitLandlord: false,
    isSecondaryDwelling: false,
    dwellingType: 'independent',
    badgeLabel: null,
    shortFlag: null,
    aiInsightNote: '🛡️ 100% Private Standalone',
  };
}

/**
 * Detects whether a property has an on-site landlord, is a cottage on shared property,
 * flatlet, granny flat, or secondary dwelling using structured metadata and AI text analysis.
 */
export function isLandlordOnSiteProperty(prop: any): boolean {
  return getDwellingPrivacyInfo(prop).isLandlordOnSite;
}

export interface AgencyReputationInfo {
  isPoorAgency: boolean;
  agencyName: string | null;
  rating: number | null;
  hellopeterRating: number | null;
  riskLevel: 'high' | 'moderate' | 'low' | 'direct_landlord' | 'unknown';
  shortFlag: string | null;
  badgeLabel: string | null;
  tooltipReason: string;
}

const KNOWN_POOR_LISTING_AGENCIES: Record<string, { name: string; rating: number; hp?: number; reason: string }> = {
  '117792741': {
    name: 'Progressive Housing Investments',
    rating: 1.5,
    hp: 1.8,
    reason: 'Progressive Housing Investments (PHI / Liesl & Giselle): 1.5★ rating — tenant complaints regarding strict exit inspections, deposit deductions, and rigid administration.',
  },
  '117763397': {
    name: 'Progressive Housing Investments',
    rating: 1.5,
    hp: 1.8,
    reason: 'Progressive Housing Investments (PHI / Liesl & Giselle): 1.5★ rating — tenant complaints regarding strict exit inspections, deposit deductions, and rigid administration.',
  },
  '117536179': {
    name: 'Progressive Housing Investments',
    rating: 1.5,
    hp: 1.8,
    reason: 'Progressive Housing Investments (PHI / Liesl & Giselle): 1.5★ rating — tenant complaints regarding strict exit inspections, deposit deductions, and rigid administration.',
  },
  '117772253': {
    name: 'Progressive Housing Investments',
    rating: 1.5,
    hp: 1.8,
    reason: 'Progressive Housing Investments (PHI / Liesl & Giselle): 1.5★ rating — tenant complaints regarding strict exit inspections, deposit deductions, and rigid administration.',
  },
  '117767952': {
    name: 'Progressive Housing Investments',
    rating: 1.5,
    hp: 1.8,
    reason: 'Progressive Housing Investments (PHI / Liesl & Giselle): 1.5★ rating — tenant complaints regarding strict exit inspections, deposit deductions, and rigid administration.',
  },
  '117711773': {
    name: 'Progressive Housing Investments',
    rating: 1.5,
    hp: 1.8,
    reason: 'Progressive Housing Investments (PHI / Liesl & Giselle): 1.5★ rating — tenant complaints regarding strict exit inspections, deposit deductions, and rigid administration.',
  },
  '117768867': {
    name: 'Progressive Housing Investments',
    rating: 1.5,
    hp: 1.8,
    reason: 'Progressive Housing Investments (PHI / Liesl & Giselle): 1.5★ rating — tenant complaints regarding strict exit inspections, deposit deductions, and rigid administration.',
  },
  '117766010': {
    name: 'Progressive Housing Investments',
    rating: 1.5,
    hp: 1.8,
    reason: 'Progressive Housing Investments (PHI / Liesl & Giselle): 1.5★ rating — tenant complaints regarding strict exit inspections, deposit deductions, and rigid administration.',
  },
  '117640938': {
    name: 'Progressive Housing Investments',
    rating: 1.5,
    hp: 1.8,
    reason: 'Progressive Housing Investments (PHI / Liesl & Giselle): 1.5★ rating — tenant complaints regarding strict exit inspections, deposit deductions, and rigid administration.',
  },
  '117772228': {
    name: 'Progressive Housing Investments',
    rating: 1.5,
    hp: 1.8,
    reason: 'Progressive Housing Investments (PHI / Liesl & Giselle): 1.5★ rating — tenant complaints regarding strict exit inspections, deposit deductions, and rigid administration.',
  },
  '117605725': {
    name: 'Progressive Housing Investments',
    rating: 1.5,
    hp: 1.8,
    reason: 'Progressive Housing Investments (PHI / Liesl & Giselle): 1.5★ rating — tenant complaints regarding strict exit inspections, deposit deductions, and rigid administration.',
  },
  '114232707': {
    name: 'Trafalgar Property Management',
    rating: 2.6,
    hp: 1.9,
    reason: 'Trafalgar Property Management: 2.6★ Google / 1.9★ HelloPeter — widespread complaints regarding delayed maintenance, billing penalties, and deposit disputes.',
  },
  '117575248': {
    name: 'Trafalgar Property Management',
    rating: 2.6,
    hp: 1.9,
    reason: 'Trafalgar Property Management: 2.6★ Google / 1.9★ HelloPeter — widespread complaints regarding delayed maintenance, billing penalties, and deposit disputes.',
  },
  '114324724': {
    name: 'Trafalgar Property Management',
    rating: 2.6,
    hp: 1.9,
    reason: 'Trafalgar Property Management: 2.6★ Google / 1.9★ HelloPeter — widespread complaints regarding delayed maintenance, billing penalties, and deposit disputes.',
  },
  '117750970': {
    name: 'Sandak Lewin Property Trust',
    rating: 2.8,
    hp: 2.2,
    reason: 'Sandak Lewin Property Trust: 2.8★ Google / 2.2★ HelloPeter — frequent tenant & owner complaints regarding slow communication turnaround and maintenance delays.',
  },
  '117643090': {
    name: 'Sandak Lewin Property Trust',
    rating: 2.8,
    hp: 2.2,
    reason: 'Sandak Lewin Property Trust: 2.8★ Google / 2.2★ HelloPeter — frequent tenant & owner complaints regarding slow communication turnaround and maintenance delays.',
  },
  '117628528': {
    name: 'Sandak Lewin Property Trust',
    rating: 2.8,
    hp: 2.2,
    reason: 'Sandak Lewin Property Trust: 2.8★ Google / 2.2★ HelloPeter — frequent tenant & owner complaints regarding slow communication turnaround and maintenance delays.',
  },
  '107131619': {
    name: 'City Living Rentals',
    rating: 2.9,
    hp: 2.3,
    reason: 'City Living Rentals: 2.9★ Google / 2.3★ HelloPeter — tenant complaints regarding deposit deductions and delayed maintenance response.',
  },
  '107079259': {
    name: 'City Living Rentals',
    rating: 2.9,
    hp: 2.3,
    reason: 'City Living Rentals: 2.9★ Google / 2.3★ HelloPeter — tenant complaints regarding deposit deductions and delayed maintenance response.',
  },
};

export function getAgencyReputationInfo(prop: any): AgencyReputationInfo {
  if (!prop) {
    return {
      isPoorAgency: false,
      agencyName: null,
      rating: null,
      hellopeterRating: null,
      riskLevel: 'unknown',
      shortFlag: null,
      badgeLabel: null,
      tooltipReason: '',
    };
  }

  const rawId = String(prop.p24_id || prop.id || '').replace(/^p24-/, '');
  const knownById = KNOWN_POOR_LISTING_AGENCIES[rawId];

  const textComb = `${prop.title || ''} ${prop.address || ''} ${prop.ai_insight || ''} ${(prop as any).description || ''}`.toLowerCase();
  const hasPhiTextSignature =
    textComb.includes('liesl') ||
    textComb.includes('giselle') ||
    textComb.includes('municipal home user charge') ||
    textComb.includes('progressive housing') ||
    textComb.includes('wireless pedestrian intercom access') ||
    textComb.includes('gleamed parquet');

  const agencyName: string | null =
    prop.agency_name ||
    knownById?.name ||
    (hasPhiTextSignature ? 'Progressive Housing Investments' : null);
  const rating: number | null =
    typeof prop.agency_rating === 'number'
      ? prop.agency_rating
      : knownById?.rating ?? (hasPhiTextSignature ? 1.5 : null);
  const hpRating: number | null =
    typeof prop.agency_hellopeter_rating === 'number'
      ? prop.agency_hellopeter_rating
      : knownById?.hp ?? (hasPhiTextSignature ? 1.8 : null);

  const nameLower = (agencyName || '').toLowerCase();
  const isKnownPoorBrand =
    nameLower.includes('trafalgar') ||
    nameLower.includes('watchprop') ||
    nameLower.includes('progressive housing') ||
    nameLower.includes('sandak lewin') ||
    nameLower.includes('sandak-lewin') ||
    nameLower.includes('city living');

  const isPoor =
    Boolean(knownById) ||
    prop.agency_risk_level === 'high' ||
    prop.agency_risk_level === 'poor' ||
    (rating !== null && rating < 3.2) ||
    (hpRating !== null && hpRating < 2.5) ||
    isKnownPoorBrand;

  if (isPoor) {
    const displayRating = rating ?? (nameLower.includes('trafalgar') ? 2.6 : nameLower.includes('watchprop') ? 2.7 : nameLower.includes('progressive') ? 1.5 : 2.8);
    const shortAgency =
      nameLower.includes('progressive housing')
        ? 'PHI'
        : nameLower.includes('trafalgar')
        ? 'Trafalgar'
        : nameLower.includes('watchprop')
        ? 'Watchprop'
        : nameLower.includes('sandak')
        ? 'Sandak Lewin'
        : agencyName
        ? agencyName.split(/\s+/).slice(0, 2).join(' ')
        : 'Agency';

    const reason =
      prop.agency_complaint_sample ||
      (Array.isArray(prop.agency_flags) && prop.agency_flags.length > 0 ? prop.agency_flags.join(' · ') : '') ||
      knownById?.reason ||
      `${agencyName || 'Managing agency'} has a poor public tenant rating (${displayRating}★). Exercise caution with deposit & maintenance terms.`;

    return {
      isPoorAgency: true,
      agencyName: agencyName || 'High-Risk Agency',
      rating: displayRating,
      hellopeterRating: hpRating,
      riskLevel: 'high',
      shortFlag: `🚩 Poor Agency (${displayRating}★)`,
      badgeLabel: `🚩 Poor Agency · ${shortAgency} (${displayRating}★)`,
      tooltipReason: reason,
    };
  }

  return {
    isPoorAgency: false,
    agencyName,
    rating,
    hellopeterRating: hpRating,
    riskLevel: (prop.agency_risk_level as any) || 'low',
    shortFlag: null,
    badgeLabel: null,
    tooltipReason: agencyName ? `Managed by ${agencyName}${rating ? ` (${rating}★)` : ''}` : '',
  };
}

export const CAPE_TOWN_SUBURB_MEDIANS: Record<string, Record<number, number>> = {
  // Specific micro-pockets first (matched longest-first)
  capricorn: { 0: 6800, 1: 9000, 2: 12500, 3: 16500 },
  'marina da gama': { 0: 7800, 1: 10000, 2: 14000, 3: 19500 },
  'costa da gama': { 0: 7500, 1: 9500, 2: 13500, 3: 18500 },
  northshore: { 0: 8500, 1: 11000, 2: 15000, 3: 21000 },
  'hout bay harbour': { 0: 8000, 1: 10500, 2: 14500, 3: 20000 },
  'scott estate': { 0: 10500, 1: 14000, 2: 19000, 3: 27000 },
  'berg en dal': { 0: 11000, 1: 14500, 2: 20000, 3: 28000 },
  'penzance estate': { 0: 10500, 1: 14000, 2: 19000, 3: 27000 },
  gardens: { 0: 13000, 1: 16500, 2: 22000, 3: 32000 },
  tamboerskloof: { 0: 13500, 1: 16800, 2: 23000, 3: 33000 },
  oranjezicht: { 0: 13000, 1: 16500, 2: 22500, 3: 32000 },
  higgovale: { 0: 15000, 1: 18000, 2: 26000, 3: 38000 },
  vredehoek: { 0: 12500, 1: 15500, 2: 21000, 3: 28000 },
  'sea point': { 0: 14000, 1: 17500, 2: 25000, 3: 36000 },
  'green point': { 0: 14000, 1: 17500, 2: 25000, 3: 36000 },
  'mouille point': { 0: 15000, 1: 19000, 2: 28000, 3: 42000 },
  'de waterkant': { 0: 14500, 1: 18000, 2: 26000, 3: 36000 },
  'camps bay': { 0: 17000, 1: 22000, 2: 35000, 3: 55000 },
  clifton: { 0: 22000, 1: 28000, 2: 45000, 3: 75000 },
  'bantry bay': { 0: 17000, 1: 22000, 2: 35000, 3: 52000 },
  bakoven: { 0: 17000, 1: 22000, 2: 35000, 3: 52000 },
  'hout bay': { 0: 9500, 1: 12500, 2: 17000, 3: 24000 },
  llandudno: { 0: 18000, 1: 24000, 2: 38000, 3: 60000 },
  noordhoek: { 0: 9000, 1: 12000, 2: 17500, 3: 26000 },
  kommetjie: { 0: 8500, 1: 11000, 2: 16000, 3: 23000 },
  scarborough: { 0: 8500, 1: 11000, 2: 16000, 3: 22000 },
  'fish hoek': { 0: 7500, 1: 9500, 2: 13500, 3: 18000 },
  'simons town': { 0: 8000, 1: 10000, 2: 14500, 3: 20000 },
  muizenberg: { 0: 8000, 1: 10500, 2: 14500, 3: 20000 },
  'kalk bay': { 0: 11000, 1: 14000, 2: 20000, 3: 28000 },
  'st james': { 0: 11000, 1: 14000, 2: 20000, 3: 28000 },
  clovelly: { 0: 8000, 1: 10000, 2: 14500, 3: 19000 },
  rondebosch: { 0: 9500, 1: 12500, 2: 17500, 3: 24000 },
  newlands: { 0: 11000, 1: 14000, 2: 20000, 3: 28000 },
  claremont: { 0: 10000, 1: 13000, 2: 18000, 3: 25000 },
  kenilworth: { 0: 9500, 1: 12000, 2: 16500, 3: 22000 },
  constantia: { 0: 12000, 1: 15000, 2: 22000, 3: 34000 },
  tokai: { 0: 9500, 1: 12000, 2: 17000, 3: 25000 },
  woodstock: { 0: 9000, 1: 11500, 2: 16000, 3: 22000 },
  observatory: { 0: 8500, 1: 11000, 2: 15500, 3: 21000 },
  capri: { 0: 7500, 1: 9500, 2: 13500, 3: 18000 },
  sunnydale: { 0: 8000, 1: 10000, 2: 14500, 3: 20000 },
  'sun valley': { 0: 8500, 1: 10500, 2: 15000, 3: 21000 }
};

export interface EmpiricalAreaMedianEntry {
  median_rent: number;
  median_sqm_rate?: number | null;
  count: number;
}

let empiricalMediansStore: Record<string, Record<string, EmpiricalAreaMedianEntry>> = {};

export function setEmpiricalMarketMedians(
  medians: Record<string, Record<string, EmpiricalAreaMedianEntry>>
) {
  empiricalMediansStore = medians || {};
}

export interface PropertyValuationContext {
  isInsideCrimeCore?: boolean;
  isInCrimeBuffer?: boolean;
  hasEstateSecurity?: boolean;
  isMainRoad?: boolean;
  isLandlordOnSite?: boolean;
  hasParking?: boolean;
}

export interface PropertyMarketValuation {
  medianPrice: number;
  baseMedianPrice: number;
  areaLabel: string;
  isEmpirical: boolean;
  pctDiff: number;
  isUnderpriced: boolean;
  isOverpriced: boolean;
  isFair: boolean;
  isRiskAdjusted: boolean;
  adjustmentNotes: string[];
  badgeText: string;
  badgeTooltip: string;
}

function formatAreaTitle(key: string): string {
  return key
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

export function getPropertyMarketValuation(
  prop: { price?: number; bedrooms?: number; suburb?: string; address?: string; sqm?: number; price_value_pct?: number | null },
  sampleContext?: Array<{ price?: number; bedrooms?: number; suburb?: string }>,
  riskContext?: PropertyValuationContext
): PropertyMarketValuation | null {
  const price = prop.price;
  if (!price || price <= 0) return null;

  const beds = Math.max(0, Math.min(3, Math.round(prop.bedrooms ?? 1)));
  const text = `${prop.address || ''} ${prop.suburb || ''}`.toLowerCase();
  const propSuburb = (prop.suburb || '').toLowerCase().trim();

  let baseMedianPrice: number | null = null;
  let medianSqmRate: number | null = null;
  let areaLabel = prop.suburb?.trim() || 'Area';
  let isEmpirical = false;

  // 1. Empirical cache-derived median + R/m² (when >= 4 cached listings exist for area + beds)
  for (const areaKey of Object.keys(CAPE_TOWN_SUBURB_MEDIANS)) {
    if (text.includes(areaKey)) {
      areaLabel = formatAreaTitle(areaKey);
      const emp = empiricalMediansStore[areaKey]?.[String(beds)];
      if (emp && emp.median_rent > 0) {
        baseMedianPrice = emp.median_rent;
        medianSqmRate = emp.median_sqm_rate ?? null;
        isEmpirical = true;
      }
      break;
    }
  }

  // 2. Curated micro-pocket / suburb baseline fallback
  if (!baseMedianPrice) {
    for (const [subName, bedMap] of Object.entries(CAPE_TOWN_SUBURB_MEDIANS)) {
      if (text.includes(subName)) {
        baseMedianPrice = bedMap[beds] || bedMap[1] || 16500;
        areaLabel = formatAreaTitle(subName);
        break;
      }
    }
  }

  // 3. Dynamic same-suburb sample median from active feed when >= 3 peers exist
  if (!baseMedianPrice && sampleContext && sampleContext.length >= 3) {
    const peers = sampleContext
      .filter((p) => {
        if (!p.price || p.price <= 0 || Math.round(p.bedrooms ?? 1) !== beds) return false;
        if (propSuburb && p.suburb) {
          return p.suburb.toLowerCase().trim() === propSuburb;
        }
        return true;
      })
      .map((p) => p.price as number)
      .sort((a, b) => a - b);
    if (peers.length >= 3) {
      const mid = Math.floor(peers.length / 2);
      baseMedianPrice = peers.length % 2 !== 0 ? peers[mid] : Math.round((peers[mid - 1] + peers[mid]) / 2);
      isEmpirical = true;
    }
  }

  if (!baseMedianPrice) {
    baseMedianPrice = 16500;
  }

  // Blend monthly rent median with area R/m² rate when sqm is known
  if (medianSqmRate && prop.sqm && prop.sqm >= 15) {
    const sqmExpected = Math.max(baseMedianPrice * 0.75, Math.min(baseMedianPrice * 1.35, medianSqmRate * prop.sqm));
    baseMedianPrice = Math.round((baseMedianPrice * 0.65 + sqmExpected * 0.35) / 100) * 100;
  }

  // 4. Real-world risk & friction adjustments on the expected median
  let multiplier = 1.0;
  const adjustmentNotes: string[] = [];

  if (riskContext?.isInsideCrimeCore) {
    const discount = riskContext.hasEstateSecurity ? 0.08 : 0.18;
    multiplier -= discount;
    adjustmentNotes.push(`-${Math.round(discount * 100)}% high-risk core${riskContext.hasEstateSecurity ? ' (estate mitigated)' : ''}`);
  } else if (riskContext?.isInCrimeBuffer) {
    const discount = riskContext.hasEstateSecurity ? 0.04 : 0.10;
    multiplier -= discount;
    adjustmentNotes.push(`-${Math.round(discount * 100)}% crime/township perimeter${riskContext.hasEstateSecurity ? ' (estate mitigated)' : ''}`);
  }

  if (riskContext?.isMainRoad) {
    multiplier -= 0.08;
    adjustmentNotes.push('-8% main-road arterial noise');
  }

  if (riskContext?.isLandlordOnSite) {
    multiplier -= 0.07;
    adjustmentNotes.push('-7% shared grounds / landlord on-site');
  }

  if (riskContext?.hasParking === false) {
    multiplier -= 0.05;
    adjustmentNotes.push('-5% street-only parking');
  }

  if (prop.sqm && prop.sqm > 0 && ((beds <= 1 && prop.sqm < 38) || (beds === 2 && prop.sqm < 55))) {
    multiplier -= 0.06;
    adjustmentNotes.push(`-6% compact floor area (${prop.sqm}m²)`);
  }

  multiplier = Math.max(0.65, Math.min(1.15, multiplier));
  const medianPrice = Math.round((baseMedianPrice * multiplier) / 100) * 100;
  const isRiskAdjusted = adjustmentNotes.length > 0;

  const rawDiff = ((price - medianPrice) / medianPrice) * 100;
  const pctDiff = Math.round(rawDiff);

  const isUnderpriced = pctDiff <= -3;
  const isOverpriced = pctDiff >= 3;
  const isFair = !isUnderpriced && !isOverpriced;

  const absPct = Math.abs(pctDiff);
  const badgeText = isUnderpriced
    ? `▼ ${absPct}% Under Value`
    : isOverpriced
    ? `▲ ${absPct}% Above Value`
    : `⚖️ Fair Market Value`;

  const sourceTag = isEmpirical ? 'live-cache' : 'baseline';
  const adjSummary = isRiskAdjusted ? `; risk-adjusted (${adjustmentNotes.join(', ')})` : '';
  const badgeTooltip = isUnderpriced
    ? `${absPct}% below ${areaLabel} ${isRiskAdjusted ? 'risk-adjusted ' : ''}median (${sourceTag}: R ${medianPrice.toLocaleString()}/mo for ${beds} Bed${adjSummary}).`
    : isOverpriced
    ? `${absPct}% above ${areaLabel} ${isRiskAdjusted ? 'risk-adjusted ' : ''}median (${sourceTag}: R ${medianPrice.toLocaleString()}/mo for ${beds} Bed${adjSummary}).`
    : `Priced in line with ${areaLabel} ${isRiskAdjusted ? 'risk-adjusted ' : ''}median (${sourceTag}: R ${medianPrice.toLocaleString()}/mo for ${beds} Bed${adjSummary}).`;

  return {
    medianPrice,
    baseMedianPrice,
    areaLabel,
    isEmpirical,
    pctDiff,
    isUnderpriced,
    isOverpriced,
    isFair,
    isRiskAdjusted,
    adjustmentNotes,
    badgeText,
    badgeTooltip,
  };
}



