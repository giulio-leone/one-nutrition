/**
 * Food Selector Worker Schema
 */

import { z } from 'zod';
import {
  NutritionRestrictionsSchema,
  MealTargetSchema,
  FoodItemSchema,
  MealTypeSchema,
} from '../../schema';

// ==================== INPUT ====================

export const FoodSelectorInputSchema = z.object({
  mealTargets: z.array(MealTargetSchema),
  mealStructure: z
    .array(
      z.object({
        type: MealTypeSchema,
        name: z.string(),
        foodCategories: z.array(z.string()),
      })
    )
    .optional(),
  restrictions: NutritionRestrictionsSchema,
  foodCatalog: z.array(FoodItemSchema).optional(),
});

// ==================== OUTPUT ====================

const SelectedFoodSchema = z.object({
  foodId: z.string(),
  name: z.string(),
  category: z.string().optional(),
  macrosPer100g: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fats: z.number(),
  }),
  suggestedMeals: z.array(MealTypeSchema).describe('Which meal types this food is suitable for'),
  priority: z.enum(['primary', 'secondary', 'optional']).default('secondary'),
});

export const FoodSelectorOutputSchema = z.object({
  selectedFoods: z.array(SelectedFoodSchema),
  proteinSources: z.array(z.string()).describe('IDs of protein-rich foods'),
  carbSources: z.array(z.string()).describe('IDs of carb-rich foods'),
  fatSources: z.array(z.string()).describe('IDs of fat-rich foods'),
  selectionRationale: z.string(),
});

// ==================== TYPE EXPORTS ====================

export type FoodSelectorInput = z.infer<typeof FoodSelectorInputSchema>;
export type FoodSelectorOutput = z.infer<typeof FoodSelectorOutputSchema>;
export type SelectedFood = z.infer<typeof SelectedFoodSchema>;
