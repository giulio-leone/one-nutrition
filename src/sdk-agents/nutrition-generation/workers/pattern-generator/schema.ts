/**
 * Pattern Generator Worker Schema
 *
 * This worker generates a complete day pattern (A, B, or C)
 * with all meals composed to hit macro targets.
 */

import { z } from 'zod';
import {
  NutritionRestrictionsSchema,
  NutritionUserProfileSchema,
  MealTargetSchema,
  PatternCodeSchema,
  MealTypeSchema,
  MacrosSchema,
} from '../../schema';

// ==================== INPUT ====================

const SelectedFoodInputSchema = z.object({
  foodId: z.string(),
  name: z.string(),
  macrosPer100g: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fats: z.number(),
  }),
  suggestedMeals: z.array(MealTypeSchema),
});

export const PatternGeneratorInputSchema = z.object({
  patternCode: PatternCodeSchema,
  mealTargets: z.array(MealTargetSchema),
  selectedFoods: z.array(SelectedFoodInputSchema),
  restrictions: NutritionRestrictionsSchema,
  userProfile: NutritionUserProfileSchema,
});

// ==================== OUTPUT ====================

const ComposedFoodSchema = z.object({
  id: z.string(),
  foodItemId: z.string(),
  name: z.string(),
  quantity: z.number().describe('Quantity in grams'),
  unit: z.string().default('g'),
  macros: MacrosSchema,
});

const ComposedMealSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: MealTypeSchema,
  time: z.string(),
  foods: z.array(ComposedFoodSchema).min(1),
  totalMacros: MacrosSchema,
});

export const PatternGeneratorOutputSchema = z.object({
  id: z.string(),
  patternCode: PatternCodeSchema,
  name: z.string(),
  description: z.string().optional(),
  meals: z.array(ComposedMealSchema).min(3),
  totalMacros: MacrosSchema,
  valid: z.boolean().default(true),
  compositionNotes: z.string().optional(),
});

// ==================== TYPE EXPORTS ====================

export type PatternGeneratorInput = z.infer<typeof PatternGeneratorInputSchema>;
export type PatternGeneratorOutput = z.infer<typeof PatternGeneratorOutputSchema>;
