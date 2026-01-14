/**
 * Prisma Helper Functions
 *
 * Type-safe helpers for converting nutrition data to Prisma Json format.
 * Eliminates unsafe type assertions in API routes.
 *
 * NOTE: The `as unknown as Prisma.InputJsonValue` assertions are necessary
 * because Prisma's Json type is a branded type that requires explicit conversion.
 * These helpers ensure type safety at the call site while maintaining Prisma compatibility.
 */

import { Prisma } from '@onecoach/types';
import type {
  Adaptations,
  CompleteMacros,
  Macros,
  MealType,
  NutritionWeek,
  PersonalizedPlan,
  NutritionUserProfile,
} from '@onecoach/types';

/**
 * Convert Macros to Prisma Json format (type-safe)
 *
 * @param macros - Macros object to convert
 * @returns Prisma.InputJsonValue for use in Prisma create/update operations
 */
export function toPrismaJsonMacros(macros: Macros): Prisma.InputJsonValue {
  // Type assertion is safe: Macros is a plain object compatible with Json
  return macros as unknown as Prisma.InputJsonValue;
}

/**
 * Convert CompleteMacros to Prisma Json format (type-safe)
 *
 * @param macros - CompleteMacros object (with required fiber) to convert
 * @returns Prisma.InputJsonValue for use in Prisma create/update operations
 */
export function toPrismaJsonCompleteMacros(macros: CompleteMacros): Prisma.InputJsonValue {
  // Type assertion is safe: CompleteMacros is a plain object compatible with Json
  return macros as unknown as Prisma.InputJsonValue;
}

/**
 * Convert NutritionWeek[] to Prisma Json format (type-safe)
 * Accepts both full NutritionWeek[] and the persistence format (without id and weeklyAverageMacros)
 *
 * @param weeks - Array of NutritionWeek objects or persistence format
 * @returns Prisma.InputJsonValue for use in Prisma create/update operations
 */
export function toPrismaJsonWeeks(
  weeks:
    | NutritionWeek[]
    | Array<{
        weekNumber: number;
        notes?: string;
        days: Array<{
          dayNumber: number;
          dayName: string;
          date?: string;
          totalMacros: Macros;
          waterIntake?: number;
          notes?: string;
          meals: Array<{
            id: string;
            name: string;
            type: MealType;
            time?: string;
            notes?: string;
            totalMacros: Macros;
            foods: Array<{
              id: string;
              foodItemId: string;
              quantity: number;
              unit: string;
              notes?: string;
              done?: boolean;
              actualQuantity?: number;
              actualMacros?: Macros;
            }>;
          }>;
        }>;
      }>
): Prisma.InputJsonValue {
  // Type assertion is safe: NutritionWeek[] is a plain array of objects compatible with Json
  return weeks as unknown as Prisma.InputJsonValue;
}

/**
 * Generic helper per Json nullable
 */
export function toPrismaNullableJson<T>(value: T | null): Prisma.NullableJsonNullValueInput {
  if (value === null) {
    return Prisma.JsonNull;
  }
  return value as unknown as Prisma.NullableJsonNullValueInput;
}

export function toPrismaJsonPersonalizedPlan(
  plan: PersonalizedPlan | null
): Prisma.NullableJsonNullValueInput {
  return toPrismaNullableJson(plan);
}

export function toPrismaJsonAdaptations(
  adaptations: Adaptations | null
): Prisma.NullableJsonNullValueInput {
  return toPrismaNullableJson(adaptations);
}

export function toPrismaJsonUserProfile(
  userProfile: NutritionUserProfile | null
): Prisma.NullableJsonNullValueInput {
  return toPrismaNullableJson(userProfile);
}

/**
 * Convert metadata to Prisma Json format (type-safe, nullable)
 *
 * @param metadata - Metadata object or null
 * @returns Prisma.NullableJsonNullValueInput for use in Prisma create/update operations
 */
export function toPrismaJsonMetadata(
  metadata: Record<string, unknown> | null
): Prisma.NullableJsonNullValueInput {
  return toPrismaNullableJson(metadata);
}
