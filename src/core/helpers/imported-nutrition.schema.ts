import { z } from 'zod';

const MacrosSchema = z.object({
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fats: z.number().nonnegative(),
  fiber: z.number().nonnegative().optional(),
});

export const ImportedFoodSchema = z.object({
  id: z.string().optional(),
  foodItemId: z.string().optional(),
  name: z.string().optional(),
  quantity: z.number().nonnegative(),
  unit: z.string().default('g'),
  macros: MacrosSchema.optional(),
  notes: z.string().optional(),
});

export type ImportedFood = z.infer<typeof ImportedFoodSchema>;

export const ImportedMealSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: z.string().optional(),
  time: z.string().optional(),
  foods: z.array(ImportedFoodSchema).default([]),
  totalMacros: MacrosSchema.optional(),
  notes: z.string().optional(),
});

export type ImportedMeal = z.infer<typeof ImportedMealSchema>;

export const ImportedDaySchema = z.object({
  id: z.string().optional(),
  dayNumber: z.number().int().positive(),
  dayName: z.string().optional(),
  meals: z.array(ImportedMealSchema).default([]),
  totalMacros: MacrosSchema.optional(),
  waterIntake: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export type ImportedDay = z.infer<typeof ImportedDaySchema>;

export const ImportedWeekSchema = z.object({
  id: z.string().optional(),
  weekNumber: z.number().int().positive(),
  days: z.array(ImportedDaySchema).default([]),
  weeklyAverageMacros: MacrosSchema.optional(),
  notes: z.string().optional(),
});

export type ImportedWeek = z.infer<typeof ImportedWeekSchema>;

export const ImportedNutritionPlanSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  goals: z.array(z.string()).default(['MAINTENANCE']),
  durationWeeks: z.number().int().positive().default(4),
  targetMacros: MacrosSchema,
  weeks: z.array(ImportedWeekSchema).min(1),
  restrictions: z.array(z.string()).default([]),
  preferences: z.array(z.string()).default([]),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).default('ACTIVE'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ImportedNutritionPlan = z.infer<typeof ImportedNutritionPlanSchema>;
