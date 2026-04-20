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
  { id: 'Sea Point Rentals', label: 'Sea Point Rentals', color: 'indigo', type: 'standard' },
  { id: 'Huis Huis', label: 'Huis Huis', color: 'rose', type: 'standard' },
  { id: 'Huis Huis Pet Friendly', label: 'Huis Huis (Pet)', color: 'emerald', type: 'pet' },
  { id: 'RentUncle', label: 'RentUncle', color: 'orange', type: 'standard' },
  { id: 'RentUncle Pet Friendly', label: 'RentUncle (Pet)', color: 'emerald', type: 'pet' },
  { id: 'Facebook Marketplace', label: 'Facebook', color: 'blue', type: 'standard' }
];

/**
 * Subscription mission quotas (Sync'd with Backend)
 */
export const TIER_LIMITS = {
  "free": 0,
  "bronze": 1,
  "silver": 10,
  "gold": 100
} as const;
