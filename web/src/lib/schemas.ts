import { z } from 'zod';

/**
 * Validates and sanitizes raw property listing data from various sources (P24, FB, etc.)
 */
export const ListingSchema = z.object({
  id: z.string().optional(),
  title: z.preprocess(v => v ?? 'Unit', z.string()),
  price: z.number().nullable().optional().default(0),
  address: z.preprocess(v => v ?? 'Cape Town', z.string()),
  bedrooms: z.number().nullable().optional().default(0),
  bathrooms: z.number().nullable().optional().default(1),
  is_furnished: z.preprocess(v => v ?? false, z.boolean()),
  is_pet_friendly: z.preprocess(v => v ?? false, z.boolean()),
  property_type: z.preprocess(v => v ?? 'Unit', z.string()),
  property_sub_type: z.preprocess(v => v ?? 'Whole', z.string()),
  rental_type: z.preprocess(v => v ?? 'long-term', z.string()),
  available_date: z.preprocess(v => v ?? 'Immediate', z.string()),
  source_url: z.preprocess(v => v ?? '#', z.string()),
  platform: z.preprocess(v => v ?? 'HomeSeek', z.string()),
  created_at: z.any().optional(),
  match_reason: z.preprocess(v => v ?? '', z.string()),
});

export type Listing = z.infer<typeof ListingSchema>;

/**
 * Validates saved search alerts
 */
export const AlertSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().nullable().optional(),
  search_query: z.string().default('Untitled Search'),
  max_price: z.number().nullable().optional().default(0),
  min_bedrooms: z.any().optional(),
  pet_friendly: z.boolean().nullable().optional().default(false),
  rental_type: z.string().nullable().optional().default('all'),
  property_sub_type: z.string().nullable().optional().default('all'),
  created_at: z.any().optional()
});

export type Alert = z.infer<typeof AlertSchema>;
