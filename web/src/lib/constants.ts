export interface IntelligenceSource {
  id: string;
  label: string;
  color: string;
  type: 'standard' | 'pet';
}

/**
 * Canonical registry for intelligence discovery channels.
 */
export const INTELLIGENCE_SOURCES: IntelligenceSource[] = [
  { id: 'Property24', label: 'Property24', color: 'blue', type: 'standard' },
  { id: 'Property24 Pet Friendly', label: 'P24 (Pet)', color: 'emerald', type: 'pet' },
  { id: 'Sea Point Rentals', label: 'FB: Sea Point Rentals', color: 'indigo', type: 'standard' },
  { id: 'Huis Huis', label: 'FB: Huis Huis', color: 'rose', type: 'standard' },
  { id: 'Huis Huis Pet Friendly', label: 'FB: Huis Huis (Pet)', color: 'emerald', type: 'pet' },
  { id: 'RentUncle', label: 'RentUncle', color: 'orange', type: 'standard' },
  { id: 'RentUncle Pet Friendly', label: 'RentUncle (Pet)', color: 'emerald', type: 'pet' }
];

/**
 * Subscription mission quotas (Sync'd with Backend)
 */
export const TIER_LIMITS = {
  "free": 0,
  "bronze": 5,
  "silver": 5,
  "gold": 30
} as const;

export const TIER_FREQUENCIES = {
  "free": "Manual Only",
  "bronze": "24 Hours",
  "silver": "24 Hours",
  "gold": "30 Minutes"
} as const;
