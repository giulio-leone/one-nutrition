/**
 * Meal Planner Worker Schema
 */

import { z } from 'zod';
import {
  NutritionGoalsSchema,
  NutritionRestrictionsSchema,
  MealTargetSchema,
  MealTypeSchema,
} from '../../schema';

// ==================== INPUT ====================

export const MealPlannerInputSchema = z.object({
  goals: NutritionGoalsSchema,
  restrictions: NutritionRestrictionsSchema,
  mealTargets: z.array(MealTargetSchema),
});

// ==================== OUTPUT ====================

export const MealStructureSchema = z.object({
  type: MealTypeSchema,
  name: z.string(),
  time: z.string(),
  caloriePercentage: z.number(),
  foodCategories: z.array(z.string()).describe('Categories of foods to include'),
  portionGuidance: z.string().optional().describe('Guidance for portion sizes'),
});

export const MealPlannerOutputSchema = z.object({
  mealStructure: z.array(MealStructureSchema),
  dietaryNotes: z.string().optional(),
  rationale: z.string().describe('Explanation of meal timing and structure'),
});

// ==================== TYPE EXPORTS ====================

export type MealPlannerInput = z.infer<typeof MealPlannerInputSchema>;
export type MealPlannerOutput = z.infer<typeof MealPlannerOutputSchema>;
export type MealStructure = z.infer<typeof MealStructureSchema>;
