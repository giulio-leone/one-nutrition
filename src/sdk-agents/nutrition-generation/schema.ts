/**
 * Nutrition Generation Schema
 *
 * Input/Output schemas for the multi-agent nutrition generation system.
 * Mirrors the workout generation pattern for consistency.
 */

import { z } from 'zod';

// ==================== ENUMS ====================

export const NutritionGoalSchema = z.enum([
  'weight_loss',
  'muscle_gain',
  'maintenance',
  'performance',
]);

export const ActivityLevelSchema = z.enum([
  'SEDENTARY',
  'LIGHT',
  'MODERATE',
  'VERY_ACTIVE',
  'EXTRA_ACTIVE',
]);

export const MealTypeSchema = z.enum([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre-workout',
  'post-workout',
]);

export const PatternCodeSchema = z.enum(['A', 'B', 'C']);

// ==================== USER PROFILE ====================

export const NutritionUserProfileSchema = z.object({
  weight: z.number().describe('Weight in kg'),
  height: z.number().describe('Height in cm'),
  age: z.number(),
  gender: z.enum(['male', 'female', 'other']),
  activityLevel: ActivityLevelSchema,
});

// ==================== GOALS ====================

export const NutritionGoalsSchema = z.object({
  goal: NutritionGoalSchema,
  mealsPerDay: z.number().min(3).max(6).describe('Number of meals per day'),
  durationWeeks: z.number().min(1).max(12).describe('Plan duration in weeks'),
  patternsCount: z.number().min(1).max(3).default(2).describe('Number of day patterns (A, B, C)'),
});

// ==================== RESTRICTIONS ====================

export const NutritionRestrictionsSchema = z.object({
  dietType: z.string().optional().describe('e.g. vegetarian, vegan, pescatarian'),
  allergies: z.array(z.string()).default([]),
  intolerances: z.array(z.string()).default([]),
  preferredFoods: z.array(z.string()).default([]),
  excludedFoods: z.array(z.string()).default([]),
});

// ==================== FOOD ITEM ====================

export const FoodItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().optional(),
  macrosPer100g: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fats: z.number(),
    fiber: z.number().optional(),
  }),
  tags: z.array(z.string()).optional(),
});

// ==================== MACROS ====================

export const MacrosSchema = z.object({
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fats: z.number(),
  fiber: z.number().optional(),
});

// ==================== MEAL TARGET ====================

export const MealTargetSchema = z.object({
  type: MealTypeSchema,
  name: z.string(),
  time: z.string().describe('Time in HH:MM format'),
  caloriePercentage: z.number().describe('Percentage of daily calories'),
  targetMacros: MacrosSchema,
});

// ==================== MEAL FOOD ====================

export const MealFoodSchema = z.object({
  id: z.string(),
  foodItemId: z.string(),
  name: z.string(),
  quantity: z.number().describe('Quantity in grams'),
  unit: z.string().default('g'),
  macros: MacrosSchema,
});

// ==================== COMPOSED MEAL ====================

export const ComposedMealSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: MealTypeSchema,
  time: z.string(),
  foods: z.array(MealFoodSchema),
  totalMacros: MacrosSchema,
  variants: z.array(z.any()).optional(),
});

// ==================== DAY PATTERN ====================

export const DayPatternSchema = z.object({
  id: z.string(),
  patternCode: PatternCodeSchema,
  name: z.string(),
  description: z.string().optional(),
  meals: z.array(ComposedMealSchema),
  totalMacros: MacrosSchema,
  valid: z.boolean().default(true),
});

// ==================== MAIN INPUT ====================

export const NutritionGenerationInputSchema = z.object({
  userId: z.string(),
  userProfile: NutritionUserProfileSchema,
  goals: NutritionGoalsSchema,
  restrictions: NutritionRestrictionsSchema,
  foodCatalog: z.array(FoodItemSchema).optional().describe('Pre-loaded foods to use'),
});

// ==================== MAIN OUTPUT ====================

export const NutritionGenerationOutputSchema = z.object({
  plan: z.object({
    id: z.string(),
    userId: z.string(),
    name: z.string(),
    description: z.string().optional(),
    goals: z.array(z.string()),
    durationWeeks: z.number(),
    targetMacros: MacrosSchema,
    dayPatterns: z.array(DayPatternSchema),
    weeklyRotation: z.array(PatternCodeSchema),
    weeks: z.array(z.any()), // Complex nested structure
    restrictions: z.array(z.string()),
    preferences: z.array(z.string()),
    status: z.string(),
    version: z.number(),
    userProfile: NutritionUserProfileSchema,
    generationMetadata: z.object({
      method: z.string(),
      patternsCount: z.number(),
      selectedFoodsCount: z.number(),
      totalVariants: z.number(),
      generatedAt: z.string(),
    }),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  tokensUsed: z.number(),
  costUSD: z.number(),
  generatedAt: z.string(),
  metadata: z
    .object({
      mealsComposed: z.number().optional(),
      failedMeals: z.number().optional(),
      patternsCount: z.number().optional(),
    })
    .optional(),
});

// ==================== TYPE EXPORTS ====================

export type NutritionGoal = z.infer<typeof NutritionGoalSchema>;
export type ActivityLevel = z.infer<typeof ActivityLevelSchema>;
export type MealType = z.infer<typeof MealTypeSchema>;
export type PatternCode = z.infer<typeof PatternCodeSchema>;
export type NutritionUserProfile = z.infer<typeof NutritionUserProfileSchema>;
export type NutritionGoals = z.infer<typeof NutritionGoalsSchema>;
export type NutritionRestrictions = z.infer<typeof NutritionRestrictionsSchema>;
export type FoodItem = z.infer<typeof FoodItemSchema>;
export type Macros = z.infer<typeof MacrosSchema>;
export type MealTarget = z.infer<typeof MealTargetSchema>;
export type MealFood = z.infer<typeof MealFoodSchema>;
export type ComposedMeal = z.infer<typeof ComposedMealSchema>;
export type DayPattern = z.infer<typeof DayPatternSchema>;
export type NutritionGenerationInput = z.infer<typeof NutritionGenerationInputSchema>;
export type NutritionGenerationOutput = z.infer<typeof NutritionGenerationOutputSchema>;
