/**
 * Branded Types for Nutrition
 *
 * Type-safe IDs to prevent mix-ups between different entity types.
 * Following TypeScript best practices for nominal typing.
 */

/**
 * Branded type for NutritionPlan ID
 */
export type NutritionPlanId = string & { __brand: 'NutritionPlanId' };

/**
 * Branded type for FoodItem ID
 */
export type FoodItemId = string & { __brand: 'FoodItemId' };

/**
 * Branded type for Meal ID
 */
export type MealId = string & { __brand: 'MealId' };

/**
 * Branded type for NutritionDay ID
 */
export type NutritionDayId = string & { __brand: 'NutritionDayId' };

/**
 * Branded type for NutritionWeek ID
 */
export type NutritionWeekId = string & { __brand: 'NutritionWeekId' };

/**
 * Type guard to create NutritionPlanId from string
 */
export function asNutritionPlanId(id: string): NutritionPlanId {
  return id as NutritionPlanId;
}

/**
 * Type guard to create FoodItemId from string
 */
export function asFoodItemId(id: string): FoodItemId {
  return id as FoodItemId;
}

/**
 * Type guard to create MealId from string
 */
export function asMealId(id: string): MealId {
  return id as MealId;
}

/**
 * Type guard to create NutritionDayId from string
 */
export function asNutritionDayId(id: string): NutritionDayId {
  return id as NutritionDayId;
}

/**
 * Type guard to create NutritionWeekId from string
 */
export function asNutritionWeekId(id: string): NutritionWeekId {
  return id as NutritionWeekId;
}
