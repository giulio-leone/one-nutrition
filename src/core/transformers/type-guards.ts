/**
 * Nutrition Type Guards
 *
 * Type-safe runtime validation for nutrition data structures.
 * Used to validate Json fields from Prisma and unknown data from external sources.
 */

import type {
  Macros,
  NutritionWeek,
  NutritionDay,
  Meal,
  Food,
  PersonalizedPlan,
  Adaptations,
} from '@onecoach/types';
import {
  MacrosSchema,
  CompleteMacrosSchema,
  FoodSchema,
  MealSchema,
  NutritionDaySchema,
  NutritionWeekSchema,
} from '@onecoach/schemas';

/**
 * Macros type guard
 */
export function isMacros(value: unknown): value is Macros {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.calories === 'number' &&
    typeof m.protein === 'number' &&
    typeof m.carbs === 'number' &&
    typeof m.fats === 'number' &&
    (m.fiber === undefined || typeof m.fiber === 'number')
  );
}

/**
 * Complete Macros type guard (with required fiber)
 */
export function isCompleteMacros(value: unknown): value is Macros & { fiber: number } {
  if (!isMacros(value)) return false;
  return typeof value.fiber === 'number';
}

/**
 * Food type guard
 * Uses Zod schema for validation to ensure consistency
 */
export function isFood(value: unknown): value is Food {
  if (!value || typeof value !== 'object') return false;
  // Use Zod schema for validation (more reliable than manual checks)
  const result = FoodSchema.safeParse(value);
  return result.success;
}

/**
 * Meal type guard
 * Uses Zod schema for validation to ensure consistency
 */
export function isMeal(value: unknown): value is Meal {
  if (!value || typeof value !== 'object') return false;
  // Use Zod schema for validation (more reliable than manual checks)
  const result = MealSchema.safeParse(value);
  return result.success;
}

/**
 * NutritionDay type guard
 * Uses Zod schema for validation to ensure consistency
 */
export function isNutritionDay(value: unknown): value is NutritionDay {
  if (!value || typeof value !== 'object') return false;
  // Use Zod schema for validation (more reliable than manual checks)
  const result = NutritionDaySchema.safeParse(value);
  return result.success;
}

/**
 * NutritionWeek type guard
 * Uses Zod schema for validation to ensure consistency
 */
export function isNutritionWeek(value: unknown): value is NutritionWeek {
  if (!value || typeof value !== 'object') return false;
  // Use Zod schema for validation (more reliable than manual checks)
  const result = NutritionWeekSchema.safeParse(value);
  return result.success;
}

/**
 * Array of NutritionWeek type guard
 */
export function isNutritionWeekArray(value: unknown): value is NutritionWeek[] {
  return Array.isArray(value) && value.every((w: unknown) => isNutritionWeek(w));
}

/**
 * Zod schema for Macros (for runtime validation)
 */
export const MacrosZodSchema = MacrosSchema;

/**
 * Zod schema for Complete Macros (with required fiber)
 */
export const CompleteMacrosZodSchema = CompleteMacrosSchema;

/**
 * Validate and parse Macros from unknown value
 */
export function parseMacrosSafe(value: unknown): Macros {
  const result = MacrosZodSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new Error(`Invalid Macros: ${result.error.message}`);
}

/**
 * Validate and parse Complete Macros from unknown value
 */
export function parseCompleteMacrosSafe(value: unknown): Macros & { fiber: number } {
  const result = CompleteMacrosZodSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  // Fallback: try base macros and default fiber to 0 to keep schema consistent
  const base = MacrosZodSchema.parse(value ?? {});
  return { ...base, fiber: base.fiber ?? 0 } as Macros & { fiber: number };
}

/**
 * Type guard for PersonalizedPlan
 */
export function isPersonalizedPlan(value: unknown): value is PersonalizedPlan {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    Array.isArray(p.customizations) &&
    Array.isArray(p.personalNotes) &&
    (p.motivationalMessage === undefined || typeof p.motivationalMessage === 'string')
  );
}

/**
 * Type guard for Adaptations
 */
export function isAdaptations(value: unknown): value is Adaptations {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return (
    (a.mealTimingAdjustments === undefined || Array.isArray(a.mealTimingAdjustments)) &&
    (a.portionAdjustments === undefined || Array.isArray(a.portionAdjustments)) &&
    (a.substitutions === undefined || Array.isArray(a.substitutions))
  );
}

/**
 * Type guard for metadata (Record<string, unknown> | null)
 */
export function isMetadata(value: unknown): value is Record<string, unknown> | null {
  return value === null || (typeof value === 'object' && !Array.isArray(value));
}
