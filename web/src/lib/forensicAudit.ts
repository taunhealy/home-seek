import {
  CAPE_TOWN_CRIME_HOTSPOTS,
  getCrimeDepthTier,
  getPropertyBusyRoadExposure,
  type PropertyMapItem,
} from '@/constants/capeTownGeo';
import {
  getDistanceKm,
  getDwellingPrivacyInfo,
  getPropertyMarketValuation,
  type PropertyValuationContext,
} from '@/lib/geo';

export function isPropertyInHighRiskCrimeZone(lat: number, lng: number): boolean {
  if (!lat || !lng) return false;
  for (const spot of CAPE_TOWN_CRIME_HOTSPOTS) {
    const tier = getCrimeDepthTier(spot);
    const isHigh = tier === 'high' || spot.risk_level.toLowerCase().includes('high');
    if (isHigh) {
      const distKm = getDistanceKm(lat, lng, spot.lat, spot.lng);
      if (distKm * 1000 <= spot.radius_m) {
        return true;
      }
    }
  }
  return false;
}

export interface CrimePerimeterInfo {
  isNearHighRisk: boolean;
  isInsideCore: boolean;
  distanceKm: number;
  hotspotName: string;
  hasEstateSecurity: boolean;
  shortFlag: string | null;
  tooltipReason: string;
}

export function getCrimePerimeterInfo(prop: {
  lat?: number;
  lng?: number;
  title?: string;
  address?: string;
  description?: string;
  ai_insight?: string;
  is_security_estate?: boolean;
  estate_name?: string | null;
}): CrimePerimeterInfo {
  const empty: CrimePerimeterInfo = {
    isNearHighRisk: false,
    isInsideCore: false,
    distanceKm: 99,
    hotspotName: '',
    hasEstateSecurity: false,
    shortFlag: null,
    tooltipReason: '',
  };
  if (!prop.lat || !prop.lng) return empty;

  const rawText = `${prop.title || ''} ${prop.address || ''} ${prop.description || ''} ${prop.ai_insight || ''}`.toLowerCase();
  const estateLabel = prop.estate_name || null;
  const hasEstateSecurity =
    Boolean(prop.is_security_estate) ||
    /\b(security\s+estate|gated\s+estate|gated\s+community|eco\s+estate|24.?h(our)?\s+security|24hr\s+security|manned\s+gate|boom\s+gate|biometric|electric\s+fenc|armed\s+response|access\s+control)\b/i.test(rawText);

  let closest: { spot: typeof CAPE_TOWN_CRIME_HOTSPOTS[number]; distM: number } | null = null;
  for (const spot of CAPE_TOWN_CRIME_HOTSPOTS) {
    const tier = getCrimeDepthTier(spot);
    const isHigh = tier === 'high' || spot.risk_level.toLowerCase().includes('high');
    if (!isHigh) continue;
    const distM = getDistanceKm(prop.lat, prop.lng, spot.lat, spot.lng) * 1000;
    const bufferM = spot.radius_m * 1.45;
    if (distM <= bufferM && (!closest || distM < closest.distM)) {
      closest = { spot, distM };
    }
  }

  if (!closest) return empty;

  const distKm = Math.round((closest.distM / 1000) * 10) / 10;
  const shortArea = closest.spot.name.split('(')[0].replace(/\s+Township.*$/i, '').trim();
  const isInsideCore = closest.distM <= closest.spot.radius_m;

  return {
    isNearHighRisk: true,
    isInsideCore,
    distanceKm: distKm,
    hotspotName: shortArea,
    hasEstateSecurity,
    shortFlag: hasEstateSecurity
      ? `Secured Estate${estateLabel ? ` (${estateLabel})` : ''} · ${distKm}km from ${shortArea}`
      : `Perimeter Risk · ${distKm}km from ${shortArea} (No Estate Security)`,
    tooltipReason: hasEstateSecurity
      ? `Within ${distKm} km of ${closest.spot.name}, mitigated by estate/complex access control.`
      : `Within ${distKm} km of ${closest.spot.name} without confirmed 24h estate/complex security — inspect burglar bars, perimeter walls & nighttime street lighting.`,
  };
}

export function isMainRoadProperty(address?: string, title?: string): boolean {
  const text = `${address || ''} ${title || ''}`.toLowerCase();
  return /\b(main\s+r(oa)?d|victoria\s+r(oa)?d|somerset\s+r(oa)?d|regent\s+r(oa)?d|kloof\s+st(reet)?|kloof\s+nek|buitengracht|new\s+church(\s+st(reet)?)?|orange\s+st(reet)?|roeland\s+st(reet)?|buitenkant(\s+st(reet)?)?|strand\s+st(reet)?|helen\s+suzman|mill\s+st(reet)?|voortrekker\s+r(oa)?d|ou\s+kaapse\s+weg|kommetjie\s+r(oa)?d|baden\s+powell|highway|freeway|motorway|m3|m4|m5|m6|m62)\b/i.test(text);
}

export function getRiskAdjustedValuation(
  prop: PropertyMapItem,
  sampleContext?: PropertyMapItem[]
) {
  const crime = getCrimePerimeterInfo(prop);
  const privacy = getDwellingPrivacyInfo(prop);
  const busy = getPropertyBusyRoadExposure(prop);
  const ctx: PropertyValuationContext = {
    isInsideCrimeCore: crime.isNearHighRisk && crime.isInsideCore,
    isInCrimeBuffer: crime.isNearHighRisk && !crime.isInsideCore,
    hasEstateSecurity: crime.hasEstateSecurity,
    isMainRoad: Boolean(prop.is_main_road) || isMainRoadProperty(prop.address, prop.title) || busy.isDirectlyOnRoad,
    isLandlordOnSite: privacy.isLandlordOnSite,
    hasParking: Boolean(prop.has_garage || prop.has_secure_bay),
  };
  return getPropertyMarketValuation(prop, sampleContext, ctx);
}

export function formatPrice(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatPriceAbbr(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || num <= 0) return '0';
  if (num >= 1000) {
    const k = num / 1000;
    return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return num.toString();
}
