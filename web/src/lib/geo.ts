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
  "virgin active kloof": [-33.9320, 18.4098],
  "virgin active point": [-33.9070, 18.4110],
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
  "uct campus": [-33.9575, 18.4605]
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

// Resolve any text or address to Cape Town coordinates
export function resolveLocationCoords(query: string): GeoLocation {
  const cleaned = (query || '').toLowerCase().trim();
  
  if (!cleaned) {
    return { lat: -33.9249, lng: 18.4241, label: 'Cape Town' };
  }

  // Exact or substring match in known places
  for (const [place, [lat, lng]] of Object.entries(KNOWN_CAPE_TOWN_PLACES)) {
    if (cleaned.includes(place) || place.includes(cleaned)) {
      return { lat, lng, label: query.split(',')[0].trim() || place };
    }
  }

  // Suburb fallbacks
  if (cleaned.includes('sea point') || cleaned.includes('seapoint')) {
    return { lat: -33.9180, lng: 18.3880, label: 'Sea Point', suburb: 'Sea Point' };
  }
  if (cleaned.includes('green point') || cleaned.includes('greenpoint')) {
    return { lat: -33.9085, lng: 18.4090, label: 'Green Point', suburb: 'Green Point' };
  }
  if (cleaned.includes('camps bay')) {
    return { lat: -33.9515, lng: 18.3780, label: 'Camps Bay', suburb: 'Camps Bay' };
  }
  if (cleaned.includes('gardens')) {
    return { lat: -33.9325, lng: 18.4120, label: 'Gardens', suburb: 'Gardens' };
  }
  if (cleaned.includes('tamboerskloof')) {
    return { lat: -33.9338, lng: 18.4055, label: 'Tamboerskloof', suburb: 'Tamboerskloof' };
  }
  if (cleaned.includes('hout bay')) {
    return { lat: -34.0450, lng: 18.3550, label: 'Hout Bay', suburb: 'Hout Bay' };
  }

  // Default City Bowl
  return { lat: -33.9315, lng: 18.4105, label: query.split(',')[0].trim() || 'Cape Town' };
}

