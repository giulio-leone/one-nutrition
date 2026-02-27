/**
 * Shopping Preferences Schema
 *
 * Zod validation schema for user shopping preferences.
 * Used when generating shopping lists from nutrition plans.
 */

import { z } from 'zod';

export const shoppingPreferencesSchema = z.object({
  /** Categories to exclude from shopping list */
  excludedCategories: z.array(z.string()).optional(),
  /** Preferred store or brand for items */
  preferredStore: z.string().optional(),
  /** Whether to sort items by category for store navigation */
  sortByCategory: z.boolean().optional(),
  /** Budget cap per shopping trip */
  budgetLimit: z.number().positive().optional(),
  /** Preferred units (metric vs imperial) */
  unitSystem: z.enum(['metric', 'imperial']).optional(),
  /** Additional notes for the shopping list */
  notes: z.string().optional(),
});

export type ShoppingPreferences = z.infer<typeof shoppingPreferencesSchema>;
